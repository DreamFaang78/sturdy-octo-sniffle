import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const accessToken = process.env.META_ACCESS_TOKEN;
    const pageId = process.env.META_PAGE_ID || '61590905900938';

    if (!accessToken || accessToken.startsWith('demo_')) {
      return NextResponse.json(
        { error: 'META_ACCESS_TOKEN is missing or not configured in environment variables.' },
        { status: 400 }
      );
    }

    // Default to yesterday at 18:00 (6:00 PM) local IST (UTC+5:30)
    // 6 PM IST yesterday in unix timestamp
    const now = new Date();
    const yesterday6pm = new Date(now.getTime() - 24 * 3600 * 1000);
    yesterday6pm.setHours(18, 0, 0, 0);
    const sinceTimestamp = Math.floor(yesterday6pm.getTime() / 1000);

    const supabase = createAdminClient();

    // 1. Fetch all Lead Ad Forms associated with the Facebook Page
    const formsUrl = `https://graph.facebook.com/v20.0/${pageId}/leadgen_forms?access_token=${accessToken}&fields=id,name,status`;
    const formsRes = await fetch(formsUrl);
    const formsData = await formsRes.json();

    if (formsData.error) {
      console.error('[Facebook Sync API Error - Forms]:', formsData.error);
      return NextResponse.json(
        { error: formsData.error.message || 'Failed to fetch Lead Forms from Facebook Graph API.' },
        { status: 502 }
      );
    }

    const forms = formsData.data || [];
    let totalFound = 0;
    let totalInserted = 0;
    let totalDuplicates = 0;
    const insertedLeads: any[] = [];

    // 2. Iterate through each Lead Form and fetch leads created since yesterday 6 PM
    for (const form of forms) {
      const leadsUrl = `https://graph.facebook.com/v20.0/${form.id}/leads?fields=id,created_time,field_data&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${sinceTimestamp}}]&access_token=${accessToken}&limit=100`;
      
      try {
        const leadsRes = await fetch(leadsUrl);
        const leadsJson = await leadsRes.json();
        const fbLeads = leadsJson.data || [];

        for (const fbLead of fbLeads) {
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

            // Also record in ingestion log
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
      message: `Historical sync complete. ${totalInserted} new leads imported from Facebook.`,
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
