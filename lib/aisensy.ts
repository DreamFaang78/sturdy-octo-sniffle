export interface SendWhatsAppParams {
  apiKey?: string;
  destinationPhone: string;
  campaignName: string;
  userName?: string;
  leadId?: string;
  sourceParams?: Record<string, string>;
  mediaUrl?: string;
}

export interface SendWhatsAppResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export async function sendAiSensyWhatsAppMessage(
  params: SendWhatsAppParams
): Promise<SendWhatsAppResult> {
  const apiKey = params.apiKey || process.env.AISENSY_API_KEY;

  if (!apiKey || apiKey === 'demo_aisensy_api_key' || apiKey.startsWith('your-')) {
    console.log('[AiSensy Simulation] Message dispatched (Demo mode active):', params);
    return {
      success: true,
      message: 'Simulated WhatsApp message sent successfully via AiSensy (Demo Mode)',
      data: {
        msgId: `mock-msg-${Date.now()}`,
        status: 'sent',
        destination: params.destinationPhone,
        campaign: params.campaignName,
        mediaUrl: params.mediaUrl || null,
      },
    };
  }

  try {
    const payload: Record<string, any> = {
      apiKey,
      campaignName: params.campaignName,
      destination: params.destinationPhone.replace(/[^0-9]/g, ''),
      userName: params.userName || 'Valued Patient',
      source: 'Hommed Lead CRM',
      params: params.sourceParams ? Object.values(params.sourceParams) : [],
    };

    if (params.mediaUrl) {
      payload.media = {
        url: params.mediaUrl,
        filename: 'diet_chart.jpg',
      };
    }


    const response = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && (data.success || data.status === 'success')) {
      return {
        success: true,
        message: 'WhatsApp message sent successfully',
        data,
      };
    }

    return {
      success: false,
      message: data.message || 'AiSensy API request failed',
      error: JSON.stringify(data),
    };
  } catch (err: any) {
    console.error('[AiSensy Error]', err);
    return {
      success: false,
      message: err.message || 'Network error communicating with AiSensy REST API',
      error: String(err),
    };
  }
}
