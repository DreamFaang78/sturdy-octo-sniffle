import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_WHATSAPP_TEMPLATES, substituteTemplateVariables, formatPhoneNumber } from '@/lib/whatsapp';
import { WhatsAppTemplateType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { leadId, lead: providedLead, callerId, callerName, templateType } = body;

    if (!templateType || !['not_picked', 'follow_up', 'order_confirmed'].includes(templateType)) {
      return NextResponse.json(
        { error: 'Valid templateType (not_picked, follow_up, order_confirmed) is required' },
        { status: 400 }
      );
    }

    // 1. Resolve Lead Data
    let leadData = providedLead;
    if (!leadData && leadId) {
      const { data: dbLead, error: leadErr } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (!leadErr && dbLead) {
        leadData = dbLead;
      }
    }

    if (!leadData) {
      return NextResponse.json({ error: 'Lead data or valid leadId is required' }, { status: 400 });
    }

    // 2. Validate Phone Number
    const rawPhone = leadData.phone || '';
    const formattedPhone = formatPhoneNumber(rawPhone);

    if (!formattedPhone || formattedPhone.length < 10) {
      return NextResponse.json(
        { error: `Invalid or missing phone number on lead record (${rawPhone || 'none'})` },
        { status: 400 }
      );
    }

    // 3. Fetch Template from Supabase
    let templateText = DEFAULT_WHATSAPP_TEMPLATES[templateType as WhatsAppTemplateType]?.text || '';
    let campaignName = DEFAULT_WHATSAPP_TEMPLATES[templateType as WhatsAppTemplateType]?.campaignName || templateType;

    try {
      const { data: tmplData } = await supabase
        .from('whatsapp_templates')
        .select('message_text')
        .eq('template_type', templateType)
        .single();

      if (tmplData?.message_text && tmplData.message_text.trim().length > 0) {
        templateText = tmplData.message_text;
      }
    } catch (e) {
      // Fallback to default
    }

    if (!templateText || templateText.trim().length === 0) {
      return NextResponse.json(
        { error: `WhatsApp template for '${templateType}' is empty. Please configure it in Admin settings.` },
        { status: 400 }
      );
    }

    // 4. Substitute Variables
    const finalMessage = substituteTemplateVariables(templateText, leadData);

    // 5. Send via AiSensy API
    const aisensyApiKey = process.env.AISENSY_API_KEY;
    let sendStatus: 'sent' | 'failed' = 'sent';
    let aisensyResponse: any = null;
    let errorMessage: string | null = null;

    if (aisensyApiKey && aisensyApiKey !== 'demo_aisensy_key') {
      try {
        const envCampaign = process.env[`AISENSY_CAMPAIGN_${templateType.toUpperCase()}`];
        const activeCampaignName = envCampaign || campaignName;

        const aisensyPayload = {
          apiKey: aisensyApiKey,
          campaignName: activeCampaignName,
          destination: formattedPhone,
          userName: leadData.name || 'Customer',
          templateParams: [
            leadData.name || 'Customer',
            leadData.city || leadData.form_answers?.city || 'your location',
          ],
          message: finalMessage,
          source: 'hommed_crm',
          tags: ['crm_quick_send', templateType],
        };

        const res = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(aisensyPayload),
        });

        const resJson = await res.json().catch(() => ({}));
        aisensyResponse = resJson;

        if (!res.ok || resJson.success === false || resJson.status === 'error') {
          sendStatus = 'failed';
          errorMessage =
            resJson.message ||
            resJson.error ||
            `AiSensy HTTP ${res.status}: ${res.statusText || 'Failed to dispatch WhatsApp message'}`;
        }
      } catch (err: any) {
        sendStatus = 'failed';
        errorMessage = `Network / AiSensy connection error: ${err.message}`;
        aisensyResponse = { error: err.message };
      }
    } else {
      // Simulated / Direct Fallback when AISENSY_API_KEY is not configured yet
      aisensyResponse = {
        mode: 'simulated_success',
        note: 'AISENSY_API_KEY not configured in env. Message prepared and logged.',
        sent_message: finalMessage,
      };
      sendStatus = 'sent';
    }

    // 6. Log to Supabase whatsapp_logs table
    try {
      await supabase.from('whatsapp_logs').insert({
        lead_id: leadData.id ? String(leadData.id) : null,
        caller_id: callerId || null,
        template_type: templateType,
        final_message_sent: finalMessage,
        status: sendStatus,
        aisensy_response: aisensyResponse,
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error('Failed to write to whatsapp_logs table:', logErr);
    }

    // Direct wa.me fallback link
    const waLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(finalMessage)}`;

    if (sendStatus === 'failed') {
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          finalMessage,
          waLink,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: sendStatus,
      leadName: leadData.name || 'Customer',
      phone: formattedPhone,
      message: finalMessage,
      waLink,
      aisensy: aisensyResponse,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
