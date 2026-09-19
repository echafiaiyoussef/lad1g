import React, { useState, useEffect } from 'react';
import { RefreshCw, Cloud, CloudOff, X, SlidersHorizontal, ArrowLeftRight, Power } from 'lucide-react';
import { 
  useOnlineStatus, 
  useManualOfflineStatus, 
  getOfflineQueue, 
  syncOfflineQueue, 
  returnToOnlineAndSync,
  turnOffOfflineMode,
  getOfflineSavedInfo 
} from '../services/offlineSyncService';
import { supabase } from '../supabase';

interface OfflineBarProps {
  laundryId?: string;
  onSyncCompleted?: () => void;
  onSyncSuccess?: () => void;
  onOpenOfflineModal?: () => void;
}

export const OfflineBar: React.FC<OfflineBarProps> = ({ 
  laundryId, 
  onSyncCompleted, 
  onSyncSuccess,
  onOpenOfflineModal 
}) => {
  const isOnline = useOnlineStatus();
  const isManualOffline = useManualOfflineStatus();
  const [queueCount, setQueueCount] = useState<number>(() => getOfflineQueue().length);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [savedCount, setSavedCount] = useState<number>(() => getOfflineSavedInfo().count);

  const triggerSyncCallback = () => {
    if (onSyncCompleted) onSyncCompleted();
    if (onSyncSuccess) onSyncSuccess();
  };

  useEffect(() => {
    const updateQueue = () => {
      const count = getOfflineQueue().length;
      setQueueCount(count);
      setSavedCount(getOfflineSavedInfo().count);
      if (count > 0 || isManualOffline) {
        setIsDismissed(false); // Re-show if new actions queued or offline mode active
      }
    };

    window.addEventListener('offline-queue-changed', updateQueue);
    window.addEventListener('manual-offline-changed', updateQueue);
    window.addEventListener('storage', updateQueue);

    return () => {
      window.removeEventListener('offline-queue-changed', updateQueue);
      window.removeEventListener('manual-offline-changed', updateQueue);
      window.removeEventListener('storage', updateQueue);
    };
  }, [isManualOffline]);

  // Automatic sync when connection is restored in online mode
  useEffect(() => {
    if (isOnline && queueCount > 0 && !isSyncing && !isManualOffline) {
      handleManualSync();
    }
  }, [isOnline, isManualOffline]);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage('جاري المزامنة مع السحابة...');

    try {
      const result = await syncOfflineQueue(supabase, laundryId);
      setQueueCount(result.remainingCount);

      if (result.syncedCount > 0) {
        setSyncMessage(`تمت مزامنة ${result.syncedCount} عملية بنجاح ✅`);
        triggerSyncCallback();
        setTimeout(() => setSyncMessage(null), 3500);
      } else if (result.remainingCount === 0) {
        setSyncMessage('كافة البيانات محدثة مع السحابة ✅');
        triggerSyncCallback();
        setTimeout(() => setSyncMessage(null), 2500);
      }
    } catch (e: any) {
      setSyncMessage('تعذرت المزامنة، ستتم المحاولة لاحقاً');
      setTimeout(() => setSyncMessage(null), 3500);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleQuickReturnOnline = async () => {
    setIsSyncing(true);
    setSyncMessage('جاري إيقاف الأوفلاين والمزامنة مع السحابة...');
    try {
      const result = await turnOffOfflineMode(supabase, laundryId);
      setQueueCount(result.remainingCount);
      if (result.syncedCount > 0) {
        setSyncMessage(`تم إيقاف الأوفلاين ومزامنة ${result.syncedCount} عملية بنجاح ✅`);
      } else {
        setSyncMessage('تم إيقاف وضع عدم الاتصال والعودة للوضع المتصل السحابي بنجاح ✅');
      }
      triggerSyncCallback();
      setTimeout(() => setSyncMessage(null), 3000);
    } catch (e) {
      setSyncMessage('حدث خطأ أثناء العودة للمتصل');
      setTimeout(() => setSyncMessage(null), 2500);
    } finally {
      setIsSyncing(false);
    }
  };

  // If dismissed or online with nothing to sync and no active message and not in manual offline
  if (isDismissed || (isOnline && queueCount === 0 && !syncMessage && !isManualOffline)) {
    return null;
  }

  return (
    <div
      id="offline-status-banner"
      className={`w-full shrink-0 transition-all duration-300 px-3 md:px-6 py-2 text-xs md:text-sm font-semibold flex items-center justify-between gap-3 shadow-sm select-none z-50 ${
        isManualOffline
          ? 'bg-amber-600 text-white border-b border-amber-700'
          : !isOnline
          ? 'bg-orange-600 text-white border-b border-orange-700'
          : queueCount > 0
          ? 'bg-indigo-600 text-white border-b border-indigo-700'
          : 'bg-emerald-600 text-white border-b border-emerald-700'
      }`}
      dir="rtl"
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        {isManualOffline ? (
          <>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            <CloudOff className="w-4 h-4 shrink-0 text-white" />
            <span className="font-bold truncate">وضع عدم الاتصال (أوفلاين مفعل):</span>
            <span className="text-amber-100 truncate text-[11px] md:text-xs">
              {savedCount > 0 ? `يعمل محلياً (${savedCount} طلب محفوظ). يتم حفظ الفواتير تلقائياً ومزامنتها.` : 'يعمل محلياً بالكامل، يتم حفظ الطلبات ومزامنتها عند العودة للوضع المتصل.'}
            </span>
          </>
        ) : !isOnline ? (
          <>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            <CloudOff className="w-4 h-4 shrink-0 text-white" />
            <span className="font-bold truncate">انقطع اتصال الإنترنت:</span>
            <span className="text-orange-100 truncate text-[11px] md:text-xs">
              النظام يعمل محلياً، يتم حفظ الطلبات ومزامنتها تلقائياً فور عودة الاتصال
            </span>
          </>
        ) : (
          <>
            <Cloud className="w-4 h-4 shrink-0 text-emerald-200" />
            <span className="font-bold truncate">متصل بالإنترنت:</span>
            <span className="truncate text-[11px] md:text-xs">
              {syncMessage || (queueCount > 0 ? `يوجد ${queueCount} عملية مسجلة محلياً بانتظار المزامنة` : 'كافة البيانات متزامنة')}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {queueCount > 0 && (
          <span className="bg-white/20 px-2 py-0.5 rounded-md text-[11px] font-bold">
            {queueCount} معلق
          </span>
        )}

        {isManualOffline && (
          <button
            type="button"
            id="btn-offlinebar-turn-off"
            onClick={handleQuickReturnOnline}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-white text-red-950 hover:bg-red-50 px-2.5 py-1 rounded-md font-black text-xs shadow-sm transition active:scale-95 disabled:opacity-50"
            title="إيقاف وضع عدم الاتصال والعودة للوضع المتصل السحابي"
          >
            <Power className="w-3.5 h-3.5 text-red-600" />
            <span>{isSyncing ? 'جاري الإيقاف...' : 'إيقاف الأوفلاين (Turn OFF)'}</span>
          </button>
        )}

        {onOpenOfflineModal && (
          <button
            type="button"
            onClick={onOpenOfflineModal}
            className="flex items-center gap-1 bg-black/20 hover:bg-black/30 text-white px-2 py-1 rounded-md font-bold text-xs transition"
            title="إعدادات الأوفلاين وتحديد عدد الطلبات"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خيارات الأوفلاين</span>
          </button>
        )}

        {isOnline && queueCount > 0 && !isManualOffline && (
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-white text-indigo-900 hover:bg-indigo-50 px-2.5 py-1 rounded-md font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'جاري...' : 'مزامنة'}</span>
          </button>
        )}

        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 hover:bg-white/10 rounded transition text-white/80 hover:text-white"
          title="إغلاق التنبيه"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};


