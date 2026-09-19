import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  ConnectionState
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export interface WhatsAppBotStatus {
  isConnected: boolean;
  isConnecting: boolean;
  qrCodeDataUrl: string | null;
  userPhone: string | null;
  userName: string | null;
  error: string | null;
  lastConnectedAt: string | null;
}

const SUPABASE_URL = "https://hoeealjgmfjbojjyodql.supabase.co";
const SUPABASE_KEY = "sb_publishable_Vq7v3naqK8moAXa-L8EwOw_Rpjc55mw";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let sock: WASocket | null = null;
let currentStatus: WhatsAppBotStatus = {
  isConnected: false,
  isConnecting: false,
  qrCodeDataUrl: null,
  userPhone: null,
  userName: null,
  error: null,
  lastConnectedAt: null,
};

let isManualDisconnect = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let connectingPromise: Promise<WhatsAppBotStatus> | null = null;
let saveCloudTimer: NodeJS.Timeout | null = null;

const sessionDir = path.join(process.cwd(), "whatsapp_session");

function ensureSessionDir() {
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
}

export function hasExistingSession(): boolean {
  try {
    if (!fs.existsSync(sessionDir)) return false;
    const files = fs.readdirSync(sessionDir);
    return files.some(f => f.startsWith("creds.json") || f.includes("session"));
  } catch (e) {
    return false;
  }
}

/**
 * Backup all WhatsApp session credentials from local disk to Supabase settings table
 * so that any device or newly created container automatically shares and restores the same session.
 */
export async function saveSessionToCloud(): Promise<boolean> {
  try {
    ensureSessionDir();
    const fileNames = fs.readdirSync(sessionDir);
    if (!fileNames.includes("creds.json")) {
      return false;
    }

    const files: Record<string, string> = {};
    for (const f of fileNames) {
      const fullPath = path.join(sessionDir, f);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          files[f] = fs.readFileSync(fullPath).toString("base64");
        }
      } catch (readErr) {
        console.warn(`[WhatsApp Bot] Could not read session file ${f}:`, readErr);
      }
    }

    if (!files["creds.json"]) {
      return false;
    }

    const { error: sessionError } = await supabase.from("settings").upsert({
      key: "whatsapp_bot_session_backup",
      value: {
        files,
        updatedAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }, { onConflict: "key" });

    if (sessionError) {
      console.error("[WhatsApp Bot] Failed to backup session to Supabase:", sessionError);
      return false;
    }

    // Also persist connection metadata in Supabase
    await supabase.from("settings").upsert({
      key: "whatsapp_bot_status",
      value: {
        ...currentStatus,
        isConnecting: false,
        qrCodeDataUrl: null,
        updatedAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }, { onConflict: "key" });

    console.log(`[WhatsApp Bot] Session backed up to Supabase cloud successfully (${Object.keys(files).length} files).`);
    return true;
  } catch (err: any) {
    console.error("[WhatsApp Bot] saveSessionToCloud error:", err);
    return false;
  }
}

function debouncedSaveSessionToCloud() {
  if (saveCloudTimer) clearTimeout(saveCloudTimer);
  saveCloudTimer = setTimeout(() => {
    saveSessionToCloud().catch((e) => console.error("[WhatsApp Bot] Cloud save failed:", e));
  }, 2000);
}

/**
 * Restore WhatsApp session credentials from Supabase cloud backup to local disk.
 */
export async function restoreSessionFromCloud(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "whatsapp_bot_session_backup")
      .maybeSingle();

    if (error || !data || !data.value || !data.value.files) {
      return false;
    }

    const files = data.value.files;
    if (!files["creds.json"]) {
      return false;
    }

    ensureSessionDir();
    let writtenCount = 0;
    for (const [fName, b64] of Object.entries(files)) {
      if (typeof b64 === "string") {
        const fullPath = path.join(sessionDir, fName);
        fs.writeFileSync(fullPath, Buffer.from(b64, "base64"));
        writtenCount++;
      }
    }

    // If status backup exists, hydrate basic phone info
    try {
      const { data: statusData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "whatsapp_bot_status")
        .maybeSingle();
      if (statusData && statusData.value) {
        const val = statusData.value;
        if (val.userPhone) currentStatus.userPhone = val.userPhone;
        if (val.userName) currentStatus.userName = val.userName;
        if (val.lastConnectedAt) currentStatus.lastConnectedAt = val.lastConnectedAt;
      }
    } catch (sErr) {}

    console.log(`[WhatsApp Bot] Restored session from Supabase cloud backup (${writtenCount} files).`);
    return true;
  } catch (err) {
    console.error("[WhatsApp Bot] restoreSessionFromCloud error:", err);
    return false;
  }
}

function formatToJid(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00966")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("05")) {
    digits = "966" + digits.slice(1);
  } else if (digits.length === 9 && digits.startsWith("5")) {
    digits = "966" + digits;
  }
  digits = digits.replace(/^0+/, "");
  return `${digits}@s.whatsapp.net`;
}

export function getWhatsAppStatus(): WhatsAppBotStatus {
  if (!currentStatus.isConnected && !currentStatus.isConnecting && !sock) {
    if (hasExistingSession()) {
      // Auto-reconnect in background if local session files are present
      connectWhatsAppBot().catch(() => {});
      return {
        ...currentStatus,
        isConnecting: true,
      };
    }
  }
  return { ...currentStatus };
}

export async function connectWhatsAppBot(): Promise<WhatsAppBotStatus> {
  if (sock && currentStatus.isConnected) {
    return getWhatsAppStatus();
  }

  if (connectingPromise && currentStatus.isConnecting) {
    return connectingPromise;
  }

  // Before connecting, check if cloud backup exists and restore if needed
  if (!hasExistingSession()) {
    try {
      await restoreSessionFromCloud();
    } catch (e) {}
  }

  isManualDisconnect = false;
  currentStatus.isConnecting = true;
  currentStatus.error = null;

  connectingPromise = new Promise(async (resolve) => {
    try {
      ensureSessionDir();
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

      const logger = pino({ level: "silent" });

      sock = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: ["نظام كاشير عود ونظافة", "Chrome", "1.0.0"],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        syncFullHistory: false,
      });

      sock.ev.on("creds.update", async () => {
        try {
          await saveCreds();
          debouncedSaveSessionToCloud();
        } catch (e) {
          console.error("[WhatsApp Bot] creds save error:", e);
        }
      });

      sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const dataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 300,
              color: {
                dark: "#0f172a",
                light: "#ffffff",
              },
            });
            currentStatus.qrCodeDataUrl = dataUrl;
            currentStatus.isConnecting = true;
            currentStatus.isConnected = false;
          } catch (qrErr: any) {
            console.error("Failed to render QR Code DataURL:", qrErr);
          }
        }

        if (connection === "open") {
          currentStatus.isConnected = true;
          currentStatus.isConnecting = false;
          currentStatus.qrCodeDataUrl = null;
          currentStatus.error = null;
          currentStatus.lastConnectedAt = new Date().toISOString();

          const rawId = sock?.user?.id || "";
          const phoneOnly = rawId.split(":")[0]?.split("@")[0] || "";
          currentStatus.userPhone = phoneOnly ? `+${phoneOnly}` : "متصل";
          currentStatus.userName = sock?.user?.name || "جوال المغسلة";

          console.log(`[WhatsApp Bot] Connected successfully as ${currentStatus.userPhone}`);
          
          // Immediate cloud persistence upon opening connection
          saveSessionToCloud().catch(err => {
            console.error("[WhatsApp Bot] Failed initial cloud session save:", err);
          });

          resolve(getWhatsAppStatus());
        }

        if (connection === "close") {
          currentStatus.isConnected = false;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          console.log(`[WhatsApp Bot] Connection closed. Status: ${statusCode}, isLoggedOut: ${isLoggedOut}`);

          if (isLoggedOut || isManualDisconnect) {
            currentStatus.isConnecting = false;
            currentStatus.qrCodeDataUrl = null;
            currentStatus.userPhone = null;
            currentStatus.userName = null;
            try {
              if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
              }
            } catch (e) {
              console.error("Failed to remove session dir:", e);
            }

            // Remove cloud backup if explicitly logged out or disconnected
            try {
              await supabase
                .from("settings")
                .delete()
                .in("key", ["whatsapp_bot_session_backup", "whatsapp_bot_status"]);
              console.log("[WhatsApp Bot] Removed session from Supabase cloud on logout.");
            } catch (delErr) {
              console.error("[WhatsApp Bot] Error deleting cloud session:", delErr);
            }

            sock = null;
            resolve(getWhatsAppStatus());
          } else {
            // Reconnect if connection was dropped unexpectedly
            currentStatus.isConnecting = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              if (!isManualDisconnect) {
                console.log("[WhatsApp Bot] Attempting auto-reconnect...");
                connectWhatsAppBot();
              }
            }, 4000);
            resolve(getWhatsAppStatus());
          }
        }
      });

      // Timeout safety: if after 4 seconds QR hasn't arrived, still return current status
      setTimeout(() => {
        resolve(getWhatsAppStatus());
      }, 3500);

    } catch (err: any) {
      console.error("[WhatsApp Bot] Connection initialization error:", err);
      currentStatus.isConnecting = false;
      currentStatus.error = err?.message || "فشل بدء جلسة الواتساب";
      resolve(getWhatsAppStatus());
    } finally {
      connectingPromise = null;
    }
  });

  return connectingPromise;
}

export async function disconnectWhatsAppBot(): Promise<WhatsAppBotStatus> {
  isManualDisconnect = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (sock) {
    try {
      await sock.logout();
    } catch (e) {}
    try {
      sock.end(undefined);
    } catch (e) {}
    sock = null;
  }

  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.error("Failed to clean session folder:", e);
  }

  try {
    await supabase
      .from("settings")
      .delete()
      .in("key", ["whatsapp_bot_session_backup", "whatsapp_bot_status"]);
    console.log("[WhatsApp Bot] Cleared Supabase cloud session on disconnect.");
  } catch (e) {
    console.error("Failed to clear Supabase cloud session:", e);
  }

  currentStatus = {
    isConnected: false,
    isConnecting: false,
    qrCodeDataUrl: null,
    userPhone: null,
    userName: null,
    error: null,
    lastConnectedAt: null,
  };

  return getWhatsAppStatus();
}

// Deduplication cache to prevent identical back-to-back WhatsApp messages within short timeframes
const recentSends = new Map<string, number>();

// Clean up stale cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentSends.entries()) {
    if (now - timestamp > 60000) {
      recentSends.delete(key);
    }
  }
}, 30000);

export async function sendWhatsAppMessageAndPdf(params: {
  toPhone: string;
  message: string;
  pdfBase64?: string;
  pdfFileName?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { toPhone, message, pdfBase64, pdfFileName } = params;

  if (!toPhone) {
    return { success: false, error: "رقم هاتف العميل مطلوب" };
  }

  // If not connected yet, try auto-connecting from cloud session before failing
  if (!sock || !currentStatus.isConnected) {
    if (hasExistingSession()) {
      try {
        await connectWhatsAppBot();
      } catch (e) {}
    } else {
      const restored = await restoreSessionFromCloud();
      if (restored) {
        try {
          await connectWhatsAppBot();
        } catch (e) {}
      }
    }
  }

  if (!sock || !currentStatus.isConnected) {
    return {
      success: false,
      error: "بوت الواتساب في الخلفية غير متصل حالياً. يرجى مسح رمز QR لربط جوال المغسلة من الإعدادات.",
    };
  }

  try {
    const cleanPhone = toPhone.replace(/\D/g, "");
    // Extract invoice/order identifier if present, or first part of message
    const orderMatch = message.match(/(?:ORD-|\b#)(\w+)/i);
    const dedupKey = `${cleanPhone}_${orderMatch ? orderMatch[1] : message.slice(0, 35)}`;
    const now = Date.now();
    const lastSendTime = recentSends.get(dedupKey);

    if (lastSendTime && (now - lastSendTime < 15000)) {
      console.log(`[WhatsApp Bot] Prevented duplicate send to ${cleanPhone} (${dedupKey}) within 15s window.`);
      return { success: true, messageId: "dedup-cached" };
    }
    recentSends.set(dedupKey, now);

    const jid = formatToJid(toPhone);

    // 1. Send the primary text message
    const sentMsg = await sock.sendMessage(jid, { text: message });

    // 2. If PDF invoice is provided, send the document directly
    if (pdfBase64) {
      try {
        const cleanBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, "");
        const pdfBuffer = Buffer.from(cleanBase64, "base64");

        const fileName = pdfFileName || "فاتورة_الطلب.pdf";
        await sock.sendMessage(jid, {
          document: pdfBuffer,
          mimetype: "application/pdf",
          fileName: fileName,
          caption: "📄 نسخة الفاتورة الرسمية بصيغة PDF",
        });
      } catch (pdfSendErr: any) {
        console.error("[WhatsApp Bot] Error sending PDF attachment:", pdfSendErr);
        // We still succeeded in sending the text message!
      }
    }

    return { success: true, messageId: sentMsg?.key?.id || undefined };
  } catch (err: any) {
    console.error("[WhatsApp Bot] Send message error:", err);
    return {
      success: false,
      error: err?.message || "حدث خطأ أثناء إرسال رسالة الواتساب للعميل.",
    };
  }
}

export async function initWhatsAppBot() {
  try {
    let hasLocal = hasExistingSession();
    if (!hasLocal) {
      console.log("[WhatsApp Bot] Checking Supabase cloud backup for existing session...");
      const restored = await restoreSessionFromCloud();
      if (restored) {
        hasLocal = true;
        console.log("[WhatsApp Bot] Restored session from Supabase cloud backup successfully!");
      }
    }

    if (hasLocal) {
      console.log("[WhatsApp Bot] Found existing session, auto-connecting in background...");
      connectWhatsAppBot().catch(err => console.error("[WhatsApp Bot] Auto-connect failed:", err));
    } else {
      console.log("[WhatsApp Bot] Ready for pairing. Waiting for user QR scan request.");
    }
  } catch (e) {
    console.error("[WhatsApp Bot] Initialization error:", e);
  }
}

