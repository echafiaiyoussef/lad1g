import * as BaileysRaw from "@whiskeysockets/baileys";
import type { WASocket, ConnectionState } from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

/**
 * Universal Baileys resolver that guarantees function availability
 * across ESM, CommonJS, and esbuild bundled dist/server.cjs.
 */
export function getBaileys() {
  const b = BaileysRaw as any;
  const makeWASocket =
    (typeof b.makeWASocket === "function" ? b.makeWASocket : null) ||
    (typeof b.default === "function" ? b.default : null) ||
    (typeof b.default?.default === "function" ? b.default.default : null) ||
    (typeof b.default?.makeWASocket === "function" ? b.default.makeWASocket : null) ||
    (typeof b === "function" ? b : null);

  const useMultiFileAuthState =
    (typeof b.useMultiFileAuthState === "function" ? b.useMultiFileAuthState : null) ||
    (typeof b.default?.useMultiFileAuthState === "function" ? b.default.useMultiFileAuthState : null) ||
    (typeof b.default?.default?.useMultiFileAuthState === "function" ? b.default.default.useMultiFileAuthState : null);

  const DisconnectReason =
    b.DisconnectReason ||
    b.default?.DisconnectReason ||
    b.default?.default?.DisconnectReason ||
    { loggedOut: 401 };

  return { makeWASocket, useMultiFileAuthState, DisconnectReason };
}

export interface WhatsAppBotStatus {
  isConnected: boolean;
  isConnecting: boolean;
  qrCodeDataUrl: string | null;
  userPhone: string | null;
  userName: string | null;
  error: string | null;
  lastConnectedAt: string | null;
}

export interface WhatsAppBotLogEntry {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
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
let reconnectAttempts = 0;

const botLogs: WhatsAppBotLogEntry[] = [];

export function logBot(level: "info" | "warn" | "error", message: string) {
  const time = new Date().toLocaleTimeString("ar-SA", { hour12: false });
  botLogs.unshift({ time, level, message });
  if (botLogs.length > 60) botLogs.pop();
  console.log(`[WhatsApp Bot ${level.toUpperCase()}] ${message}`);
}

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

export async function connectWhatsAppBot(forceNewQR = false): Promise<WhatsAppBotStatus> {
  if (!forceNewQR && sock && currentStatus.isConnected) {
    return getWhatsAppStatus();
  }

  if (!forceNewQR && connectingPromise && currentStatus.isConnecting) {
    return connectingPromise;
  }

  // If force requested or clean QR wanted, terminate existing socket and wipe session directory
  if (forceNewQR) {
    console.log("[WhatsApp Bot] Force new QR requested: clearing old session files and restarting socket...");
    isManualDisconnect = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempts = 0;

    if (sock) {
      try {
        sock.ev.removeAllListeners("connection.update");
        sock.ev.removeAllListeners("creds.update");
        sock.end(undefined);
      } catch (e) {}
      sock = null;
    }

    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
      fs.mkdirSync(sessionDir, { recursive: true });
    } catch (e) {
      console.warn("[WhatsApp Bot] Could not wipe sessionDir:", e);
    }

    try {
      await supabase
        .from("settings")
        .delete()
        .in("key", ["whatsapp_bot_session_backup", "whatsapp_bot_status"]);
    } catch (e) {}

    currentStatus = {
      isConnected: false,
      isConnecting: true,
      qrCodeDataUrl: null,
      userPhone: null,
      userName: null,
      error: null,
      lastConnectedAt: null,
    };
  } else {
    // Normal connect: try to restore cloud backup only if local session doesn't exist
    if (!hasExistingSession()) {
      try {
        await restoreSessionFromCloud();
      } catch (e) {}
    }
  }

  isManualDisconnect = false;
  currentStatus.isConnecting = true;
  currentStatus.error = null;

  connectingPromise = new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (status: WhatsAppBotStatus) => {
      if (!resolved) {
        resolved = true;
        resolve(status);
      }
    };

    (async () => {
      try {
        ensureSessionDir();
        logBot("info", "بدء تجهيز جلسة الواتساب ومحرك Baileys...");

        const { makeWASocket, useMultiFileAuthState, DisconnectReason } = getBaileys();
        if (typeof makeWASocket !== "function") {
          throw new Error(`مكتبة Baileys makeWASocket غير متاحة كدالة (النوع: ${typeof makeWASocket})`);
        }
        if (typeof useMultiFileAuthState !== "function") {
          throw new Error(`مكتبة Baileys useMultiFileAuthState غير متاحة كدالة (النوع: ${typeof useMultiFileAuthState})`);
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const logger = pino({ level: "silent" });

        // If old credentials exist but socket has already failed multiple times, wipe them to force QR
        if (reconnectAttempts >= 3 && !currentStatus.isConnected) {
          logBot("warn", "تجاوز محاولات الاتصال مع ملفات قديمة. جاري مسح الجلسة لإنشاء رمز QR جديد...");
          try {
            if (fs.existsSync(sessionDir)) {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            }
            fs.mkdirSync(sessionDir, { recursive: true });
          } catch (e) {}
          reconnectAttempts = 0;
        }

        // Close any prior socket before creating new one
        if (sock) {
          try {
            sock.ev.removeAllListeners("connection.update");
            sock.ev.removeAllListeners("creds.update");
            sock.end(undefined);
          } catch (e) {}
          sock = null;
        }

        logBot("info", "جاري إنشاء اتصال WASocket جديد...");
        sock = makeWASocket({
          auth: state,
          logger,
          printQRInTerminal: false,
          browser: ["Ubuntu", "Chrome", "122.0.0"], // Standard ASCII browser identifier to prevent WhatsApp rejection
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
            logBot("error", `خطأ أثناء حفظ بيانات الاعتماد: ${e}`);
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
              currentStatus.error = null;
              logBot("info", "تم توليد رمز QR بنجاح، بانتظار مسحه من تطبيق واتساب.");
              safeResolve(getWhatsAppStatus());
            } catch (qrErr: any) {
              logBot("error", `فشل تحويل رمز QR إلى صورة: ${qrErr.message}`);
            }
          }

          if (connection === "open") {
            currentStatus.isConnected = true;
            currentStatus.isConnecting = false;
            currentStatus.qrCodeDataUrl = null;
            currentStatus.error = null;
            currentStatus.lastConnectedAt = new Date().toISOString();
            reconnectAttempts = 0;

            const rawId = sock?.user?.id || "";
            const phoneOnly = rawId.split(":")[0]?.split("@")[0] || "";
            currentStatus.userPhone = phoneOnly ? `+${phoneOnly}` : "متصل";
            currentStatus.userName = sock?.user?.name || "جوال المغسلة";

            logBot("info", `تم الاتصال بنجاح برقم: ${currentStatus.userPhone} (${currentStatus.userName})`);
            
            // Immediate cloud persistence upon opening connection
            saveSessionToCloud().catch(err => {
              logBot("warn", `فشل حفظ الجلسة في السحابة: ${err}`);
            });

            safeResolve(getWhatsAppStatus());
          }

          if (connection === "close") {
            currentStatus.isConnected = false;
            const err = lastDisconnect?.error as any;
            const statusCode = err?.output?.statusCode || err?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403;

            logBot("warn", `أُغلق اتصال الواتساب. الرمز: ${statusCode}, تسجيل خروج: ${isLoggedOut}`);

            if (isLoggedOut || isManualDisconnect) {
              currentStatus.isConnecting = false;
              currentStatus.qrCodeDataUrl = null;
              currentStatus.userPhone = null;
              currentStatus.userName = null;
              reconnectAttempts = 0;

              try {
                if (fs.existsSync(sessionDir)) {
                  fs.rmSync(sessionDir, { recursive: true, force: true });
                }
              } catch (e) {
                console.error("Failed to remove session dir:", e);
              }

              try {
                await supabase
                  .from("settings")
                  .delete()
                  .in("key", ["whatsapp_bot_session_backup", "whatsapp_bot_status"]);
              } catch (delErr) {}

              sock = null;
              safeResolve(getWhatsAppStatus());
            } else {
              reconnectAttempts++;
              if (reconnectAttempts > 4) {
                logBot("error", "تجاوز حد محاولات إعادة الاتصال. يُرجى طلب رمز QR جديد.");
                try {
                  if (fs.existsSync(sessionDir)) {
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                  }
                } catch (e) {}
                currentStatus.isConnecting = false;
                currentStatus.error = "انتهت صلاحية جلسة الواتساب القديمة، يرجى طلب رمز QR جديد.";
                safeResolve(getWhatsAppStatus());
                return;
              }

              currentStatus.isConnecting = true;
              if (reconnectTimer) clearTimeout(reconnectTimer);
              reconnectTimer = setTimeout(() => {
                if (!isManualDisconnect) {
                  logBot("info", `محاولة إعادة الاتصال التلقائي (${reconnectAttempts})...`);
                  connectWhatsAppBot();
                }
              }, 4000);
              safeResolve(getWhatsAppStatus());
            }
          }
        });

        // Timeout safety: if after 6 seconds neither QR nor connection arrived, resolve current status
        setTimeout(() => {
          safeResolve(getWhatsAppStatus());
        }, 6000);

      } catch (err: any) {
        logBot("error", `فشل بدء جلسة الواتساب: ${err?.message || err}`);
        currentStatus.isConnecting = false;
        currentStatus.error = err?.message || "فشل بدء جلسة الواتساب";
        safeResolve(getWhatsAppStatus());
      } finally {
        connectingPromise = null;
      }
    })();
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
  recentLogs: WhatsAppBotLogEntry[];
}

export async function getWhatsAppDiagnostics(): Promise<WhatsAppDiagnosticsReport> {
  const baileys = getBaileys();
  const sessionExists = fs.existsSync(sessionDir);
  let sessionFiles: string[] = [];
  try {
    if (sessionExists) sessionFiles = fs.readdirSync(sessionDir);
  } catch (e: any) {
    sessionFiles = [`خطأ في قراءة المجلد: ${e.message}`];
  }

  let cloudBackupFound = false;
  let cloudBackupDate: string | null = null;
  try {
    const { data } = await supabase
      .from("settings")
      .select("value, updated_at")
      .eq("key", "whatsapp_bot_session_backup")
      .maybeSingle();
    if (data?.value?.files?.["creds.json"]) {
      cloudBackupFound = true;
      cloudBackupDate = data.updated_at;
    }
  } catch (e) {}

  return {
    timestamp: new Date().toISOString(),
    status: getWhatsAppStatus(),
    baileys: {
      isMakeWASocketFunction: typeof baileys.makeWASocket === "function",
      isUseAuthStateFunction: typeof baileys.useMultiFileAuthState === "function",
      hasDisconnectReason: typeof baileys.DisconnectReason === "object" && baileys.DisconnectReason !== null,
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      pid: process.pid,
    },
    session: {
      directory: sessionDir,
      exists: sessionExists,
      filesCount: sessionFiles.length,
      files: sessionFiles.slice(0, 20),
      hasCreds: sessionFiles.includes("creds.json"),
      reconnectAttempts,
    },
    cloudBackup: {
      found: cloudBackupFound,
      updatedAt: cloudBackupDate,
    },
    recentLogs: botLogs.slice(0, 30),
  };
}

