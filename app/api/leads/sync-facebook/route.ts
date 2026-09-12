import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const rawToken = process.env.META_ACCESS_TOKEN;
    const targetPageId = process.env.META_PAGE_ID || '61590905900938';

    if (!rawToken || rawToken.startsWith('demo_')) {
      return NextResponse.json(
        { error: 'META_ACCESS_TOKEN is missing or not configured in Vercel environment variables.' },
        { status: 400 }
      );
    }

    // Default to yesterday at 18:00 (6:00 PM) local IST (UTC+5:30)
    const now = new Date();
    const yesterday6pm = new Date(now.getTime() - 24 * 3600 * 1000);
    yesterday6pm.setHours(18, 0, 0, 0);
    const sinceTimestampMs = yesterday6pm.getTime();

    const supabase = createAdminClient();

    // 1. Resolve effective Page Access Token (check /me/accounts in case a User token was provided)
    let effectiveToken = rawToken;
    try {
      const accountsRes = await fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${rawToken}`);
      const accountsJson = await accountsRes.json();
      if (accountsJson.data && Array.isArray(accountsJson.data)) {
        const pageMatch = accountsJson.data.find(
          (p: any) => p.id === targetPageId || (p.name && p.name.toLowerCase().includes('healing house'))
        );
        if (pageMatch?.access_token) {
          effectiveToken = pageMatch.access_token;
          console.log(`[Facebook Sync] Successfully resolved Page Access Token for ${pageMatch.name} (${pageMatch.id})`);
        }
      }
    } catch (tokenErr) {
      console.warn('[Facebook Sync] Token resolution fallback:', tokenErr);
    }

    // 2. Fetch Lead Ad Forms for the Page
    let forms: any[] = [];
    const formsUrl = `https://graph.facebook.com/v20.0/${targetPageId}/leadgen_forms?access_token=${effectiveToken}&fields=id,name,status`;
    const formsRes = await fetch(formsUrl);
    const formsData = await formsRes.json();

    if (formsData.data) {
      forms = formsData.data;
    } else if (formsData.error) {
      console.warn('[Facebook Sync] forms endpoint notice:', formsData.error);
      const meFormsRes = await fetch(`https://graph.facebook.com/v20.0/me/leadgen_forms?access_token=${effectiveToken}&fields=id,name,status`);
      const meFormsJson = await meFormsRes.json();
      if (meFormsJson.data) {
        forms = meFormsJson.data;
      } else {
        return NextResponse.json(
          { 
            error: `Meta API error: ${formsData.error.message || 'Permissions issue'}. Please ensure your Meta Access Token has 'leads_retrieval' and 'pages_read_engagement' permissions.`,
            details: formsData.error 
          },
          { status: 502 }
        );
      }
    }

    let totalFound = 0;
    let totalInserted = 0;
    let totalDuplicates = 0;
    const insertedLeads: any[] = [];

    // 3. Iterate through each Lead Form and fetch leads
    for (const form of forms) {
      const leadsUrl = `https://graph.facebook.com/v20.0/${form.id}/leads?fields=id,created_time,field_data&limit=100&access_token=${effectiveToken}`;
      
      try {
        const leadsRes = await fetch(leadsUrl);
        const leadsJson = await leadsRes.json();
        const fbLeads = leadsJson.data || [];

        for (const fbLead of fbLeads) {
          const leadCreatedTimeMs = new Date(fbLead.created_time).getTime();
          
          // Filter: only include leads created after yesterday 6 PM
          if (leadCreatedTimeMs < sinceTimestampMs) {
            continue;
          }

          totalFound++;
          const leadgenId = fbLead.id;
          let name = '';
          let phone = '';
          let formAnswers: Record<string, any> = {
            'Leadgen ID': leadgenId,
            'Form ID': form.id,
            'Form Name': form.name,
          };

          if (fbLead.field_data) {
            fbLead.field_data.forEach((field: any) => {
              const fieldName = (field.name || '').toLowerCase();
              const val = field.values?.[0] || '';
              
              if (
                fieldName.includes('full_name') || 
                fieldName.includes('first_name') || 
                fieldName.includes('name')
              ) {
                name = val;
              } else if (
                fieldName.includes('phone') || 
                fieldName.includes('mobile') || 
                fieldName.includes('contact') || 
                fieldName.includes('whatsapp') ||
                fieldName.includes('tel')
              ) {
                phone = val;
              } else {
                formAnswers[field.name || fieldName] = val;
              }
            });
          }

          if (!name) name = `FB Lead ${leadgenId}`;
          if (!phone) phone = '+919999900000';

          // Check if already in Supabase by phone
          const { data: existing } = await supabase
            .from('leads')
            .select('id')
            .eq('phone', phone)
            .limit(1);

          if (existing && existing.length > 0) {
            totalDuplicates++;
            continue;
          }

          // Insert into Supabase leads table
          const newLead = {
            name,
            phone,
            source: 'Facebook Lead Ads',
            campaign: form.name || `FB Form ${form.id}`,
            form_answers: formAnswers,
            status: 'unassigned',
            created_at: fbLead.created_time || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { data: inserted, error: insErr } = await supabase
            .from('leads')
            .insert(newLead)
            .select()
            .single();

          if (!insErr && inserted) {
            totalInserted++;
            insertedLeads.push(inserted);

            // Record in ingestion log
            await supabase.from('lead_ingestion_log').insert({
              meta_lead_id: leadgenId,
              name,
              phone,
              campaign: form.name || `FB Form ${form.id}`,
              status: 'success',
              created_at: fbLead.created_time || new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error(`[Error fetching leads for form ${form.id}]:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Historical sync complete! ${totalInserted} leads imported from Facebook.`,
      stats: {
        formsChecked: forms.length,
        leadsFound: totalFound,
        leadsInserted: totalInserted,
        duplicatesSkipped: totalDuplicates,
        sinceTime: yesterday6pm.toISOString(),
      },
      leads: insertedLeads,
    });
  } catch (error: any) {
    console.error('[Facebook Historical Leads Sync Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
