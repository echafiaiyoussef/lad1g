import { useState, useEffect } from 'react';
import { Order, OrderStatus } from '../types';

export type OfflineOrderLimit = 30 | 50 | 100 | 200 | 300 | 500 | 1000 | 'all';

export const OFFLINE_LIMIT_OPTIONS: { value: OfflineOrderLimit; label: string; countText: string; desc: string }[] = [
  { value: 30, label: '30 طلب', countText: 'آخر 30 طلب', desc: 'خفيف وسريع جداً' },
  { value: 50, label: '50 طلب', countText: 'آخر 50 طلب', desc: 'مناسب للاستخدام اليومي' },
  { value: 100, label: '100 طلب', countText: 'آخر 100 طلب', desc: 'الخيار القياسي الموصى به' },
  { value: 200, label: '200 طلب', countText: 'آخر 200 طلب', desc: 'مناسب للمغاسل المزدحمة' },
  { value: 300, label: '300 طلب', countText: 'آخر 300 طلب', desc: 'سجل متكامل لعدة أسابيع' },
  { value: 500, label: '500 طلب', countText: 'آخر 500 طلب', desc: 'حفظ موسع لكافة الفواتير الحديثة' },
  { value: 1000, label: '1000 طلب', countText: 'آخر 1000 طلب', desc: 'أرشيف ضخم للعمل المطول' },
  { value: 'all', label: 'كافة البيانات (الكل)', countText: 'جميع الطلبات المسجلة', desc: 'تنزيل كامل قاعدة البيانات محلياً' },
];

export const MANUAL_OFFLINE_KEY = 'laundry_manual_offline_mode';
export const OFFLINE_LIMIT_KEY = 'laundry_offline_cache_limit';
export const OFFLINE_SAVED_COUNT_KEY = 'laundry_offline_saved_count';
export const OFFLINE_SAVED_AT_KEY = 'laundry_offline_saved_at';

export type OfflineActionType = 
  | 'CREATE_ORDER' 
  | 'UPDATE_ORDER_STATUS' 
  | 'UPDATE_ORDER' 
  | 'DELETE_ORDER'
  | 'CREATE_INVENTORY'
  | 'UPDATE_INVENTORY' 
  | 'DELETE_INVENTORY' 
  | 'CREATE_SUBSCRIPTION'
  | 'UPDATE_SUBSCRIPTION'
  | 'UPDATE_SUBSCRIPTION_BALANCE' 
  | 'CREATE_PACKAGE'
  | 'UPDATE_PACKAGE'
  | 'DELETE_PACKAGE'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'UPDATE_USER_STATUS'
  | 'UPDATE_USER_PASSWORD'
  | 'DELETE_USER';

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  payload: any;
  createdAt: string;
  laundryId?: string;
  retryCount?: number;
}

const QUEUE_KEY = 'laundry_offline_sync_queue';

export function cleanTenantStringHelper(str?: string): string {
  if (!str) return '';
  return String(str)
    .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\|/i, '')
    .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '')
    .replace(/^laund-[a-z0-9]+\|/i, '')
    .replace(/^laund-[a-z0-9]+-/i, '')
    .trim();
}

/**
 * Strict deduplication helper that ensures no duplicate orders by ID or order_number
 */
export function deduplicateOrders<T extends { id?: string; order_number?: string }>(orders: T[]): T[] {
  if (!Array.isArray(orders)) return [];
  const seenIds = new Set<string>();
  const seenNumbers = new Set<string>();
  const result: T[] = [];

  for (const o of orders) {
    if (!o) continue;
    const cleanId = o.id ? String(o.id).trim().toLowerCase() : '';
    const cleanNum = cleanTenantStringHelper(o.order_number).toLowerCase();

    // If already seen by ID or by Order Number, skip to prevent duplicates
    if (cleanId && seenIds.has(cleanId)) {
      continue;
    }
    if (cleanNum && seenNumbers.has(cleanNum)) {
      continue;
    }

    if (cleanId) seenIds.add(cleanId);
    if (cleanNum) seenNumbers.add(cleanNum);
    result.push(o);
  }
  return result;
}

export function isDeviceOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function isManualOffline(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MANUAL_OFFLINE_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export function isBrowserOnline(): boolean {
  if (isManualOffline()) return false;
  return isDeviceOnline();
}

export function setManualOffline(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(MANUAL_OFFLINE_KEY, 'true');
    } else {
      localStorage.removeItem(MANUAL_OFFLINE_KEY);
    }
    window.dispatchEvent(new CustomEvent('manual-offline-changed', { detail: { enabled } }));
    window.dispatchEvent(new CustomEvent('offline-status-changed', { detail: { isOnline: !enabled && isDeviceOnline() } }));
  } catch (e) {
    console.error('Failed to set manual offline status:', e);
  }
}

export function getOfflineCacheLimit(): OfflineOrderLimit {
  try {
    const val = localStorage.getItem(OFFLINE_LIMIT_KEY);
    if (val === 'all') return 'all';
    const num = Number(val);
    if ([30, 50, 100, 200, 300, 500, 1000].includes(num)) {
      return num as OfflineOrderLimit;
    }
  } catch (e) {}
  return 100;
}

export function setOfflineCacheLimit(limit: OfflineOrderLimit): void {
  try {
    localStorage.setItem(OFFLINE_LIMIT_KEY, String(limit));
  } catch (e) {}
}

export function getOfflineSavedInfo(): { isManualOffline: boolean; savedAt: string | null; count: number; limit: OfflineOrderLimit } {
  try {
    const isManual = isManualOffline();
    const savedAt = localStorage.getItem(OFFLINE_SAVED_AT_KEY);
    const count = Number(localStorage.getItem(OFFLINE_SAVED_COUNT_KEY) || 0);
    const limit = getOfflineCacheLimit();
    return { isManualOffline: isManual, savedAt, count, limit };
  } catch (e) {
    return { isManualOffline: false, savedAt: null, count: 0, limit: 100 };
  }
}

export function clearOfflineCache(laundryId?: string): void {
  try {
    if (laundryId) {
      localStorage.removeItem(`laundry_orders_${laundryId}`);
    }
    localStorage.removeItem('laundry_orders');
    localStorage.removeItem(OFFLINE_SAVED_COUNT_KEY);
    localStorage.removeItem(OFFLINE_SAVED_AT_KEY);
    setManualOffline(false);
    window.dispatchEvent(new CustomEvent('offline-cache-cleared'));
  } catch (e) {
    console.error('Failed to clear offline cache:', e);
  }
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => isBrowserOnline());

  useEffect(() => {
    const handleStatusUpdate = () => {
      setIsOnline(isBrowserOnline());
    };

    window.addEventListener('online', handleStatusUpdate);
    window.addEventListener('offline', handleStatusUpdate);
    window.addEventListener('manual-offline-changed', handleStatusUpdate);
    window.addEventListener('offline-status-changed', handleStatusUpdate);
    window.addEventListener('storage', handleStatusUpdate);

    return () => {
      window.removeEventListener('online', handleStatusUpdate);
      window.removeEventListener('offline', handleStatusUpdate);
      window.removeEventListener('manual-offline-changed', handleStatusUpdate);
      window.removeEventListener('offline-status-changed', handleStatusUpdate);
      window.removeEventListener('storage', handleStatusUpdate);
    };
  }, []);

  return isOnline;
}

export function useManualOfflineStatus(): boolean {
  const [isManual, setIsManual] = useState<boolean>(() => isManualOffline());

  useEffect(() => {
    const update = () => setIsManual(isManualOffline());
    window.addEventListener('manual-offline-changed', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('manual-offline-changed', update);
      window.removeEventListener('storage', update);
    };
  }, []);

  return isManual;
}

export async function downloadAndSaveDataForOffline(
  supabase: any,
  laundryId: string | undefined,
  limit: OfflineOrderLimit = 100,
  onProgress?: (statusText: string) => void
): Promise<{ success: boolean; count: number; orders: Order[]; error?: string }> {
  if (!isDeviceOnline()) {
    throw new Error('لا يوجد اتصال بشبكة الإنترنت لتنزيل البيانات من قاعدة البيانات السحابية');
  }

  try {
    if (onProgress) onProgress('جاري فحص الاتصال وقاعدة البيانات...');

    let isMulti = true;
    try {
      const { error } = await supabase.from('orders').select('laundry_id').limit(1);
      if (error && error.code === '42703') isMulti = false;
    } catch (e) {}

    if (onProgress) onProgress(limit === 'all' ? 'جاري جلب جميع الفواتير...' : `جاري جلب آخر ${limit} فاتورة...`);

    let ordersQuery = supabase.from('orders').select('*');
    if (isMulti && laundryId) {
      ordersQuery = ordersQuery.eq('laundry_id', laundryId);
    }
    ordersQuery = ordersQuery.order('created_at', { ascending: false });
    if (limit !== 'all') {
      ordersQuery = ordersQuery.limit(limit);
    }

    const { data: ordersData, error: ordersError } = await ordersQuery;
    if (ordersError) throw ordersError;

    let processedOrders = ordersData || [];
    if (laundryId) {
      if (!isMulti) {
        processedOrders = processedOrders.filter((o: any) => 
          (o.order_number && o.order_number.startsWith(`${laundryId}-`)) || 
          (o.customer_phone && o.customer_phone.startsWith(`${laundryId}|`))
        );
      }
      processedOrders = processedOrders.map((o: any) => ({
        ...o,
        order_number: cleanTenantStringHelper(o.order_number),
        customer_name: cleanTenantStringHelper(o.customer_name),
        customer_phone: cleanTenantStringHelper(o.customer_phone)
      }));
    }

    // Preserve any pending unsynced offline orders created previously with zero duplication
    const currentQueue = getOfflineQueue();
    const pendingCreatedOrders = currentQueue
      .filter(a => a.type === 'CREATE_ORDER')
      .map(a => a.payload);
    if (pendingCreatedOrders.length > 0) {
      const existingIds = new Set(processedOrders.map((o: any) => (o.id ? String(o.id).toLowerCase() : '')));
      const existingNums = new Set(processedOrders.map((o: any) => cleanTenantStringHelper(o.order_number).toLowerCase()));
      const unsaved = pendingCreatedOrders.filter((po: any) => {
        const poId = po.id ? String(po.id).toLowerCase() : '';
        const poNum = cleanTenantStringHelper(po.order_number).toLowerCase();
        return (!poId || !existingIds.has(poId)) && (!poNum || !existingNums.has(poNum));
      });
      if (unsaved.length > 0) {
        processedOrders = [...unsaved, ...processedOrders];
      }
    }

    // Strictly deduplicate processedOrders by ID and Order Number
    processedOrders = deduplicateOrders(processedOrders);

    if (onProgress) onProgress('جاري حفظ المواد والخدمات والاشتراكات...');

    // Also download and save inventory, categories, packages, subscriptions
    try {
      let invQ = supabase.from('inventory').select('*');
      if (isMulti && laundryId) invQ = invQ.eq('laundry_id', laundryId);
      const { data: invData } = await invQ;
      if (invData && invData.length > 0) {
        const cleanInv = invData.map((i: any) => ({ ...i, name: cleanTenantStringHelper(i.name) }));
        if (laundryId) localStorage.setItem(`laundry_inventory_${laundryId}`, JSON.stringify(cleanInv));
        localStorage.setItem('laundry_inventory', JSON.stringify(cleanInv));
      }
    } catch (e) {}

    try {
      let subsQ = supabase.from('subscriptions').select('*');
      if (isMulti && laundryId) subsQ = subsQ.eq('laundry_id', laundryId);
      const { data: subsData } = await subsQ;
      if (subsData && subsData.length > 0) {
        if (laundryId) localStorage.setItem(`laundry_subscriptions_${laundryId}`, JSON.stringify(subsData));
        localStorage.setItem('laundry_subscriptions', JSON.stringify(subsData));
      }
    } catch (e) {}

    try {
      let pkgQ = supabase.from('subscription_packages').select('*');
      if (isMulti && laundryId) pkgQ = pkgQ.eq('laundry_id', laundryId);
      const { data: pkgData } = await pkgQ;
      if (pkgData && pkgData.length > 0) {
        if (laundryId) localStorage.setItem(`laundry_subscription_packages_${laundryId}`, JSON.stringify(pkgData));
        localStorage.setItem('laundry_subscription_packages', JSON.stringify(pkgData));
      }
    } catch (e) {}

    // Download and cache user profiles for offline management
    try {
      let profQ = supabase.from('profiles').select('*');
      if (isMulti && laundryId) profQ = profQ.eq('laundry_id', laundryId);
      const { data: profData } = await profQ;
      if (profData && profData.length > 0) {
        if (laundryId) localStorage.setItem(`laundry_profiles_${laundryId}`, JSON.stringify(profData));
        localStorage.setItem('laundry_profiles_all', JSON.stringify(profData));
        localStorage.setItem('laundry_profiles', JSON.stringify(profData));
      }
    } catch (e) {}

    // Download and cache user permissions map and settings
    try {
      const { data: sData } = await supabase.from('settings').select('*');
      if (sData && sData.length > 0) {
        sData.forEach((setting: any) => {
          if (setting.key === 'platform_user_permissions_map') {
            localStorage.setItem('platform_user_permissions_map', JSON.stringify(setting.value));
          } else if (setting.key === 'platform_disabled_users_map') {
            localStorage.setItem('platform_disabled_users_map', JSON.stringify(setting.value));
          } else if (setting.key === 'platform_user_passwords_map') {
            localStorage.setItem('platform_user_passwords_map', JSON.stringify(setting.value));
          } else if (setting.key === 'platform_subscriptions_map') {
            localStorage.setItem('platform_subscriptions_map', JSON.stringify(setting.value));
          }
        });
      }
    } catch (e) {}

    // Save orders into localStorage
    const serializedOrders = JSON.stringify(processedOrders);
    if (laundryId) {
      localStorage.setItem(`laundry_orders_${laundryId}`, serializedOrders);
    }
    localStorage.setItem('laundry_orders', serializedOrders);

    // Save metadata
    setOfflineCacheLimit(limit);
    localStorage.setItem(OFFLINE_SAVED_COUNT_KEY, String(processedOrders.length));
    localStorage.setItem(OFFLINE_SAVED_AT_KEY, new Date().toISOString());

    // Switch to manual offline mode
    setManualOffline(true);

    if (onProgress) onProgress(`تم حفظ ${processedOrders.length} طلب بنجاح وتفعيل وضع الأوفلاين!`);

    return {
      success: true,
      count: processedOrders.length,
      orders: processedOrders
    };
  } catch (err: any) {
    console.error('Error saving data for offline:', err);
    return {
      success: false,
      count: 0,
      orders: [],
      error: err.message || 'فشل تنزيل وحفظ بيانات الأوفلاين'
    };
  }
}

/**
 * Return to online mode and synchronize any pending queue items
 */
export async function returnToOnlineAndSync(
  supabase: any,
  laundryId?: string,
  onProgress?: (synced: number, total: number) => void
): Promise<{ success: boolean; syncedCount: number; remainingCount: number; errors: string[] }> {
  let syncResult = { success: true, syncedCount: 0, remainingCount: getOfflineQueue().length, errors: [] as string[] };
  
  if (isDeviceOnline() && syncResult.remainingCount > 0) {
    syncResult = await syncOfflineQueue(supabase, laundryId, onProgress);
  }

  // Deactivate manual offline mode
  setManualOffline(false);

  return syncResult;
}

/**
 * Explicit function to turn OFF offline mode at any time
 */
export async function turnOffOfflineMode(
  supabase?: any,
  laundryId?: string,
  onProgress?: (synced: number, total: number) => void
): Promise<{ success: boolean; syncedCount: number; remainingCount: number; errors: string[] }> {
  let syncResult = { success: true, syncedCount: 0, remainingCount: getOfflineQueue().length, errors: [] as string[] };

  if (supabase && isDeviceOnline() && syncResult.remainingCount > 0) {
    syncResult = await syncOfflineQueue(supabase, laundryId, onProgress);
  }

  // Deactivate manual offline mode completely
  setManualOffline(false);

  return syncResult;
}

export function getOfflineQueue(): OfflineAction[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read offline queue from localStorage:', e);
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineAction[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: { count: queue.length } }));
  } catch (e) {
    console.error('Failed to save offline queue to localStorage:', e);
  }
}

export function addOfflineAction(action: Omit<OfflineAction, 'id' | 'createdAt'>): OfflineAction {
  const queue = getOfflineQueue();

  // Prevent duplicate CREATE_ORDER actions in the offline queue
  if (action.type === 'CREATE_ORDER' && action.payload) {
    const pId = action.payload.id ? String(action.payload.id).toLowerCase() : '';
    const pNum = cleanTenantStringHelper(action.payload.order_number).toLowerCase();
    const existingIndex = queue.findIndex(q => {
      if (q.type !== 'CREATE_ORDER' || !q.payload) return false;
      const qId = q.payload.id ? String(q.payload.id).toLowerCase() : '';
      const qNum = cleanTenantStringHelper(q.payload.order_number).toLowerCase();
      return (pId && qId === pId) || (pNum && qNum === pNum);
    });
    if (existingIndex !== -1) {
      // Replace existing pending action with latest payload instead of creating duplicates
      const updatedAction: OfflineAction = {
        ...action,
        id: queue[existingIndex].id,
        createdAt: new Date().toISOString(),
        retryCount: queue[existingIndex].retryCount || 0
      };
      queue[existingIndex] = updatedAction;
      saveOfflineQueue(queue);
      return updatedAction;
    }
  }

  const newAction: OfflineAction = {
    ...action,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  queue.push(newAction);
  saveOfflineQueue(queue);
  return newAction;
}

export function removeOfflineAction(id: string): void {
  const queue = getOfflineQueue().filter(item => item.id !== id);
  saveOfflineQueue(queue);
}

export function clearOfflineQueue(): void {
  saveOfflineQueue([]);
}

export const ensureUUID = (str?: string): string => {
  if (!str) return '00000000-0000-0000-0000-000000000000';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) return str.toLowerCase();
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const hex1 = Math.abs(hash).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash * 31).toString(16).padStart(8, '0');
  const hex3 = Math.abs(hash * 57).toString(16).padStart(8, '0');
  const hex4 = Math.abs(hash * 93).toString(16).padStart(8, '0');
  const rawHex = (hex1 + hex2 + hex3 + hex4).substring(0, 32).padEnd(32, 'f');
  return `${rawHex.slice(0, 8)}-${rawHex.slice(8, 12)}-${rawHex.slice(12, 16)}-${rawHex.slice(16, 20)}-${rawHex.slice(20, 32)}`;
};

/**
 * Synchronize all pending actions with the Supabase database
 */
export async function syncOfflineQueue(
  supabase: any,
  laundryId?: string,
  onProgress?: (synced: number, total: number) => void
): Promise<{ success: boolean; syncedCount: number; remainingCount: number; errors: string[] }> {
  if (!isBrowserOnline()) {
    return { success: false, syncedCount: 0, remainingCount: getOfflineQueue().length, errors: ['لا يوجد اتصال بالإنترنت'] };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0, remainingCount: 0, errors: [] };
  }

  let syncedCount = 0;
  const errors: string[] = [];
  const remainingQueue: OfflineAction[] = [];

  for (let i = 0; i < queue.length; i++) {
    const action = queue[i];
    try {
      if (action.type === 'CREATE_ORDER') {
        const p = action.payload;
        const targetLaundryId = ensureUUID(p.laundry_id || action.laundryId || laundryId);
        
        // Clean order payload to match standard Supabase orders table schema
        const orderDataToInsert: any = {
          id: p.id,
          order_number: p.order_number,
          customer_name: p.customer_name,
          customer_phone: p.customer_phone,
          order_type: p.order_type || 'مغسلة',
          items: p.items || [],
          subtotal: Number(p.subtotal) || 0,
          tax: Number(p.tax) || 0,
          total: Number(p.total) || 0,
          custom_adjustment: Number(p.custom_adjustment) || 0,
          is_paid: !!p.is_paid,
          payment_method: p.payment_method || 'Cash',
          status: p.status || 'Received',
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at || new Date().toISOString(),
          laundry_id: targetLaundryId
        };

        // Check if an order with this ID or order_number already exists in Supabase to avoid duplicates
        const cleanNum = cleanTenantStringHelper(p.order_number);
        const pId = p.id;
        let alreadyInDatabase = false;

        try {
          let checkQuery = supabase.from('orders').select('id, order_number');
          if (targetLaundryId) {
            checkQuery = checkQuery.or(`id.eq.${pId},order_number.eq.${cleanNum},order_number.eq.${targetLaundryId}-${cleanNum}`);
          } else {
            checkQuery = checkQuery.or(`id.eq.${pId},order_number.eq.${cleanNum}`);
          }
          const { data: existingRows } = await checkQuery.limit(1);
          if (existingRows && existingRows.length > 0) {
            alreadyInDatabase = true;
            console.log(`Order ${cleanNum} (ID: ${pId}) already in DB, updating existing record...`);
            await supabase.from('orders').update({
              customer_name: orderDataToInsert.customer_name,
              customer_phone: orderDataToInsert.customer_phone,
              items: orderDataToInsert.items,
              subtotal: orderDataToInsert.subtotal,
              tax: orderDataToInsert.tax,
              total: orderDataToInsert.total,
              status: orderDataToInsert.status,
              is_paid: orderDataToInsert.is_paid,
              payment_method: orderDataToInsert.payment_method,
              updated_at: new Date().toISOString()
            }).eq('id', existingRows[0].id);
            syncedCount++;
          }
        } catch (checkErr) {
          console.warn("Duplicate pre-check warning:", checkErr);
        }

        if (!alreadyInDatabase) {
          // Try upsert first
          let { error } = await supabase.from('orders').upsert([orderDataToInsert], { onConflict: 'id' });
          
          if (error) {
            console.warn('Sync CREATE_ORDER upsert returned error, trying fallback insert:', error);
            // If upsert failed due to missing column or constraint, retry with basic insert
            const retryRes = await supabase.from('orders').insert([orderDataToInsert]);
            error = retryRes.error;
          }

          // Check if error is duplicate key (already exists in DB), which means it's synced!
          if (error) {
            const errMsg = String(error.message || '').toLowerCase();
            const errCode = String(error.code || '');
            if (errCode === '23505' || errMsg.includes('duplicate') || errMsg.includes('already exists') || errMsg.includes('unique')) {
              console.log(`Order ${orderDataToInsert.order_number} is already in database, marking synced.`);
              error = null;
            }
          }

          if (error) throw error;
          syncedCount++;
        }
      } else if (action.type === 'UPDATE_ORDER_STATUS') {
        const { orderId, status, updated_at } = action.payload;
        const { error } = await supabase.from('orders').update({
          status,
          updated_at: updated_at || new Date().toISOString()
        }).eq('id', orderId);
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'UPDATE_ORDER') {
        const orderData = action.payload;
        const { error } = await supabase.from('orders').upsert([orderData], { onConflict: 'id' });
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'UPDATE_INVENTORY') {
        const { id, stock } = action.payload;
        const { error } = await supabase.from('inventory').update({ stock }).eq('id', id);
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'CREATE_INVENTORY') {
        const invData = action.payload;
        const targetLaundryId = ensureUUID(invData.laundry_id || action.laundryId || laundryId);
        const { error } = await supabase.from('inventory').upsert([{ ...invData, laundry_id: targetLaundryId }], { onConflict: 'id' });
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'DELETE_INVENTORY') {
        const { id } = action.payload;
        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'UPDATE_SUBSCRIPTION_BALANCE') {
        const { subId, items_remaining } = action.payload;
        const { error } = await supabase.from('subscriptions').update({ items_remaining }).eq('id', subId);
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'CREATE_SUBSCRIPTION') {
        const subData = action.payload;
        const targetLaundryId = ensureUUID(subData.laundry_id || action.laundryId || laundryId);
        const { error } = await supabase.from('subscriptions').upsert([{ ...subData, laundry_id: targetLaundryId }], { onConflict: 'id' });
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'UPDATE_SUBSCRIPTION') {
        const subData = action.payload;
        const targetLaundryId = ensureUUID(subData.laundry_id || action.laundryId || laundryId);
        const { error } = await supabase.from('subscriptions').upsert([{ ...subData, laundry_id: targetLaundryId }], { onConflict: 'id' });
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'CREATE_PACKAGE' || action.type === 'UPDATE_PACKAGE') {
        const pkgData = action.payload;
        const targetLaundryId = ensureUUID(pkgData.laundry_id || action.laundryId || laundryId);
        const { error } = await supabase.from('subscription_packages').upsert([{ ...pkgData, laundry_id: targetLaundryId }], { onConflict: 'id' });
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'DELETE_PACKAGE') {
        const { id } = action.payload;
        try {
          await supabase.from('subscriptions').delete().eq('package_id', id);
        } catch (e) {}
        const { error } = await supabase.from('subscription_packages').delete().eq('id', id);
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'CREATE_USER') {
        const userData = action.payload;
        const targetLaundryId = ensureUUID(userData.laundry_id || action.laundryId || laundryId);
        const { error } = await supabase.from('profiles').upsert([{ ...userData, laundry_id: targetLaundryId }], { onConflict: 'id' });
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'UPDATE_USER') {
        const { id, updates } = action.payload;
        const { error } = await supabase.from('profiles').update(updates).eq('id', id);
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'UPDATE_USER_STATUS') {
        const { id, is_disabled, status } = action.payload;
        try {
          let disabledMap: Record<string, boolean> = {};
          const { data: dData } = await supabase.from('settings').select('value').eq('key', 'platform_disabled_users_map');
          if (dData && dData.length > 0 && dData[0].value) {
            disabledMap = dData[0].value as Record<string, boolean>;
          }
          disabledMap[id] = is_disabled;
          await supabase.from('settings').upsert({
            key: 'platform_disabled_users_map',
            value: disabledMap,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
        } catch (e) {}
        const { error } = await supabase.from('profiles').update({ is_disabled, status }).eq('id', id);
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'UPDATE_USER_PASSWORD') {
        const { id, password } = action.payload;
        try {
          let pwdMap: Record<string, string> = {};
          const { data: pData } = await supabase.from('settings').select('value').eq('key', 'platform_user_passwords_map');
          if (pData && pData.length > 0 && pData[0].value) {
            pwdMap = pData[0].value as Record<string, string>;
          }
          pwdMap[id] = password;
          await supabase.from('settings').upsert({
            key: 'platform_user_passwords_map',
            value: pwdMap,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
        } catch (e) {}
        try {
          await supabase.from('profiles').update({ password }).eq('id', id);
        } catch (e) {}
        syncedCount++;
      } else if (action.type === 'DELETE_USER') {
        const { id } = action.payload;
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
        syncedCount++;
      } else if (action.type === 'DELETE_ORDER') {
        const { orderId } = action.payload;
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) throw error;
        syncedCount++;
      }

      if (onProgress) {
        onProgress(syncedCount, queue.length);
      }
    } catch (err: any) {
      console.error(`Failed to sync action ${action.id} (${action.type}):`, err);
      errors.push(err.message || 'خطأ أثناء المزامنة');
      action.retryCount = (action.retryCount || 0) + 1;
      remainingQueue.push(action);
    }
  }

  saveOfflineQueue(remainingQueue);

  return {
    success: errors.length === 0,
    syncedCount,
    remainingCount: remainingQueue.length,
    errors,
  };
}
