import React, { useState, useEffect } from 'react';
import { 
  CloudOff, 
  Cloud, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  X, 
  Database, 
  Layers, 
  Sparkles, 
  Trash2,
  AlertCircle,
  ShieldCheck,
  Power
} from 'lucide-react';
import { 
  OfflineOrderLimit, 
  OFFLINE_LIMIT_OPTIONS, 
  isManualOffline, 
  isDeviceOnline, 
  getOfflineCacheLimit, 
  setOfflineCacheLimit, 
  getOfflineSavedInfo, 
  downloadAndSaveDataForOffline, 
  returnToOnlineAndSync,
  turnOffOfflineMode, 
  clearOfflineCache,
  getOfflineQueue 
} from '../services/offlineSyncService';
import { supabase } from '../supabase';
import { Order } from '../types';

interface OfflineModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  laundryId?: string;
  onDataSavedOffline?: (savedOrders: Order[], count: number) => void;
  onReturnOnline?: () => void;
}

export const OfflineModeModal: React.FC<OfflineModeModalProps> = ({
  isOpen,
  onClose,
  laundryId,
  onDataSavedOffline,
  onReturnOnline
}) => {
  const [selectedLimit, setSelectedLimit] = useState<OfflineOrderLimit>(() => getOfflineCacheLimit());
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedInfo, setSavedInfo] = useState(() => getOfflineSavedInfo());
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(() => getOfflineQueue().length);
  const deviceOnline = isDeviceOnline();

  const refreshInfo = () => {
    setSavedInfo(getOfflineSavedInfo());
    setPendingQueueCount(getOfflineQueue().length);
  };

  useEffect(() => {
    if (isOpen) {
      refreshInfo();
      setSelectedLimit(getOfflineCacheLimit());
      setStatusMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isCurrentlyOffline = savedInfo.isManualOffline;

  // Action: Go Offline (Download & Cache Data from Database)
  const handleGoOffline = async () => {
    if (!deviceOnline) {
      setErrorMessage('لا يوجد اتصال بشبكة الإنترنت حالياً لتنزيل البيانات من قاعدة البيانات.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage('جاري الاتصال بقاعدة البيانات السحابية وتنزيل البيانات مع منع التكرار...');

    try {
      const result = await downloadAndSaveDataForOffline(
        supabase,
        laundryId,
        selectedLimit,
        (msg) => setStatusMessage(msg)
      );

      if (result.success) {
        refreshInfo();
        setStatusMessage(`تم حفظ ${result.count} طلب بنجاح وبدون أي تكرار، وتفعيل وضع عدم الاتصال!`);
        if (onDataSavedOffline) {
          onDataSavedOffline(result.orders, result.count);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMessage(result.error || 'فشل حفظ البيانات للوضع غير المتصل');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'حدث خطأ غير متوقع أثناء حفظ البيانات');
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Turn OFF Offline Mode & Return to Online (with deduplicated sync)
  const handleTurnOff = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage('جاري إيقاف وضع الأوفلاين ومزامنة الفواتير المعلقة مع السحابة...');

    try {
      const result = await turnOffOfflineMode(supabase, laundryId);
      refreshInfo();

      if (result.syncedCount > 0) {
        setStatusMessage(`تم إيقاف الأوفلاين بنجاح ومزامنة ${result.syncedCount} فاتورة بدون أي تكرار!`);
      } else {
        setStatusMessage('تم إيقاف وضع عدم الاتصال (Turn OFF) والعودة للوضع المتصل السحابي بنجاح!');
      }

      if (onReturnOnline) {
        onReturnOnline();
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e: any) {
      setErrorMessage(e.message || 'حدث خطأ أثناء إيقاف الأوفلاين والعودة للمتصل');
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Clear Offline Cache & Turn OFF
  const handleClearCache = () => {
    if (pendingQueueCount > 0) {
      const confirmClear = window.confirm(`يوجد ${pendingQueueCount} عملية معلقة لم تتم مزامنتها مع السحابة بعد. هل أنت متأكد من رغبتك في مسح الذاكرة المحلية وإيقاف الأوفلاين؟`);
      if (!confirmClear) return;
    }
    clearOfflineCache(laundryId);
    refreshInfo();
    setStatusMessage('تم مسح الذاكرة المحلية وإيقاف وضع الأوفلاين والعودة للوضع المتصل الافتراضي.');
    if (onReturnOnline) onReturnOnline();
    setTimeout(() => {
      setStatusMessage(null);
    }, 2000);
  };

  return (
    <div 
      id="offline-mode-modal-backdrop"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[200] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      dir="rtl"
      onClick={onClose}
    >
      <div 
        id="offline-mode-modal-card"
        className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-7 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
              isCurrentlyOffline 
                ? 'bg-amber-100 text-amber-700' 
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {isCurrentlyOffline ? <CloudOff size={24} /> : <Cloud size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900">
                  إعدادات وضع العمل بدون إنترنت (Offline Mode)
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                  isCurrentlyOffline 
                    ? 'bg-amber-100 text-amber-800' 
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {isCurrentlyOffline ? 'أوفلاين مفعل 🟡' : 'الوضع المتصل الافتراضي 🟢'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                التحكم بالوضع التشغيلي وتحديد عدد الفواتير المحفوظة للأوفلاين
              </p>
            </div>
          </div>

          <button 
            type="button"
            id="btn-close-offline-modal"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 [scrollbar-width:thin]">

          {/* Quick Toggle / Operational State Switch */}
          <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                isCurrentlyOffline ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
              }`}>
                <Power size={20} />
              </div>
              <div>
                <span className="text-xs font-black text-slate-800 block">
                  مفتاح تشغيل/إيقاف وضع عدم الاتصال (Offline Mode Switch)
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {isCurrentlyOffline 
                    ? 'الوضع الحالي: مفعل (ON) — النظام يعمل محلياً' 
                    : 'الوضع الحالي: متوقف (OFF) — متصل بالسحابة الافتراضية'}
                </span>
              </div>
            </div>

            {isCurrentlyOffline ? (
              <button
                type="button"
                id="btn-quick-turn-off-offline"
                onClick={handleTurnOff}
                disabled={isProcessing}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition disabled:opacity-50"
              >
                <Power size={14} />
                <span>إيقاف الوضع (Turn OFF)</span>
              </button>
            ) : (
              <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black flex items-center gap-1.5">
                <CheckCircle size={14} />
                <span>متوقف افتراضياً (OFF)</span>
              </span>
            )}
          </div>

          {/* Current Status Box (Using the exact Arabic text requested by the user) */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            isCurrentlyOffline 
              ? 'bg-amber-50/90 border-amber-200 text-amber-950' 
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black uppercase text-slate-400 block mb-1">الحالة التشغيلية الحالية</span>
                <p className="text-sm font-black flex items-center gap-2">
                  {isCurrentlyOffline ? (
                    <>
                      <CloudOff size={18} className="text-amber-600" />
                      وضع عدم الاتصال مفعل حالياً (النظام يعمل محلياً)
                    </>
                  ) : (
                    <>
                      <Cloud size={18} className="text-emerald-600" />
                      الوضع المتصل الافتراضي (قاعدة البيانات السحابية مباشرة)
                    </>
                  )}
                </p>
                <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                  {isCurrentlyOffline 
                    ? `يحتوي الجهاز على ${savedInfo.count} طلب محفوظ محلياً. يتم حفظ أي فواتير جديدة في قائمة الانتظار للمزامنة فور العودة للاتصال بدون أي تكرار.` 
                    : 'في الوضع المتصل الافتراضي، لا يتم تخزين البيانات محلياً إلا بعد اختيارك (الانتقال لوضع عدم الاتصال).'
                  }
                </p>
              </div>

              {isCurrentlyOffline && (
                <div className="flex items-center gap-2 shrink-0">
                  {pendingQueueCount > 0 && (
                    <span className="px-3 py-1 bg-amber-200/80 text-amber-900 rounded-xl text-xs font-black">
                      {pendingQueueCount} معلق
                    </span>
                  )}
                  <button
                    type="button"
                    id="btn-return-online-from-status"
                    onClick={handleTurnOff}
                    disabled={isProcessing}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 shadow-xs"
                  >
                    <Cloud size={14} />
                    <span>إيقاف الأوفلاين والعودة للمتصل (Online)</span>
                  </button>
                </div>
              )}
            </div>

            {savedInfo.savedAt && (
              <div className="mt-3 pt-3 border-t border-slate-200/70 flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-bold gap-2">
                <span>تاريخ آخر حفظ محلي: {new Date(savedInfo.savedAt).toLocaleString('ar-SA')}</span>
                <span>الحد المحدد: {savedInfo.limit === 'all' ? 'جميع الطلبات' : `${savedInfo.limit} طلب`}</span>
              </div>
            )}
          </div>

          {/* Feedback Messages */}
          {statusMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Order Limit Selector (Exact Arabic text requested by the user) */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-1">
              <label className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Layers size={16} className="text-indigo-600" />
                اختر عدد الفواتير والطلبات المراد حفظها للأوفلاين:
              </label>
              <span className="text-[11px] font-bold text-slate-500">
                يتم تنزيل المخزون والاشتراكات والمستخدمين والخدمات تلقائياً للعمل بدون إنترنت
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {OFFLINE_LIMIT_OPTIONS.map((opt) => {
                const isSelected = selectedLimit === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    id={`btn-offline-limit-${opt.value}`}
                    onClick={() => {
                      setSelectedLimit(opt.value);
                      setOfflineCacheLimit(opt.value);
                    }}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-200 text-indigo-950 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black">{opt.countText}</span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium leading-tight">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Zero Duplicate Guarantee Card */}
          <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 text-xs text-emerald-950 space-y-1.5">
            <p className="font-black text-emerald-900 flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-emerald-600" />
              ضمان عدم تكرار البيانات نهائياً (Zero Duplicate Data Guarantee)
            </p>
            <p className="leading-relaxed font-medium text-emerald-800 text-[11px]">
              • عند حفظ البيانات للأوفلاين أو العودة للوضع المتصل، يتم تطبيق فحص ذكي موثوق لمعرفات الفواتير (IDs) وأرقام الطلبات لمنع ظهور أو إدخال أي فاتورة مكررة في قاعدة البيانات السحابية أو الواجهة.
            </p>
          </div>

          {/* Operational Guidance */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            <p className="font-black text-slate-800 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              كيف يعمل النظام؟
            </p>
            <p className="leading-relaxed font-medium text-slate-500">
              • الوضع الافتراضي متوقف <strong>(OFF)</strong>، ولا يتم حفظ أي بيانات للأوفلاين إلا عند ضغطك على زر <strong>الانتقال لوضع عدم الاتصال وحفظ البيانات</strong>.
            </p>
            <p className="leading-relaxed font-medium text-slate-500">
              • يمكنك في أي لحظة إيقاف وضع عدم الاتصال بالضغط على زر <strong>(إيقاف الوضع Turn OFF)</strong> للعودة لقاعدة البيانات المباشرة ومزامنة كافة العمليات المعلقة.
            </p>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {savedInfo.count > 0 && (
              <button
                type="button"
                id="btn-clear-offline-cache"
                onClick={handleClearCache}
                disabled={isProcessing}
                className="px-3.5 py-2.5 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                title="مسح الفواتير المخزنة محلياً وإيقاف الأوفلاين"
              >
                <Trash2 size={15} />
                <span>مسح الذاكرة المحلية وإيقاف الوضع</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              id="btn-cancel-offline-modal"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition"
            >
              إغلاق
            </button>

            {!isCurrentlyOffline ? (
              <button
                type="button"
                id="btn-activate-offline-mode"
                onClick={handleGoOffline}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-200 flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>جاري الحفظ والانتقال...</span>
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    <span>الانتقال لوضع عدم الاتصال وحفظ البيانات (Go Offline)</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-refresh-offline-data"
                  onClick={handleGoOffline}
                  disabled={isProcessing}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                  title="إعادة تنزيل الطلبات المحددة من قاعدة البيانات"
                >
                  <RefreshCw size={14} className={isProcessing ? 'animate-spin' : ''} />
                  <span>تحديث بيانات الأوفلاين</span>
                </button>

                <button
                  type="button"
                  id="btn-turn-off-offline-mode-footer"
                  onClick={handleTurnOff}
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-200 flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>جاري المزامنة والإيقاف...</span>
                    </>
                  ) : (
                    <>
                      <Power size={15} />
                      <span>إيقاف وضع عدم الاتصال (Turn OFF)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
