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

export interface WhatsAppDiagnosticsReport {
  timestamp: string;
  status: WhatsAppBotStatus;
  baileys: {
    isMakeWASocketFunction: boolean;
    isUseAuthStateFunction: boolean;
    hasDisconnectReason: boolean;
  };
  system: {
    nodeVersion: string;
    platform: string;
    arch: string;
    uptimeSeconds: number;
    memoryMb: number;
    pid: number;
  };
  session: {
    directory: string;
    exists: boolean;
    filesCount: number;
    files: string[];
    hasCreds: boolean;
    reconnectAttempts: number;
  };
  cloudBackup: {
    found: boolean;
    updatedAt: string | null;
  };
  recentLogs: Array<{
    time: string;
    level: "info" | "warn" | "error";
    message: string;
  }>;
}

export async function getWhatsAppDiagnostics(): Promise<WhatsAppDiagnosticsReport | null> {
  try {
    const res = await fetch('/api/whatsapp/debug');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Failed to load WhatsApp diagnostics:", err);
    return null;
  }
}
