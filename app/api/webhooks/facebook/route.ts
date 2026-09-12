import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { INITIAL_INGESTION_LOGS, INITIAL_LEADS } from '@/lib/mockDb';


// Helper function: Fetch from Meta Graph API with Retry & Exponential Backoff
async function fetchGraphApiWithRetry(url: string, maxRetries = 3, initialDelayMs = 1000): Promise<any> {
  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt < maxRetries) {
    try {
      attempt++;
      console.log(`[Meta Graph API Fetch Attempt ${attempt}/${maxRetries}]: ${url}`);
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
      const errText = await res.text();
      console.warn(`[Meta Graph API Retryable Error] Attempt ${attempt} failed: ${res.status} ${errText}`);
    } catch (err) {
      console.warn(`[Meta Graph API Network Exception] Attempt ${attempt} failed:`, err);
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }

  throw new Error(`Meta Graph API call failed after ${maxRetries} attempts.`);
}

// GET verification request from Meta Developers setup
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedToken = process.env.META_VERIFY_TOKEN || 'hommed_lead_crm_verify_token_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Meta Webhook Verified] Successfully verified webhook endpoint.');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// POST notification when a Facebook/Instagram Lead Ad form is submitted
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[Meta Lead Webhook Payload Received]:', JSON.stringify(body));

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (value?.leadgen_id) {
      const leadgenId = value.leadgen_id;
      const pageId = value.page_id;
      const formId = value.form_id;

      let name = '';
      let phone = '';
      let campaign = `FB Form ${formId || ''}`;
      let formAnswers: Record<string, any> = {};
      let graphApiFailed = false;
      let apiErrorMessage = '';

      const accessToken = process.env.META_ACCESS_TOKEN;
      const supabase = createAdminClient();

      // 1. Fetch full lead payload from Meta Graph API if access token is set
      if (accessToken && !accessToken.startsWith('demo_')) {
        try {
          const graphUrl = `https://graph.facebook.com/v20.0/${leadgenId}?access_token=${accessToken}`;
          const graphData = await fetchGraphApiWithRetry(graphUrl, 3, 1000);

          if (graphData?.field_data) {
            graphData.field_data.forEach((field: any) => {
              const fieldName = field.name?.toLowerCase() || '';
              const val = field.values?.[0] || '';
              
              if (fieldName.includes('full_name') || fieldName.includes('name')) {
                name = val;
              } else if (fieldName.includes('phone') || fieldName.includes('mobile')) {
                phone = val;
              } else {
                formAnswers[field.name || fieldName] = val;
              }
            });
          }
        } catch (graphErr: any) {
          console.error('[Meta Graph API Failure]:', graphErr);
          graphApiFailed = true;
          apiErrorMessage = graphErr.message || String(graphErr);
        }
      } else {
        // Fallback for testing/mock payload if Meta token not configured
        name = value.created_name || value.name || 'New Facebook Lead';
        phone = value.phone_number || value.phone || '+919999900000';
        formAnswers = value.form_answers || { 'Leadgen ID': leadgenId, 'Page ID': pageId };
      }

      // 2. Handle Graph API Error — create partial lead instead of dropping it
      if (graphApiFailed) {
        console.warn('[Meta Webhook] Graph API failed — creating partial lead from webhook payload.');

        const errLogData = {
          meta_lead_id: leadgenId,
          name: 'Facebook Lead (pending enrichment)',
          phone: null,
          campaign,
          status: 'api_error',
          error_detail: `Graph API call failed after retries: ${apiErrorMessage}. Lead captured as partial — needs manual enrichment.`,
          raw_payload: body,
          created_at: new Date().toISOString(),
        };
        await supabase.from('lead_ingestion_log').insert(errLogData);
        INITIAL_INGESTION_LOGS.unshift({ id: `ingest-${Date.now()}`, ...errLogData, status: 'api_error' });

        // Still create a partial lead so it is not lost
        const partialLead = {
          name: `Facebook Lead — ${leadgenId}`,
          phone: null,
          source: 'Facebook Lead Ads',
          campaign,
          form_answers: { 'Leadgen ID': leadgenId, 'Page ID': pageId, 'Form ID': formId, note: 'Graph API enrichment failed — token may be expired' },
          status: 'unassigned',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await supabase.from('leads').insert(partialLead);

        return NextResponse.json({
          success: true,
          status: 'partial_lead_created',
          message: 'Lead captured without enrichment — Graph API token may be expired',
          meta_lead_id: leadgenId,
        });
      }

      // 3. Handle Mapping Error if Phone is missing
      if (!phone || phone.trim() === '') {
        const logData = {
          meta_lead_id: leadgenId,
          name: name || 'Unmapped Lead',
          phone: null,
          campaign,
          status: 'mapping_error',
          error_detail: 'Lead payload extracted, but phone number field was missing or empty.',
          raw_payload: body,
          created_at: new Date().toISOString(),
        };

        await supabase.from('lead_ingestion_log').insert(logData);
        INITIAL_INGESTION_LOGS.unshift({ id: `ingest-${Date.now()}`, ...logData, status: 'mapping_error' });

        return NextResponse.json(
          { success: false, error: 'Phone number mapping error', meta_lead_id: leadgenId },
          { status: 422 }
        );
      }

      // 4. Duplicate Check by phone
      let isDuplicate = false;
      const { data: existingLeads } = await supabase
        .from('leads')
        .select('id, name, phone')
        .eq('phone', phone)
        .limit(1);

      if (existingLeads && existingLeads.length > 0) {
        isDuplicate = true;
      } else {
        // Fallback check against mock DB if Supabase DB empty
        if (INITIAL_LEADS.some((l) => l.phone === phone)) {
          isDuplicate = true;
        }
      }

      if (isDuplicate) {
        const logData = {
          meta_lead_id: leadgenId,
          name,
          phone,
          campaign,
          status: 'duplicate',
          error_detail: `Skipped insertion into leads queue — phone ${phone} already exists in database.`,
          raw_payload: body,
          created_at: new Date().toISOString(),
        };

        await supabase.from('lead_ingestion_log').insert(logData);
        INITIAL_INGESTION_LOGS.unshift({ id: `ingest-${Date.now()}`, ...logData, status: 'duplicate' });

        return NextResponse.json({
          success: true,
          status: 'duplicate_skipped',
          message: 'Duplicate lead acknowledged and skipped',
          phone,
        });
      }

      // 5. Successful Lead Ingestion & Database Insert
      const newLead = {
        name,
        phone,
        source: 'Facebook Lead Ads',
        campaign,
        form_answers: formAnswers,
        status: 'unassigned',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: insertedLead, error: dbError } = await supabase
        .from('leads')
        .insert(newLead)
        .select()
        .single();

      if (dbError) {
        console.error('[Supabase Webhook Insert Error]:', dbError);
      }

      // Record Success Log
      const successLogData = {
        meta_lead_id: leadgenId,
        name,
        phone,
        campaign,
        status: 'success',
        raw_payload: body,
        created_at: new Date().toISOString(),
      };

      await supabase.from('lead_ingestion_log').insert(successLogData);
      INITIAL_INGESTION_LOGS.unshift({ id: `ingest-${Date.now()}`, ...successLogData, status: 'success' });

      return NextResponse.json({
        success: true,
        message: 'Lead processed successfully and logged to intake feed',
        leadId: insertedLead?.id || leadgenId,
      });

    }

    return NextResponse.json({ success: true, message: 'Event acknowledged' });
  } catch (err: any) {
    console.error('[Meta Webhook Handler Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

