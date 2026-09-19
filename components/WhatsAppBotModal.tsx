import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Smartphone,
  Send,
  Power,
  X,
  Loader2,
  Check,
  PartyPopper,
  Terminal,
  ChevronDown,
  ChevronUp,
  Copy,
  Activity,
  Cpu
} from 'lucide-react';
import {
  WhatsAppBotStatus,
  getWhatsAppBotStatus,
  connectWhatsAppBot,
  disconnectWhatsAppBot,
  sendWhatsAppBotMessage,
  getWhatsAppDiagnostics,
  WhatsAppDiagnosticsReport
} from '../services/whatsappBotClient';
import { supabase } from '../supabase';

interface WhatsAppBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (status: WhatsAppBotStatus) => void;
}

export const WhatsAppBotModal: React.FC<WhatsAppBotModalProps> = ({
  isOpen,
  onClose,
  onStatusChange
}) => {
  const [status, setStatus] = useState<WhatsAppBotStatus>({
    isConnected: false,
    isConnecting: false,
    qrCodeDataUrl: null,
    userPhone: null,
    userName: null,
    error: null,
    lastConnectedAt: null
  });

  const [loading, setLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  
  // Diagnostics & Debug State
  const [showDebug, setShowDebug] = useState(false);
  const [debugReport, setDebugReport] = useState<WhatsAppDiagnosticsReport | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [copiedDebug, setCopiedDebug] = useState(false);

  const [autoSendEnabled, setAutoSendEnabled] = useState<boolean>(() => {
    return localStorage.getItem('laundry_whatsapp_bot_auto_send') !== 'false';
  });

  const pollIntervalRef = useRef<number | null>(null);

  // Sync cloud auto send setting
  useEffect(() => {
    const fetchAutoSend = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'laundry_whatsapp_bot_auto_send')
          .maybeSingle();
        if (data && data.value && typeof data.value.enabled === 'boolean') {
          setAutoSendEnabled(data.value.enabled);
          localStorage.setItem('laundry_whatsapp_bot_auto_send', data.value.enabled ? 'true' : 'false');
        }
      } catch (e) {}
    };
    fetchAutoSend();
  }, []);

  const fetchStatus = async () => {
    const current = await getWhatsAppBotStatus();
    setStatus(current);
    onStatusChange?.(current);
    return current;
  };

  const loadDiagnostics = async () => {
    setDebugLoading(true);
    try {
      const data = await getWhatsAppDiagnostics();
      setDebugReport(data);
    } catch (e) {
      console.error("Failed to load diagnostics:", e);
    } finally {
      setDebugLoading(false);
    }
  };

  const handleCopyDiagnostics = () => {
    if (!debugReport) return;
    navigator.clipboard.writeText(JSON.stringify(debugReport, null, 2));
    setCopiedDebug(true);
    setTimeout(() => setCopiedDebug(false), 2000);
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchStatus().then((s) => {
        setLoading(false);
        // Only initiate new connection if not connected and not already in connecting state
        if (!s.isConnected && !s.isConnecting) {
          handleConnect();
        }
      });

      // Poll status while modal is open
      pollIntervalRef.current = window.setInterval(async () => {
        await fetchStatus();
      }, 3000);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isOpen]);

  // Load diagnostics when debug panel is opened
  useEffect(() => {
    if (showDebug && isOpen) {
      loadDiagnostics();
    }
  }, [showDebug, isOpen]);

  const handleConnect = async (force = false) => {
    setLoading(true);
    try {
      const res = await connectWhatsAppBot(force);
      setStatus(res);
      onStatusChange?.(res);
      if (showDebug) loadDiagnostics();
    } catch (e: any) {
      console.error('Failed to connect:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('هل أنت متأكد من رغبتك في تسجيل الخروج وقطع ارتباط جوال المغسلة من جميع الأجهزة؟')) return;
    setLoading(true);
    try {
      const res = await disconnectWhatsAppBot();
      setStatus(res);
      onStatusChange?.(res);
      setTestResult(null);
      if (showDebug) loadDiagnostics();
    } catch (e: any) {
      console.error('Failed to disconnect:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoSend = async (enabled: boolean) => {
    setAutoSendEnabled(enabled);
    localStorage.setItem('laundry_whatsapp_bot_auto_send', enabled ? 'true' : 'false');
    try {
      await supabase.from('settings').upsert({
        key: 'laundry_whatsapp_bot_auto_send',
        value: { enabled },
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    } catch (e) {}
  };

  const handleSendTestMessage = async () => {
    if (!testPhone.trim()) {
      alert('يرجى إدخال رقم هاتف للتجربة (مثال: 0501234567)');
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await sendWhatsAppBotMessage({
        toPhone: testPhone.trim(),
        message: `مرحباً بك من مغسلة عود ونظافة! ✨\nهذه رسالة تجريبية لتأكيد نجاح الربط مع الواتساب وحفظه سحابياً على جميع أجهزتك.\nسيتم الآن إرسال الفواتير لعملائك تلقائياً فور حفظ أي طلب.`
      });
      if (res.success) {
        setTestResult({ success: true, message: 'تم إرسال الرسالة بنجاح وبسرعة في الخلفية! تفقد تطبيق الواتساب على جوال المستلم.' });
      } else {
        setTestResult({ success: false, message: res.error || 'تعذر إرسال الرسالة التجريبية.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'حدث خطأ أثناء الإرسال.' });
    } finally {
      setTestSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">الربط مع الواتساب</h3>
              <p className="text-[11px] text-slate-400">إرسال الفواتير والإشعارات للعملاء</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Status Section */}
          {status.isConnected ? (
            <div className="space-y-3">
              {/* Congratulatory Success Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-700 text-white shadow-sm flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner">
                  <PartyPopper size={20} className="text-amber-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-black text-xs text-white">
                    <span>تهانينا! تم الاتصال بنجاح</span>
                    <span>🎉</span>
                  </div>
                  <p className="text-[11px] text-emerald-100 font-medium mt-0.5 truncate">
                    حساب الواتساب متصل الآن وجاهز لإرسال الفواتير لعملائك تلقائياً
                  </p>
                </div>
              </div>

              {/* Connected Details Bar */}
              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-xs font-bold text-emerald-950">
                    {status.userPhone ? `الرقم المتصل: ${status.userPhone}` : 'جاهز للإرسال السريع'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={fetchStatus}
                    disabled={loading}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                    title="تحديث الحالة"
                  >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    تحديث
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={loading}
                    className="px-2.5 py-1.5 hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="قطع الارتباط"
                  >
                    <Power size={12} />
                    قطع الارتباط
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* QR Display when not connected */
            <div className="text-center py-2 space-y-3">
              <p className="text-xs text-slate-500">
                امسح الرمز من واتساب (الإعدادات &gt; الأجهزة المرتبطة &gt; ربط جهاز)
              </p>

              {status.error && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex flex-col items-center gap-1.5 text-center">
                  <span className="font-mono text-[11px]">{status.error}</span>
                  <button
                    type="button"
                    onClick={() => handleConnect(true)}
                    disabled={loading}
                    className="mt-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] transition-colors cursor-pointer shadow-xs"
                  >
                    حذف الجلسة القديمة وإنشاء رمز QR جديد
                  </button>
                </div>
              )}

              <div className="relative inline-block p-3 bg-white rounded-xl shadow-sm border border-slate-200">
                {status.qrCodeDataUrl ? (
                  <img
                    src={status.qrCodeDataUrl}
                    alt="WhatsApp QR Code"
                    className="w-48 h-48 mx-auto object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-400 gap-2 p-2 text-center">
                    <Loader2 size={28} className="animate-spin text-emerald-600" />
                    <span className="text-xs font-bold text-slate-700">
                      {status.isConnecting ? 'جاري تجهيز رمز QR...' : 'جاري الاتصال...'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleConnect(true)}
                      disabled={loading}
                      className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      طلب رمز جديد الآن
                    </button>
                  </div>
                )}

                {loading && status.qrCodeDataUrl && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl">
                    <Loader2 size={28} className="animate-spin text-emerald-600" />
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleConnect(true)}
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  تحديث / إنشاء رمز جديد
                </button>
              </div>
            </div>
          )}

          {/* Automatic Send Setting Toggle */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone size={17} className="text-slate-500 shrink-0" />
              <span className="text-xs font-bold text-slate-800">
                إرسال الفاتورة تلقائياً عند حفظ الطلب
              </span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoSendEnabled}
                onChange={(e) => handleToggleAutoSend(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Test Message Box (Shown if connected) */}
          {status.isConnected && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <span className="text-xs font-bold text-slate-700 block">تجربة إرسال رسالة:</span>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="رقم الجوال للتجربة (مثال: 0501234567)"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 transition-colors"
                  dir="ltr"
                />
                <button
                  onClick={handleSendTestMessage}
                  disabled={testSending || !testPhone.trim()}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                >
                  {testSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  إرسال
                </button>
              </div>

              {testResult && (
                <div className={`p-2.5 rounded-lg text-xs font-bold flex items-center gap-2 ${
                  testResult.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {testResult.success ? <Check size={15} /> : <AlertCircle size={15} />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Collapsible Debug & Diagnostics Section */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
            <button
              type="button"
              onClick={() => setShowDebug(!showDebug)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-600 hover:bg-slate-100/70 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Terminal size={15} className="text-emerald-600" />
                <span>أدوات التشخيص وفحص السيرفر (Debug Tools)</span>
                {status.error && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                )}
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-[10px]">{showDebug ? 'إخفاء' : 'عرض التفاصيل'}</span>
                {showDebug ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </div>
            </button>

            {showDebug && (
              <div className="p-4 border-t border-slate-200 space-y-3 bg-white">
                {/* Diagnostic Indicators */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">حالة محرك Baileys:</span>
                      {debugReport?.baileys.isMakeWASocketFunction ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 size={12} /> جاهز كدالة
                        </span>
                      ) : (
                        <span className="text-amber-600 font-bold flex items-center gap-1">
                          <AlertCircle size={12} /> {debugLoading ? 'جاري الفحص...' : 'قيد التحقق'}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      makeWASocket: {debugReport?.baileys.isMakeWASocketFunction ? 'OK' : 'Checking'}
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">مجلد الجلسة:</span>
                      {debugReport?.session.hasCreds ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 size={12} /> creds.json موجود
                        </span>
                      ) : (
                        <span className="text-slate-600 font-bold">
                          {debugReport?.session.filesCount ?? 0} ملفات
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate" title={debugReport?.session.directory}>
                      {debugReport?.session.directory ? 'whatsapp_session/' : 'مسار محلي'}
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">خادم Node / النظام:</span>
                      <span className="font-mono text-slate-700 font-bold">
                        {debugReport?.system.nodeVersion || 'v20+'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ذاكرة: {debugReport?.system.memoryMb ?? 0} MB | PID: {debugReport?.system.pid ?? '-'}
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">النسخ السحابي:</span>
                      {debugReport?.cloudBackup.found ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 size={12} /> محفوظ بسوبابيز
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">غير محفوظ</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {debugReport?.cloudBackup.updatedAt ? new Date(debugReport.cloudBackup.updatedAt).toLocaleTimeString('ar-SA') : 'جاهز للمزامنة'}
                    </div>
                  </div>
                </div>

                {/* Diagnostic Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={loadDiagnostics}
                    disabled={debugLoading}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={12} className={debugLoading ? 'animate-spin' : ''} />
                    <span>تحديث بيانات الفحص</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyDiagnostics}
                    disabled={!debugReport}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedDebug ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedDebug ? 'تم النسخ بنجاح!' : 'نسخ تقرير الفحص'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConnect(true)}
                    disabled={loading}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer mr-auto"
                  >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    <span>مسح الجلسة وتوليد QR نظيف</span>
                  </button>
                </div>

                {/* Real-time Server Bot Logs */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>سجل أحداث الخادم المباشر (Server Logs):</span>
                    <span className="text-[10px] text-slate-400">آخر 30 حدث</span>
                  </div>
                  <div className="bg-slate-900 text-slate-200 font-mono text-[11px] p-2.5 rounded-lg max-h-36 overflow-y-auto space-y-1 text-left" dir="ltr">
                    {debugReport?.recentLogs && debugReport.recentLogs.length > 0 ? (
                      debugReport.recentLogs.map((log, idx) => (
                        <div key={idx} className="leading-tight flex items-start gap-1.5">
                          <span className="text-slate-500 shrink-0">[{log.time}]</span>
                          <span className={
                            log.level === 'error' ? 'text-red-400 font-bold' :
                            log.level === 'warn' ? 'text-amber-400' : 'text-emerald-400'
                          }>
                            [{log.level.toUpperCase()}]
                          </span>
                          <span className="text-slate-300 break-all">{log.message}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500 italic">
                        {debugLoading ? 'جاري جلب السجلات...' : 'لا توجد سجلات مسجلة حتى الآن. اضغط على "تحديث بيانات الفحص".'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

