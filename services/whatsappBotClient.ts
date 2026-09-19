export interface WhatsAppBotStatus {
  isConnected: boolean;
  isConnecting: boolean;
  qrCodeDataUrl: string | null;
  userPhone: string | null;
  userName: string | null;
  error: string | null;
  lastConnectedAt: string | null;
}

export async function getWhatsAppBotStatus(): Promise<WhatsAppBotStatus> {
  try {
    const res = await fetch('/api/whatsapp/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return {
      isConnected: false,
      isConnecting: false,
      qrCodeDataUrl: null,
      userPhone: null,
      userName: null,
      error: err.message || 'تعذر الاتصال بالسيرفر',
      lastConnectedAt: null,
    };
  }
}

export async function connectWhatsAppBot(force = false): Promise<WhatsAppBotStatus> {
  try {
    const res = await fetch(`/api/whatsapp/connect${force ? '?force=true' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return {
      isConnected: false,
      isConnecting: false,
      qrCodeDataUrl: null,
      userPhone: null,
      userName: null,
      error: err.message || 'تعذر بدء الاتصال',
      lastConnectedAt: null,
    };
  }
}

export async function resetWhatsAppBot(): Promise<WhatsAppBotStatus> {
  return connectWhatsAppBot(true);
}

export async function disconnectWhatsAppBot(): Promise<WhatsAppBotStatus> {
  try {
    const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return {
      isConnected: false,
      isConnecting: false,
      qrCodeDataUrl: null,
      userPhone: null,
      userName: null,
      error: err.message || 'تعذر قطع الاتصال',
      lastConnectedAt: null,
    };
  }
}

export async function sendWhatsAppBotMessage(params: {
  toPhone: string;
  message: string;
  pdfBase64?: string;
  pdfFileName?: string;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'فشل إرسال الرسالة عبر الخادم',
    };
  }
}
