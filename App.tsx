
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Package, 
  Wallet, 
  Search,
  ShoppingCart,
  CheckCircle,
  Clock,
  AlertTriangle,
  Printer,
  Share2,
  Trash2,
  X,
  Repeat,
  RotateCcw,
  Loader2,
  Camera,
  ScanQrCode,
  ScanBarcode,
  Scan,
  Barcode,
  TrendingUp,
  Plus,
  ArrowRight,
  ArrowLeft,
  Bell,
  Check,
  Database,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Layers,
  Banknote,
  Send,
  Download,
  Upload,
  Filter,
  Minus,
  Save,
  Edit3,
  Settings2,
  Menu,
  ShieldCheck,
  Zap,
  Gift,
  CreditCard,
  UserPlus,
  Edit2,
  FileSpreadsheet,
  FileText,
  Crown,
  Building2,
  Sparkles,
  Smile,
  Image as ImageIcon,
  ChevronDown,
  Lock,
  ShieldAlert,
  UserX,
  MessageCircle,
  Key,
  Globe,
  SlidersHorizontal,
  Box,
  Users,
  Eye,
  Receipt,
  Users2,
  MoreHorizontal,
  BarChart3,
  FileCheck,
  Store,
  ShoppingBag,
  Activity,
  Calendar,
  QrCode,
  CloudOff,
  Cloud
} from 'lucide-react';
import { Order, InventoryItem, OrderType, OrderStatus, LaundryItem, PaymentMethod, TwilioConfig, UserProfile, UserRole, Subscription, Offer, SubscriptionPackage } from './types';
import { BarcodeGenerator } from './components/BarcodeGenerator';
import { InvoiceQRCode, getInvoiceQRDataUrl } from './components/InvoiceQRCode';
import { ClothingTagsPrintView } from './components/ClothingTagsPrintView';
import { setupHardwareBarcodeScannerListener, playScannerBeep, matchOrderFromScannedCode } from './services/hardwareBarcodeScanner';
import { Auth } from './components/Auth';
import { LandingPage } from './components/LandingPage';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { generateSmartReminder, MessageContext } from './services/geminiService';
import { sendTwilioWhatsApp } from './services/twilioService';
import { OfflineBar } from './components/OfflineBar';
import { OfflineModeModal } from './components/OfflineModeModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { PaginationBar } from './components/PaginationBar';
import { 
  addOfflineAction, 
  isBrowserOnline, 
  syncOfflineQueue, 
  getOfflineQueue,
  isManualOffline,
  getOfflineCacheLimit,
  deduplicateOrders,
  turnOffOfflineMode
} from './services/offlineSyncService';
import { WhatsAppBotModal } from './components/WhatsAppBotModal';
import { OrderQRScannerModal } from './components/OrderQRScannerModal';
import {
  WhatsAppBotStatus,
  getWhatsAppBotStatus,
  sendWhatsAppBotMessage,
  disconnectWhatsAppBot,
} from './services/whatsappBotClient';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Helper: Cache orders locally only when manual offline mode is enabled by the user
const cacheOrdersLocally = (ordersList: Order[], laundryId?: string) => {
  if (!isManualOffline()) {
    return;
  }
  try {
    const limit = getOfflineCacheLimit();
    const toCache = limit === 'all' ? ordersList : ordersList.slice(0, typeof limit === 'number' ? limit : 100);
    const serialized = JSON.stringify(toCache);
    if (laundryId) {
      localStorage.setItem(`laundry_orders_${laundryId}`, serialized);
    }
    localStorage.setItem('laundry_orders', serialized);
  } catch (e) {
    console.warn("Failed to cache orders to localStorage:", e);
  }
};

// Ensure html2pdf is available via window as fallback
declare var html2pdf: any;

const ensureUUID = (str: string): string => {
  if (!str) return '00000000-0000-0000-0000-000000000000';
  
  // Check if it's already a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str.toLowerCase();
  }
  
  // Deterministically hash the string to a UUID format
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash1 = (hash1 * 31 + ch) | 0;
    hash2 = (hash2 * 37 + ch) | 0;
  }
  
  const hex1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
  const hex3 = Math.abs(hash1 ^ hash2).toString(16).padStart(8, '0');
  const hex4 = Math.abs(hash1 + hash2).toString(16).padStart(8, '0');
  
  const rawHex = (hex1 + hex2 + hex3 + hex4).substring(0, 32).padEnd(32, 'f');
  
  return `${rawHex.slice(0, 8)}-${rawHex.slice(8, 12)}-${rawHex.slice(12, 16)}-${rawHex.slice(16, 20)}-${rawHex.slice(20, 32)}`;
};

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback if randomUUID fails (e.g. HTTP non-secure context)
    }
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: number) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
      );
    } catch (e) {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, '');
  // Get the last 9 digits (which is standard for Saudi mobile numbers without country code or leading 0)
  return digits.slice(-9);
};

const isImageIcon = (str?: string): boolean => {
  if (!str) return false;
  const s = str.trim();
  return (
    s.startsWith('data:image/') ||
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('blob:') ||
    s.includes('/') ||
    s.includes('.')
  );
};

const compressImageFile = (file: File, maxSize = 200): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', 0.85) || canvas.toDataURL('image/png'));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const renderCategoryIcon = (iconStr?: string, className: string = "w-12 h-12 text-2xl flex items-center justify-center bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden p-1") => {
  const icon = iconStr?.trim() || '✨';
  if (isImageIcon(icon)) {
    return (
      <div className={className}>
        <img src={icon} alt="Icon" className="w-full h-full object-cover rounded-xl" />
      </div>
    );
  }
  return <div className={className}><span>{icon}</span></div>;
};

const INITIAL_ITEMS = [
  { name: 'ثوب', price: 5, icon: '👕' },
  { name: 'غترة/شماغ', price: 3, icon: '🧣' },
  { name: 'قميص', price: 4, icon: '👔' },
  { name: 'بنطلون', price: 4, icon: '👖' },
  { name: 'تيشرت', price: 3, icon: '👕' },
  { name: 'فستان', price: 15, icon: '👗' },
  { name: 'جاكيت', price: 10, icon: '🧥' },
  { name: 'بطانية', price: 25, icon: '🛌' },
  { name: 'سجادة', price: 30, icon: '🧶' },
  { name: 'بدلة كاملة', price: 15, icon: '🤵' },
  { name: 'ملاءة سرير', price: 10, icon: '🛏️' },
];

const PRESET_CUSTOM_ICONS = [
  '✨', '👕', '👔', '👗', '🥼', '🧥', '👖', '🥋', 
  '🧦', '🧣', '🧤', '🧢', '🎩', '🛏️', '🧺', '🧽', 
  '🧼', '🛋️', '👑', '🎒', '👟', '👠', '🧵', '🏷️', 
  '🧶', '👰', '🤵', '🥾', '👜', '🧳', '🧸', '🚿'
];

const PRESET_INVENTORY_ITEMS = [
  { name: 'شامبو عباية', stock: 30000, unit: 'مل', defaultConsumption: 30, threshold: 500 },
  { name: 'منعم ملابس', stock: 30000, unit: 'مل', defaultConsumption: 30, threshold: 500 },
  { name: 'سائل مبيض كلور', stock: 30000, unit: 'مل', defaultConsumption: 30, threshold: 500 },
  { name: 'صودا سائل', stock: 30000, unit: 'مل', defaultConsumption: 30, threshold: 500 },
  { name: 'سائل فيري', stock: 30000, unit: 'مل', defaultConsumption: 30, threshold: 500 },
  { name: 'سائل كمفورت', stock: 30000, unit: 'مل', defaultConsumption: 30, threshold: 500 },
  { name: 'الصابون بودرة', stock: 30000, unit: 'جرام', defaultConsumption: 50, threshold: 500 },
  { name: 'صودا الغسيل (قشور)', stock: 25000, unit: 'مل', defaultConsumption: 12.5, threshold: 500 },
  { name: 'معطر رحاب', stock: 6000, unit: 'مل', defaultConsumption: 5.56, threshold: 200 },
  { name: 'علاقات الملابس', stock: 450, unit: 'حبة', defaultConsumption: 1, threshold: 50 },
  { name: 'نشاء الكوي', stock: 12000, unit: 'مل', defaultConsumption: 55.56, threshold: 500 },
  { name: 'نيلة الملابس', stock: 9000, unit: 'مل', defaultConsumption: 3.75, threshold: 200 },
  { name: 'كيس ملابس الداخلية', stock: 900, unit: 'كيس', defaultConsumption: 0.083, threshold: 50 },
  { name: 'رول ورق كاشير', stock: 500, unit: 'لفة', defaultConsumption: 1, threshold: 20 },
  { name: 'كرتون ورق شماغ', stock: 2500, unit: 'حبة', defaultConsumption: 1, threshold: 100 },
  { name: 'رول بلاستيك ملابس طويل', stock: 250, unit: 'حبة', defaultConsumption: 1, threshold: 20 },
  { name: 'رول بلاستيك ملابس قصير', stock: 250, unit: 'حبة', defaultConsumption: 1, threshold: 20 },
];

const TAX_RATE = 0.15;

const DISCLAIMER_TEXT = "تنويه هام: المغسلة غير مسؤولة عن فقدان أي أغراض شخصية تُترك داخل الملابس عند استلامها، كما لا تتحمل مسؤولية حفظ الملابس أو الأغراض بعد مضي (15) يومًا من تاريخ الاستلام.";

const statusArabic: Record<OrderStatus, string> = {
  Received: 'تم الاستلام',
  Washing: 'جاري الغسيل',
  Ironing: 'جاري الكي',
  Ready: 'جاهز للاستلام',
  Delivered: 'تم التسليم',
};

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ['super-admin'],
  admin: ['dashboard', 'new-order', 'orders', 'inventory', 'finance', 'users', 'settings', 'subscriptions'],
  manager: ['dashboard', 'new-order', 'orders', 'inventory', 'finance', 'subscriptions'],
  staff: ['dashboard', 'new-order', 'orders'],
};

const navItems = [
  { id: 'dashboard', label: 'الرئيسية (الكاشير)', icon: LayoutDashboard },
  { id: 'new-order', label: 'كاشير جديد', icon: PlusCircle },
  { id: 'orders', label: 'الطلبات', icon: Package },
  { id: 'inventory', label: 'المخزون', icon: Layers },
  { id: 'finance', label: 'الحسابات', icon: Wallet },
  { id: 'subscriptions', label: 'الاشتراكات', icon: CreditCard },
  { id: 'users', label: 'المستخدمين', icon: User },
  { id: 'settings', label: 'الإعدادات', icon: Settings2 },
  { id: 'super-admin', label: 'إدارة شبكة المنصة', icon: ShieldAlert },
];

const formatMoney = (val: number, decimals: number = 2): string => {
  return Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const formatInteger = (val: number): string => {
  return Number(val || 0).toLocaleString('en-US');
};

const safeFormatDate = (dateVal: any, locale: string = 'ar-SA-u-nu-latn', fallback: string = '-'): string => {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 30);
      if (d > farFuture) {
        return 'لا محدود';
      }
      return d.toLocaleDateString(locale);
    }
  } catch (e) {}
  return fallback;
};

const safeFormatDateWithTime = (dateVal: any, locale: string = 'ar-SA-u-nu-latn', fallback: string = '-'): string => {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 30);
      if (d > farFuture) {
        return 'لا محدود';
      }
      return d.toLocaleString(locale);
    }
  } catch (e) {}
  return fallback;
};

const safeDateToInputVal = (dateVal: any): string => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {}
  return '';
};

const safeAddDaysISO = (daysToAdd: any): string => {
  const d = new Date();
  const days = typeof daysToAdd === 'number' ? daysToAdd : (parseInt(daysToAdd, 10) ?? 30);
  if (days === 0 || days >= 36500) {
    d.setFullYear(d.getFullYear() + 100);
    return d.toISOString();
  }
  d.setDate(d.getDate() + days);
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() + 100);
    return fallback.toISOString();
  }
  return d.toISOString();
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(() => {
    try {
      const customUserStr = localStorage.getItem('custom_auth_user');
      if (customUserStr) {
        const u = JSON.parse(customUserStr);
        if (u && u.id) return { user: { id: u.id, email: u.email } };
      }
      const cachedProfileStr = localStorage.getItem('laundry_cached_profile');
      if (cachedProfileStr) {
        const p = JSON.parse(cachedProfileStr);
        if (p && p.id) return { user: { id: p.id, email: p.email } };
      }
    } catch (e) {}
    return null;
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const cachedProfileStr = localStorage.getItem('laundry_cached_profile');
      if (cachedProfileStr) {
        const p = JSON.parse(cachedProfileStr);
        if (p && p.id) return p;
      }
    } catch (e) {}
    return null;
  });

  const [isDbMultiTenant, setIsDbMultiTenant] = useState<boolean>(true);
  const [onboardingLaundryName, setOnboardingLaundryName] = useState('');
  const [onboardingPlan, setOnboardingPlan] = useState<'silver' | 'gold' | 'platinum'>('gold');
  const [showSaaSPaymentModal, setShowSaaSPaymentModal] = useState<boolean>(false);
  const [upgradePlanForm, setUpgradePlanForm] = useState<'silver' | 'gold' | 'platinum'>('gold');

  const [laundries, setLaundries] = useState<any[]>([]);
  const [newStaffForm, setNewStaffForm] = useState<{
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
    laundry_id: string;
    laundry_name: string;
    permissions: string[];
  }>({
    full_name: '',
    email: '',
    password: '',
    role: 'staff',
    laundry_id: '',
    laundry_name: '',
    permissions: ['dashboard', 'new-order', 'orders']
  });
  const [createStaffLoading, setCreateStaffLoading] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);

  const [editingUserProfile, setEditingUserProfile] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [editingUserForm, setEditingUserForm] = useState<{
    full_name: string;
    role: UserRole;
    laundry_id: string;
    laundry_name: string;
    permissions: string[];
    saas_plan: 'trial' | 'silver' | 'gold' | 'platinum';
    saas_billing_cycle: 'annual' | 'monthly' | 'trial';
    saas_expiry: string;
  }>({
    full_name: '',
    role: 'staff',
    laundry_id: '',
    laundry_name: '',
    permissions: [],
    saas_plan: 'gold',
    saas_billing_cycle: 'annual',
    saas_expiry: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]
  });

  // Super Admin state variables
  const [superAdminSearchQuery, setSuperAdminSearchQuery] = useState('');
  const [superAdminRoleFilter, setSuperAdminRoleFilter] = useState('all');
  const [superAdminStatusFilter, setSuperAdminStatusFilter] = useState('all');
  const [changingPasswordUser, setChangingPasswordUser] = useState<UserProfile | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);

  // Dedicated Subscription Management State
  const [editingSubscriptionUser, setEditingSubscriptionUser] = useState<UserProfile | null>(null);
  const [subscriptionForm, setSubscriptionForm] = useState<{
    saas_plan: 'trial' | 'silver' | 'gold' | 'platinum';
    saas_billing_cycle: 'annual' | 'monthly' | 'trial';
    saas_expiry: string;
  }>({
    saas_plan: 'gold',
    saas_billing_cycle: 'annual',
    saas_expiry: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]
  });
  const [subscriptionSaveLoading, setSubscriptionSaveLoading] = useState(false);

  const cleanTenantString = (str: string | null | undefined): string => {
    if (!str) return '';
    return str
      .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\|/i, '')
      .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '')
      .replace(/^laund-[a-z0-9]+\|/, '')
      .replace(/^laund-[a-z0-9]+-/, '');
  };
  const [activeTab, setActiveTab] = useState<'dashboard' | 'landing' | 'new-order' | 'orders' | 'inventory' | 'finance' | 'users' | 'settings' | 'offers' | 'subscriptions' | 'super-admin'>('dashboard');
  const [showAuthScreen, setShowAuthScreen] = useState<boolean>(false);
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const cachedProfileStr = localStorage.getItem('laundry_cached_profile');
      const laundryId = cachedProfileStr ? JSON.parse(cachedProfileStr)?.laundry_id : null;
      const local = (laundryId ? localStorage.getItem(`laundry_orders_${laundryId}`) : null) || localStorage.getItem('laundry_orders');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const cachedProfileStr = localStorage.getItem('laundry_cached_profile');
      const laundryId = cachedProfileStr ? JSON.parse(cachedProfileStr)?.laundry_id : null;
      const local = (laundryId ? localStorage.getItem(`laundry_inventory_${laundryId}`) : null) || localStorage.getItem('laundry_inventory');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => {
    try {
      const cachedProfileStr = localStorage.getItem('laundry_cached_profile');
      const laundryId = cachedProfileStr ? JSON.parse(cachedProfileStr)?.laundry_id : null;
      const local = (laundryId ? localStorage.getItem(`laundry_subscriptions_${laundryId}`) : null) || localStorage.getItem('laundry_subscriptions');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [subscriptionPackages, setSubscriptionPackages] = useState<SubscriptionPackage[]>(() => {
    try {
      const cachedProfileStr = localStorage.getItem('laundry_cached_profile');
      const laundryId = cachedProfileStr ? JSON.parse(cachedProfileStr)?.laundry_id : null;
      const local = (laundryId ? localStorage.getItem(`laundry_subscription_packages_${laundryId}`) : null) || localStorage.getItem('laundry_subscription_packages');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      { id: '1', name: 'الباقة الفضية', total_items: 30, price: 150, duration_days: 30 },
      { id: '2', name: 'الباقة الذهبية', total_items: 60, price: 280, duration_days: 30 },
      { id: '3', name: 'الباقة الماسية', total_items: 100, price: 450, duration_days: 30 },
    ];
  });
  const [offers, setOffers] = useState<Offer[]>([
    { id: '1', title: 'عرض الـ 100 قطعة', description: 'اغسل 100 قطعة واحصل على 5 قطع مجاناً', threshold_items: 100, free_items: 5 },
    { id: '2', title: 'خصم الافتتاح', description: 'خصم 10% على جميع الطلبات لفترة محدودة', discount_percent: 10 }
  ]);
  const [profiles, setProfiles] = useState<UserProfile[]>(() => {
    try {
      const cachedProfileStr = localStorage.getItem('laundry_cached_profile');
      const laundryId = cachedProfileStr ? JSON.parse(cachedProfileStr)?.laundry_id : null;
      const local = (laundryId ? localStorage.getItem(`laundry_profiles_${laundryId}`) : null) || localStorage.getItem('laundry_profiles_all') || localStorage.getItem('laundry_profiles');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [dashboardChartPeriod, setDashboardChartPeriod] = useState<'7' | '14' | '30'>('7');
  const [hoveredChartPoint, setHoveredChartPoint] = useState<number | null>(null);
  const [quickNotesText, setQuickNotesText] = useState<string>(() => {
    return localStorage.getItem('laundry_quick_notes') || 'ملاحظات الكاشير اليومية:\n- فحص نوع القماش والتعليمات الخاصة\n- التأكد من إرفاق الفاتورة مع الملابس المستلمة';
  });
  
  const [twilioConfig, setTwilioConfig] = useState<TwilioConfig>({
    accountSid: '',
    authToken: '',
    fromNumber: '',
    enabled: false
  });

  const [showWhatsAppBotModal, setShowWhatsAppBotModal] = useState(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [whatsAppBotStatus, setWhatsAppBotStatus] = useState<WhatsAppBotStatus>({
    isConnected: false,
    isConnecting: false,
    qrCodeDataUrl: null,
    userPhone: null,
    userName: null,
    error: null,
    lastConnectedAt: null
  });
  const [whatsAppBotAutoSend, setWhatsAppBotAutoSend] = useState<boolean>(() => {
    return localStorage.getItem('laundry_whatsapp_bot_auto_send') !== 'false';
  });
  const [autoPrintThermalOnSave, setAutoPrintThermalOnSave] = useState<boolean>(() => {
    return localStorage.getItem('laundry_auto_print_thermal') !== 'false';
  });
  const [showQRScannerModal, setShowQRScannerModal] = useState<boolean>(false);
  const [printModalTab, setPrintModalTab] = useState<'receipt' | 'tags'>('receipt');
  const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [toastNotification, setToastNotification] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // Pagination and scalable order loading
  const [ordersCurrentPage, setOrdersCurrentPage] = useState<number>(1);
  const [loadedOrdersLimit, setLoadedOrdersLimit] = useState<number>(60);
  const [isLoadingMoreOrders, setIsLoadingMoreOrders] = useState<boolean>(false);
  const [hasMoreRemoteOrders, setHasMoreRemoteOrders] = useState<boolean>(true);

  // Pagination for Finance / Client statements & sales orders
  const [financeClientsCurrentPage, setFinanceClientsCurrentPage] = useState<number>(1);
  const [financeOrdersCurrentPage, setFinanceOrdersCurrentPage] = useState<number>(1);
  const [financeSalesViewMode, setFinanceSalesViewMode] = useState<'clients' | 'orders'>('clients');
  const [selectedCustomerForOrders, setSelectedCustomerForOrders] = useState<{ name: string; phone: string } | null>(null);
  const [customerModalOrdersPage, setCustomerModalOrdersPage] = useState<number>(1);

  const [categories, setCategories] = useState<any[]>(() => {
    try {
      const cachedProfileStr = localStorage.getItem('laundry_cached_profile');
      const laundryId = cachedProfileStr ? JSON.parse(cachedProfileStr)?.laundry_id : null;
      const local = (laundryId ? localStorage.getItem(`laundry_categories_${laundryId}`) : null) || localStorage.getItem('laundry_categories');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_ITEMS;
  });
  const [customPrices, setCustomPrices] = useState<Record<string, any>>({});
  const [isCategoriesLoaded, setIsCategoriesLoaded] = useState(true);

  // Backup Import/Restore state
  const [importModalData, setImportModalData] = useState<{
    fileName: string;
    laundryName: string;
    exportDate: string;
    ordersCount: number;
    inventoryCount: number;
    categoriesCount: number;
    subscriptionsCount: number;
    packagesCount: number;
    offersCount: number;
    root: any;
    importedOrders: any[];
    importedInventory: any[];
    importedCategories: any[];
    importedSubscriptions: any[];
    importedPackages: any[];
    importedOffers: any[];
  } | null>(null);

  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const syncCustomPricesToDb = async (newPrices: Record<string, any>) => {
    try {
      const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
      const key = isDbMultiTenant ? 'laundry_categories_custom_prices' : `${laundryId}_laundry_categories_custom_prices`;
      const payload: any = {
        key,
        value: newPrices,
        updated_at: new Date().toISOString()
      };
      if (isDbMultiTenant) {
        payload.laundry_id = laundryId;
      }

      const { error } = await supabase
        .from('settings')
        .upsert(payload, { onConflict: 'key' });

      if (error) {
        console.error("Error syncing custom prices to Supabase settings:", error);
      } else {
        console.log("Successfully synced custom prices to Supabase settings!");
      }
    } catch (e) {
      console.error("Exception in syncCustomPricesToDb:", e);
    }
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const [inventoryConsumption, setInventoryConsumption] = useState<Record<string, Record<string, number>>>({});
  const [customItemConsumptions, setCustomItemConsumptions] = useState<Record<string, number>>({});
  const [editingConsumptionItem, setEditingConsumptionItem] = useState<any | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const getGroupedItems = (items: any[]) => {
    if (!items) return [];
    let safeItems: any[] = items;
    if (typeof safeItems === 'string') {
      try {
        safeItems = JSON.parse(safeItems);
      } catch (e) {
        safeItems = [];
      }
    }
    if (!Array.isArray(safeItems)) return [];

    const groups: Record<string, { key: string; item: any; totalQty: number; totalPrice: number; originalItems: any[] }> = {};
    safeItems.forEach(item => {
      if (!item) return;
      const opts: string[] = [];
      if (item.service_type === 'مستعجل' || (item as any).is_urgent) opts.push('مستعجل');
      if (item.is_ironing_only) opts.push('كوي');
      if ((item as any).is_no_ironing || item.ironing_type === 'بدون كوي') opts.push('بدون كوي');
      if (opts.length === 0) opts.push('عادي');
      const optStr = opts.join('+');
      const key = `${item.name || 'صنف'}_${optStr}`;
      
      if (!groups[key]) {
        groups[key] = {
          key,
          item: { ...item, name: item.name || 'صنف عام' },
          totalQty: 0,
          totalPrice: 0,
          originalItems: []
        };
      }
      const itemQty = Number(item.quantity) || 1;
      const itemPrice = Number(item.price) || 0;
      groups[key].totalQty += itemQty;
      groups[key].totalPrice += itemPrice * itemQty;
      groups[key].originalItems.push(item);
    });
    return Object.values(groups);
  };

  const toggleExpandGroup = (orderId: string, groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [`${orderId}_${groupKey}`]: !prev[`${orderId}_${groupKey}`]
    }));
  };

  const syncInventoryConsumptionToDb = async (newCons: Record<string, Record<string, number>>) => {
    try {
      const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
      const key = isDbMultiTenant ? 'laundry_inventory_consumption' : `${laundryId}_laundry_inventory_consumption`;
      const payload: any = {
        key,
        value: newCons,
        updated_at: new Date().toISOString()
      };
      if (isDbMultiTenant) {
        payload.laundry_id = laundryId;
      }

      const { error } = await supabase
        .from('settings')
        .upsert(payload, { onConflict: 'key' });

      if (error) {
        console.error("Error syncing inventory consumption to Supabase settings:", error);
      } else {
        console.log("Successfully synced inventory consumption!");
      }
    } catch (e) {
      console.error("Exception in syncInventoryConsumptionToDb:", e);
    }
  };

  const syncCategoriesOrderToDb = async (orderedNames: string[]) => {
    try {
      const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
      const key = isDbMultiTenant ? 'laundry_categories_order' : `${laundryId}_laundry_categories_order`;
      localStorage.setItem(key, JSON.stringify(orderedNames));
      
      const payload: any = {
        key,
        value: orderedNames,
        updated_at: new Date().toISOString()
      };
      if (isDbMultiTenant) {
        payload.laundry_id = laundryId;
      }

      const { error } = await supabase
        .from('settings')
        .upsert(payload, { onConflict: 'key' });

      if (error) {
        console.error("Error syncing categories order to Supabase settings:", error);
      } else {
        console.log("Successfully synced categories order!");
      }
    } catch (e) {
      console.error("Exception in syncCategoriesOrderToDb:", e);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const updated = [...categories];
    const draggedItem = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);
    setCategories(updated);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    const orderNames = categories.map(c => c.name);
    syncCategoriesOrderToDb(orderNames);
  };

  const [isEditingPrices, setIsEditingPrices] = useState(false);
  const [editingCategoryModalIndex, setEditingCategoryModalIndex] = useState<number | null>(null);
  const [editingCategoryForm, setEditingCategoryForm] = useState<{
    id?: string;
    name: string;
    icon: string;
    price: number;
    price_normal: number;
    price_urgent: number;
    price_ironing: number;
  }>({ name: '', icon: '✨', price: 0, price_normal: 0, price_urgent: 0, price_ironing: 0 });
  const [editingCategoryConsumptions, setEditingCategoryConsumptions] = useState<Record<string, number>>({});
  const [showEditCategoryIconPicker, setShowEditCategoryIconPicker] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [customItemForm, setCustomItemForm] = useState({ name: '', price: 0, price_normal: 0, price_urgent: 0, price_ironing: 0, price_no_ironing: 0, icon: '✨' });

  const [isAddingCustomItem, setIsAddingCustomItem] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [showDeleteCategoryConfirm, setShowDeleteCategoryConfirm] = useState(false);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const isAddingCustomItemRef = useRef(false);
  const isSavingCategoryRef = useRef(false);
  const isDeletingCategoryRef = useRef(false);
  const lastItemAddClickTimeRef = useRef<{ name: string; time: number }>({ name: '', time: 0 });

  const [sendingMessageIds, setSendingMessageIds] = useState<Set<string>>(new Set());
  const [timeFilter, setTimeFilter] = useState<'all' | '1h' | '24h' | '48h'>('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  const [showPrintModal, setShowPrintModal] = useState<Order | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [showEditOrderModal, setShowEditOrderModal] = useState<Order | null>(null);
  const [originalOrder, setOriginalOrder] = useState<Order | null>(null);
  const [editOrderItems, setEditOrderItems] = useState<LaundryItem[]>([]);
  const [editCustomAdjustment, setEditCustomAdjustment] = useState<number>(0);
  const [editDiscountPercent, setEditDiscountPercent] = useState<number>(0);
  const [editIsTaxEnabled, setEditIsTaxEnabled] = useState<boolean>(true);
  const [editedSubscription, setEditedSubscription] = useState<Subscription | null>(null);
  const [isEditingSub, setIsEditingSub] = useState<boolean>(false);
  const [subDeleteConfirmId, setSubDeleteConfirmId] = useState<string | null>(null);

  const [financeFromDate, setFinanceFromDate] = useState<string>('');
  const [financeToDate, setFinanceToDate] = useState<string>('');
  const [financeSelectedClientPhone, setFinanceSelectedClientPhone] = useState<string>('all');
  const [financePendingFilter, setFinancePendingFilter] = useState<'all' | 'has_pending' | 'no_pending'>('all');
  const [financeClientSearch, setFinanceClientSearch] = useState<string>('');

  const uniqueClients = useMemo(() => {
    const clientsMap: Record<string, { name: string, phone: string }> = {};
    orders.forEach(o => {
      if (o.customer_phone) {
        const ph = o.customer_phone.trim();
        if (ph) {
          clientsMap[ph] = {
            name: o.customer_name || 'عميل مجهول',
            phone: ph
          };
        }
      }
    });
    subscriptions.forEach(s => {
      if (s.customer_phone) {
        const ph = s.customer_phone.trim();
        if (ph) {
          clientsMap[ph] = {
            name: s.customer_name || 'عميل مجهول',
            phone: ph
          };
        }
      }
    });
    return Object.values(clientsMap).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [orders, subscriptions]);

  const filteredFinanceOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Date Filter
      if (financeFromDate) {
        const orderDate = new Date(order.created_at);
        const fromDateObj = new Date(financeFromDate);
        fromDateObj.setHours(0, 0, 0, 0);
        if (orderDate < fromDateObj) return false;
      }
      if (financeToDate) {
        const orderDate = new Date(order.created_at);
        const toDateObj = new Date(financeToDate);
        toDateObj.setHours(23, 59, 59, 999);
        if (orderDate > toDateObj) return false;
      }
      
      // 2. Client Filter
      if (financeSelectedClientPhone !== 'all') {
        if (order.customer_phone !== financeSelectedClientPhone) return false;
      }
      
      return true;
    });
  }, [orders, financeFromDate, financeToDate, financeSelectedClientPhone]);

  const financeStats = useMemo(() => {
    const filteredPaidOrders = filteredFinanceOrders.filter(o => o.is_paid);
    const totalRevenue = filteredPaidOrders.reduce((acc, o) => acc + o.total, 0);
    const taxTotal = filteredPaidOrders.reduce((acc, o) => acc + o.tax, 0);
    const pendingAmount = filteredFinanceOrders.filter(o => !o.is_paid).reduce((acc, o) => acc + o.total, 0);
    const totalOrdersCount = filteredFinanceOrders.length;
    const paidOrdersCount = filteredPaidOrders.length;
    const pendingOrdersCount = filteredFinanceOrders.filter(o => !o.is_paid).length;
    
    const cashRevenue = filteredPaidOrders.filter(o => o.payment_method === 'Cash').reduce((acc, o) => acc + o.total, 0);
    const cardRevenue = filteredPaidOrders.filter(o => o.payment_method === 'Card').reduce((acc, o) => acc + o.total, 0);
    const transferRevenue = filteredPaidOrders.filter(o => o.payment_method === 'Transfer').reduce((acc, o) => acc + o.total, 0);
    
    // Group client statistics under the current filter
    const clientMap: Record<string, { 
      name: string, 
      phone: string, 
      totalOrders: number, 
      totalSpent: number, 
      pendingSpent: number, 
      lastOrderDate: string,
      hasSubscription: boolean,
      subscriptionPlanName: string | null,
      itemsRemaining: number,
      totalItems: number,
      subscriptionExpiry: string | null,
      subscriptionIsActive: boolean
    }> = {};

    // Pre-populate if a specific client is selected to ensure they show up even with 0 orders in the filtered range
    if (financeSelectedClientPhone !== 'all') {
      const selectedClient = uniqueClients.find(c => c.phone === financeSelectedClientPhone);
      if (selectedClient) {
        const clientOrders = orders.filter(o => o.customer_phone === financeSelectedClientPhone);
        let latestDate = '';
        if (clientOrders.length > 0) {
          latestDate = clientOrders.reduce((latest, o) => {
            return !latest || new Date(o.created_at) > new Date(latest) ? o.created_at : latest;
          }, '');
        }
        
        clientMap[financeSelectedClientPhone] = {
          name: selectedClient.name,
          phone: financeSelectedClientPhone,
          totalOrders: 0,
          totalSpent: 0,
          pendingSpent: 0,
          lastOrderDate: latestDate,
          hasSubscription: false,
          subscriptionPlanName: null,
          itemsRemaining: 0,
          totalItems: 0,
          subscriptionExpiry: null,
          subscriptionIsActive: false
        };
      }
    }
    
    filteredFinanceOrders.forEach(o => {
      const phone = o.customer_phone || 'unspecified';
      if (!clientMap[phone]) {
        clientMap[phone] = {
          name: o.customer_name || 'عميل مجهول',
          phone: phone,
          totalOrders: 0,
          totalSpent: 0,
          pendingSpent: 0,
          lastOrderDate: o.created_at,
          hasSubscription: false,
          subscriptionPlanName: null,
          itemsRemaining: 0,
          totalItems: 0,
          subscriptionExpiry: null,
          subscriptionIsActive: false
        };
      }
      
      const client = clientMap[phone];
      client.totalOrders += 1;
      if (o.is_paid) {
        client.totalSpent += o.total;
      } else {
        client.pendingSpent += o.total;
      }
      if (!client.lastOrderDate || new Date(o.created_at) > new Date(client.lastOrderDate)) {
        client.lastOrderDate = o.created_at;
      }
    });

    // Enrich clients with subscription details
    Object.keys(clientMap).forEach(phone => {
      if (phone === 'unspecified') return;
      const clientSub = subscriptions.find(s => s.customer_phone === phone);
      if (clientSub) {
        const subPackage = subscriptionPackages.find(p => p.id === clientSub.package_id);
        const client = clientMap[phone];
        client.hasSubscription = true;
        client.subscriptionPlanName = subPackage ? subPackage.name : 'باقة مخصصة';
        client.itemsRemaining = clientSub.items_remaining;
        client.totalItems = clientSub.total_items;
        client.subscriptionExpiry = clientSub.expiry_date;
        const expD = clientSub.expiry_date ? new Date(clientSub.expiry_date) : null;
        client.subscriptionIsActive = clientSub.is_active && expD !== null && !isNaN(expD.getTime()) && (expD >= new Date());
      }
    });
    
    const clientList = Object.values(clientMap).sort((a, b) => b.totalSpent - a.totalSpent);
    
    return {
      totalRevenue,
      taxTotal,
      pendingAmount,
      totalOrdersCount,
      paidOrdersCount,
      pendingOrdersCount,
      cashRevenue,
      cardRevenue,
      transferRevenue,
      clientList
    };
  }, [filteredFinanceOrders, subscriptions, subscriptionPackages, financeSelectedClientPhone, uniqueClients, orders]);

  useEffect(() => {
    if (showEditOrderModal) {
      setEditOrderItems(showEditOrderModal.items || []);
      setEditCustomAdjustment(showEditOrderModal.custom_adjustment || 0);
      const discount = (showEditOrderModal.items?.[0] as any)?.discount_percent || 0;
      setEditDiscountPercent(discount);
      setEditIsTaxEnabled(showEditOrderModal.tax > 0);
      
      const sub = getCustomerSubscription(showEditOrderModal.customer_phone);
      setEditedSubscription(sub ? JSON.parse(JSON.stringify(sub)) : null);
      setIsEditingSub(false);
      setSubDeleteConfirmId(null);
    } else {
      setEditOrderItems([]);
      setEditCustomAdjustment(0);
      setEditDiscountPercent(0);
      setEditIsTaxEnabled(true);
      setEditedSubscription(null);
      setIsEditingSub(false);
      setSubDeleteConfirmId(null);
    }
  }, [showEditOrderModal?.id, showEditOrderModal?.customer_phone, subscriptions]);

  const editSubtotal = useMemo(() => {
    if (!showEditOrderModal) return 0;
    if (showEditOrderModal.payment_method === 'Free') return 0;
    const itemsTotal = editOrderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const sub = itemsTotal + (editCustomAdjustment || 0);
    const discount = sub * (editDiscountPercent / 100);
    return Math.max(0, sub - discount);
  }, [editOrderItems, editCustomAdjustment, editDiscountPercent, showEditOrderModal?.payment_method]);

  const editTax = useMemo(() => {
    return editIsTaxEnabled ? editSubtotal * TAX_RATE : 0;
  }, [editSubtotal, editIsTaxEnabled]);

  const editTotal = useMemo(() => {
    return editSubtotal + editTax;
  }, [editSubtotal, editTax]);

  const updateEditItemQuantity = (id: string, delta: number) => {
    setEditOrderItems(prev => prev.map(i => {
      if (i.id === id) {
        return { ...i, quantity: i.quantity + delta };
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const updateEditItemOption = (id: string, option: 'urgent' | 'ironing' | 'no_ironing' | 'normal', enabled: boolean) => {
    setEditOrderItems(prev => prev.map(i => {
      if (i.id === id) {
        const prices = getItemPrices(i);
        const normal = prices.price_normal;
        const urgent = prices.price_urgent;
        const ironing = prices.price_ironing;
        const noIron = prices.price_no_ironing;

        const basePrice = i.base_price !== undefined ? i.base_price : (i.price ?? 5);

        const is_normal = option === 'normal' ? enabled : (i.is_normal || false);
        const is_urgent = option === 'urgent' ? enabled : (i.is_urgent || false);
        const is_ironing_only = option === 'ironing' ? enabled : (i.is_ironing_only || false);
        const is_no_ironing = option === 'no_ironing' ? enabled : (i.is_no_ironing || false);

        let finalPrice = basePrice;
        if (is_normal) {
          finalPrice += normal;
        }
        if (is_urgent) {
          finalPrice += urgent;
        }
        if (is_ironing_only) {
          finalPrice += ironing;
        }
        if (is_no_ironing) {
          finalPrice += noIron;
        }

        return {
          ...i,
          is_normal,
          is_urgent,
          is_ironing_only,
          is_no_ironing,
          service_type: is_urgent ? 'مستعجل' : (is_normal ? 'عادي' : undefined),
          ironing_type: is_ironing_only ? 'كوي فقط' : (is_no_ironing ? 'بدون كوي' : 'غسيل وكوي'),
          price: finalPrice,
          base_price: basePrice
        };
      }
      return i;
    }));
  };

  const updateEditItemMode = (id: string, mode: 'عادي' | 'مستعجل' | 'كوي' | 'بدون كوي') => {
    const item = editOrderItems.find(i => i.id === id);
    if (!item) return;

    if (mode === 'عادي') {
      const isNormal = item.is_normal || false;
      updateEditItemOption(id, 'normal', !isNormal);
    } else if (mode === 'مستعجل') {
      const isUrgent = item.is_urgent || item.service_type === 'مستعجل' || false;
      updateEditItemOption(id, 'urgent', !isUrgent);
    } else if (mode === 'كوي') {
      const isIroning = item.is_ironing_only || false;
      updateEditItemOption(id, 'ironing', !isIroning);
    } else if (mode === 'بدون كوي') {
      const isNoIron = item.is_no_ironing || false;
      updateEditItemOption(id, 'no_ironing', !isNoIron);
    }
  };

  const updateEditItemCustomPrice = (id: string, type: 'normal' | 'urgent' | 'ironing' | 'no_ironing', priceValue: number) => {
    setEditOrderItems(prev => prev.map(i => {
      if (i.id === id) {
        const prices = getItemPrices(i);
        const normal = prices.price_normal;
        const urgent = prices.price_urgent;
        const ironing = prices.price_ironing;
        const noIron = prices.price_no_ironing;

        const updatedPrices = {
          price_normal: type === 'normal' ? priceValue : normal,
          price_urgent: type === 'urgent' ? priceValue : urgent,
          price_ironing: type === 'ironing' ? priceValue : ironing,
          price_no_ironing: type === 'no_ironing' ? priceValue : noIron,
        };

        const is_normal = i.is_normal || false;
        const is_urgent = i.is_urgent || (i.service_type === 'مستعجل') || false;
        const is_ironing_only = i.is_ironing_only || (i.ironing_type === 'كوي فقط') || false;
        const is_no_ironing = i.is_no_ironing || (i.ironing_type === 'بدون كوي') || false;

        const basePrice = i.base_price !== undefined ? i.base_price : (i.price ?? 5);

        let activePrice = basePrice;
        if (is_normal) {
          activePrice += updatedPrices.price_normal;
        }
        if (is_urgent) {
          activePrice += updatedPrices.price_urgent;
        }
        if (is_ironing_only) {
          activePrice += updatedPrices.price_ironing;
        }
        if (is_no_ironing) {
          activePrice += updatedPrices.price_no_ironing;
        }

        return {
          ...i,
          price: activePrice,
          ...updatedPrices
        };
      }
      return i;
    }));
  };
  const [isInvModalOpen, setIsInvModalOpen] = useState(false);
  const [newInvItem, setNewInvItem] = useState<{
    name: string;
    stock: number;
    unit: string;
    threshold: number;
    defaultConsumption?: number;
  }>({ name: '', stock: 0, unit: 'قطعة', threshold: 5, defaultConsumption: 10 });
  const [newInvConsumption, setNewInvConsumption] = useState<Record<string, number>>({});
  const [editingInvConsumptionItem, setEditingInvConsumptionItem] = useState<InventoryItem | null>(null);
  const [customStockModalItem, setCustomStockModalItem] = useState<InventoryItem | null>(null);
  const [customStockAmount, setCustomStockAmount] = useState<string>('100');
  const [customStockMode, setCustomStockMode] = useState<'add' | 'subtract'>('add');
  const [customStockLoading, setCustomStockLoading] = useState<boolean>(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showAssignSubModal, setShowAssignSubModal] = useState<{ name: string, phone: string } | null>(null);
  const [packageForm, setPackageForm] = useState<{
    name: string;
    total_items: number | string;
    price: number | string;
    duration_days: number | string;
    discount_percent: number | string;
    isUnlimitedDays?: boolean;
  }>({ name: '', total_items: '', price: '', duration_days: 30, discount_percent: '', isUnlimitedDays: false });
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  
  const [platformWhatsApp, setPlatformWhatsApp] = useState<string>('966500000000');
  const [platformWhatsAppInput, setPlatformWhatsAppInput] = useState<string>('966500000000');
  
  const scanIntervalRef = useRef<number | null>(null);
  const isSubmittingOrderRef = useRef<boolean>(false);
  const recentSentNotificationsRef = useRef<Map<string, number>>(new Map());

  const fetchPlatformWhatsApp = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'platform_support_whatsapp')
        .maybeSingle();
      if (data && data.value) {
        const valStr = typeof data.value === 'string' ? data.value : (data.value.phone || '966500000000');
        setPlatformWhatsApp(valStr);
        setPlatformWhatsAppInput(valStr);
      }
    } catch (e) {
      console.warn("Could not load platform_support_whatsapp setting:", e);
    }
  };

  const handleSavePlatformWhatsApp = async (numToSave: string) => {
    try {
      const cleanNum = numToSave.trim().replace(/[^\d+]/g, '');
      if (!cleanNum) {
        alert('الرجاء إدخال رقم واتساب صحيح ❌');
        return;
      }
      const { error } = await supabase.from('settings').upsert({
        key: 'platform_support_whatsapp',
        value: cleanNum,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      if (error) throw error;
      setPlatformWhatsApp(cleanNum);
      setPlatformWhatsAppInput(cleanNum);
      alert('تم حفظ رقم واتساب الدعم الفني للمنصة بنجاح ✅');
    } catch (e: any) {
      alert(`فشل حفظ الرقم: ${e.message}`);
    }
  };

  useEffect(() => {
    fetchPlatformWhatsApp();

    // Restore cached user session and profile for instant offline startup
    const cachedProfileStr = localStorage.getItem('laundry_cached_profile');
    if (cachedProfileStr) {
      try {
        const cachedProf = JSON.parse(cachedProfileStr);
        if (cachedProf && cachedProf.id) {
          setUserProfile(cachedProf);
          setSession({ user: { id: cachedProf.id, email: cachedProf.email } });
        }
      } catch (e) {}
    }

    // Check if there is a custom logged in user from local storage
    const customUserStr = localStorage.getItem('custom_auth_user');
    if (customUserStr) {
      try {
        const customUser = JSON.parse(customUserStr);
        if (customUser && customUser.id) {
          const fakeSession = { user: { id: customUser.id, email: customUser.email } };
          setSession(fakeSession);
          fetchUserProfile(customUser.id, fakeSession);
        }
      } catch (e) {}
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setSession(session);
          fetchUserProfile(session.user.id, session);
        }
      });
    }

    supabase.from('orders').select('id', { count: 'exact', head: true }).limit(1)
      .then(({ error }) => {
        if (error) console.error("Supabase connection check failed:", error);
        else console.log("Supabase connection established.");
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('laundry_cached_profile');
        localStorage.removeItem('custom_auth_user');
        setSession(null);
        setUserProfile(null);
        return;
      }
      const storedCustom = localStorage.getItem('custom_auth_user');
      if (storedCustom) {
        try {
          const customUser = JSON.parse(storedCustom);
          if (customUser && customUser.id) {
            const fakeSession = { user: { id: customUser.id, email: customUser.email } };
            setSession(fakeSession);
            fetchUserProfile(customUser.id, fakeSession);
            return;
          }
        } catch (e) {}
      }
      if (session) {
        setSession(session);
        fetchUserProfile(session.user.id, session);
      } else {
        // Guard: Do not wipe user profile if cached profile exists or if browser is offline
        const cached = localStorage.getItem('laundry_cached_profile');
        if (!cached && isBrowserOnline()) {
          setSession(null);
          setUserProfile(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
      fetchSettings();
      if (userProfile) fetchProfiles();
    }
  }, [session, userProfile?.id, userProfile?.laundry_id]);

  useEffect(() => {
    if (twilioConfig.enabled && session) {
      scanIntervalRef.current = window.setInterval(checkAndSendAutoReminders, 1000 * 60 * 5);
      return () => { if (scanIntervalRef.current) window.clearInterval(scanIntervalRef.current); };
    }
  }, [twilioConfig, orders, session]);

  // Initial and periodic WhatsApp Bot status check & cloud settings sync
  useEffect(() => {
    let isMounted = true;
    const checkBotStatus = async () => {
      try {
        const st = await getWhatsAppBotStatus();
        if (isMounted) setWhatsAppBotStatus(st);
      } catch (e) {}
    };
    checkBotStatus();
    const interval = setInterval(checkBotStatus, 8000);

    // Sync cloud auto-send setting across devices
    const syncAutoSend = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'laundry_whatsapp_bot_auto_send')
          .maybeSingle();
        if (isMounted && data && data.value && typeof data.value.enabled === 'boolean') {
          setWhatsAppBotAutoSend(data.value.enabled);
          localStorage.setItem('laundry_whatsapp_bot_auto_send', data.value.enabled ? 'true' : 'false');
        }
      } catch (e) {}
    };
    syncAutoSend();

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Auto dismiss toast notifications after 6 seconds
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => setToastNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  const fetchUserProfile = async (userId: string, activeSession?: any) => {
    // 1. Instant hydration from cached profile for 0ms loading time
    try {
      const cached = localStorage.getItem('laundry_cached_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.id === userId || !userId)) {
          setUserProfile(parsed);
        }
      }
    } catch (e) {}

    // 2. If offline, don't execute hanging network calls
    if (!isBrowserOnline()) {
      return;
    }

    try {
      // 3. Parallel fetch with 2500ms timeout
      const permsPromise = supabase.from('settings').select('value').eq('key', 'platform_user_permissions_map');
      const disPromise = supabase.from('settings').select('value').eq('key', 'platform_disabled_users_map');
      const profilePromise = supabase.from('profiles').select('*').eq('id', userId).single();
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Profile timeout')), 2500));

      const [permsRes, disRes, profileRes] = await Promise.race([
        Promise.all([permsPromise, disPromise, profilePromise]),
        timeoutPromise
      ]) as any;

      let customPerms: Record<string, string[]> = {};
      if (permsRes?.data && permsRes.data.length > 0 && permsRes.data[0].value) {
        customPerms = permsRes.data[0].value as Record<string, string[]>;
      }

      let disabledMap: Record<string, boolean> = {};
      if (disRes?.data && disRes.data.length > 0 && disRes.data[0].value) {
        disabledMap = disRes.data[0].value as Record<string, boolean>;
      }

      const { data, error } = profileRes;
      
      if (error) {
        console.warn("Profile table fetch failed, checking user_metadata fallback...", error);
        const metadata = activeSession?.user?.user_metadata || session?.user?.user_metadata;
        const fallbackEmail = activeSession?.user?.email || session?.user?.email || '';
        
        const fallbackIsDisabled = disabledMap[userId] !== undefined ? disabledMap[userId] : false;
        
        const fallbackProfile: UserProfile = {
          id: userId,
          email: fallbackEmail,
          role: (metadata?.role || 'admin') as UserRole,
          full_name: metadata?.full_name || fallbackEmail.split('@')[0] || 'مستخدم تجريبي',
          laundry_id: ensureUUID(metadata?.laundry_id || userId),
          laundry_name: metadata?.laundry_name || 'منصة غسيل كلاود',
          saas_plan: (metadata?.saas_plan || 'gold') as any,
          saas_expiry: metadata?.saas_expiry || new Date(Date.now() + 365*24*60*60*1000).toISOString(),
          saas_status: metadata?.saas_status || 'active',
          is_disabled: fallbackIsDisabled,
          status: fallbackIsDisabled ? 'disabled' : 'active',
          permissions: customPerms[userId] !== undefined 
            ? customPerms[userId] 
            : (metadata?.permissions !== undefined ? metadata.permissions : (ROLE_PERMISSIONS[(metadata?.role || 'admin') as UserRole] || []))
        };
        
        setUserProfile(fallbackProfile);
        try {
          localStorage.setItem('laundry_cached_profile', JSON.stringify(fallbackProfile));
        } catch (e) {}
        
        try {
          const { permissions, ...profileToSave } = fallbackProfile;
          await supabase.from('profiles').upsert(profileToSave);
        } catch (healErr) {
          console.warn("Profile table self-healing failed:", healErr);
        }
        return;
      }

      if (data) {
        const metadata = activeSession?.user?.user_metadata || session?.user?.user_metadata;
        const checkedLaundryId = data.laundry_id ? ensureUUID(data.laundry_id) : ensureUUID(userId);
        const isAccDisabled = disabledMap[userId] !== undefined ? disabledMap[userId] : (data.is_disabled || data.status === 'disabled');
        
        const updatedProfile: UserProfile = {
          ...data,
          laundry_id: checkedLaundryId,
          is_disabled: isAccDisabled,
          status: isAccDisabled ? 'disabled' : 'active',
          permissions: customPerms[userId] !== undefined 
            ? customPerms[userId] 
            : (metadata?.permissions !== undefined ? metadata.permissions : (ROLE_PERMISSIONS[data.role as UserRole] || []))
        };
        setUserProfile(updatedProfile);
        try {
          localStorage.setItem('laundry_cached_profile', JSON.stringify(updatedProfile));
        } catch (e) {}
        
        if (!data.laundry_id) {
          try {
            await supabase.from('profiles').update({ laundry_id: checkedLaundryId }).eq('id', userId);
          } catch (updateErr) {
            console.warn("Failed to persist self-healed laundry_id:", updateErr);
          }
        }
      }
    } catch (e) {
      console.warn("Failed or timed out fetching profile, using cache/fallback:", e);
      // Ensure we don't clear profile on network error
      const cached = localStorage.getItem('laundry_cached_profile');
      if (cached) {
        try {
          setUserProfile(JSON.parse(cached));
          return;
        } catch (err) {}
      }
      const fallbackEmail = activeSession?.user?.email || session?.user?.email || '';
      setUserProfile({
        id: userId,
        email: fallbackEmail,
        role: 'admin',
        full_name: fallbackEmail.split('@')[0] || 'مستخدم تجريبي',
        laundry_id: ensureUUID(userId),
        laundry_name: 'منصة غسيل كلاود',
        saas_plan: 'gold',
        saas_expiry: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
        saas_status: 'active',
        permissions: ROLE_PERMISSIONS['admin']
      });
    }
  };

  const fetchLaundries = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'platform_laundries_list')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data && data.value && Array.isArray(data.value)) {
        setLaundries(data.value);
      } else {
        const defaultLaundries = [
          { id: ensureUUID(userProfile?.laundry_id || 'laund-unknown'), name: userProfile?.laundry_name || 'منصة غسيل كلاود' }
        ];
        setLaundries(defaultLaundries);
        
        await supabase
          .from('settings')
          .upsert({
            key: 'platform_laundries_list',
            value: defaultLaundries,
            updated_at: new Date().toISOString()
          });
      }
    } catch (e) {
      console.error("Failed to fetch laundries from settings:", e);
      setLaundries([
        { id: ensureUUID(userProfile?.laundry_id || 'laund-unknown'), name: userProfile?.laundry_name || 'منصة غسيل كلاود' }
      ]);
    }
  };

  const addLaundryToPlatform = async (id: string, name: string) => {
    try {
      let currentList = [...laundries];
      const existingIdx = currentList.findIndex((l: any) => l.id === id);
      if (existingIdx >= 0) {
        currentList[existingIdx] = { ...currentList[existingIdx], name };
      } else {
        currentList.push({ id, name });
      }
      await supabase
        .from('settings')
        .upsert({
          key: 'platform_laundries_list',
          value: currentList,
          updated_at: new Date().toISOString()
        });
      setLaundries(currentList);
      return true;
    } catch (e) {
      console.error("Failed to add/update laundry in platform settings:", e);
      return false;
    }
  };

  const fetchProfiles = async () => {
    const userLaundryId = userProfile?.laundry_id;

    // Fast instant hydration from cache
    try {
      const cached = localStorage.getItem(`laundry_profiles_${userLaundryId || 'all'}`) || 
                     localStorage.getItem('laundry_profiles_all') || 
                     localStorage.getItem('laundry_profiles');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProfiles(parsed);
        }
      }
    } catch (e) {}

    if (!isBrowserOnline()) return;

    try {
      fetchLaundries();

      let query = supabase.from('profiles').select('*');
      if (userProfile?.role !== 'super_admin' && userLaundryId) {
        query = query.eq('laundry_id', userLaundryId);
      }

      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Fetch profiles timeout')), 3000));

      const [permsRes, disRes, subRes, pwdRes, profilesRes] = await Promise.race([
        Promise.all([
          supabase.from('settings').select('value').eq('key', 'platform_user_permissions_map'),
          supabase.from('settings').select('value').eq('key', 'platform_disabled_users_map'),
          supabase.from('settings').select('value').eq('key', 'platform_subscriptions_map'),
          supabase.from('settings').select('value').eq('key', 'platform_user_passwords_map'),
          query.order('updated_at', { ascending: false })
        ]),
        timeoutPromise
      ]) as any;

      const customPerms = (permsRes?.data?.[0]?.value as Record<string, string[]>) || {};
      const disabledUsersMap = (disRes?.data?.[0]?.value as Record<string, boolean>) || {};
      const subMap = (subRes?.data?.[0]?.value as Record<string, any>) || {};
      const pwdMap = (pwdRes?.data?.[0]?.value as Record<string, string>) || {};

      const data = profilesRes?.data;
      if (profilesRes?.error) throw profilesRes.error;

      const enriched = (data || []).map((p: any) => {
        const isDisabled = disabledUsersMap[p.id] !== undefined ? disabledUsersMap[p.id] : (p.is_disabled || p.status === 'disabled');
        const userSub = subMap[p.id] || {};
        return {
          ...p,
          is_disabled: isDisabled,
          status: isDisabled ? 'disabled' : 'active',
          password: pwdMap[p.id] || p.password || '',
          permissions: customPerms[p.id] !== undefined ? customPerms[p.id] : (ROLE_PERMISSIONS[p.role as UserRole] || []),
          saas_plan: userSub.saas_plan || p.saas_plan || 'gold',
          saas_billing_cycle: userSub.saas_billing_cycle || p.saas_billing_cycle || 'annual',
          saas_expiry: userSub.saas_expiry || p.saas_expiry || new Date(Date.now() + 365*24*60*60*1000).toISOString(),
          saas_status: userSub.saas_status || p.saas_status || 'active',
          last_login_at: p.last_login_at || p.updated_at || p.created_at
        };
      });
      setProfiles(enriched);
      try {
        const serializedProfiles = JSON.stringify(enriched);
        localStorage.setItem(`laundry_profiles_${userLaundryId || 'all'}`, serializedProfiles);
        localStorage.setItem('laundry_profiles_all', serializedProfiles);
        localStorage.setItem('laundry_profiles', serializedProfiles);
      } catch (e) {}
    } catch (e) {
      console.warn("Notice: Failed or timed out fetching profiles:", e);
    }
  };

  const filteredSuperAdminProfiles = useMemo(() => {
    return profiles.filter(p => {
      if (superAdminSearchQuery.trim()) {
        const q = superAdminSearchQuery.toLowerCase().trim();
        const matchesName = (p.full_name || '').toLowerCase().includes(q);
        const matchesEmail = (p.email || '').toLowerCase().includes(q);
        const matchesLaundry = (p.laundry_name || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesLaundry) return false;
      }

      if (superAdminRoleFilter !== 'all' && p.role !== superAdminRoleFilter) {
        return false;
      }

      const isDisabled = p.is_disabled || p.status === 'disabled';
      if (superAdminStatusFilter === 'active' && isDisabled) return false;
      if (superAdminStatusFilter === 'disabled' && !isDisabled) return false;

      return true;
    });
  }, [profiles, superAdminSearchQuery, superAdminRoleFilter, superAdminStatusFilter]);

  const handleLogout = async () => {
    localStorage.removeItem('custom_auth_user');
    await supabase.auth.signOut();
    setSession(null);
    setUserProfile(null);
  };

  const toggleUserDisabledStatus = async (targetUser: UserProfile) => {
    const isCurrentlyDisabled = targetUser.is_disabled || targetUser.status === 'disabled';
    const newDisabled = !isCurrentlyDisabled;
    const currentLaundryId = userProfile?.laundry_id;

    const nextProfiles = profiles.map(p => p.id === targetUser.id ? {
      ...p,
      is_disabled: newDisabled,
      status: newDisabled ? 'disabled' : 'active'
    } : p);
    setProfiles(nextProfiles);

    try {
      const serialized = JSON.stringify(nextProfiles);
      if (currentLaundryId) localStorage.setItem(`laundry_profiles_${currentLaundryId}`, serialized);
      localStorage.setItem('laundry_profiles_all', serialized);
      localStorage.setItem('laundry_profiles', serialized);
    } catch (e) {}

    if (isBrowserOnline()) {
      try {
        let disabledMap: Record<string, boolean> = {};
        const { data: dData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'platform_disabled_users_map');
        if (dData && dData.length > 0 && dData[0].value) {
          disabledMap = dData[0].value as Record<string, boolean>;
        }
        disabledMap[targetUser.id] = newDisabled;

        await supabase.from('settings').upsert({
          key: 'platform_disabled_users_map',
          value: disabledMap,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        try {
          await supabase.from('profiles').update({
            is_disabled: newDisabled,
            status: newDisabled ? 'disabled' : 'active'
          }).eq('id', targetUser.id);
        } catch (err) {}
      } catch (e: any) {
        addOfflineAction({
          type: 'UPDATE_USER_STATUS',
          payload: { id: targetUser.id, is_disabled: newDisabled, status: newDisabled ? 'disabled' : 'active' },
          laundryId: targetUser.laundry_id || currentLaundryId
        });
      }
    } else {
      addOfflineAction({
        type: 'UPDATE_USER_STATUS',
        payload: { id: targetUser.id, is_disabled: newDisabled, status: newDisabled ? 'disabled' : 'active' },
        laundryId: targetUser.laundry_id || currentLaundryId
      });
    }

    alert(newDisabled ? 'تم تعطيل الحساب بنجاح 🔒' : 'تم تفعيل الحساب بنجاح 🔓');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changingPasswordUser || !newPasswordInput.trim()) return;
    if (newPasswordInput.length < 6) {
      alert('كلمة المرور يجب أن تكون 6 خانات على الأقل');
      return;
    }

    setPasswordChangeLoading(true);
    const pwd = newPasswordInput.trim();
    const currentLaundryId = userProfile?.laundry_id;

    const nextProfiles = profiles.map(p => p.id === changingPasswordUser.id ? {
      ...p,
      password: pwd
    } : p);
    setProfiles(nextProfiles);

    try {
      const serialized = JSON.stringify(nextProfiles);
      if (currentLaundryId) localStorage.setItem(`laundry_profiles_${currentLaundryId}`, serialized);
      localStorage.setItem('laundry_profiles_all', serialized);
      localStorage.setItem('laundry_profiles', serialized);
    } catch (e) {}

    if (isBrowserOnline()) {
      try {
        let pwdMap: Record<string, string> = {};
        const { data: pData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'platform_user_passwords_map');
        if (pData && pData.length > 0 && pData[0].value) {
          pwdMap = pData[0].value as Record<string, string>;
        }
        pwdMap[changingPasswordUser.id] = pwd;

        await supabase.from('settings').upsert({
          key: 'platform_user_passwords_map',
          value: pwdMap,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        try {
          await supabase.from('profiles').update({
            password: pwd
          }).eq('id', changingPasswordUser.id);
        } catch (err) {}

        if (changingPasswordUser.id === session?.user?.id) {
          try {
            await supabase.auth.updateUser({ password: pwd });
          } catch (err) {}
        }
      } catch (e: any) {
        addOfflineAction({
          type: 'UPDATE_USER_PASSWORD',
          payload: { id: changingPasswordUser.id, password: pwd },
          laundryId: changingPasswordUser.laundry_id || currentLaundryId
        });
      }
    } else {
      addOfflineAction({
        type: 'UPDATE_USER_PASSWORD',
        payload: { id: changingPasswordUser.id, password: pwd },
        laundryId: changingPasswordUser.laundry_id || currentLaundryId
      });
    }

    setPasswordChangeLoading(false);
    alert('تم تغيير كلمة المرور بنجاح! 🔑');
    setChangingPasswordUser(null);
    setNewPasswordInput('');
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubscriptionUser) return;

    setSubscriptionSaveLoading(true);
    try {
      let subMap: Record<string, any> = {};
      const { data: sData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'platform_subscriptions_map');
      if (sData && sData.length > 0 && sData[0].value) {
        subMap = sData[0].value as Record<string, any>;
      }

      let expiryIso = new Date(Date.now() + 365*24*60*60*1000).toISOString();
      if (subscriptionForm.saas_expiry) {
        const parsed = new Date(subscriptionForm.saas_expiry);
        if (!isNaN(parsed.getTime())) {
          expiryIso = parsed.toISOString();
        }
      }
      const isExpActive = new Date(expiryIso).getTime() > Date.now();

      subMap[editingSubscriptionUser.id] = {
        saas_plan: subscriptionForm.saas_plan,
        saas_billing_cycle: subscriptionForm.saas_billing_cycle,
        saas_expiry: expiryIso,
        saas_status: isExpActive ? 'active' : 'expired'
      };

      await supabase.from('settings').upsert({
        key: 'platform_subscriptions_map',
        value: subMap,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

      setProfiles(prev => prev.map(p => p.id === editingSubscriptionUser.id ? {
        ...p,
        saas_plan: subscriptionForm.saas_plan,
        saas_billing_cycle: subscriptionForm.saas_billing_cycle,
        saas_expiry: expiryIso,
        saas_status: isExpActive ? 'active' : 'expired'
      } : p));

      alert('تم حفظ وتمديد اشتراك المنصة لهذا الحساب بنجاح! 🚀');
      setEditingSubscriptionUser(null);
    } catch (e: any) {
      alert(`حدث خطأ أثناء حفظ الاشتراك: ${e.message || e}`);
    } finally {
      setSubscriptionSaveLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      setNewStaffForm(prev => ({
        ...prev,
        laundry_id: userProfile.laundry_id || '',
        laundry_name: userProfile.laundry_name || '',
      }));
    }
  }, [userProfile]);

  const handleCreateStaffAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.email.trim() || !newStaffForm.password.trim() || !newStaffForm.full_name.trim()) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    if (newStaffForm.password.length < 6) {
      alert('كلمة المرور يجب أن تكون 6 خانات على الأقل');
      return;
    }

    setCreateStaffLoading(true);

    // Fast-path: Offline creation
    if (!isBrowserOnline()) {
      const offlineUserId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const offlineProfile: UserProfile = {
        id: offlineUserId,
        email: newStaffForm.email.trim(),
        role: newStaffForm.role,
        full_name: newStaffForm.full_name.trim(),
        laundry_id: newStaffForm.laundry_id || userProfile?.laundry_id || '',
        laundry_name: newStaffForm.laundry_name || userProfile?.laundry_name || '',
        password: newStaffForm.password.trim(),
        permissions: newStaffForm.permissions,
        saas_plan: 'gold',
        saas_expiry: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
        saas_status: 'active',
        is_disabled: false,
        status: 'active',
        created_at: new Date().toISOString()
      };

      const nextProfiles = [offlineProfile, ...profiles];
      setProfiles(nextProfiles);

      try {
        const serialized = JSON.stringify(nextProfiles);
        const lid = offlineProfile.laundry_id;
        if (lid) localStorage.setItem(`laundry_profiles_${lid}`, serialized);
        localStorage.setItem('laundry_profiles_all', serialized);
        localStorage.setItem('laundry_profiles', serialized);

        // Also save offline permissions & password map in localStorage
        const permMapStr = localStorage.getItem('platform_user_permissions_map');
        const permMap = permMapStr ? JSON.parse(permMapStr) : {};
        permMap[offlineUserId] = newStaffForm.permissions;
        localStorage.setItem('platform_user_permissions_map', JSON.stringify(permMap));

        const pwdMapStr = localStorage.getItem('platform_user_passwords_map');
        const pwdMap = pwdMapStr ? JSON.parse(pwdMapStr) : {};
        pwdMap[offlineUserId] = newStaffForm.password.trim();
        localStorage.setItem('platform_user_passwords_map', JSON.stringify(pwdMap));
      } catch (e) {}

      addOfflineAction({
        type: 'CREATE_USER',
        payload: offlineProfile,
        laundryId: offlineProfile.laundry_id
      });

      alert('تم إنشاء حساب المستخدم محلياً بنجاح في وضع الأوفلاين! 🚀 سيتم المزامنة تلقائياً مع السحابة فور عودة الاتصال.');
      setNewStaffForm(prev => ({
        ...prev,
        email: '',
        password: '',
        full_name: '',
        permissions: ['dashboard', 'new-order', 'orders']
      }));
      setIsCreatingUser(false);
      setCreateStaffLoading(false);
      return;
    }

    try {
      const tempSupabase = createClient('https://hoeealjgmfjbojjyodql.supabase.co', 'sb_publishable_Vq7v3naqK8moAXa-L8EwOw_Rpjc55mw', {
        auth: { persistSession: false }
      });

      // Sign up the user in Auth
      const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
        email: newStaffForm.email,
        password: newStaffForm.password,
        options: {
          data: {
            full_name: newStaffForm.full_name,
            role: newStaffForm.role,
            laundry_id: newStaffForm.laundry_id,
            laundry_name: newStaffForm.laundry_name,
            permissions: newStaffForm.permissions
          }
        }
      });

      if (signUpError) throw signUpError;
      
      const newUserId = signUpData?.user?.id;
      if (!newUserId) {
        throw new Error('فشل الحصول على معرّف المستخدم الجديد من نظام المصادقة');
      }

      // Upsert directly into profiles (EXCLUDING permissions column to prevent database schema error)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: newUserId,
          email: newStaffForm.email,
          role: newStaffForm.role,
          full_name: newStaffForm.full_name,
          laundry_id: newStaffForm.laundry_id,
          laundry_name: newStaffForm.laundry_name,
          saas_plan: 'gold',
          saas_expiry: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
          saas_status: 'active'
        });

      if (profileError) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            email: newStaffForm.email,
            role: newStaffForm.role,
            full_name: newStaffForm.full_name,
            laundry_id: newStaffForm.laundry_id,
            laundry_name: newStaffForm.laundry_name
          })
          .eq('id', newUserId);
        if (updateError) throw updateError;
      }

      // Save custom permissions to the setting map safely
      try {
        let currentMap: Record<string, string[]> = {};
        const { data: mData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'platform_user_permissions_map');
        if (mData && mData.length > 0 && mData[0].value) {
          currentMap = mData[0].value as Record<string, string[]>;
        }
        
        currentMap[newUserId] = newStaffForm.permissions;
        
        await supabase
          .from('settings')
          .upsert({
            key: 'platform_user_permissions_map',
            value: currentMap,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (permsErr) {
        console.warn("Could not persist custom permissions in settings table", permsErr);
      }

      // Ensure the laundry is added to the list in platform settings
      if (newStaffForm.laundry_id && newStaffForm.laundry_name) {
        await addLaundryToPlatform(newStaffForm.laundry_id, newStaffForm.laundry_name);
      }

      alert('تم إنشاء حساب المستخدم بنجاح وربطه بالمغسلة المحددة! 🎉');
      
      setNewStaffForm(prev => ({
        ...prev,
        email: '',
        password: '',
        full_name: '',
        permissions: ['dashboard', 'new-order', 'orders']
      }));

      fetchProfiles();
      setIsCreatingUser(false);
    } catch (err: any) {
      alert(`فشل إنشاء الحساب: ${err.message || err}`);
    } finally {
      setCreateStaffLoading(false);
    }
  };

  const handleUpdateUserProfile = async () => {
    if (!editingUserProfile) return;
    setSaveLoading(true);

    // Safely calculate subscription expiry date without throwing Invalid time value
    let resolvedExpiryIso = new Date(Date.now() + 365*24*60*60*1000).toISOString();
    if (editingUserForm.saas_expiry) {
      const parsed = new Date(editingUserForm.saas_expiry);
      if (!isNaN(parsed.getTime())) {
        resolvedExpiryIso = parsed.toISOString();
      }
    } else if (editingUserProfile.saas_expiry) {
      const parsed = new Date(editingUserProfile.saas_expiry);
      if (!isNaN(parsed.getTime())) {
        resolvedExpiryIso = parsed.toISOString();
      }
    }
    const isExpActive = new Date(resolvedExpiryIso).getTime() > Date.now();

    const nextProfiles = profiles.map(p => {
      if (p.id === editingUserProfile.id) {
        return {
          ...p,
          full_name: editingUserForm.full_name,
          role: editingUserForm.role,
          laundry_id: editingUserForm.laundry_id,
          laundry_name: editingUserForm.laundry_name,
          permissions: editingUserForm.permissions,
          saas_plan: editingUserForm.saas_plan || p.saas_plan || 'gold',
          saas_billing_cycle: editingUserForm.saas_billing_cycle || p.saas_billing_cycle || 'annual',
          saas_expiry: resolvedExpiryIso,
          saas_status: isExpActive ? 'active' : 'expired'
        };
      } else if (editingUserForm.laundry_id && p.laundry_id === editingUserForm.laundry_id) {
        return {
          ...p,
          laundry_name: editingUserForm.laundry_name
        };
      }
      return p;
    });
    setProfiles(nextProfiles);

    try {
      const serialized = JSON.stringify(nextProfiles);
      if (editingUserForm.laundry_id) localStorage.setItem(`laundry_profiles_${editingUserForm.laundry_id}`, serialized);
      localStorage.setItem('laundry_profiles_all', serialized);
      localStorage.setItem('laundry_profiles', serialized);

      // Cache custom permissions in localStorage
      const permMapStr = localStorage.getItem('platform_user_permissions_map');
      const permMap = permMapStr ? JSON.parse(permMapStr) : {};
      permMap[editingUserProfile.id] = editingUserForm.permissions;
      localStorage.setItem('platform_user_permissions_map', JSON.stringify(permMap));
    } catch (e) {}

    if (editingUserProfile.id === session?.user?.id) {
      setUserProfile(prev => prev ? {
        ...prev,
        full_name: editingUserForm.full_name,
        role: editingUserForm.role,
        laundry_id: editingUserForm.laundry_id,
        laundry_name: editingUserForm.laundry_name,
        permissions: editingUserForm.permissions
      } : null);
    }

    if (!isBrowserOnline()) {
      addOfflineAction({
        type: 'UPDATE_USER',
        payload: {
          id: editingUserProfile.id,
          updates: {
            full_name: editingUserForm.full_name,
            role: editingUserForm.role,
            laundry_id: editingUserForm.laundry_id,
            laundry_name: editingUserForm.laundry_name,
            permissions: editingUserForm.permissions,
            saas_plan: editingUserForm.saas_plan,
            saas_billing_cycle: editingUserForm.saas_billing_cycle,
            saas_expiry: resolvedExpiryIso
          }
        },
        laundryId: editingUserForm.laundry_id || userProfile?.laundry_id
      });
      setSaveLoading(false);
      alert('تم تحديث بيانات المستخدم محلياً بنجاح في وضع الأوفلاين! 🚀 سيتم المزامنة عند عودة الاتصال.');
      setEditingUserProfile(null);
      return;
    }

    try {
      // Exclude 'permissions' column from database update to prevent schema column error
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editingUserForm.full_name,
          role: editingUserForm.role,
          laundry_id: editingUserForm.laundry_id,
          laundry_name: editingUserForm.laundry_name
        })
        .eq('id', editingUserProfile.id);

      if (error) throw error;

      // Update custom permissions in setting map safely
      try {
        let currentMap: Record<string, string[]> = {};
        const { data: mData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'platform_user_permissions_map');
        if (mData && mData.length > 0 && mData[0].value) {
          currentMap = mData[0].value as Record<string, string[]>;
        }
        
        currentMap[editingUserProfile.id] = editingUserForm.permissions;
        
        await supabase
          .from('settings')
          .upsert({
            key: 'platform_user_permissions_map',
            value: currentMap,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (permsErr) {
        console.warn("Could not save custom permissions map:", permsErr);
      }

      // Update custom subscription in settings map safely
      try {
        let subMap: Record<string, any> = {};
        const { data: sData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'platform_subscriptions_map');
        if (sData && sData.length > 0 && sData[0].value) {
          subMap = sData[0].value as Record<string, any>;
        }
        
        subMap[editingUserProfile.id] = {
          saas_plan: editingUserForm.saas_plan || editingUserProfile.saas_plan || 'gold',
          saas_billing_cycle: editingUserForm.saas_billing_cycle || editingUserProfile.saas_billing_cycle || 'annual',
          saas_expiry: resolvedExpiryIso,
          saas_status: isExpActive ? 'active' : 'expired'
        };
        
        await supabase
          .from('settings')
          .upsert({
            key: 'platform_subscriptions_map',
            value: subMap,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (subErr) {
        console.warn("Could not save custom subscription map:", subErr);
      }

      // Ensure the laundry name is saved or updated in platform laundries settings
      if (editingUserForm.laundry_id && editingUserForm.laundry_name) {
        await addLaundryToPlatform(editingUserForm.laundry_id, editingUserForm.laundry_name);
        
        // Sync updated laundry_name across all user profiles that share this laundry_id
        try {
          await supabase
            .from('profiles')
            .update({ laundry_name: editingUserForm.laundry_name })
            .eq('laundry_id', editingUserForm.laundry_id);
        } catch (syncErr) {
          console.warn("Could not sync laundry_name across profiles:", syncErr);
        }
      }

      if (editingUserProfile.id === session?.user?.id) {
        try {
          await supabase.auth.updateUser({
            data: {
              full_name: editingUserForm.full_name,
              role: editingUserForm.role,
              laundry_id: editingUserForm.laundry_id,
              laundry_name: editingUserForm.laundry_name,
              permissions: editingUserForm.permissions
            }
          });
        } catch (authErr) {
          console.warn("Could not update auth user metadata:", authErr);
        }
      }

      alert('تم تحديث بيانات المستخدم وصلاحياته بنجاح ✅');
      setEditingUserProfile(null);
    } catch (e: any) {
      addOfflineAction({
        type: 'UPDATE_USER',
        payload: {
          id: editingUserProfile.id,
          updates: {
            full_name: editingUserForm.full_name,
            role: editingUserForm.role,
            laundry_id: editingUserForm.laundry_id,
            laundry_name: editingUserForm.laundry_name,
            permissions: editingUserForm.permissions
          }
        },
        laundryId: editingUserForm.laundry_id || userProfile?.laundry_id
      });
      alert('تم حفظ التعديلات محلياً وسيتم المزامنة تلقائياً عند الاتصال ✅');
      setEditingUserProfile(null);
    } finally {
      setSaveLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    const nextProfiles = profiles.map(p => p.id === userId ? { ...p, role } : p);
    setProfiles(nextProfiles);

    try {
      const lid = userProfile?.laundry_id;
      const serialized = JSON.stringify(nextProfiles);
      if (lid) localStorage.setItem(`laundry_profiles_${lid}`, serialized);
      localStorage.setItem('laundry_profiles_all', serialized);
      localStorage.setItem('laundry_profiles', serialized);
    } catch (e) {}

    if (isBrowserOnline()) {
      try {
        const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
        if (error) throw error;
        alert('تم تحديث صلاحية المستخدم بنجاح ✅');
      } catch (e: any) {
        addOfflineAction({
          type: 'UPDATE_USER',
          payload: { id: userId, updates: { role } },
          laundryId: userProfile?.laundry_id
        });
        alert('تم حفظ الصلاحية محلياً وسيتم المزامنة عند الاتصال ✅');
      }
    } else {
      addOfflineAction({
        type: 'UPDATE_USER',
        payload: { id: userId, updates: { role } },
        laundryId: userProfile?.laundry_id
      });
      alert('تم تحديث صلاحية المستخدم محلياً بنجاح في وضع الأوفلاين ✅');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === session?.user?.id) {
      alert('لا يمكنك حذف حسابك الحالي! ❌');
      return;
    }
    setDeletingUserId(userId);
    const nextProfiles = profiles.filter(p => p.id !== userId);
    setProfiles(nextProfiles);

    try {
      const lid = userProfile?.laundry_id;
      const serialized = JSON.stringify(nextProfiles);
      if (lid) localStorage.setItem(`laundry_profiles_${lid}`, serialized);
      localStorage.setItem('laundry_profiles_all', serialized);
      localStorage.setItem('laundry_profiles', serialized);
    } catch (e) {}

    setUserToDelete(null);

    if (isBrowserOnline()) {
      try {
        const { error } = await supabase.from('profiles').delete().eq('id', userId);
        if (error) throw error;
        alert('تم حذف المستخدم بنجاح ✅');
      } catch (e: any) {
        addOfflineAction({
          type: 'DELETE_USER',
          payload: { id: userId },
          laundryId: userProfile?.laundry_id
        });
        alert('تم حذف المستخدم محلياً وسيتم المزامنة عند الاتصال ✅');
      } finally {
        setDeletingUserId(null);
      }
    } else {
      addOfflineAction({
        type: 'DELETE_USER',
        payload: { id: userId },
        laundryId: userProfile?.laundry_id
      });
      setDeletingUserId(null);
      alert('تم حذف المستخدم محلياً في وضع الأوفلاين ✅');
    }
  };

  const isFinancePendingOnlyUser = useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.role === 'super_admin') return false;
    const permissions = (userProfile.permissions !== undefined && userProfile.permissions !== null)
      ? userProfile.permissions
      : (ROLE_PERMISSIONS[userProfile.role] || []);
    return permissions.includes('finance_pending_only') && !permissions.includes('finance');
  }, [userProfile]);

  const allowedNavItems = useMemo(() => {
    if (!userProfile) return [];
    const permissions = (userProfile.permissions !== undefined && userProfile.permissions !== null)
      ? userProfile.permissions
      : (ROLE_PERMISSIONS[userProfile.role] || []);
    const isPendingOnly = permissions.includes('finance_pending_only') && !permissions.includes('finance') && userProfile.role !== 'super_admin';
    return navItems
      .filter(item => {
        if (item.id === 'super-admin') {
          return userProfile.role === 'super_admin';
        }
        if (item.id === 'finance') {
          return permissions.includes('finance') || permissions.includes('finance_pending_only');
        }
        return permissions.includes(item.id);
      })
      .map(item => {
        if (item.id === 'finance' && isPendingOnly) {
          return { ...item, label: 'تصفية المبالغ المعلقة 💰' };
        }
        return item;
      });
  }, [userProfile]);

  // Ensure active tab is allowed
  useEffect(() => {
    if (userProfile) {
      const permissions = (userProfile.permissions !== undefined && userProfile.permissions !== null)
        ? userProfile.permissions
        : (ROLE_PERMISSIONS[userProfile.role] || []);
      const isAllowed = (tabId: string) => {
        if (tabId === 'super-admin') {
          return userProfile.role === 'super_admin';
        }
        if (tabId === 'finance') {
          return permissions.includes('finance') || permissions.includes('finance_pending_only');
        }
        return permissions.includes(tabId);
      };
      if (!isAllowed(activeTab)) {
        const firstAllowed = navItems.find(item => isAllowed(item.id));
        if (firstAllowed) {
          setActiveTab(firstAllowed.id as any);
        } else {
          setActiveTab('dashboard');
        }
      }
    }
  }, [userProfile, activeTab]);

  const fetchSettings = async () => {
    try {
      const laundryId = userProfile?.laundry_id;
      if (!laundryId) return;
      const getTenantKey = (baseKey: string) => isDbMultiTenant ? baseKey : `${laundryId}_${baseKey}`;

      let query = supabase.from('settings').select('value').eq('key', getTenantKey('twilio'));
      if (isDbMultiTenant) {
        query = query.eq('laundry_id', laundryId);
      }
      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        setTwilioConfig(data.value);
      }
    } catch (e) {
      console.error("Failed to fetch settings from DB:", e);
    }
  };

  const saveSettingsToDB = async () => {
    setSaveLoading(true);
    try {
      const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
      const getTenantKey = (baseKey: string) => isDbMultiTenant ? baseKey : `${laundryId}_${baseKey}`;

      const payload: any = {
        key: getTenantKey('twilio'),
        value: twilioConfig,
        updated_at: new Date().toISOString()
      };
      if (isDbMultiTenant) {
        payload.laundry_id = laundryId;
      }

      const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'key' });

      if (error) throw error;
      alert('تم حفظ الإعدادات في قاعدة البيانات بنجاح ✅');
    } catch (e: any) {
      alert(`فشل حفظ الإعدادات: ${e.message}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        app_name: 'منصة غسيل كلاود - نظام إدارة المغاسل',
        version: '2.0',
        export_date: new Date().toISOString(),
        laundry_id: userProfile?.laundry_id || 'laundry-default',
        laundry_name: userProfile?.laundry_name || 'مغسلة عود ونظافة',
        orders: orders || [],
        inventory: inventory || [],
        categories: categories || [],
        subscriptions: subscriptions || [],
        subscription_packages: subscriptionPackages || [],
        offers: offers || [],
        inventory_consumption: inventoryConsumption || {},
        twilio_config: twilioConfig || {},
        custom_prices: JSON.parse(localStorage.getItem('laundry_categories_custom_prices') || '{}'),
        custom_icons: JSON.parse(localStorage.getItem('laundry_categories_custom_icons') || '{}')
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      const safeLaundryName = (userProfile?.laundry_name || 'المغسلة').replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_');
      
      link.href = url;
      link.download = `نسخة_احتياطية_${safeLaundryName}_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`حدث خطأ أثناء تصدير النسخة الاحتياطية: ${err.message || err}`);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);

    const fileName = file.name;
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        if (!content || !content.trim()) {
          throw new Error('الملف فارغ ولا يحتوي على بيانات.');
        }

        let data: any;
        try {
          data = JSON.parse(content);
        } catch (jsonErr) {
          throw new Error('صيغة الملف غير صحيحة (ليس ملف JSON صالح).');
        }

        if (!data || (typeof data !== 'object')) {
          throw new Error('الملف غير صالح أو لا يحتوي على كائن بيانات صحيح.');
        }

        let root = data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
            root = data.data;
          } else if (data.backup && typeof data.backup === 'object' && !Array.isArray(data.backup)) {
            root = data.backup;
          }
        }

        // Safe collections extraction
        let importedOrders: any[] = [];
        if (Array.isArray(root)) {
          importedOrders = root;
        } else if (Array.isArray(root.orders)) {
          importedOrders = root.orders;
        } else if (Array.isArray(root.invoices)) {
          importedOrders = root.invoices;
        } else if (Array.isArray(root.sales)) {
          importedOrders = root.sales;
        }

        let importedInventory: any[] = [];
        if (Array.isArray(root.inventory)) {
          importedInventory = root.inventory;
        } else if (Array.isArray(root.items) && importedOrders.length > 0) {
          importedInventory = root.items;
        } else if (Array.isArray(root.stock)) {
          importedInventory = root.stock;
        }

        let importedCategories: any[] = [];
        if (Array.isArray(root.categories)) {
          importedCategories = root.categories;
        } else if (Array.isArray(root.services)) {
          importedCategories = root.services;
        } else if (Array.isArray(root.items) && importedOrders.length === 0 && importedInventory.length === 0) {
          importedCategories = root.items;
        }

        let importedSubscriptions: any[] = Array.isArray(root.subscriptions) ? root.subscriptions : Array.isArray(root.customer_subscriptions) ? root.customer_subscriptions : [];
        let importedPackages: any[] = Array.isArray(root.subscription_packages) ? root.subscription_packages : Array.isArray(root.packages) ? root.packages : [];
        let importedOffers: any[] = Array.isArray(root.offers) ? root.offers : [];

        const totalItemsCount = importedOrders.length + importedInventory.length + importedCategories.length + importedSubscriptions.length + importedPackages.length + importedOffers.length;
        if (totalItemsCount === 0 && !root.custom_prices && !root.inventory_consumption) {
          throw new Error('لم يتم العثور على أي بيانات معروفة (فواتير، مخزون، أصناف) داخل ملف النسخة الاحتياطية.');
        }

        setImportModalData({
          fileName,
          laundryName: root.laundry_name || root.laundryName || userProfile?.laundry_name || 'غير محدد',
          exportDate: root.export_date ? new Date(root.export_date).toLocaleString('ar-SA-u-nu-latn') : new Date().toLocaleDateString('ar-SA-u-nu-latn'),
          ordersCount: importedOrders.length,
          inventoryCount: importedInventory.length,
          categoriesCount: importedCategories.length,
          subscriptionsCount: importedSubscriptions.length,
          packagesCount: importedPackages.length,
          offersCount: importedOffers.length,
          root,
          importedOrders,
          importedInventory,
          importedCategories,
          importedSubscriptions,
          importedPackages,
          importedOffers
        });
      } catch (err: any) {
        setImportError(`عذراً، فشل استيراد ملف النسخة الاحتياطية: ${err.message || err}`);
      } finally {
        if (backupFileInputRef.current) {
          backupFileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setImportError('حدث خطأ أثناء قراءة الملف من جهازك.');
      if (backupFileInputRef.current) {
        backupFileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const executeBackupRestore = async () => {
    if (!importModalData) return;
    setIsImporting(true);
    setImportError(null);

    const {
      root,
      importedOrders,
      importedInventory,
      importedCategories,
      importedSubscriptions,
      importedPackages,
      importedOffers
    } = importModalData;

    try {
      const laundryId = userProfile?.laundry_id || 'default';
      const isMulti = isDbMultiTenant;

      // 1. Local State Update
      if (importedOrders.length > 0) {
        setOrders(importedOrders);
        localStorage.setItem('laundry_orders', JSON.stringify(importedOrders));
        localStorage.setItem(`laundry_orders_${laundryId}`, JSON.stringify(importedOrders));
      }

      if (importedInventory.length > 0) {
        setInventory(importedInventory);
        localStorage.setItem('laundry_inventory', JSON.stringify(importedInventory));
        localStorage.setItem(`laundry_inventory_${laundryId}`, JSON.stringify(importedInventory));
      }

      if (importedCategories.length > 0) {
        setCategories(importedCategories);
        localStorage.setItem('laundry_categories', JSON.stringify(importedCategories));
        localStorage.setItem(`laundry_categories_${laundryId}`, JSON.stringify(importedCategories));
      }

      if (importedSubscriptions.length > 0) {
        setSubscriptions(importedSubscriptions);
        localStorage.setItem('laundry_subscriptions', JSON.stringify(importedSubscriptions));
        localStorage.setItem(`laundry_subscriptions_${laundryId}`, JSON.stringify(importedSubscriptions));
      }

      if (importedPackages.length > 0) {
        setSubscriptionPackages(importedPackages);
        localStorage.setItem('laundry_subscription_packages', JSON.stringify(importedPackages));
        localStorage.setItem(`laundry_subscription_packages_${laundryId}`, JSON.stringify(importedPackages));
      }

      if (importedOffers.length > 0) {
        setOffers(importedOffers);
        localStorage.setItem('laundry_offers', JSON.stringify(importedOffers));
        localStorage.setItem(`laundry_offers_${laundryId}`, JSON.stringify(importedOffers));
      }

      if (root.inventory_consumption && typeof root.inventory_consumption === 'object') {
        setInventoryConsumption(root.inventory_consumption);
        localStorage.setItem('laundry_inventory_consumption', JSON.stringify(root.inventory_consumption));
        localStorage.setItem(`${laundryId}_laundry_inventory_consumption`, JSON.stringify(root.inventory_consumption));
      }

      if (root.custom_prices && typeof root.custom_prices === 'object') {
        setCustomPrices(root.custom_prices);
        localStorage.setItem('laundry_categories_custom_prices', JSON.stringify(root.custom_prices));
        localStorage.setItem(`${laundryId}_laundry_categories_custom_prices`, JSON.stringify(root.custom_prices));
      }

      if (root.custom_icons && typeof root.custom_icons === 'object') {
        localStorage.setItem('laundry_categories_custom_icons', JSON.stringify(root.custom_icons));
        localStorage.setItem(`${laundryId}_laundry_categories_custom_icons`, JSON.stringify(root.custom_icons));
      }

      if (root.twilio_config && typeof root.twilio_config === 'object') {
        setTwilioConfig(root.twilio_config);
        localStorage.setItem('laundry_twilio_config', JSON.stringify(root.twilio_config));
      }

      // 2. Sync to Supabase Database
      if (userProfile?.laundry_id && supabase) {
        try {
          if (importedOrders.length > 0) {
            const formattedOrders = importedOrders.map((ord: any) => ({
              ...ord,
              laundry_id: userProfile.laundry_id,
              order_number: ord.order_number || `ORD-${Math.floor(10000 + Math.random() * 90000)}`
            }));
            await supabase.from('orders').upsert(formattedOrders, { onConflict: 'id' });
          }

          if (importedInventory.length > 0) {
            const formattedInventory = importedInventory.map((inv: any) => ({
              ...inv,
              laundry_id: userProfile.laundry_id
            }));
            await supabase.from('inventory').upsert(formattedInventory, { onConflict: 'id' });
          }

          if (importedCategories.length > 0) {
            const genId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
            const formattedCategories = importedCategories.map((cat: any) => ({
              id: cat.id || genId(),
              name: cat.name,
              price: cat.price ?? cat.price_normal ?? 5,
              icon: cat.icon || '👕',
              price_normal: cat.price_normal ?? cat.price ?? 5,
              price_urgent: cat.price_urgent ?? 10,
              price_ironing: cat.price_ironing ?? 2.5,
              price_no_ironing: cat.price_no_ironing ?? 4,
              laundry_id: userProfile.laundry_id
            }));
            await supabase.from('categories').upsert(formattedCategories, { onConflict: 'id' });
          }

          if (importedSubscriptions.length > 0) {
            const formattedSubs = importedSubscriptions.map((sub: any) => ({
              ...sub,
              laundry_id: userProfile.laundry_id
            }));
            await supabase.from('subscriptions').upsert(formattedSubs, { onConflict: 'id' });
          }

          if (importedPackages.length > 0) {
            const formattedPkgs = importedPackages.map((pkg: any) => ({
              ...pkg,
              laundry_id: userProfile.laundry_id
            }));
            await supabase.from('subscription_packages').upsert(formattedPkgs, { onConflict: 'id' });
          }

          const getTenantKey = (baseKey: string) => isMulti ? baseKey : `${laundryId}_${baseKey}`;

          if (root.custom_prices) {
            const pPayload: any = {
              key: getTenantKey('laundry_categories_custom_prices'),
              value: root.custom_prices,
              updated_at: new Date().toISOString()
            };
            if (isMulti) pPayload.laundry_id = laundryId;
            await supabase.from('settings').upsert(pPayload, { onConflict: 'key' });
          }

          if (root.inventory_consumption) {
            const cPayload: any = {
              key: getTenantKey('laundry_inventory_consumption'),
              value: root.inventory_consumption,
              updated_at: new Date().toISOString()
            };
            if (isMulti) cPayload.laundry_id = laundryId;
            await supabase.from('settings').upsert(cPayload, { onConflict: 'key' });
          }

          if (root.twilio_config) {
            const tPayload: any = {
              key: getTenantKey('twilio'),
              value: root.twilio_config,
              updated_at: new Date().toISOString()
            };
            if (isMulti) tPayload.laundry_id = laundryId;
            await supabase.from('settings').upsert(tPayload, { onConflict: 'key' });
          }
        } catch (syncErr: any) {
          console.warn("Supabase sync warning during import:", syncErr);
        }
      }

      setImportSuccess(`تم استرجاع واستيراد كافة البيانات بنجاح! 🎉\n• الفواتير: ${importedOrders.length}\n• عناصر المخزون: ${importedInventory.length}\n• الأصناف والخدمات: ${importedCategories.length}\n• الاشتراكات: ${importedSubscriptions.length}`);
      setImportModalData(null);

      // Refresh data
      fetchData();
    } catch (err: any) {
      setImportError(`حدث خطأ أثناء تطبيق بيانات الاسترجاع: ${err.message || err}`);
    } finally {
      setIsImporting(false);
    }
  };

  const triggerBackgroundNotification = async (order: Order, context: MessageContext) => {
    if (!twilioConfig.enabled || !twilioConfig.accountSid) return;
    try {
      const smartMsg = await generateSmartReminder(order, context);
      const fullMessage = `${smartMsg}\n\n📦 فاتورة: ${order.order_number}\n💰 الإجمالي: ${order.total.toFixed(2)} ريال\n📍 الحالة: ${statusArabic[order.status]}\n\n${DISCLAIMER_TEXT}`;
      await sendTwilioWhatsApp(order, fullMessage, twilioConfig);
    } catch (e) {
      console.error("Background notify error:", e);
    }
  };

  const checkAndSendAutoReminders = async () => {
    if (!twilioConfig.enabled || !twilioConfig.accountSid) return;
    const now = Date.now();
    for (const order of orders) {
      if (order.status === 'Delivered') continue;
      
      const orderTime = new Date(order.created_at).getTime();
      const hoursPassed = (now - orderTime) / 3600000;
      
      let key: keyof Order | null = null;
      let context: MessageContext | null = null;

      if (hoursPassed >= 48 && !order.notified_48h) { key = 'notified_48h'; context = 'REMINDER_48H'; }
      else if (hoursPassed >= 24 && !order.notified_24h) { key = 'notified_24h'; context = 'REMINDER_24H'; }
      else if (hoursPassed >= 1 && !order.notified_1h) { key = 'notified_1h'; context = 'REMINDER_1H'; }

      if (key && context) {
        try {
          const smartMsg = await generateSmartReminder(order, context);
          const fullMessage = `${smartMsg}\n\n📦 فاتورة: ${order.order_number}\n💰 الإجمالي: ${order.total.toFixed(2)} ريال\n📍 الحالة: ${statusArabic[order.status]}\n\n${DISCLAIMER_TEXT}`;
          const success = await sendTwilioWhatsApp(order, fullMessage, twilioConfig);
          if (success) {
            await supabase.from('orders').update({ [key]: true }).eq('id', order.id);
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, [key]: true } : o));
          }
        } catch (e) { console.error("Auto Send Fail:", e); }
      }
    }
  };

  const getMergedCategories = (rawCategories: any[], pricesDict?: Record<string, any>) => {
    let storedPrices: Record<string, any> = {};
    if (pricesDict) {
      storedPrices = pricesDict;
    } else if (Object.keys(customPrices).length > 0) {
      storedPrices = customPrices;
    } else {
      try {
        const stored = localStorage.getItem("laundry_categories_custom_prices");
        if (stored) {
          storedPrices = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Error reading custom prices from localStorage:", e);
      }
    }

    let storedIcons: Record<string, string> = {};
    try {
      const storedIc = localStorage.getItem("laundry_categories_custom_icons");
      if (storedIc) storedIcons = JSON.parse(storedIc);
    } catch (e) {
      console.error("Error reading custom icons from localStorage:", e);
    }

    return rawCategories.map((cat: any) => {
      const custom = storedPrices[cat.name] || {};
      const customIcon = storedIcons[cat.name] || cat.icon || '✨';
      const price_normal = custom.price_normal !== undefined && custom.price_normal !== null ? custom.price_normal : (cat.price_normal !== undefined && cat.price_normal !== null ? cat.price_normal : (cat.price ?? 5));
      const price_urgent = custom.price_urgent !== undefined && custom.price_urgent !== null ? custom.price_urgent : (cat.price_urgent !== undefined && cat.price_urgent !== null ? cat.price_urgent : price_normal * 2);
      const price_ironing = custom.price_ironing !== undefined && custom.price_ironing !== null ? custom.price_ironing : (cat.price_ironing !== undefined && cat.price_ironing !== null ? cat.price_ironing : price_normal * 0.5);
      const price_no_ironing = custom.price_no_ironing !== undefined && custom.price_no_ironing !== null ? custom.price_no_ironing : (cat.price_no_ironing !== undefined && cat.price_no_ironing !== null ? cat.price_no_ironing : price_normal * 0.8);
      
      return {
        ...cat,
        icon: customIcon,
        price_normal,
        price_urgent,
        price_ironing,
        price_no_ironing,
        price: price_normal
      };
    });
  };

  const fetchData = async () => {
    const laundryId = userProfile?.laundry_id || (() => {
      try {
        const cached = localStorage.getItem('laundry_cached_profile');
        if (cached) return JSON.parse(cached)?.laundry_id;
      } catch (e) {}
      return null;
    })();

    if (!laundryId) {
      console.warn("fetchData: laundry_id is not yet available, retaining local cache.");
      setLoading(false);
      return;
    }

    // Fast-path: If offline, load strictly from local storage with 0 latency
    if (!isBrowserOnline()) {
      try {
        const localOrders = localStorage.getItem(`laundry_orders_${laundryId}`) || localStorage.getItem('laundry_orders');
        if (localOrders) setOrders(JSON.parse(localOrders));
        const localInv = localStorage.getItem(`laundry_inventory_${laundryId}`) || localStorage.getItem('laundry_inventory');
        if (localInv) setInventory(JSON.parse(localInv));
        const localSubs = localStorage.getItem(`laundry_subscriptions_${laundryId}`) || localStorage.getItem('laundry_subscriptions');
        if (localSubs) setSubscriptions(JSON.parse(localSubs));
        const localPkgs = localStorage.getItem(`laundry_subscription_packages_${laundryId}`) || localStorage.getItem('laundry_subscription_packages');
        if (localPkgs) setSubscriptionPackages(JSON.parse(localPkgs));
        const localCats = localStorage.getItem(`laundry_categories_${laundryId}`) || localStorage.getItem('laundry_categories');
        if (localCats) setCategories(JSON.parse(localCats));
        const localProfiles = localStorage.getItem(`laundry_profiles_${laundryId}`) || localStorage.getItem('laundry_profiles_all') || localStorage.getItem('laundry_profiles');
        if (localProfiles) setProfiles(JSON.parse(localProfiles));
        const localConsumption = localStorage.getItem('laundry_inventory_consumption');
        if (localConsumption) setInventoryConsumption(JSON.parse(localConsumption));
        setIsCategoriesLoaded(true);
      } catch (e) {}
      setLoading(false);
      return;
    }

    setLoading(true);
    setDbError(null);
    try {
      // Auto-detect schema multi-tenancy dynamically
      let isMulti = true;
      try {
        const { error } = await supabase.from('orders').select('laundry_id').limit(1);
        if (error && error.code === '42703') {
          isMulti = false;
        }
      } catch (e) {}
      setIsDbMultiTenant(isMulti);

      // Helper to dynamically get tenant keys for Settings
      const getTenantKey = (baseKey: string) => isMulti ? baseKey : `${laundryId}_${baseKey}`;

      // 1. Fetch Orders
      let ordersQuery = supabase.from('orders').select('*');
      if (isMulti && laundryId) {
        ordersQuery = ordersQuery.eq('laundry_id', laundryId);
      }
      const { data: ordersData, error: ordersError } = await ordersQuery.order('created_at', { ascending: false });
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
          order_number: cleanTenantString(o.order_number),
          customer_name: cleanTenantString(o.customer_name),
          customer_phone: cleanTenantString(o.customer_phone)
        }));
      }

      // Preserve only pending unsynced orders from the offline queue with zero duplicates
      try {
        const pendingQueue = getOfflineQueue();
        const pendingCreated = pendingQueue
          .filter(a => a.type === 'CREATE_ORDER' && a.payload)
          .map(a => a.payload);

        if (pendingCreated.length > 0) {
          const remoteIds = new Set(processedOrders.map((o: any) => (o.id ? String(o.id).toLowerCase() : '')));
          const remoteNums = new Set(processedOrders.map((o: any) => cleanTenantString(o.order_number).toLowerCase()));
          const trulyUnsynced = pendingCreated.filter((po: any) => {
            const poId = po.id ? String(po.id).toLowerCase() : '';
            const poNum = cleanTenantString(po.order_number).toLowerCase();
            return (!poId || !remoteIds.has(poId)) && (!poNum || !remoteNums.has(poNum));
          });
          if (trulyUnsynced.length > 0) {
            console.log(`Preserving ${trulyUnsynced.length} pending offline orders:`, trulyUnsynced.map((o: any) => o.order_number));
            processedOrders = [...trulyUnsynced, ...processedOrders];
          }
        }
      } catch (e) {}

      // Strictly deduplicate processedOrders by both id and order_number
      processedOrders = deduplicateOrders(processedOrders);

      setOrders(processedOrders);
      if (isManualOffline()) {
        try {
          const limit = getOfflineCacheLimit();
          const toSave = limit === 'all' ? processedOrders : processedOrders.slice(0, typeof limit === 'number' ? limit : 100);
          const serialized = JSON.stringify(toSave);
          localStorage.setItem(`laundry_orders_${laundryId}`, serialized);
          localStorage.setItem('laundry_orders', serialized);
        } catch (e) {}
      }

      // 2. Fetch Inventory
      let invQuery = supabase.from('inventory').select('*');
      if (isMulti && laundryId) {
        invQuery = invQuery.eq('laundry_id', laundryId);
      }
      const { data: inventoryData, error: invError } = await invQuery;
      if (invError) throw invError;

      let processedInventory = inventoryData || [];
      if (laundryId) {
        if (!isMulti) {
          processedInventory = processedInventory.filter((i: any) => i.name && i.name.startsWith(`${laundryId}|`));
        }
        processedInventory = processedInventory.map((i: any) => ({
          ...i,
          name: cleanTenantString(i.name)
        }));
      }

      if (processedInventory.length === 0) {
        try {
          const localSaved = localStorage.getItem(`laundry_inventory_${laundryId}`) || localStorage.getItem('laundry_inventory');
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              processedInventory = parsed;
            }
          }
        } catch (e) {}
      }
      setInventory(processedInventory);
      try {
        localStorage.setItem(`laundry_inventory_${laundryId}`, JSON.stringify(processedInventory));
        localStorage.setItem('laundry_inventory', JSON.stringify(processedInventory));
      } catch (e) {}

      // 3. Fetch Subscriptions
      let subsQuery = supabase.from('subscriptions').select('*');
      if (isMulti && laundryId) {
        subsQuery = subsQuery.eq('laundry_id', laundryId);
      }
      const { data: subsData, error: subsError } = await subsQuery;
      if (subsError) throw subsError;

      let processedSubs = subsData || [];
      if (laundryId) {
        if (!isMulti) {
          processedSubs = processedSubs.filter((s: any) => 
            (s.customer_name && s.customer_name.startsWith(`${laundryId}|`)) || 
            (s.customer_phone && s.customer_phone.startsWith(`${laundryId}|`))
          );
        }
        processedSubs = processedSubs.map((s: any) => ({
          ...s,
          customer_name: cleanTenantString(s.customer_name),
          customer_phone: cleanTenantString(s.customer_phone)
        }));
      }
      setSubscriptions(processedSubs);
      try {
        localStorage.setItem(`laundry_subscriptions_${laundryId}`, JSON.stringify(processedSubs));
        localStorage.setItem('laundry_subscriptions', JSON.stringify(processedSubs));
      } catch (e) {}

      // 4. Fetch Subscription Packages
      let pkgsQuery = supabase.from('subscription_packages').select('*');
      if (isMulti && laundryId) {
        pkgsQuery = pkgsQuery.eq('laundry_id', laundryId);
      }
      const { data: pkgsData, error: pkgsError } = await pkgsQuery;
      if (pkgsError) throw pkgsError;

      let processedPkgs = pkgsData || [];
      if (laundryId) {
        if (!isMulti) {
          processedPkgs = processedPkgs.filter((pkg: any) => pkg.name && pkg.name.startsWith(`${laundryId}|`));
        }
        processedPkgs = processedPkgs.map((pkg: any) => {
          let name = cleanTenantString(pkg.name);
          let discount_percent = 0;
          let cleanName = name;
          if (name && name.includes(' __dp:')) {
            const parts = name.split(' __dp:');
            cleanName = parts[0];
            discount_percent = parseInt(parts[1], 10) || 0;
          }
          return {
            ...pkg,
            name: cleanName,
            discount_percent
          };
        });
      }
      setSubscriptionPackages(processedPkgs);
      try {
        localStorage.setItem(`laundry_subscription_packages_${laundryId}`, JSON.stringify(processedPkgs));
        localStorage.setItem('laundry_subscription_packages', JSON.stringify(processedPkgs));
      } catch (e) {}

      // 5. Fetch custom prices
      let latestCustomPrices: Record<string, any> = {};
      try {
        let pricesQuery = supabase.from('settings').select('value').eq('key', getTenantKey('laundry_categories_custom_prices'));
        if (isMulti && laundryId) {
          pricesQuery = pricesQuery.eq('laundry_id', laundryId);
        }
        const { data: pricesSetting, error: pricesError } = await pricesQuery.maybeSingle();
        if (!pricesError && pricesSetting && pricesSetting.value) {
          latestCustomPrices = typeof pricesSetting.value === 'string'
            ? JSON.parse(pricesSetting.value)
            : pricesSetting.value;
          localStorage.setItem(getTenantKey('laundry_categories_custom_prices'), JSON.stringify(latestCustomPrices));
        } else {
          const stored = localStorage.getItem(getTenantKey('laundry_categories_custom_prices'));
          if (stored) latestCustomPrices = JSON.parse(stored);
        }
      } catch (err) {
        console.warn("Could not load custom prices:", err);
        const stored = localStorage.getItem(getTenantKey('laundry_categories_custom_prices'));
        if (stored) {
          try { latestCustomPrices = JSON.parse(stored); } catch {}
        }
      }
      setCustomPrices(latestCustomPrices);

      // 6. Fetch inventory consumption
      let latestConsumption: Record<string, Record<string, number>> = {};
      try {
        let consQuery = supabase.from('settings').select('value').eq('key', getTenantKey('laundry_inventory_consumption'));
        if (isMulti && laundryId) {
          consQuery = consQuery.eq('laundry_id', laundryId);
        }
        const { data: consumptionSetting, error: consError } = await consQuery.maybeSingle();
        if (!consError && consumptionSetting && consumptionSetting.value) {
          latestConsumption = typeof consumptionSetting.value === 'string'
            ? JSON.parse(consumptionSetting.value)
            : consumptionSetting.value;
          localStorage.setItem(getTenantKey('laundry_inventory_consumption'), JSON.stringify(latestConsumption));
        } else {
          const storedCons = localStorage.getItem(getTenantKey('laundry_inventory_consumption'));
          if (storedCons) latestConsumption = JSON.parse(storedCons);
        }
      } catch (err) {
        console.warn("Could not load inventory consumption:", err);
        const storedCons = localStorage.getItem(getTenantKey('laundry_inventory_consumption'));
        if (storedCons) {
          try { latestConsumption = JSON.parse(storedCons); } catch {}
        }
      }
      setInventoryConsumption(latestConsumption);

      // 7. Fetch categories custom order
      let categoriesOrder: string[] = [];
      try {
        let orderQuery = supabase.from('settings').select('value').eq('key', getTenantKey('laundry_categories_order'));
        if (isMulti && laundryId) {
          orderQuery = orderQuery.eq('laundry_id', laundryId);
        }
        const { data: orderSetting, error: orderError } = await orderQuery.maybeSingle();
        if (!orderError && orderSetting && orderSetting.value) {
          categoriesOrder = typeof orderSetting.value === 'string'
            ? JSON.parse(orderSetting.value)
            : orderSetting.value;
        } else {
          const storedOrder = localStorage.getItem(getTenantKey('laundry_categories_order'));
          if (storedOrder) categoriesOrder = JSON.parse(storedOrder);
        }
      } catch (err) {
        console.warn("Could not load categories order:", err);
        const storedOrder = localStorage.getItem(getTenantKey('laundry_categories_order'));
        if (storedOrder) {
          try { categoriesOrder = JSON.parse(storedOrder); } catch {}
        }
      }

      // 8. Fetch Categories
      console.log("Fetching categories from Supabase...");
      let catsQuery = supabase.from('categories').select('*');
      if (isMulti && laundryId) {
        catsQuery = catsQuery.eq('laundry_id', laundryId);
      }
      const { data: catsData, error: catsError } = await catsQuery.order('created_at', { ascending: true });
      if (catsError) throw catsError;

      let dbCats = catsData || [];
      if (laundryId && !isMulti) {
        dbCats = dbCats.filter((c: any) => c.name && c.name.startsWith(`${laundryId}|`));
      }

      // Auto-seed if empty
      if (dbCats.length === 0) {
        console.log("Database categories table is empty, auto-seeding with INITIAL_ITEMS...");
        const seedRows = INITIAL_ITEMS.map(item => {
          const row: any = {
            name: isMulti ? item.name : `${laundryId}|${item.name}`,
            price: item.price,
            icon: item.icon,
            price_normal: item.price,
            price_urgent: item.price * 2,
            price_ironing: item.price * 0.5,
            price_no_ironing: item.price * 0.8
          };
          if (isMulti) {
            row.laundry_id = laundryId;
          }
          return row;
        });

        try {
          const { data: seedData, error: seedError } = await supabase.from('categories').insert(seedRows).select();
          if (!seedError && seedData && seedData.length > 0) {
            dbCats = seedData;
            console.log("Auto-seeding categories completed successfully!");
          } else {
            console.warn("Auto-seeding categories failed, falling back to local INITIAL_ITEMS:", seedError);
          }
        } catch (seedEx) {
          console.warn("Auto-seeding categories exception caught, falling back to local INITIAL_ITEMS:", seedEx);
        }
      }

      const uniqueDbCats: any[] = [];
      const seenCatNames = new Set<string>();
      for (const c of dbCats) {
        const cleanName = cleanTenantString(c.name);
        if (cleanName && !seenCatNames.has(cleanName)) {
          seenCatNames.add(cleanName);
          uniqueDbCats.push({ ...c, name: cleanName });
        }
      }
      dbCats = uniqueDbCats;

      const sortCategories = (cats: any[], orderList: string[]) => {
        if (!orderList || orderList.length === 0) return cats;
        return [...cats].sort((a: any, b: any) => {
          const indexA = orderList.indexOf(a.name);
          const indexB = orderList.indexOf(b.name);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      };

      if (dbCats.length > 0) {
        console.log("Setting categories to database items.");
        const merged = getMergedCategories(dbCats, latestCustomPrices);
        const sortedCats = sortCategories(merged, categoriesOrder);
        setCategories(sortedCats);
        try {
          localStorage.setItem(`laundry_categories_${laundryId}`, JSON.stringify(sortedCats));
          localStorage.setItem('laundry_categories', JSON.stringify(sortedCats));
        } catch (e) {}
      } else {
        console.log("Database categories table is empty, using INITIAL_ITEMS as fallback.");
        const merged = getMergedCategories(INITIAL_ITEMS, latestCustomPrices);
        const sortedCats = sortCategories(merged, categoriesOrder);
        setCategories(sortedCats);
        try {
          localStorage.setItem(`laundry_categories_${laundryId}`, JSON.stringify(sortedCats));
          localStorage.setItem('laundry_categories', JSON.stringify(sortedCats));
        } catch (e) {}
      }
      setIsCategoriesLoaded(true);
    } catch (error: any) {
      console.warn("Fetch Data Notice/Error:", error);
      // If offline or network error, fallback to local storage gracefully without showing a blocking error
      const isOnline = isBrowserOnline();
      if (!isOnline || error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
        console.info("Offline mode active: Loading cached data from local storage.");
        try {
          const localOrders = localStorage.getItem(`laundry_orders_${laundryId}`) || localStorage.getItem('laundry_orders');
          if (localOrders) setOrders(JSON.parse(localOrders));
          const localInv = localStorage.getItem(`laundry_inventory_${laundryId}`) || localStorage.getItem('laundry_inventory');
          if (localInv) setInventory(JSON.parse(localInv));
          const localSubs = localStorage.getItem(`laundry_subscriptions_${laundryId}`) || localStorage.getItem('laundry_subscriptions');
          if (localSubs) setSubscriptions(JSON.parse(localSubs));
          const localPkgs = localStorage.getItem(`laundry_subscription_packages_${laundryId}`) || localStorage.getItem('laundry_subscription_packages');
          if (localPkgs) setSubscriptionPackages(JSON.parse(localPkgs));
          const localCats = localStorage.getItem(`laundry_categories_${laundryId}`) || localStorage.getItem('laundry_categories');
          if (localCats) {
            setCategories(JSON.parse(localCats));
          } else {
            setCategories(INITIAL_ITEMS);
          }
          setIsCategoriesLoaded(true);
        } catch (e) {}
        setDbError(null);
      } else {
        setDbError(error.message || "فشل الاتصال بقاعدة البيانات");
      }
    } finally {
      setLoading(false);
    }
  };

  const overallStats = useMemo(() => {
    const totalOrdersCount = orders.length;
    const paidOrders = orders.filter(o => o.is_paid);
    const pendingPaymentOrders = orders.filter(o => !o.is_paid);
    const paidOrdersCount = paidOrders.length;
    const pendingPaymentCount = pendingPaymentOrders.length;
    const totalRevenue = paidOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    const pendingAmount = pendingPaymentOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    const grossRevenue = orders.reduce((acc, o) => acc + (o.total || 0), 0);
    const taxTotal = paidOrders.reduce((acc, o) => acc + (o.tax || 0), 0);
    const deliveredCount = orders.filter(o => o.status === 'Delivered').length;
    const inProgressCount = orders.filter(o => o.status !== 'Delivered').length;
    const lowStockCount = inventory.filter(i => i.stock <= i.threshold).length;
    const collectionRate = totalOrdersCount > 0 ? Math.round((paidOrdersCount / totalOrdersCount) * 100) : 0;

    return {
      totalOrdersCount,
      paidOrdersCount,
      pendingPaymentCount,
      totalRevenue,
      pendingAmount,
      grossRevenue,
      taxTotal,
      deliveredCount,
      inProgressCount,
      lowStockCount,
      collectionRate,
      pendingOrdersCount: inProgressCount,
    };
  }, [orders, inventory]);

  const stats = overallStats;

  const todayStats = useMemo(() => {
    const now = new Date();
    const targetTodayY = now.getFullYear();
    const targetTodayM = now.getMonth();
    const targetTodayD = now.getDate();

    const yDate = new Date(now);
    yDate.setDate(now.getDate() - 1);
    const targetYestY = yDate.getFullYear();
    const targetYestM = yDate.getMonth();
    const targetYestD = yDate.getDate();

    const matchesDay = (od: Date, y: number, m: number, d: number) => {
      const local = od.getFullYear() === y && od.getMonth() === m && od.getDate() === d;
      const utc = od.getUTCFullYear() === y && od.getUTCMonth() === m && od.getUTCDate() === d;
      return local || utc;
    };

    const todayOrders = orders.filter(o => {
      if (!o.created_at) return false;
      const od = new Date(o.created_at);
      return !isNaN(od.getTime()) && matchesDay(od, targetTodayY, targetTodayM, targetTodayD);
    });

    const yesterdayOrders = orders.filter(o => {
      if (!o.created_at) return false;
      const od = new Date(o.created_at);
      return !isNaN(od.getTime()) && matchesDay(od, targetYestY, targetYestM, targetYestD);
    });

    const todayTotalRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const todayPaidRevenue = todayOrders.filter(o => o.is_paid).reduce((sum, o) => sum + (o.total || 0), 0);
    const todayPendingRevenue = todayOrders.filter(o => !o.is_paid).reduce((sum, o) => sum + (o.total || 0), 0);
    const todayOrdersCount = todayOrders.length;
    const todayPaidCount = todayOrders.filter(o => o.is_paid).length;
    const todayPendingCount = todayOrders.filter(o => !o.is_paid).length;

    const yesterdayTotalRevenue = yesterdayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    const avgOrderValue = todayOrdersCount > 0 
      ? (todayTotalRevenue / todayOrdersCount) 
      : 0;

    let growthPercent = 0;
    if (yesterdayTotalRevenue > 0) {
      growthPercent = Math.round(((todayTotalRevenue - yesterdayTotalRevenue) / yesterdayTotalRevenue) * 100);
    } else if (todayTotalRevenue > 0) {
      growthPercent = 100;
    }

    return {
      todayOrders,
      todayRevenue: todayTotalRevenue,
      todayTotalRevenue,
      todayPaidRevenue,
      todayPendingRevenue,
      todayOrdersCount,
      todayPaidCount,
      todayPendingCount,
      avgOrderValue,
      growthPercent,
    };
  }, [orders]);

  const chartDaysData = useMemo(() => {
    const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const countDays = dashboardChartPeriod === '30' ? 30 : (dashboardChartPeriod === '14' ? 14 : 7);
    const today = new Date();
    const list: { dayName: string; dateStr: string; amount: number; paidAmount: number; count: number }[] = [];

    for (let i = countDays - 1; i >= 0; i--) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      const targetY = targetDate.getFullYear();
      const targetM = targetDate.getMonth();
      const targetD = targetDate.getDate();

      const dayOrders = orders.filter(o => {
        if (!o.created_at) return false;
        const od = new Date(o.created_at);
        if (isNaN(od.getTime())) return false;

        const localMatch = od.getFullYear() === targetY && od.getMonth() === targetM && od.getDate() === targetD;
        const utcMatch = od.getUTCFullYear() === targetY && od.getUTCMonth() === targetM && od.getUTCDate() === targetD;
        return localMatch || utcMatch;
      });

      const dayTotal = dayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const dayPaidTotal = dayOrders.filter(o => o.is_paid).reduce((sum, o) => sum + (o.total || 0), 0);

      list.push({
        dayName: arabicDays[targetDate.getDay()],
        dateStr: targetDate.toLocaleDateString('ar-SA-u-nu-latn', { month: 'numeric', day: 'numeric' }),
        amount: dayTotal,
        paidAmount: dayPaidTotal,
        count: dayOrders.length,
      });
    }

    return list;
  }, [orders, dashboardChartPeriod]);

  const uniqueCustomersList = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; totalOrders: number; totalSpent: number; lastOrder: string }>();
    orders.forEach(o => {
      const phone = normalizePhone(o.customer_phone);
      if (!phone) return;
      const existing = map.get(phone);
      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpent += (o.total || 0);
      } else {
        map.set(phone, {
          name: o.customer_name || 'عميل',
          phone: o.customer_phone,
          totalOrders: 1,
          totalSpent: o.total || 0,
          lastOrder: o.created_at,
        });
      }
    });
    return Array.from(map.values());
  }, [orders]);

  const getCustomerStats = (phone: string) => {
    const norm = normalizePhone(phone);
    if (!norm) return { totalItems: 0, freeItems: 0, paidItems: 0 };
    const customerOrders = orders.filter(o => normalizePhone(o.customer_phone) === norm);
    const totalItems = customerOrders.reduce((acc, o) => acc + o.items.reduce((sum, item) => sum + item.quantity, 0), 0);
    const freeItems = customerOrders.filter(o => o.payment_method === 'Free').reduce((acc, o) => acc + o.items.reduce((sum, item) => sum + item.quantity, 0), 0);
    const paidItems = totalItems - freeItems;
    return { totalItems, freeItems, paidItems };
  };

  const getCustomerSubscription = (phone: string) => {
    const norm = normalizePhone(phone);
    if (!norm) return undefined;
    return subscriptions.find(s => {
      if (normalizePhone(s.customer_phone) !== norm || !s.is_active || !s.expiry_date) return false;
      const d = new Date(s.expiry_date);
      return !isNaN(d.getTime()) && d > new Date();
    });
  };

  const handleCreatePackage = async () => {
    const nameTrimmed = packageForm.name ? packageForm.name.trim() : '';
    const parsedTotalItems = parseInt(packageForm.total_items as any) || 0;
    const parsedPrice = packageForm.price === '' || packageForm.price === null || packageForm.price === undefined
      ? 0
      : parseFloat(packageForm.price as any);
    const isUnlimited = !!packageForm.isUnlimitedDays || packageForm.duration_days === 0 || packageForm.duration_days === '0';
    const parsedDuration = isUnlimited
      ? 0
      : (parseInt(packageForm.duration_days as any) || 30);
    const parsedDiscount = packageForm.discount_percent === '' ? 0 : (parseFloat(packageForm.discount_percent as any) || 0);

    if (!nameTrimmed) return alert('يرجى إدخال اسم الباقة');
    if (parsedTotalItems <= 0) return alert('يرجى إدخال عدد قطع صحيح (أكبر من 0)');
    if (isNaN(parsedPrice) || parsedPrice < 0) return alert('يرجى إدخال سعر صحيح (0 أو أكثر)');

    const finalPkg: SubscriptionPackage = {
      id: editingPackageId || generateUUID(),
      name: nameTrimmed,
      total_items: parsedTotalItems,
      price: parsedPrice,
      duration_days: isUnlimited ? 0 : Math.max(0, parsedDuration),
      discount_percent: Math.min(100, Math.max(0, parsedDiscount))
    };

    const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');

    if (editingPackageId) {
      // Editing existing package
      const dbPkg: any = {
        id: editingPackageId,
        name: isDbMultiTenant ? `${finalPkg.name} __dp:${finalPkg.discount_percent}` : `${laundryId}|${finalPkg.name} __dp:${finalPkg.discount_percent}`,
        total_items: finalPkg.total_items,
        price: finalPkg.price,
        duration_days: finalPkg.duration_days
      };
      if (isDbMultiTenant) {
        dbPkg.laundry_id = laundryId;
      }

      const nextPkgs = subscriptionPackages.map(p => p.id === editingPackageId ? finalPkg : p);
      setSubscriptionPackages(nextPkgs);
      try {
        if (laundryId) localStorage.setItem(`laundry_subscription_packages_${laundryId}`, JSON.stringify(nextPkgs));
        localStorage.setItem('laundry_subscription_packages', JSON.stringify(nextPkgs));
      } catch (e) {}

      setPackageForm({ name: '', total_items: '', price: '', duration_days: 30, discount_percent: '', isUnlimitedDays: false });
      setEditingPackageId(null);
      setShowPackageModal(false);

      if (isBrowserOnline()) {
        try {
          const { error } = await supabase.from('subscription_packages').update(dbPkg).eq('id', editingPackageId);
          if (error) throw error;
          alert('تم تعديل الباقة بنجاح ✅');
        } catch (e: any) {
          addOfflineAction({ type: 'UPDATE_PACKAGE', payload: dbPkg, laundryId });
          alert('تم حفظ تعديل الباقة محلياً وسيتم المزامنة تلقائياً عند الاتصال ✅');
        }
      } else {
        addOfflineAction({ type: 'UPDATE_PACKAGE', payload: dbPkg, laundryId });
        alert('تم تعديل الباقة بنجاح في وضع الأوفلاين ✅');
      }
    } else {
      // Creating a new package
      const dbPkg: any = {
        id: finalPkg.id,
        name: isDbMultiTenant ? `${finalPkg.name} __dp:${finalPkg.discount_percent}` : `${laundryId}|${finalPkg.name} __dp:${finalPkg.discount_percent}`,
        total_items: finalPkg.total_items,
        price: finalPkg.price,
        duration_days: finalPkg.duration_days
      };
      if (isDbMultiTenant) {
        dbPkg.laundry_id = laundryId;
      }

      const nextPkgs = [...subscriptionPackages, finalPkg];
      setSubscriptionPackages(nextPkgs);
      try {
        if (laundryId) localStorage.setItem(`laundry_subscription_packages_${laundryId}`, JSON.stringify(nextPkgs));
        localStorage.setItem('laundry_subscription_packages', JSON.stringify(nextPkgs));
      } catch (e) {}

      setPackageForm({ name: '', total_items: '', price: '', duration_days: 30, discount_percent: '', isUnlimitedDays: false });
      setShowPackageModal(false);

      if (isBrowserOnline()) {
        try {
          const { error } = await supabase.from('subscription_packages').insert([dbPkg]);
          if (error) throw error;
          alert('تم إنشاء الباقة بنجاح ✅');
        } catch (e: any) {
          addOfflineAction({ type: 'CREATE_PACKAGE', payload: dbPkg, laundryId });
          alert('تم حفظ الباقة محلياً وسيتم المزامنة تلقائياً عند الاتصال ✅');
        }
      } else {
        addOfflineAction({ type: 'CREATE_PACKAGE', payload: dbPkg, laundryId });
        alert('تم إنشاء الباقة بنجاح في وضع الأوفلاين ✅');
      }
    }
  };

  const handleStartEditPackage = (pkg: SubscriptionPackage) => {
    setEditingPackageId(pkg.id);
    const isUnlimited = pkg.duration_days === 0 || pkg.duration_days >= 36500;
    setPackageForm({
      name: pkg.name,
      total_items: pkg.total_items ?? '',
      price: pkg.price === 0 ? 0 : (pkg.price ?? ''),
      duration_days: isUnlimited ? 0 : (pkg.duration_days ?? 30),
      discount_percent: pkg.discount_percent === 0 ? '' : (pkg.discount_percent ?? ''),
      isUnlimitedDays: isUnlimited
    });
    setShowPackageModal(true);
  };

  const handleDeletePackage = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الباقة؟ سيتم أيضاً حذف جميع الاشتراكات المرتبطة بها.')) return;
    const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');

    const nextPkgs = subscriptionPackages.filter(p => p.id !== id);
    const nextSubs = subscriptions.filter(sub => sub.package_id !== id);
    setSubscriptionPackages(nextPkgs);
    setSubscriptions(nextSubs);

    try {
      if (laundryId) {
        localStorage.setItem(`laundry_subscription_packages_${laundryId}`, JSON.stringify(nextPkgs));
        localStorage.setItem(`laundry_subscriptions_${laundryId}`, JSON.stringify(nextSubs));
      }
      localStorage.setItem('laundry_subscription_packages', JSON.stringify(nextPkgs));
      localStorage.setItem('laundry_subscriptions', JSON.stringify(nextSubs));
    } catch (e) {}

    if (isBrowserOnline()) {
      try {
        // Delete associated subscriptions first to prevent foreign key constraint violation
        const { error: subErr } = await supabase.from('subscriptions').delete().eq('package_id', id);
        if (subErr) throw subErr;

        const { error } = await supabase.from('subscription_packages').delete().eq('id', id);
        if (error) throw error;

        alert('تم حذف الباقة والاشتراكات المرتبطة بها بنجاح ✅');
      } catch (e: any) {
        addOfflineAction({ type: 'DELETE_PACKAGE', payload: { id }, laundryId });
        alert('تم حذف الباقة محلياً وسيتم المزامنة عند الاتصال ✅');
      }
    } else {
      addOfflineAction({ type: 'DELETE_PACKAGE', payload: { id }, laundryId });
      alert('تم حذف الباقة محلياً في وضع الأوفلاين ✅');
    }
  };

  const downloadGeneralExcel = () => {
    const headers = [
      'رقم الطلب',
      'اسم العميل',
      'رقم الجوال',
      'نوع الطلب',
      'المجموع الفرعي',
      'الضريبة (15%)',
      'خصم/تعديل',
      'الإجمالي',
      'حالة الدفع',
      'طريقة الدفع',
      'حالة الطلب',
      'تاريخ الإنشاء'
    ];
    
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const translatePaymentMethod = (method: PaymentMethod) => {
      switch (method) {
        case 'Cash': return 'نقدي';
        case 'Card': return 'شبكة / مدى';
        case 'Transfer': return 'تحويل بنكي';
        case 'Subscription': return 'اشتراك';
        case 'Free': return 'طلب مجاني';
        default: return method;
      }
    };

    const translateOrderStatus = (status: OrderStatus) => {
      switch (status) {
        case 'Received': return 'تم الاستلام';
        case 'Washing': return 'جاري الغسيل';
        case 'Ironing': return 'جاري الكوي';
        case 'Ready': return 'جاهز للتسليم';
        case 'Delivered': return 'تم التسليم';
        default: return status;
      }
    };
    
    const rows = filteredFinanceOrders.map(o => [
      escapeCSV(o.order_number),
      escapeCSV(o.customer_name),
      escapeCSV(o.customer_phone),
      o.order_type === 'Urgent' ? 'مستعجل' : 'عادي',
      o.subtotal.toFixed(2),
      o.tax.toFixed(2),
      o.custom_adjustment.toFixed(2),
      o.total.toFixed(2),
      o.is_paid ? 'مدفوع' : 'غير مدفوع',
      translatePaymentMethod(o.payment_method),
      translateOrderStatus(o.status),
      new Date(o.created_at).toLocaleDateString('ar-SA')
    ]);
    
    const csvContent = "\uFEFF" + [
      [`التقرير المالي العام - مغسلة عود ونظافة`],
      [`الفترة من: ${financeFromDate || 'البداية'} إلى: ${financeToDate || 'اليوم'}`],
      [],
      [`ملخص الفترة:`],
      [`إجمالي المبيعات المحصلة, ${financeStats.totalRevenue.toFixed(2)} ر.س`],
      [`الضريبة المحصلة, ${financeStats.taxTotal.toFixed(2)} ر.س`],
      [`المبالغ المعلقة غير المحصلة, ${financeStats.pendingAmount.toFixed(2)} ر.س`],
      [`إجمالي عدد الطلبات, ${financeStats.totalOrdersCount}`],
      [],
      headers,
      ...rows
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `التقرير_المالي_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadGeneralPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('يرجى السماح بالنوافذ المنبثقة لتنزيل التقرير ⚠️');
    
    const fromStr = financeFromDate ? new Date(financeFromDate).toLocaleDateString('ar-SA') : 'البداية';
    const toStr = financeToDate ? new Date(financeToDate).toLocaleDateString('ar-SA') : 'اليوم';
    
    const translatePaymentMethod = (method: PaymentMethod) => {
      switch (method) {
        case 'Cash': return 'نقدي';
        case 'Card': return 'شبكة / مدى';
        case 'Transfer': return 'تحويل بنكي';
        case 'Subscription': return 'اشتراك';
        case 'Free': return 'طلب مجاني';
        default: return method;
      }
    };

    const htmlContent = `
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>تقرير الحسابات المالي</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 40px;
            color: #333;
            background-color: #fff;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 20px;
          }
          .header h1 {
            font-size: 28px;
            color: #1e1b4b;
            margin: 0;
          }
          .header p {
            font-size: 14px;
            color: #64748b;
            margin: 5px 0 0 0;
            font-weight: bold;
          }
          .info-grid {
            display: grid;
            grid-template-cols: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 40px;
          }
          .info-card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            background-color: #f8fafc;
          }
          .info-card .title {
            font-size: 11px;
            color: #64748b;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .info-card .value {
            font-size: 24px;
            font-weight: 900;
          }
          .value.emerald { color: #059669; }
          .value.indigo { color: #4f46e5; }
          .value.red { color: #dc2626; }
          .payment-breakdown {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 40px;
            background-color: #fff;
          }
          .payment-breakdown h3 {
            margin: 0 0 15px 0;
            font-size: 16px;
            color: #1e1b4b;
          }
          .payment-grid {
            display: grid;
            grid-template-cols: repeat(3, 1fr);
            gap: 15px;
          }
          .payment-item {
            background-color: #f8fafc;
            padding: 12px;
            border-radius: 8px;
            text-align: center;
            font-size: 14px;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 12px;
          }
          th, td {
            border-bottom: 1px solid #e2e8f0;
            padding: 12px 10px;
            text-align: right;
          }
          th {
            background-color: #f1f5f9;
            color: #475569;
            font-weight: bold;
          }
          tr:hover {
            background-color: #f8fafc;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>مغسلة عود ونظافة</h1>
          <p>التقرير المالي العام للفترة من ${fromStr} إلى ${toStr}</p>
        </div>
        
        <div class="info-grid">
          <div class="info-card">
            <div class="title">المبيعات المحصلة</div>
            <div class="value emerald">${financeStats.totalRevenue.toFixed(2)} ر.س</div>
          </div>
          <div class="info-card">
            <div class="title">الضريبة المحصلة (15%)</div>
            <div class="value indigo">${financeStats.taxTotal.toFixed(2)} ر.س</div>
          </div>
          <div class="info-card">
            <div class="title">المبالغ المعلقة غير المحصلة</div>
            <div class="value red">${financeStats.pendingAmount.toFixed(2)} ر.س</div>
          </div>
        </div>

        <div class="payment-breakdown">
          <h3>طرق الدفع والتحصيل للفترة</h3>
          <div class="payment-grid">
            <div class="payment-item">نقدي: ${financeStats.cashRevenue.toFixed(2)} ر.س</div>
            <div class="payment-item">شبكة / مدى: ${financeStats.cardRevenue.toFixed(2)} ر.س</div>
            <div class="payment-item">تحويل بنكي: ${financeStats.transferRevenue.toFixed(2)} ر.س</div>
          </div>
        </div>

        <h3>قائمة تفاصيل مبيعات الطلبات (${filteredFinanceOrders.length} طلب)</h3>
        <table>
          <thead>
            <tr>
              <th>رقم الطلب</th>
              <th>العميل</th>
              <th>الجوال</th>
              <th>نوع الطلب</th>
              <th>المجموع</th>
              <th>الضريبة</th>
              <th>الإجمالي</th>
              <th>حالة الدفع</th>
              <th>طريقة الدفع</th>
              <th>تاريخ الطلب</th>
            </tr>
          </thead>
          <tbody>
            ${filteredFinanceOrders.map(o => `
              <tr>
                <td><strong>${o.order_number}</strong></td>
                <td>${o.customer_name}</td>
                <td style="font-family: monospace;">${o.customer_phone}</td>
                <td>${o.order_type === 'Urgent' ? 'مستعجل' : 'عادي'}</td>
                <td>${o.subtotal.toFixed(2)} ر.س</td>
                <td>${o.tax.toFixed(2)} ر.س</td>
                <td><strong>${o.total.toFixed(2)} ر.س</strong></td>
                <td><span style="color: ${o.is_paid ? '#059669' : '#dc2626'}; font-weight: bold;">${o.is_paid ? 'مدفوع' : 'غير مدفوع'}</span></td>
                <td>${translatePaymentMethod(o.payment_method)}</td>
                <td>${new Date(o.created_at).toLocaleDateString('ar-SA')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          تم توليد هذا التقرير تلقائياً بتاريخ ${new Date().toLocaleString('ar-SA-u-nu-latn')} - مغسلة عود ونظافة
        </div>
        
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const downloadCustomerExcel = (customerPhone: string, customerName: string) => {
    const customerOrders = orders.filter(o => o.customer_phone === customerPhone);
    
    const headers = [
      'رقم الطلب',
      'نوع الطلب',
      'الأصناف والتفاصيل',
      'المجموع الفرعي',
      'الضريبة (15%)',
      'خصم/تعديل',
      'الإجمالي',
      'حالة الدفع',
      'طريقة الدفع',
      'حالة الطلب',
      'تاريخ الطلب'
    ];
    
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const translatePaymentMethod = (method: PaymentMethod) => {
      switch (method) {
        case 'Cash': return 'نقدي';
        case 'Card': return 'شبكة / مدى';
        case 'Transfer': return 'تحويل بنكي';
        case 'Subscription': return 'اشتراك';
        case 'Free': return 'طلب مجاني';
        default: return method;
      }
    };

    const translateOrderStatus = (status: OrderStatus) => {
      switch (status) {
        case 'Received': return 'تم الاستلام';
        case 'Washing': return 'جاري الغسيل';
        case 'Ironing': return 'جاري الكوي';
        case 'Ready': return 'جاهز للتسليم';
        case 'Delivered': return 'تم التسليم';
        default: return status;
      }
    };
    
    const getItemsSummaryString = (items: LaundryItem[]) => {
      if (!items || items.length === 0) return '-';
      return items.map(item => `${item.name} (${item.quantity})`).join(' - ');
    };
    
    const rows = customerOrders.map(o => [
      o.order_number,
      o.order_type === 'Urgent' ? 'مستعجل' : 'عادي',
      getItemsSummaryString(o.items),
      o.subtotal.toFixed(2),
      o.tax.toFixed(2),
      o.custom_adjustment.toFixed(2),
      o.total.toFixed(2),
      o.is_paid ? 'مدفوع' : 'غير مدفوع',
      translatePaymentMethod(o.payment_method),
      translateOrderStatus(o.status),
      new Date(o.created_at).toLocaleDateString('ar-SA')
    ]);
    
    const totalPaid = customerOrders.filter(o => o.is_paid).reduce((acc, o) => acc + o.total, 0);
    const totalPending = customerOrders.filter(o => !o.is_paid).reduce((acc, o) => acc + o.total, 0);
    
    const csvContent = "\uFEFF" + [
      [`كشف حساب العميل: ${customerName}`],
      [`رقم الجوال: ${customerPhone}`],
      [`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-SA')}`],
      [],
      [`ملخص المبيعات للعميل:`],
      [`إجمالي المدفوع المحصل, ${totalPaid.toFixed(2)} ر.س`],
      [`إجمالي المعلق غير المحصل, ${totalPending.toFixed(2)} ر.س`],
      [`إجمالي عدد الطلبات, ${customerOrders.length}`],
      [],
      headers,
      ...rows
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `كشف_حساب_${customerName}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCustomerPDF = (customerPhone: string, customerName: string) => {
    const customerOrders = orders.filter(o => o.customer_phone === customerPhone);
    const totalPaid = customerOrders.filter(o => o.is_paid).reduce((acc, o) => acc + o.total, 0);
    const totalPending = customerOrders.filter(o => !o.is_paid).reduce((acc, o) => acc + o.total, 0);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('يرجى السماح بالنوافذ المنبثقة لتنزيل التقرير ⚠️');
    
    const translatePaymentMethod = (method: PaymentMethod) => {
      switch (method) {
        case 'Cash': return 'نقدي';
        case 'Card': return 'شبكة / مدى';
        case 'Transfer': return 'تحويل بنكي';
        case 'Subscription': return 'اشتراك';
        case 'Free': return 'طلب مجاني';
        default: return method;
      }
    };

    const htmlContent = `
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كشف حساب العميل - ${customerName}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 40px;
            color: #333;
            background-color: #fff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            font-size: 24px;
            color: #1e1b4b;
            margin: 0;
          }
          .header p {
            font-size: 14px;
            color: #64748b;
            margin: 5px 0 0 0;
          }
          .client-info {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 15px 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
          }
          .client-info h3 {
            margin: 0 0 5px 0;
            color: #1e1b4b;
          }
          .client-info p {
            margin: 0;
            font-size: 13px;
            color: #475569;
          }
          .stats-grid {
            display: grid;
            grid-template-cols: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 35px;
          }
          .stat-card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 15px;
            text-align: center;
            background-color: #f8fafc;
          }
          .stat-card .title {
            font-size: 11px;
            color: #64748b;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .stat-card .val {
            font-size: 20px;
            font-weight: 900;
          }
          .val.green { color: #059669; }
          .val.red { color: #dc2626; }
          .val.indigo { color: #4f46e5; }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          th, td {
            border-bottom: 1px solid #e2e8f0;
            padding: 10px;
            text-align: right;
          }
          th {
            background-color: #f1f5f9;
            color: #475569;
            font-weight: bold;
          }
          .items-list {
            font-size: 10px;
            color: #64748b;
            line-height: 1.4;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>مغسلة عود ونظافة</h1>
            <p>كشف حساب العمليات والطلبات التفصيلي</p>
          </div>
          <div style="text-align: left;">
            <p style="font-weight: bold;">تاريخ الطباعة</p>
            <p>${new Date().toLocaleDateString('ar-SA')}</p>
          </div>
        </div>

        <div class="client-info">
          <div>
            <h3>العميل: ${customerName}</h3>
            <p>رقم الجوال: <span style="font-family: monospace;">${customerPhone}</span></p>
          </div>
          <div style="text-align: left;">
            <p>حالة العميل: نشط</p>
            <p>إجمالي المعاملات: ${customerOrders.length} طلب</p>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="title">إجمالي المبالغ المدفوعة</div>
            <div class="val green">${totalPaid.toFixed(2)} ر.س</div>
          </div>
          <div class="stat-card">
            <div class="title">إجمالي المبالغ المعلقة</div>
            <div class="val red">${totalPending.toFixed(2)} ر.س</div>
          </div>
          <div class="stat-card">
            <div class="title">عدد الطلبات</div>
            <div class="val indigo">${customerOrders.length}</div>
          </div>
        </div>

        <h3>تفاصيل الطلبات المسجلة للعميل</h3>
        <table>
          <thead>
            <tr>
              <th>رقم الطلب</th>
              <th>نوع الطلب</th>
              <th>الأصناف والتفاصيل</th>
              <th>المجموع</th>
              <th>الضريبة</th>
              <th>خصم/تعديل</th>
              <th>الإجمالي</th>
              <th>حالة الدفع</th>
              <th>طريقة الدفع</th>
              <th>التاريخ والوقت</th>
            </tr>
          </thead>
          <tbody>
            ${customerOrders.map(o => `
              <tr>
                <td><strong>${o.order_number}</strong></td>
                <td>${o.order_type === 'Urgent' ? 'مستعجل' : 'عادي'}</td>
                <td class="items-list">${o.items.map(item => `${item.name} (${item.quantity})`).join('، ')}</td>
                <td>${o.subtotal.toFixed(2)} ر.س</td>
                <td>${o.tax.toFixed(2)} ر.س</td>
                <td>${o.custom_adjustment.toFixed(2)} ر.س</td>
                <td><strong>${o.total.toFixed(2)} ر.س</strong></td>
                <td><span style="color: ${o.is_paid ? '#059669' : '#dc2626'}; font-weight: bold;">${o.is_paid ? 'مدفوع' : 'غير مدفوع'}</span></td>
                <td>${translatePaymentMethod(o.payment_method)}</td>
                <td>${new Date(o.created_at).toLocaleDateString('ar-SA')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          كشف الحساب هذا تم توليده إلكترونياً لعميل مغسلة عود ونظافة
        </div>
        
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleAssignSubscription = async (pkgId: string) => {
    if (!showAssignSubModal) return;
    const pkg = subscriptionPackages.find(p => p.id === pkgId);
    if (!pkg) return;

    const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
    const expiryIso = safeAddDaysISO(pkg.duration_days);

    const subId = generateUUID();
    const newSub: any = {
      id: subId,
      customer_name: isDbMultiTenant ? showAssignSubModal.name : `${laundryId}|${showAssignSubModal.name}`,
      customer_phone: isDbMultiTenant ? showAssignSubModal.phone : `${laundryId}|${showAssignSubModal.phone}`,
      package_id: pkg.id,
      items_remaining: pkg.total_items,
      total_items: pkg.total_items,
      expiry_date: expiryIso,
      is_active: true
    };
    if (laundryId) {
      newSub.laundry_id = laundryId;
    }

    const localSub = {
      ...newSub,
      customer_name: cleanTenantString(newSub.customer_name),
      customer_phone: cleanTenantString(newSub.customer_phone)
    };
    const nextSubs = [localSub, ...subscriptions];
    setSubscriptions(nextSubs);
    try {
      if (laundryId) localStorage.setItem(`laundry_subscriptions_${laundryId}`, JSON.stringify(nextSubs));
      localStorage.setItem('laundry_subscriptions', JSON.stringify(nextSubs));
    } catch (e) {}

    if (showEditOrderModal) {
      setEditedSubscription(localSub);
      setShowEditOrderModal(prev => prev ? ({
        ...prev,
        payment_method: 'Subscription',
        is_paid: true
      }) : null);
    }
    setShowAssignSubModal(null);

    if (isBrowserOnline()) {
      try {
        const { error } = await supabase.from('subscriptions').insert([newSub]);
        if (error) throw error;
        alert(`تم تفعيل اشتراك ${pkg.name} للعميل بنجاح ✅`);
      } catch (e: any) {
        addOfflineAction({ type: 'CREATE_SUBSCRIPTION', payload: newSub, laundryId });
        alert(`تم تفعيل اشتراك ${pkg.name} للعميل محلياً وسيتم المزامنة تلقائياً عند الاتصال ✅`);
      }
    } else {
      addOfflineAction({ type: 'CREATE_SUBSCRIPTION', payload: newSub, laundryId });
      alert(`تم تفعيل اشتراك ${pkg.name} للعميل محلياً في وضع الأوفلاين ✅`);
    }
  };

  const updateSubscriptionBalance = async (subId: string, newBalance: number) => {
    const safeBalance = Math.max(0, newBalance);
    setSubscriptions(prev => {
      const updated = prev.map(s => 
        s.id === subId ? { ...s, items_remaining: safeBalance } : s
      );
      try {
        const laundryId = userProfile?.laundry_id;
        if (laundryId) localStorage.setItem(`laundry_subscriptions_${laundryId}`, JSON.stringify(updated));
        localStorage.setItem('laundry_subscriptions', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    if (isBrowserOnline()) {
      try {
        const { error } = await supabase.from('subscriptions').update({ items_remaining: safeBalance }).eq('id', subId);
        if (error) throw error;
      } catch (e: any) {
        console.warn("Failed to update balance in DB, queuing offline action:", e);
        addOfflineAction({ type: 'UPDATE_SUBSCRIPTION_BALANCE', payload: { subId, items_remaining: safeBalance } });
      }
    } else {
      addOfflineAction({ type: 'UPDATE_SUBSCRIPTION_BALANCE', payload: { subId, items_remaining: safeBalance } });
    }
  };

  const deleteCategory = async (target: { id?: string; name: string } | string) => {
    const targetId = typeof target === 'string' ? target : target?.id;
    const targetName = typeof target === 'string' ? target : target?.name;

    if (isDeletingCategoryRef.current) return;
    isDeletingCategoryRef.current = true;
    setIsDeletingCategory(true);

    console.log("Deleting category:", { targetId, targetName });

    try {
      if (targetId) {
        console.log(`Executing Supabase delete for id: ${targetId} ...`);
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', targetId);
        
        if (error) {
          console.error("Supabase delete error details:", error);
        }
      }

      if (targetName) {
        try {
          const updatedPrices = { ...customPrices };
          delete updatedPrices[targetName];
          setCustomPrices(updatedPrices);
          localStorage.setItem('laundry_categories_custom_prices', JSON.stringify(updatedPrices));
          await syncCustomPricesToDb(updatedPrices);
        } catch (e) {
          console.error("Failed to delete custom prices from settings:", e);
        }

        try {
          const storedIconsStr = localStorage.getItem('laundry_categories_custom_icons') || '{}';
          const storedIcons = JSON.parse(storedIconsStr);
          delete storedIcons[targetName];
          localStorage.setItem('laundry_categories_custom_icons', JSON.stringify(storedIcons));
        } catch (e) {
          console.error("Failed to delete custom icon:", e);
        }

        try {
          const updatedCons = { ...inventoryConsumption };
          delete updatedCons[targetName];
          setInventoryConsumption(updatedCons);
          localStorage.setItem('laundry_inventory_consumption', JSON.stringify(updatedCons));
          await syncInventoryConsumptionToDb(updatedCons);
        } catch (e) {
          console.error("Failed to delete custom inventory consumption:", e);
        }
      }

      setCategories(prev => {
        return prev.filter(c => {
          if (targetId && (c as any).id === targetId) return false;
          if (targetName && c.name === targetName) return false;
          return true;
        });
      });

      alert('تم حذف الصنف بنجاح ✅');
    } catch (e: any) {
      console.error("Delete category exception caught:", e);
      alert(`فشل الحذف: ${e.message || 'خطأ غير معروف'}`);
    } finally {
      isDeletingCategoryRef.current = false;
      setIsDeletingCategory(false);
    }
  };

  const [useSubscription, setUseSubscription] = useState<boolean>(true);
  const [selectedOrderPackageId, setSelectedOrderPackageId] = useState<string>('');

  const [newOrder, setNewOrder] = useState<{
    customer_name: string;
    customer_phone: string;
    order_type: OrderType;
    items: LaundryItem[];
    is_paid: boolean;
    payment_method: PaymentMethod;
    custom_adjustment: number;
    is_free: boolean;
    is_tax_enabled: boolean;
    discount_percent: number;
  }>({
    customer_name: '',
    customer_phone: '',
    order_type: 'Normal',
    items: [],
    is_paid: false,
    payment_method: 'Cash',
    custom_adjustment: 0,
    is_free: false,
    is_tax_enabled: true,
    discount_percent: 0
  });

  // Auto-select subscription and apply automatic package discount if available
  useEffect(() => {
    if (newOrder.customer_phone.length >= 9) {
      const sub = getCustomerSubscription(newOrder.customer_phone);
      const activePkgId = sub ? sub.package_id : selectedOrderPackageId;
      const pkg = activePkgId ? subscriptionPackages.find(p => p.id === activePkgId) : null;
      const hasSubOrNewPkg = !!sub || !!selectedOrderPackageId;
      const autoDiscount = (hasSubOrNewPkg && useSubscription && pkg && pkg.discount_percent) ? pkg.discount_percent : 0;

      setNewOrder(prev => {
        let updated = false;
        const updates: any = {};
        
        if (hasSubOrNewPkg && useSubscription) {
          if (!prev.is_free && prev.payment_method !== 'Subscription') {
            updates.is_paid = true;
            updates.payment_method = 'Subscription';
            updated = true;
          }
        } else {
          // If customer has a subscription but use_subscription is toggled OFF, reset payment method from 'Subscription' to 'Cash'
          if (prev.payment_method === 'Subscription') {
            updates.is_paid = false;
            updates.payment_method = 'Cash';
            updated = true;
          }
        }
        
        if (prev.discount_percent !== autoDiscount) {
          updates.discount_percent = autoDiscount;
          updated = true;
        }

        if (updated) {
          return { ...prev, ...updates };
        }
        return prev;
      });
    } else {
      // Clear auto-applied discount if phone number is cleared
      setNewOrder(prev => {
        if (prev.discount_percent > 0 || prev.payment_method === 'Subscription') {
          return { ...prev, discount_percent: 0, payment_method: 'Cash', is_paid: false };
        }
        return prev;
      });
    }
  }, [newOrder.customer_phone, useSubscription, selectedOrderPackageId, subscriptions, subscriptionPackages]);

  const currentSubtotal = useMemo(() => {
    if (newOrder.is_free) return 0;
    const itemsTotal = newOrder.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const sub = itemsTotal + (newOrder.custom_adjustment || 0);
    const discount = sub * ((newOrder.discount_percent || 0) / 100);
    return Math.max(0, sub - discount);
  }, [newOrder.items, newOrder.custom_adjustment, newOrder.is_free, newOrder.discount_percent]);

  const currentTax = useMemo(() => newOrder.is_tax_enabled ? currentSubtotal * TAX_RATE : 0, [currentSubtotal, newOrder.is_tax_enabled]);
  const currentTotal = useMemo(() => currentSubtotal + currentTax, [currentSubtotal, currentTax]);

  const togglePredefinedItem = (item: { name: string, price: number, icon?: string }) => {
    if (isEditingPrices) return;

    // Prevent duplicate item additions from rapid double-clicks within 300ms
    const now = Date.now();
    if (lastItemAddClickTimeRef.current.name === item.name && now - lastItemAddClickTimeRef.current.time < 300) {
      return;
    }
    lastItemAddClickTimeRef.current = { name: item.name, time: now };

    const id = Math.random().toString(36).substr(2, 9);
    const prices = getItemPrices(item);
    const normal = prices.price_normal;
    const urgent = prices.price_urgent;
    const ironing = prices.price_ironing;
    const noIron = prices.price_no_ironing;
    const itemIcon = (item as any).icon || (categories.find(c => c.name === item.name)?.icon) || '🧺';
    setNewOrder(prev => ({
      ...prev,
      items: [...prev.items, { 
        id, 
        name: item.name, 
        quantity: 1, 
        price: item.price, 
        icon: itemIcon,
        service_type: undefined, 
        is_ironing_only: false,
        ironing_type: undefined,
        is_urgent: false,
        is_no_ironing: false,
        price_normal: normal,
        price_urgent: urgent,
        price_ironing: ironing,
        price_no_ironing: noIron,
        base_price: item.price,
        is_normal: false
      }]
    }));
  };

  const handleAddCustomItem = async () => {
    if (isAddingCustomItemRef.current) return;

    if (!customItemForm.name || customItemForm.price < 0 || customItemForm.price_normal < 0 || customItemForm.price_urgent < 0 || customItemForm.price_ironing < 0 || customItemForm.price_no_ironing < 0) {
      return alert('يرجى إدخال اسم صحيح وأسعار لا تقل عن الصفر');
    }

    isAddingCustomItemRef.current = true;
    setIsAddingCustomItem(true);
    
    const rawLaundryId = userProfile?.laundry_id || 'laund-unknown';
    const laundryId = ensureUUID(rawLaundryId);
    const chosenIcon = customItemForm.icon && customItemForm.icon.trim() ? customItemForm.icon.trim() : '✨';

    try {
      const catName = isDbMultiTenant ? customItemForm.name : `${rawLaundryId}|${customItemForm.name}`;
      const newCat: any = {
        name: catName,
        price: customItemForm.price,
        icon: chosenIcon
      };
      if (laundryId) {
        newCat.laundry_id = laundryId;
      }
      
      let result;
      try {
        const fullCat: any = {
          ...newCat,
          price_normal: customItemForm.price_normal,
          price_urgent: customItemForm.price_urgent,
          price_ironing: customItemForm.price_ironing,
          price_no_ironing: customItemForm.price_no_ironing
        };
        if (laundryId) {
          fullCat.laundry_id = laundryId;
        }
        const { data, error } = await supabase.from('categories').insert([fullCat]).select();
        if (error) {
          console.warn("Categories custom columns missing, falling back to basic insert.");
          const { data: fallbackData, error: fallbackError } = await supabase.from('categories').insert([newCat]).select();
          if (fallbackError) throw fallbackError;
          result = fallbackData;
        } else {
          result = data;
        }
      } catch (insertErr) {
        console.warn("Failed inserting custom columns, using standard insert fallback:", insertErr);
        const { data: fallbackData, error: fallbackError } = await supabase.from('categories').insert([newCat]).select();
        if (fallbackError) throw fallbackError;
        result = fallbackData;
      }
      
      const returnedRow = result && result.length > 0 ? result[0] : { id: Math.random().toString(36).substr(2, 9) };
      const savedCat = {
        ...returnedRow,
        id: returnedRow.id,
        name: customItemForm.name,
        price: customItemForm.price,
        icon: chosenIcon,
        price_normal: customItemForm.price_normal,
        price_urgent: customItemForm.price_urgent,
        price_ironing: customItemForm.price_ironing,
        price_no_ironing: customItemForm.price_no_ironing
      };

      // Save to state, localStorage, and clean-sync with Supabase settings
      try {
        const storedPrices = { ...customPrices };
        storedPrices[savedCat.name] = {
          price_normal: savedCat.price_normal,
          price_urgent: savedCat.price_urgent,
          price_ironing: savedCat.price_ironing,
          price_no_ironing: savedCat.price_no_ironing
        };
        setCustomPrices(storedPrices);
        localStorage.setItem('laundry_categories_custom_prices', JSON.stringify(storedPrices));
        await syncCustomPricesToDb(storedPrices);
      } catch (e) {
        console.error("Failed to save custom prices map:", e);
      }

      // Save custom item inventory consumptions if any
      try {
        const storedCons = { ...inventoryConsumption };
        storedCons[savedCat.name] = customItemConsumptions;
        setInventoryConsumption(storedCons);
        localStorage.setItem('laundry_inventory_consumption', JSON.stringify(storedCons));
        await syncInventoryConsumptionToDb(storedCons);
      } catch (e) {
        console.error("Failed to save custom inventory consumptions map:", e);
      }
      
      setCategories(prev => {
        const isUsingFallback = prev.length > 0 && !(prev[0] as any).id;
        if (isUsingFallback) {
          return [savedCat];
        }
        return [...prev, savedCat];
      });
      
      // Add custom item with all 4 default prices to current order
      setNewOrder(prev => ({
        ...prev,
        items: [...prev.items, { 
          id: savedCat.id, 
          name: savedCat.name, 
          quantity: 1, 
          price: customItemForm.price, 
          service_type: undefined, 
          is_ironing_only: false,
          ironing_type: undefined,
          is_urgent: false,
          is_no_ironing: false,
          price_normal: customItemForm.price_normal,
          price_urgent: customItemForm.price_urgent,
          price_ironing: customItemForm.price_ironing,
          price_no_ironing: customItemForm.price_no_ironing,
          base_price: customItemForm.price,
          is_normal: false
        }]
      }));

      setCustomItemForm({ name: '', price: 0, price_normal: 0, price_urgent: 0, price_ironing: 0, price_no_ironing: 0, icon: '✨' });
      setCustomItemConsumptions({});
      setShowCustomItemModal(false);
    } catch (e: any) {
      alert(`فشل إضافة الصنف: ${e.message}`);
    } finally {
      isAddingCustomItemRef.current = false;
      setIsAddingCustomItem(false);
    }
  };

  const updateCategoryIcon = async (index: number, newIcon: string) => {
    const item = categories[index];
    const updated = [...categories];
    updated[index].icon = newIcon;
    setCategories(updated);

    // Save custom icon to localStorage for persistent default categories
    try {
      const storedIconsStr = localStorage.getItem('laundry_categories_custom_icons') || '{}';
      const storedIcons = JSON.parse(storedIconsStr);
      storedIcons[item.name] = newIcon;
      localStorage.setItem('laundry_categories_custom_icons', JSON.stringify(storedIcons));
    } catch (e) {
      console.error("Failed to save icon locally:", e);
    }

    if ((item as any).id) {
      try {
        await supabase.from('categories').update({ icon: newIcon }).eq('id', (item as any).id);
      } catch (e) {
        console.error(`Failed to update icon in DB:`, e);
      }
    }
  };

  const updateCategoryCustomPrice = async (index: number, field: 'price' | 'price_urgent' | 'price_ironing' | 'price_no_ironing', newPrice: number) => {
    const item = categories[index];
    const updated = [...categories];
    const mappedField = field === 'price' ? 'price_normal' : field;
    updated[index][mappedField] = newPrice;
    if (mappedField === 'price_normal') {
      updated[index]['price'] = newPrice;
    }

    const normal = updated[index].price_normal !== undefined ? updated[index].price_normal : updated[index].price;
    if (updated[index].price_urgent === undefined) updated[index].price_urgent = normal * 2;
    if (updated[index].price_ironing === undefined) updated[index].price_ironing = normal * 0.5;
    if (updated[index].price_no_ironing === undefined) updated[index].price_no_ironing = normal * 0.8;

    setCategories(updated);
    
    // Save to state, localStorage, and sync to Supabase settings
    try {
      const storedPrices = { ...customPrices };
      storedPrices[item.name] = {
        price_normal: updated[index].price_normal,
        price_urgent: updated[index].price_urgent,
        price_ironing: updated[index].price_ironing,
        price_no_ironing: updated[index].price_no_ironing
      };
      setCustomPrices(storedPrices);
      localStorage.setItem('laundry_categories_custom_prices', JSON.stringify(storedPrices));
      await syncCustomPricesToDb(storedPrices);
    } catch (e) {
      console.error("Failed to save custom price:", e);
    }

    if ((item as any).id) {
      try {
        await supabase.from('categories').update({ [field]: newPrice }).eq('id', (item as any).id);
      } catch (e) {
        console.error(`Failed to update ${field} in DB:`, e);
      }
    }
  };

  const openEditCategoryModal = (idx: number) => {
    const item = categories[idx];
    if (!item) return;
    const prices = getItemPrices(item);
    setEditingCategoryModalIndex(idx);
    setEditingCategoryForm({
      id: (item as any).id,
      name: item.name,
      icon: item.icon || '✨',
      price: item.price || prices.price_normal,
      price_normal: prices.price_normal,
      price_urgent: prices.price_urgent,
      price_ironing: prices.price_ironing,
    });

    const existingMap = inventoryConsumption[item.name] || {};
    setEditingCategoryConsumptions({ ...existingMap });
    setShowEditCategoryIconPicker(false);
    setShowDeleteCategoryConfirm(false);
  };

  const handleSaveCategoryEdit = async () => {
    if (editingCategoryModalIndex === null) return;
    if (isSavingCategoryRef.current) return;

    isSavingCategoryRef.current = true;
    setIsSavingCategory(true);

    try {
      const oldItem = categories[editingCategoryModalIndex];
      if (!oldItem) return;
      const oldName = oldItem.name;
      const newName = editingCategoryForm.name.trim() || oldName;
      const newIcon = editingCategoryForm.icon.trim() || '✨';
      const newNormal = editingCategoryForm.price_normal;
      const newUrgent = editingCategoryForm.price_urgent;
      const newIroning = editingCategoryForm.price_ironing;

      // 1. Update categories array
      const updatedCategories = [...categories];
      updatedCategories[editingCategoryModalIndex] = {
        ...updatedCategories[editingCategoryModalIndex],
        name: newName,
        icon: newIcon,
        price: newNormal,
        price_normal: newNormal,
        price_urgent: newUrgent,
        price_ironing: newIroning,
      };
      setCategories(updatedCategories);

      // 2. Update custom prices state and storage
      const storedPrices = { ...customPrices };
      if (oldName !== newName) {
        delete storedPrices[oldName];
      }
      storedPrices[newName] = {
        price_normal: newNormal,
        price_urgent: newUrgent,
        price_ironing: newIroning,
        price_no_ironing: newNormal * 0.8,
      };
      setCustomPrices(storedPrices);
      try {
        localStorage.setItem('laundry_categories_custom_prices', JSON.stringify(storedPrices));
        await syncCustomPricesToDb(storedPrices);
      } catch (e) {
        console.error("Failed to save custom prices:", e);
      }

      // 3. Save custom icon locally
      try {
        const storedIconsStr = localStorage.getItem('laundry_categories_custom_icons') || '{}';
        const storedIcons = JSON.parse(storedIconsStr);
        if (oldName !== newName) delete storedIcons[oldName];
        storedIcons[newName] = newIcon;
        localStorage.setItem('laundry_categories_custom_icons', JSON.stringify(storedIcons));
      } catch (e) {
        console.error("Failed to save custom icon:", e);
      }

      // 4. Save material consumption
      const updatedInvConsumption = { ...inventoryConsumption };
      if (oldName !== newName) {
        delete updatedInvConsumption[oldName];
      }
      updatedInvConsumption[newName] = editingCategoryConsumptions;
      setInventoryConsumption(updatedInvConsumption);
      try {
        localStorage.setItem('laundry_inventory_consumption', JSON.stringify(updatedInvConsumption));
        await syncInventoryConsumptionToDb(updatedInvConsumption);
      } catch (e) {
        console.error("Failed to save inventory consumption:", e);
      }

      // 5. Update category in Supabase DB if ID exists
      if (editingCategoryForm.id) {
        try {
          await supabase.from('categories').update({
            name: newName,
            icon: newIcon,
            price: newNormal,
            price_normal: newNormal,
            price_urgent: newUrgent,
            price_ironing: newIroning,
          }).eq('id', editingCategoryForm.id);
        } catch (e) {
          console.error("Failed to update category in Supabase:", e);
        }
      }

      setEditingCategoryModalIndex(null);
    } finally {
      isSavingCategoryRef.current = false;
      setIsSavingCategory(false);
    }
  };

  const updateItemQuantity = (id: string, delta: number) => {
    setNewOrder(prev => {
      const target = prev.items.find(i => i.id === id);
      if (!target) return prev;
      if (delta < 0) {
        if (target.quantity > 1) {
          return {
            ...prev,
            items: prev.items.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i)
          };
        }
        return {
          ...prev,
          items: prev.items.filter(i => i.id !== id)
        };
      } else {
        return {
          ...prev,
          items: prev.items.map(i => i.id === id ? { ...i, quantity: i.quantity + 1 } : i)
        };
      }
    });
  };

  const removeOrderItem = (id: string) => {
    setNewOrder(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== id)
    }));
  };

  const updateItemUnitPrice = (id: string, newUnitPrice: number) => {
    setNewOrder(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, price: Math.max(0, newUnitPrice) } : i)
    }));
  };

  const getBaseItemPrice = (name: string): number => {
    const matchedCategory = categories.find(c => c.name === name);
    if (matchedCategory) return matchedCategory.price;
    const matchedInitial = INITIAL_ITEMS.find(i => i.name === name);
    if (matchedInitial) return matchedInitial.price;
    return 5;
  };

  const getItemPrices = (itemOrName: any) => {
    let name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;
    let basePrice = typeof itemOrName === 'string' ? getBaseItemPrice(name) : (itemOrName.price ?? itemOrName.price_normal ?? 5);

    // Prefer React customPrices state; falls back to localStorage if empty
    let custom: any = {};
    if (Object.keys(customPrices).length > 0) {
      custom = customPrices[name] || {};
    } else {
      try {
        const stored = localStorage.getItem('laundry_categories_custom_prices');
        if (stored) {
          const storedPrices = JSON.parse(stored);
          custom = storedPrices[name] || {};
        }
      } catch (e) {
        console.warn("localStorage error in getItemPrices:", e);
      }
    }

    // fallback structure
    const price_normal = custom.price_normal !== undefined && custom.price_normal !== null
      ? custom.price_normal
      : (typeof itemOrName === 'object' && itemOrName && itemOrName.price_normal !== undefined && itemOrName.price_normal !== null
          ? itemOrName.price_normal
          : basePrice);

    const price_urgent = custom.price_urgent !== undefined && custom.price_urgent !== null
      ? custom.price_urgent
      : (typeof itemOrName === 'object' && itemOrName && itemOrName.price_urgent !== undefined && itemOrName.price_urgent !== null
          ? itemOrName.price_urgent
          : price_normal * 2);

    const price_ironing = custom.price_ironing !== undefined && custom.price_ironing !== null
      ? custom.price_ironing
      : (typeof itemOrName === 'object' && itemOrName && itemOrName.price_ironing !== undefined && itemOrName.price_ironing !== null
          ? itemOrName.price_ironing
          : price_normal * 0.5);

    const price_no_ironing = custom.price_no_ironing !== undefined && custom.price_no_ironing !== null
      ? custom.price_no_ironing
      : (typeof itemOrName === 'object' && itemOrName && itemOrName.price_no_ironing !== undefined && itemOrName.price_no_ironing !== null
          ? itemOrName.price_no_ironing
          : price_normal * 0.8);

    return {
      price_normal,
      price_urgent,
      price_ironing,
      price_no_ironing
    };
  };

  const updateItemOption = (id: string, option: 'urgent' | 'ironing' | 'no_ironing' | 'normal', enabled: boolean) => {
    setNewOrder(prev => {
      const updatedItems = prev.items.map(i => {
        if (i.id === id) {
          const prices = getItemPrices(i);
          const normal = prices.price_normal;
          const urgent = prices.price_urgent;
          const ironing = prices.price_ironing;
          const noIron = prices.price_no_ironing;

          const basePrice = i.base_price !== undefined ? i.base_price : (i.price ?? 5);

          const is_normal = option === 'normal' ? enabled : (i.is_normal || false);
          const is_urgent = option === 'urgent' ? enabled : (i.is_urgent || false);
          const is_ironing_only = option === 'ironing' ? enabled : (i.is_ironing_only || false);
          const is_no_ironing = option === 'no_ironing' ? enabled : (i.is_no_ironing || false);

          let finalPrice = basePrice;
          if (is_normal) {
            finalPrice += normal;
          }
          if (is_urgent) {
            finalPrice += urgent;
          }
          if (is_ironing_only) {
            finalPrice += ironing;
          }
          if (is_no_ironing) {
            finalPrice += noIron;
          }

          return {
            ...i,
            price_normal: normal,
            price_urgent: urgent,
            price_ironing: ironing,
            price_no_ironing: noIron,
            is_normal,
            is_urgent,
            is_ironing_only,
            is_no_ironing,
            service_type: is_urgent ? 'مستعجل' : (is_normal ? 'عادي' : undefined),
            ironing_type: is_ironing_only ? 'كوي' : (is_no_ironing ? 'بدون كوي' : undefined),
            price: finalPrice,
            base_price: basePrice
          };
        }
        return i;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const updateItemMode = (id: string, mode: 'عادي' | 'مستعجل' | 'كوي' | 'بدون كوي') => {
    const item = newOrder.items.find(i => i.id === id);
    if (!item) return;

    if (mode === 'عادي') {
      const isNormal = item.is_normal || false;
      updateItemOption(id, 'normal', !isNormal);
    } else if (mode === 'مستعجل') {
      const isUrgent = item.is_urgent || item.service_type === 'مستعجل' || false;
      updateItemOption(id, 'urgent', !isUrgent);
    } else if (mode === 'كوي') {
      const isIroning = item.is_ironing_only || false;
      updateItemOption(id, 'ironing', !isIroning);
    } else if (mode === 'بدون كوي') {
      const isNoIron = item.is_no_ironing || false;
      updateItemOption(id, 'no_ironing', !isNoIron);
    }
  };

  const updateItemCustomPrice = (id: string, type: 'normal' | 'urgent' | 'ironing' | 'no_ironing', priceValue: number) => {
    setNewOrder(prev => {
      const updatedItems = prev.items.map(i => {
        if (i.id === id) {
          const prices = getItemPrices(i);
          const normal = prices.price_normal;
          const urgent = prices.price_urgent;
          const ironing = prices.price_ironing;
          const noIron = prices.price_no_ironing;

          const updatedPrices = {
            price_normal: type === 'normal' ? priceValue : normal,
            price_urgent: type === 'urgent' ? priceValue : urgent,
            price_ironing: type === 'ironing' ? priceValue : ironing,
            price_no_ironing: type === 'no_ironing' ? priceValue : noIron
          };

          const is_normal = i.is_normal || false;
          const is_urgent = i.is_urgent || false;
          const is_ironing_only = i.is_ironing_only || false;
          const is_no_ironing = i.is_no_ironing || false;

          const basePrice = i.base_price !== undefined ? i.base_price : (i.price ?? 5);

          let activePrice = basePrice;
          if (is_normal) {
            activePrice += updatedPrices.price_normal;
          }
          if (is_urgent) {
            activePrice += updatedPrices.price_urgent;
          }
          if (is_ironing_only) {
            activePrice += updatedPrices.price_ironing;
          }
          if (is_no_ironing) {
            activePrice += updatedPrices.price_no_ironing;
          }

          return {
            ...i,
            ...updatedPrices,
            price: activePrice
          };
        }
        return i;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const updateItemServiceType = (id: string, service_type: 'عادي' | 'مستعجل') => {
    updateItemOption(id, 'urgent', service_type === 'مستعجل');
  };

  const updateItemIroningOnly = (id: string, is_ironing_only: boolean) => {
    updateItemOption(id, 'ironing', is_ironing_only);
  };

  const updateItemPrice = (id: string, price: number) => {
    setNewOrder(prev => {
      const updatedItems = prev.items.map(i => {
        if (i.id === id) {
          // Update the normal price as the primary target
          return { 
            ...i, 
            price, 
            price_normal: price 
          };
        }
        return i;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const handleCreateOrder = async () => {
    if (!newOrder.customer_name || !newOrder.customer_phone) return alert('يرجى إدخال اسم العميل ورقم هاتفه');
    if (newOrder.items.length === 0 && newOrder.custom_adjustment === 0) return alert('يرجى إضافة قطعة واحدة على الأقل');
    
    if (isSubmittingOrderRef.current) {
      console.warn("Order submission already in progress. Ignoring duplicate click.");
      return;
    }
    isSubmittingOrderRef.current = true;
    setLoading(true);
    const nowISO = new Date().toISOString();
    const laundryId = ensureUUID(
      userProfile?.laundry_id || 
      (() => {
        try {
          return JSON.parse(localStorage.getItem('laundry_cached_profile') || '{}')?.laundry_id;
        } catch(e) {
          return null;
        }
      })() || 
      'laund-unknown'
    );
    
    try {
      let activeSubId: string | undefined = undefined;
      let activeSubRemaining: number = 0;

      const existingSub = getCustomerSubscription(newOrder.customer_phone);
      if (existingSub) {
        activeSubId = existingSub.id;
        activeSubRemaining = existingSub.items_remaining;
      }

      // Create subscription first if a subscription package is selected and customer has no active sub
      if (selectedOrderPackageId) {
        const pkg = subscriptionPackages.find(p => p.id === selectedOrderPackageId);
        if (pkg) {
          const expiryIso = safeAddDaysISO(pkg.duration_days);

          const subId = generateUUID();
          const newSub: any = {
            id: subId,
            customer_name: isDbMultiTenant ? newOrder.customer_name : `${laundryId}|${newOrder.customer_name}`,
            customer_phone: isDbMultiTenant ? newOrder.customer_phone : `${laundryId}|${newOrder.customer_phone}`,
            package_id: pkg.id,
            items_remaining: pkg.total_items,
            total_items: pkg.total_items,
            expiry_date: expiryIso,
            is_active: true,
            laundry_id: laundryId
          };

          if (isBrowserOnline()) {
            try {
              const { error: subErr } = await supabase.from('subscriptions').insert([newSub]);
              if (subErr) throw subErr;
            } catch (err: any) {
              console.warn("Online sub insert failed, queuing offline:", err);
              addOfflineAction({ type: 'CREATE_SUBSCRIPTION', payload: newSub, laundryId });
            }
          } else {
            addOfflineAction({ type: 'CREATE_SUBSCRIPTION', payload: newSub, laundryId });
          }

          activeSubId = newSub.id;
          activeSubRemaining = newSub.total_items;

          // Add to local subscriptions state and cache
          const localSub = {
            ...newSub,
            customer_name: cleanTenantString(newSub.customer_name),
            customer_phone: cleanTenantString(newSub.customer_phone)
          };
          setSubscriptions(prev => {
            const nextSubs = [localSub, ...prev];
            try {
              localStorage.setItem(`laundry_subscriptions_${laundryId}`, JSON.stringify(nextSubs));
              localStorage.setItem('laundry_subscriptions', JSON.stringify(nextSubs));
            } catch (e) {}
            return nextSubs;
          });
        }
      }

      const rawOrderNumber = `ORD-${Date.now().toString().slice(-5)}`;
      const generatedOrderId = generateUUID();
      const creatorEmail = userProfile?.email || session?.user?.email || 'unspecified';

      const orderData: any = {
        id: generatedOrderId,
        order_number: isDbMultiTenant ? rawOrderNumber : `${laundryId}-${rawOrderNumber}`,
        customer_name: isDbMultiTenant ? newOrder.customer_name : `${laundryId}|${newOrder.customer_name}`,
        customer_phone: isDbMultiTenant ? newOrder.customer_phone : `${laundryId}|${newOrder.customer_phone}`,
        order_type: newOrder.order_type,
        items: newOrder.items.map(item => ({
          ...item,
          discount_percent: newOrder.discount_percent
        })),
        subtotal: currentSubtotal,
        tax: currentTax,
        total: currentTotal,
        custom_adjustment: newOrder.custom_adjustment,
        is_paid: newOrder.is_paid || newOrder.is_free,
        payment_method: newOrder.is_free ? 'Free' : newOrder.payment_method,
        status: 'Received',
        laundry_id: laundryId,
        created_at: nowISO,
        updated_at: nowISO
      };

      let createdOrder: any = null;

      if (isBrowserOnline()) {
        try {
          const res = await supabase.from('orders').insert([{ ...orderData, created_by: creatorEmail }]).select();
          let data = res.data;
          let error = res.error;
          if (error && (error.message?.includes('column') || error.code === '42703')) {
            console.warn("created_by column missing from Supabase orders table, using fallback insert.");
            const resFallback = await supabase.from('orders').insert([orderData]).select();
            data = resFallback.data;
            error = resFallback.error;
          }
          if (data && data.length > 0) {
            let safeItems = data[0].items;
            if (typeof safeItems === 'string') {
              try { safeItems = JSON.parse(safeItems); } catch (e) { safeItems = null; }
            }
            if (!Array.isArray(safeItems) || safeItems.length === 0) {
              safeItems = orderData.items;
            }

            createdOrder = {
              ...orderData,
              ...data[0],
              items: safeItems,
              subtotal: (typeof data[0].subtotal === 'number' && data[0].subtotal > 0) ? data[0].subtotal : orderData.subtotal,
              tax: (typeof data[0].tax === 'number') ? data[0].tax : orderData.tax,
              total: (typeof data[0].total === 'number' && data[0].total > 0) ? data[0].total : orderData.total,
              order_number: cleanTenantString(data[0].order_number || rawOrderNumber),
              customer_name: cleanTenantString(data[0].customer_name || newOrder.customer_name),
              customer_phone: cleanTenantString(data[0].customer_phone || newOrder.customer_phone)
            };
          }
        } catch (insertErr) {
          console.warn("Direct insert failed (network/offline?), falling back to offline queue:", insertErr);
        }
      }

      // If offline or online insert failed, build local order and queue for offline synchronization
      if (!createdOrder) {
        createdOrder = {
          ...orderData,
          created_by: creatorEmail,
          order_number: rawOrderNumber,
          customer_name: cleanTenantString(newOrder.customer_name),
          customer_phone: cleanTenantString(newOrder.customer_phone)
        };
        addOfflineAction({
          type: 'CREATE_ORDER',
          payload: { ...orderData, created_by: creatorEmail },
          laundryId
        });
      }

      if (createdOrder) {
        // Deduct from subscription if applicable (Only if payment method is explicitly 'Subscription')
        const orderPaymentMethod = newOrder.is_free ? 'Free' : newOrder.payment_method;
        if (activeSubId && orderPaymentMethod === 'Subscription') {
          const totalItemsInOrder = newOrder.items.reduce((acc, i) => acc + i.quantity, 0);
          if (totalItemsInOrder > 0) {
            await updateSubscriptionBalance(activeSubId, activeSubRemaining - totalItemsInOrder);
          }
        }

        // Deduct consumed materials from inventory
        try {
          const totalInventoryCuts: Record<string, number> = {};
          newOrder.items.forEach(laundryItem => {
            const consumption = inventoryConsumption[laundryItem.name];
            if (consumption) {
              const qty = laundryItem.quantity || 1;
              Object.entries(consumption).forEach(([invId, rate]) => {
                const numericRate = parseFloat(rate as any) || 0;
                if (numericRate > 0) {
                  totalInventoryCuts[invId] = (totalInventoryCuts[invId] || 0) + (numericRate * qty);
                }
              });
            }
          });

          const updatedInventory = [...inventory];
          for (const [invId, cutQty] of Object.entries(totalInventoryCuts)) {
            const invItem = updatedInventory.find(i => i.id === invId);
            if (invItem) {
              const newStock = Math.max(0, invItem.stock - cutQty);
              invItem.stock = newStock;
              if (isBrowserOnline()) {
                supabase.from('inventory').update({ stock: newStock }).eq('id', invId).then(({ error }) => {
                  if (error) {
                    addOfflineAction({ type: 'UPDATE_INVENTORY', payload: { id: invId, stock: newStock }, laundryId });
                  }
                });
              } else {
                addOfflineAction({ type: 'UPDATE_INVENTORY', payload: { id: invId, stock: newStock }, laundryId });
              }
            }
          }
          setInventory(updatedInventory);
          try {
            localStorage.setItem(`laundry_inventory_${laundryId}`, JSON.stringify(updatedInventory));
            localStorage.setItem('laundry_inventory', JSON.stringify(updatedInventory));
          } catch (e) {}
        } catch (invErr) {
          console.error("Failed to deduct inventory consumption:", invErr);
        }

        setOrders(prev => {
          const filtered = prev.filter(o => 
            o.id !== createdOrder.id && 
            cleanTenantString(o.order_number) !== cleanTenantString(createdOrder.order_number)
          );
          const nextOrders = deduplicateOrders([createdOrder, ...filtered]);
          if (isManualOffline()) {
            try {
              localStorage.setItem(`laundry_orders_${laundryId}`, JSON.stringify(nextOrders));
              localStorage.setItem('laundry_orders', JSON.stringify(nextOrders));
            } catch (e) {}
          }
          return nextOrders;
        });
        setNewOrder({ customer_name: '', customer_phone: '', order_type: 'Normal', items: [], is_paid: false, payment_method: 'Cash', custom_adjustment: 0, is_free: false, is_tax_enabled: true, discount_percent: 0 });
        setUseSubscription(true);
        setSelectedOrderPackageId('');
        setActiveTab('orders');
        setShowPrintModal(createdOrder);

        // Auto print with USB Thermal Printer if enabled
        const isAutoPrintThermal = localStorage.getItem('laundry_auto_print_thermal') !== 'false';
        if (isAutoPrintThermal) {
          setTimeout(() => {
            window.print();
          }, 350);
        }

        // Auto msg if online
        if (isBrowserOnline()) {
          triggerBackgroundNotification(createdOrder, 'RECEIVED');
        }

        // Silent background WhatsApp Bot message
        const autoSendBot = localStorage.getItem('laundry_whatsapp_bot_auto_send') !== 'false';
        if (autoSendBot && createdOrder.customer_phone) {
          sendSilentWhatsAppBotOrderNotification(createdOrder, 'RECEIVED');
        }
      }
    } catch (e: any) {
      alert(`فشل الحفظ: ${e.message}`);
    } finally { 
      setLoading(false); 
      isSubmittingOrderRef.current = false;
    }
  };

  const updateOrderStatus = async (
    id: string, 
    status: OrderStatus, 
    options?: { skipNotification?: boolean }
  ) => {
    const nowISO = new Date().toISOString();
    const laundryId = userProfile?.laundry_id;
    let targetOrder: Order | null = null;
    let previousStatus: OrderStatus | null = null;

    setOrders(prev => {
      const target = prev.find(o => o.id === id);
      if (target) {
        targetOrder = target;
        previousStatus = target.status;
        const updated = { ...target, status, updated_at: nowISO };
        const nextOrders = prev.map(o => o.id === id ? updated : o);
        try {
          if (laundryId) localStorage.setItem(`laundry_orders_${laundryId}`, JSON.stringify(nextOrders));
          localStorage.setItem('laundry_orders', JSON.stringify(nextOrders));
        } catch (e) {}
        return nextOrders;
      }
      return prev;
    });

    if (isBrowserOnline()) {
      try {
        const { error } = await supabase.from('orders').update({ status, updated_at: nowISO }).eq('id', id);
        if (error) throw error;
      } catch (e) {
        console.warn("Online order status update failed, queuing offline:", e);
        addOfflineAction({ type: 'UPDATE_ORDER_STATUS', payload: { orderId: id, status, updated_at: nowISO }, laundryId });
      }
    } else {
      addOfflineAction({ type: 'UPDATE_ORDER_STATUS', payload: { orderId: id, status, updated_at: nowISO }, laundryId });
    }

    // Trigger ready notifications strictly ONCE outside setOrders, and only if:
    // 1. Not explicitly skipped (e.g. from QR scanner modal which handles its own notification)
    // 2. Status actually transitioned to 'Ready' from another status
    // 3. Browser is online and we found the target order
    if (
      !options?.skipNotification && 
      previousStatus && 
      previousStatus !== 'Ready' && 
      status === 'Ready' && 
      isBrowserOnline() && 
      targetOrder
    ) {
      const updated: Order = { ...(targetOrder as Order), status, updated_at: nowISO };
      triggerBackgroundNotification(updated, 'READY');
      const autoSendBot = localStorage.getItem('laundry_whatsapp_bot_auto_send') !== 'false';
      if (autoSendBot && updated.customer_phone) {
        sendSilentWhatsAppBotOrderNotification(updated, 'READY');
      }
    }
  };

  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  const deleteOrder = async (id: string, orderNumber: string) => {
    console.log("--- DELETE PROCESS STARTED ---");
    console.log("Order ID:", id);
    console.log("Order Number:", orderNumber);
    
    if (!id) {
      alert('خطأ: معرف الطلب مفقود');
      return;
    }
    
    setDeletingOrderId(id);
    const laundryId = userProfile?.laundry_id;
    try {
      setOrders(prev => {
        const filtered = prev.filter(o => o.id !== id);
        try {
          if (laundryId) localStorage.setItem(`laundry_orders_${laundryId}`, JSON.stringify(filtered));
          localStorage.setItem('laundry_orders', JSON.stringify(filtered));
        } catch (e) {}
        return filtered;
      });

      if (isBrowserOnline()) {
        try {
          const response = await supabase
            .from('orders')
            .delete()
            .eq('id', id);
          if (response.error) throw response.error;
        } catch (dbErr: any) {
          console.warn("Delete in DB failed, queuing offline action:", dbErr);
          addOfflineAction({ type: 'DELETE_ORDER', payload: { orderId: id }, laundryId });
        }
      } else {
        addOfflineAction({ type: 'DELETE_ORDER', payload: { orderId: id }, laundryId });
      }
      
      alert('تم حذف الطلب بنجاح ✅');
      setOrderToDelete(null);
    } catch (e: any) {
      console.error("Delete failed with error:", e);
      alert(`فشل الحذف: ${e.message || 'خطأ غير معروف'}`);
    } finally {
      setDeletingOrderId(null);
      console.log("--- DELETE PROCESS FINISHED ---");
    }
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
    try {
      if (originalOrder) {
        const oldUsedSub = originalOrder.payment_method === 'Subscription';
        const newUsedSub = updatedOrder.payment_method === 'Subscription';

        const oldTotalItems = originalOrder.items.reduce((acc, i) => acc + i.quantity, 0);
        const newTotalItems = updatedOrder.items.reduce((acc, i) => acc + i.quantity, 0);

        if (oldUsedSub && newUsedSub) {
          if (originalOrder.customer_phone === updatedOrder.customer_phone) {
            const diff = oldTotalItems - newTotalItems;
            if (diff !== 0) {
              const sub = getCustomerSubscription(updatedOrder.customer_phone);
              if (sub) {
                await updateSubscriptionBalance(sub.id, sub.items_remaining + diff);
              }
            }
          } else {
            const oldSub = getCustomerSubscription(originalOrder.customer_phone);
            if (oldSub) {
              await updateSubscriptionBalance(oldSub.id, oldSub.items_remaining + oldTotalItems);
            }
            const newSub = getCustomerSubscription(updatedOrder.customer_phone);
            if (newSub) {
              await updateSubscriptionBalance(newSub.id, newSub.items_remaining - newTotalItems);
            }
          }
        } else if (oldUsedSub && !newUsedSub) {
          const oldSub = getCustomerSubscription(originalOrder.customer_phone);
          if (oldSub) {
            await updateSubscriptionBalance(oldSub.id, oldSub.items_remaining + oldTotalItems);
          }
        } else if (!oldUsedSub && newUsedSub) {
          const newSub = getCustomerSubscription(updatedOrder.customer_phone);
          if (newSub) {
            await updateSubscriptionBalance(newSub.id, newSub.items_remaining - newTotalItems);
          }
        }
      }

      if (editedSubscription) {
        const dbSubPayload: any = {
          package_id: editedSubscription.package_id,
          items_remaining: editedSubscription.items_remaining,
          total_items: editedSubscription.total_items,
          expiry_date: editedSubscription.expiry_date,
          is_active: editedSubscription.is_active,
          customer_name: isDbMultiTenant ? editedSubscription.customer_name : `${laundryId}|${editedSubscription.customer_name}`,
          customer_phone: isDbMultiTenant ? editedSubscription.customer_phone : `${laundryId}|${editedSubscription.customer_phone}`
        };
        if (isDbMultiTenant) {
          dbSubPayload.laundry_id = laundryId;
        }

        const { error: subErr } = await supabase.from('subscriptions').update(dbSubPayload).eq('id', editedSubscription.id);
        if (subErr) throw subErr;
        setSubscriptions(prev => prev.map(s => s.id === editedSubscription.id ? editedSubscription : s));
      }

      const dbOrderPayload: any = {
        ...updatedOrder,
        order_number: isDbMultiTenant ? updatedOrder.order_number : `${laundryId}-${updatedOrder.order_number}`,
        customer_name: isDbMultiTenant ? updatedOrder.customer_name : `${laundryId}|${updatedOrder.customer_name}`,
        customer_phone: isDbMultiTenant ? updatedOrder.customer_phone : `${laundryId}|${updatedOrder.customer_phone}`
      };
      if (isDbMultiTenant) {
        dbOrderPayload.laundry_id = laundryId;
      }

      const { error } = await supabase.from('orders').update(dbOrderPayload).eq('id', updatedOrder.id);
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      setShowEditOrderModal(null);
      setOriginalOrder(null);
      alert('تم تحديث الطلب بنجاح');
    } catch (e: any) {
      alert(`فشل التحديث: ${e.message}`);
    }
  };

  const createInvoicePdfContainer = async (order: Order, laundryName: string): Promise<HTMLElement> => {
    let orderItems = order.items || [];
    if (typeof orderItems === 'string') {
      try {
        orderItems = JSON.parse(orderItems);
      } catch (e) {
        orderItems = [];
      }
    }
    if (!Array.isArray(orderItems)) {
      orderItems = [];
    }

    const discountPercent = (orderItems?.[0] as any)?.discount_percent || 0;
    const logoLetter = (laundryName || 'مغسلة عود ونظافة')[0]?.toUpperCase() || 'M';
    const qrDataUrl = await getInvoiceQRDataUrl(order, laundryName, 180);

    const groupedItems = getGroupedItems(orderItems);
    let itemsRowsHtml = '';

    if (groupedItems.length === 0) {
      itemsRowsHtml = `
        <tr style="background-color: #ffffff;">
          <td colspan="5" style="padding: 18px 12px; text-align: center; color: #475569; font-weight: 700; font-size: 13px; border-bottom: 1px solid #e2e8f0;">
            خدمات مغسلة عامة (طلب رقم #${order.order_number})
          </td>
        </tr>
      `;
    } else {
      itemsRowsHtml = groupedItems.map((group, idx) => {
        const opts: string[] = [];
        const item = group.item;
        if (item.service_type === 'مستعجل' || (item as any).is_urgent) opts.push('مستعجل 🔥');
        if (item.is_ironing_only) opts.push('كوي فقط');
        if ((item as any).is_no_ironing || item.ironing_type === 'بدون كوي') opts.push('بدون كوي');
        if (opts.length === 0) opts.push('غسيل وكوي');
        const optionsText = opts.join(' + ');

        const unitPrice = group.totalQty > 0 ? (group.totalPrice / group.totalQty).toFixed(2) : '0.00';
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        return `
          <tr style="background-color: ${rowBg};">
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; width: 40px; font-weight: 800; color: #64748b; font-size: 12px;">
              ${idx + 1}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">
              <div style="font-weight: 900; color: #0f172a; font-size: 13px;">${item.name || 'خدمة مغسلة'}</div>
              <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px;">الخدمة: ${optionsText}</div>
            </td>
            <td style="text-align: center; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; width: 70px;">
              <span style="background: #eef2ff; color: #4338ca; padding: 3px 10px; border-radius: 9999px; font-weight: 900; font-size: 13px; font-family: monospace;">${group.totalQty}</span>
            </td>
            <td style="text-align: center; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #475569; font-size: 13px; width: 90px;">
              ${unitPrice} ر.س
            </td>
            <td style="text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 900; color: #0f172a; font-size: 13px; width: 100px;">
              ${(group.totalPrice).toFixed(2)} ر.س
            </td>
          </tr>
        `;
      }).join('');
    }

    const container = document.createElement('div');
    container.id = 'pdf-invoice-container';
    container.className = 'pdf-invoice-export-container';
    container.style.width = '780px';
    container.style.boxSizing = 'border-box';
    container.style.padding = '36px 40px';
    container.style.background = '#ffffff';
    container.style.color = '#0f172a';
    container.style.direction = 'rtl';
    container.style.fontFamily = "'Tajawal', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '-9999px';
    container.style.zIndex = '99999';
    container.style.visibility = 'visible';
    container.style.opacity = '1';
    container.style.pointerEvents = 'none';

    container.innerHTML = `
      <!-- Header with Brand & Logo -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 18px; border-bottom: 2px solid #e2e8f0;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 58px; height: 58px; background: #0f172a; color: #ffffff; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            ${logoLetter}
          </div>
          <div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">${laundryName}</h1>
            <p style="margin: 3px 0 0; font-size: 12px; font-weight: 700; color: #64748b;">فاتورة إلكترونية | Electronic Invoice</p>
          </div>
        </div>
        <div style="text-align: left;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b;">رقم الفاتورة:</div>
          <div style="font-size: 16px; font-weight: 900; color: #4338ca; font-family: monospace;">#${order.order_number}</div>
          <div style="margin-top: 4px; font-size: 11px; font-weight: 800; color: #475569;">
            ${new Date(order.created_at || Date.now()).toLocaleDateString('ar-SA-u-nu-latn')}
          </div>
        </div>
      </div>

      <!-- Customer & Order Information + QR Code -->
      <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 16px; margin: 20px 0;">
        <!-- Order Metadata Table -->
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px 18px 14px; display: flex; flex-direction: column; justify-content: center;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 8px 6px; text-align: right; width: 50%;">
                <span style="font-size: 11px; font-weight: 700; color: #64748b; display: block;">اسم العميل:</span>
                <span style="font-size: 15px; font-weight: 900; color: #0f172a;">${order.customer_name || 'عميل'}</span>
              </td>
              <td style="padding: 4px 8px 6px; text-align: right; width: 50%;">
                <span style="font-size: 11px; font-weight: 700; color: #64748b; display: block;">رقم الجوال:</span>
                <span style="font-size: 14px; font-weight: 900; color: #0f172a; font-family: monospace;" dir="ltr">${order.customer_phone || '-'}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 8px 8px; text-align: right; width: 50%;">
                <span style="font-size: 11px; font-weight: 700; color: #64748b; display: block;">رقم الفاتورة:</span>
                <span style="font-size: 15px; font-weight: 900; color: #4338ca; font-family: monospace;">#${order.order_number}</span>
              </td>
              <td style="padding: 4px 8px 8px; text-align: right; width: 50%;">
                <span style="font-size: 11px; font-weight: 700; color: #64748b; display: block;">تاريخ ووقت الإصدار:</span>
                <span style="font-size: 12px; font-weight: 800; color: #334155;">${new Date(order.created_at || Date.now()).toLocaleString('ar-SA-u-nu-latn')}</span>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 8px 8px 6px; border-top: 1px solid #e2e8f0; text-align: right;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 12px; font-weight: 700; color: #64748b;">حالة الفاتورة والسداد:</span>
                  <span style="font-size: 12px; font-weight: 900; color: ${order.is_paid ? '#15803d' : '#c2410c'}; background: ${order.is_paid ? '#dcfce7' : '#ffedd5'}; padding: 4px 14px 9px 14px; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">
                    ${order.is_paid ? 'مسددة بالكامل ✅' : 'معلقة / غير مسددة ⏳'} ${order.payment_method ? `(${order.payment_method === 'Cash' ? 'نقدي' : order.payment_method === 'Card' ? 'شبكة' : order.payment_method === 'Transfer' ? 'تحويل' : order.payment_method === 'Free' ? 'مجاني' : order.payment_method})` : ''}
                  </span>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- QR Code Container -->
        <div style="width: 155px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
          <img src="${qrDataUrl}" alt="QR Code" style="width: 115px; height: 115px; border-radius: 10px; border: 1px solid #cbd5e1; background: #ffffff; padding: 4px;" />
          <span style="font-size: 9px; font-weight: 800; color: #475569; margin-top: 4px;">رمز التحقق الإلكتروني (QR)</span>
        </div>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff;">
            <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 900; width: 40px;">#</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 900;">الصنف والخدمة المطلوبة</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 900; width: 70px;">الكمية</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 900; width: 90px;">سعر الوحدة</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 900; width: 100px;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
        </tbody>
      </table>

      <!-- Financial Calculation Summary -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
        <div style="width: 350px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            ${discountPercent > 0 ? `
              <tr>
                <td style="padding: 4px 0; text-align: right; font-size: 13px; font-weight: 700; color: #64748b;">المجموع المبدئي</td>
                <td style="padding: 4px 0; text-align: left; font-size: 13px; font-weight: 800; color: #334155;">${((order.subtotal || 0) / (1 - discountPercent/100)).toFixed(2)} ر.س</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; text-align: right; font-size: 13px; font-weight: 900; color: #dc2626;">خصم خاص (${discountPercent}%)</td>
                <td style="padding: 4px 0; text-align: left; font-size: 13px; font-weight: 900; color: #dc2626;">-${(((order.subtotal || 0) / (1 - discountPercent/100)) * (discountPercent/100)).toFixed(2)} ر.س</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; text-align: right; font-size: 13px; font-weight: 700; color: #64748b;">المجموع بعد الخصم</td>
                <td style="padding: 4px 0; text-align: left; font-size: 13px; font-weight: 800; color: #334155;">${(order.subtotal || 0).toFixed(2)} ر.س</td>
              </tr>
            ` : `
              <tr>
                <td style="padding: 4px 0; text-align: right; font-size: 13px; font-weight: 700; color: #64748b;">المجموع الفرعي</td>
                <td style="padding: 4px 0; text-align: left; font-size: 13px; font-weight: 800; color: #334155;">${(order.subtotal || 0).toFixed(2)} ر.س</td>
              </tr>
            `}
            <tr>
              <td style="padding: 4px 0; text-align: right; font-size: 13px; font-weight: 700; color: #64748b;">ضريبة القيمة المضافة (15%)</td>
              <td style="padding: 4px 0; text-align: left; font-size: 13px; font-weight: 800; color: #334155;">${(order.tax || 0).toFixed(2)} ر.س</td>
            </tr>
            ${order.custom_adjustment && order.custom_adjustment !== 0 ? `
              <tr>
                <td style="padding: 4px 0; text-align: right; font-size: 13px; font-weight: 700; color: #64748b;">تعديل إضافي</td>
                <td style="padding: 4px 0; text-align: left; font-size: 13px; font-weight: 800; color: #334155;">${Number(order.custom_adjustment).toFixed(2)} ر.س</td>
              </tr>
            ` : ''}
            <tr>
              <td style="padding: 12px 0 4px; text-align: right; border-top: 2px dashed #cbd5e1; font-size: 16px; font-weight: 900; color: #0f172a;">الإجمالي النهائي المستحق</td>
              <td style="padding: 12px 0 4px; text-align: left; border-top: 2px dashed #cbd5e1; font-size: 22px; font-weight: 900; color: #4338ca;">${(order.total || 0).toFixed(2)} ر.س</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Store Notice & Legal Disclaimer -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; text-align: center; margin-bottom: 16px;">
        <p style="margin: 0; font-size: 11px; font-weight: 700; color: #64748b; line-height: 1.7;">
          تنويه هام: المغسلة غير مسؤولة عن فقدان أي أغراض شخصية تُترك داخل الملابس عند استلامها، كما لا تتحمل مسؤولية حفظ الملابس أو الأغراض بعد مضي (15) يومًا من تاريخ الاستلام.
        </p>
      </div>

      <div style="text-align: center; font-size: 12px; font-weight: 800; color: #94a3b8;">
        شكراً لتعاملكم مع ${laundryName} | نسعد دائماً بخدمتكم
      </div>
    `;

    document.body.appendChild(container);
    return container;
  };

  const generateInvoicePdfBlob = async (order: Order, laundryName: string): Promise<Blob> => {
    const container = await createInvoicePdfContainer(order, laundryName);
    try {
      // Ensure image (QR code) is decoded
      const qrImg = container.querySelector('img');
      if (qrImg && (qrImg as HTMLImageElement).decode) {
        try { await (qrImg as HTMLImageElement).decode(); } catch (e) {}
      }
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Render directly with imported html2canvas and onclone to bypass viewport/scroll clipping
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 800,
        onclone: (clonedDoc) => {
          const target = clonedDoc.getElementById('pdf-invoice-container');
          if (target) {
            target.style.position = 'relative';
            target.style.left = '0';
            target.style.top = '0';
            target.style.margin = '0 auto';
            target.style.visibility = 'visible';
            target.style.opacity = '1';
            target.style.display = 'block';
            const allElements = target.querySelectorAll('*');
            allElements.forEach((el: any) => {
              el.style.visibility = 'visible';
              el.style.opacity = '1';
            });
          }
        }
      });

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error("فشل توليد صورة الفاتورة");
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const printWidth = pageWidth - (margin * 2);
      const printHeight = (canvas.height * printWidth) / canvas.width;

      if (printHeight <= pageHeight - (margin * 2)) {
        pdf.addImage(imgData, 'JPEG', margin, margin, printWidth, printHeight);
      } else {
        let heightLeft = printHeight;
        let position = margin;
        pdf.addImage(imgData, 'JPEG', margin, position, printWidth, printHeight);
        heightLeft -= (pageHeight - margin * 2);

        while (heightLeft > 0) {
          position -= (pageHeight - margin * 2);
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', margin, position, printWidth, printHeight);
          heightLeft -= (pageHeight - margin * 2);
        }
      }

      return pdf.output('blob');
    } finally {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  };

  const generateInvoicePdfBase64 = async (order: Order, laundryName: string): Promise<string> => {
    const blob = await generateInvoicePdfBlob(order, laundryName);
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const sendSilentWhatsAppBotOrderNotification = (order: Order, context: MessageContext) => {
    const dedupKey = `${order.id || order.order_number}_${context}`;
    const now = Date.now();
    const lastSent = recentSentNotificationsRef.current.get(dedupKey);
    if (lastSent && (now - lastSent < 45000)) {
      console.log(`[WhatsApp Notification] Skipping duplicate silent notification for ${dedupKey} (sent ${now - lastSent}ms ago)`);
      return;
    }
    recentSentNotificationsRef.current.set(dedupKey, now);

    // Run asynchronously in a detached timer so it never lags or freezes the UI during save
    setTimeout(async () => {
      try {
        const smartMsg = await generateSmartReminder(order, context);
        const fullMessage = `${smartMsg}\n\n📦 فاتورة: #${order.order_number}\n💰 الإجمالي: ${order.total.toFixed(2)} ريال\n📍 الحالة: ${statusArabic[order.status] || order.status}\n\n📄 مرفق نسخة الفاتورة الرسمية بصيغة PDF.\n${DISCLAIMER_TEXT}`;

        const laundryName = userProfile?.laundry_name || 'مغسلة عود ونظافة';
        let pdfBase64: string | undefined = undefined;
        try {
          pdfBase64 = await generateInvoicePdfBase64(order, laundryName);
        } catch (pdfErr) {
          console.warn("Silent bot PDF generation error:", pdfErr);
        }

        const res = await sendWhatsAppBotMessage({
          toPhone: order.customer_phone,
          message: fullMessage,
          pdfBase64,
          pdfFileName: `فاتورة-${order.order_number}.pdf`
        });

        if (!res.success) {
          console.warn("WhatsApp bot silent send result:", res.error);
        }
      } catch (e: any) {
        console.error("sendSilentWhatsAppBotOrderNotification error:", e);
      }
    }, 1000);
  };

  const sendWhatsAppReminder = async (order: Order, context: MessageContext) => {
    if (sendingMessageIds.has(order.id)) return;
    setSendingMessageIds(prev => new Set(prev).add(order.id));
    
    try {
      const laundryName = userProfile?.laundry_name || 'مغسلة عود ونظافة';
      // Generate smart reminder message
      const smartMsg = await generateSmartReminder(order, context);
      const fullMessage = `${smartMsg}\n\n📦 فاتورة: #${order.order_number}\n💰 الإجمالي: ${order.total.toFixed(2)} ريال\n📍 الحالة: ${statusArabic[order.status] || order.status}\n\n📄 مرفق نسخة الفاتورة الرسمية بصيغة PDF.\n${DISCLAIMER_TEXT}`;
      
      const cleanPhone = order.customer_phone.replace(/\D/g, '');
      const finalPhone = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.replace(/^0/, '')}`;
      const waUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(fullMessage)}`;

      let pdfBlob: Blob | null = null;
      let pdfBase64: string | undefined = undefined;

      try {
        pdfBlob = await generateInvoicePdfBlob(order, laundryName);
        pdfBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(pdfBlob!);
        });
      } catch (pdfErr) {
        console.warn("PDF generation warning in reminder:", pdfErr);
      }

      // 1. IF WhatsApp Bot is connected, send message AND PDF directly in background!
      if (whatsAppBotStatus.isConnected) {
        const botRes = await sendWhatsAppBotMessage({
          toPhone: order.customer_phone,
          message: fullMessage,
          pdfBase64,
          pdfFileName: `فاتورة-${order.order_number}.pdf`
        });

        if (botRes.success) {
          setToastNotification({
            type: 'success',
            message: `تم إرسال الفاتورة والرسالة للعميل (${order.customer_name}) مباشرة مع ملف PDF عبر الواتساب! 🟢`
          });
          return;
        }
      }

      // 2. If WhatsApp Bot is not connected, use native sharing or auto-download PDF and open chat
      if (pdfBlob) {
        const pdfFile = new File([pdfBlob], `فاتورة-${order.order_number}.pdf`, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          try {
            await navigator.share({
              files: [pdfFile],
              title: `فاتورة #${order.order_number}`,
              text: fullMessage
            });
            return;
          } catch (shareErr: any) {
            if (shareErr?.name === 'AbortError') {
              return;
            }
          }
        }
        
        // Auto download the PDF file to disk for easy drag & drop / attachment
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `فاتورة-${order.order_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (a.parentNode) a.parentNode.removeChild(a);
          URL.revokeObjectURL(url);
        }, 500);

        setToastNotification({
          type: 'success',
          message: 'تم تنزيل الفاتورة PDF تلقائياً لإرفاقها في محادثة الواتساب 📎'
        });
      }

      window.open(waUrl, '_blank');
    } catch (error) { 
      alert("خطأ في معالجة الرسالة."); 
    } finally {
      setSendingMessageIds(prev => { const n = new Set(prev); n.delete(order.id); return n; });
    }
  };

  const handleDownloadPDF = async (order: Order) => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    const laundryName = userProfile?.laundry_name || 'مغسلة عود ونظافة';

    try {
      const pdfBlob = await generateInvoicePdfBlob(order, laundryName);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `فاتورة-${order.order_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);

      setToastNotification({
        type: 'success',
        message: `تم تحميل ملف الفاتورة PDF (${order.order_number}) بنجاح ✅`
      });
    } catch (err) {
      console.error("PDF download error:", err);
      alert("حدث خطأ أثناء تحميل الفاتورة بصيغة PDF.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Automated Order Ready notification with smart message and invoice PDF
  const sendOrderReadyNotification = useCallback(async (scannedOrder: Order): Promise<{ success: boolean; error?: string }> => {
    try {
      const dedupKey = `${scannedOrder.id || scannedOrder.order_number}_READY`;
      const now = Date.now();
      const lastSent = recentSentNotificationsRef.current.get(dedupKey);
      if (lastSent && (now - lastSent < 30000)) {
        console.log(`[Order Ready] Notification already sent for ${dedupKey} ${now - lastSent}ms ago, skipping duplicate.`);
        return { success: true };
      }
      recentSentNotificationsRef.current.set(dedupKey, now);

      const laundryName = userProfile?.laundry_name || 'مغسلة عود ونظافة';
      let smartMsg = '';
      try {
        smartMsg = await generateSmartReminder(scannedOrder, 'READY');
      } catch {
        smartMsg = `مرحباً بك عميلنا العزيز ${scannedOrder.customer_name} ✨\nيسعدنا إبلاغك بأن طلبك أصبح جاهزاً للاستلام الآن! تم الانتهاء من تجهيز وتغليف ملابسك بعناية، تفضل بزيارتنا للاستلام. نسعد دائماً بخدمتك في ${laundryName}. 🌸`;
      }

      const fullMessage = `${smartMsg}\n\n📦 رقم الفاتورة: #${scannedOrder.order_number}\n💰 الإجمالي: ${scannedOrder.total.toFixed(2)} ر.س\n📍 الحالة: جاهز للاستلام ✨\n\n📄 مرفق نسخة الفاتورة الرسمية بصيغة PDF.\n${DISCLAIMER_TEXT}`;

      let pdfBase64: string | undefined = undefined;
      try {
        pdfBase64 = await generateInvoicePdfBase64(scannedOrder, laundryName);
      } catch (pdfErr) {
        console.warn("Ready notification PDF generation error:", pdfErr);
      }

      let sendSuccess = false;
      let sendError = '';

      const res = await sendWhatsAppBotMessage({
        toPhone: scannedOrder.customer_phone,
        message: fullMessage,
        pdfBase64,
        pdfFileName: `فاتورة-${scannedOrder.order_number}.pdf`
      });

      if (res.success) {
        sendSuccess = true;
      } else {
        sendError = res.error || '';
        if (twilioConfig.enabled && twilioConfig.accountSid) {
          try {
            await sendTwilioWhatsApp(scannedOrder, fullMessage, twilioConfig);
            sendSuccess = true;
          } catch (twErr: any) {
            sendError = twErr.message;
          }
        }
      }

      return { success: sendSuccess, error: sendError };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [userProfile, twilioConfig]);

  // Handler for scans initiated by thermal printer hardware barcode scanner
  const handleHardwareScan = useCallback(async (scannedCode: string) => {
    try {
      const raw = scannedCode.trim();
      if (!raw) return;

      const order = await matchOrderFromScannedCode(raw, orders);
      if (!order) {
        if (raw.length >= 3) {
          playScannerBeep('error');
          setToastNotification({
            type: 'error',
            message: `لم يتم العثور على طلب مطابق للرمز الممسوح: "${raw.length > 25 ? raw.slice(0, 25) + '...' : raw}"`
          });
        }
        return;
      }

      // Audio beep confirmation
      playScannerBeep('success');

      // Update order status to Ready
      await updateOrderStatus(order.id, 'Ready', { skipNotification: true });
      const updatedOrder: Order = { ...order, status: 'Ready' };

      // Send automated WhatsApp notification with invoice PDF (matching camera scan!)
      const notifRes = await sendOrderReadyNotification(updatedOrder);

      // Dispatch custom event for any open modals
      window.dispatchEvent(new CustomEvent('hardware-qr-scanned', {
        detail: { order: updatedOrder, code: raw, success: notifRes.success }
      }));

      if (notifRes.success) {
        setToastNotification({
          type: 'success',
          message: `⚡ تم مسح رمز الفاتورة بنجاح! طلب العميل ${order.customer_name} (#${order.order_number}) أصبح (جاهز للاستلام) وتم إرسال رسالة الواتساب مع الفاتورة فوراً 🧺✅`
        });
      } else {
        setToastNotification({
          type: 'success',
          message: `تم تحديث الطلب #${order.order_number} إلى (جاهز للاستلام) بنجاح 🧺 (${notifRes.error ? 'تنبيه: ' + notifRes.error : 'تأكد من اتصال بوت الواتساب لإرسال الإشعار التلقائي'})`
        });
      }
    } catch (err: any) {
      console.error("handleHardwareScan error:", err);
    }
  }, [orders, updateOrderStatus, sendOrderReadyNotification]);

  // Setup Global Hardware Barcode / QR Scanner Listener
  useEffect(() => {
    const cleanup = setupHardwareBarcodeScannerListener({
      onScan: (scannedText) => {
        handleHardwareScan(scannedText);
      }
    });
    return cleanup;
  }, [handleHardwareScan]);

  const handleAddInventoryItem = async () => {
    if (!newInvItem.name) {
      alert('يرجى إدخال اسم المادة');
      return;
    }
    setLoading(true);
    const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
    const itemId = generateUUID();

    const payload: any = {
      id: itemId,
      name: isDbMultiTenant ? newInvItem.name : `${laundryId}|${newInvItem.name}`,
      stock: Number(newInvItem.stock) || 0,
      unit: newInvItem.unit || 'قطعة',
      threshold: Number(newInvItem.threshold) || 5
    };
    if (isDbMultiTenant) {
      payload.laundry_id = laundryId;
    }

    const cleanedRow: InventoryItem = {
      id: itemId,
      name: newInvItem.name,
      stock: Number(newInvItem.stock) || 0,
      unit: newInvItem.unit || 'قطعة',
      threshold: Number(newInvItem.threshold) || 5,
      consumption_per_use: newInvItem.defaultConsumption || 10
    };

    // Sync consumption mapping for categories
    const updatedCons = { ...inventoryConsumption };
    const categoryList = categories.length > 0 ? categories : INITIAL_ITEMS;

    categoryList.forEach(cat => {
      const catName = cat.name;
      const val = newInvConsumption[catName] !== undefined
        ? newInvConsumption[catName]
        : 0;
      
      if (val > 0) {
        if (!updatedCons[catName]) {
          updatedCons[catName] = {};
        }
        updatedCons[catName][cleanedRow.id] = val;
      }
    });

    setInventoryConsumption(updatedCons);
    try {
      localStorage.setItem('laundry_inventory_consumption', JSON.stringify(updatedCons));
    } catch (e) {}

    const nextInv = [cleanedRow, ...inventory];
    setInventory(nextInv);
    try {
      if (laundryId) localStorage.setItem(`laundry_inventory_${laundryId}`, JSON.stringify(nextInv));
      localStorage.setItem('laundry_inventory', JSON.stringify(nextInv));
    } catch (e) {}

    setIsInvModalOpen(false);
    setNewInvItem({ name: '', stock: 0, unit: 'قطعة', threshold: 5, defaultConsumption: 10 });
    setNewInvConsumption({});

    if (isBrowserOnline()) {
      try {
        const { data, error } = await supabase
          .from('inventory')
          .insert([payload])
          .select();

        if (error) throw error;
        await syncInventoryConsumptionToDb(updatedCons);
        alert('تم إضافة المادة وربط استهلاكها بالأصناف بنجاح ✅');
      } catch (e: any) {
        addOfflineAction({ type: 'CREATE_INVENTORY', payload, laundryId });
        alert('تم حفظ المادة محلياً وسيتم المزامنة تلقائياً عند الاتصال ✅');
      } finally {
        setLoading(false);
      }
    } else {
      addOfflineAction({ type: 'CREATE_INVENTORY', payload, laundryId });
      setLoading(false);
      alert('تم إضافة المادة وحفظها محلياً في وضع الأوفلاين ✅');
    }
  };

  const handlePrintNewPage = async (order: Order) => {
    const discountPercent = (order.items?.[0] as any)?.discount_percent || 0;
    const laundryName = userProfile?.laundry_name || 'مغسلة عود ونظافة';
    const logoLetter = laundryName[0]?.toUpperCase() || 'M';

    // Expose a helper to generate WhatsApp details if child asks
    (window as any).getWhatsAppDetailsForPrint = async () => {
      try {
        const smartMsg = await generateSmartReminder(order, 'RECEIVED');
        const fullMessage = `${smartMsg}\n\n📦 فاتورة: #${order.order_number}\n💰 الإجمالي: ${order.total.toFixed(2)} ريال\n📍 الحالة: ${statusArabic[order.status] || order.status}\n\n📄 مرفق نسخة الفاتورة الرسمية بصيغة PDF.\n${DISCLAIMER_TEXT}`;
        const cleanPhone = order.customer_phone.replace(/\D/g, '');
        const finalPhone = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.replace(/^0/, '')}`;
        return {
          message: fullMessage,
          phone: finalPhone,
          url: `https://wa.me/${finalPhone}?text=${encodeURIComponent(fullMessage)}`
        };
      } catch (e) {
        const cleanPhone = order.customer_phone.replace(/\D/g, '');
        const finalPhone = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.replace(/^0/, '')}`;
        const fallbackMsg = `مرحباً ${order.customer_name}، نود إعلامكم بتسجيل طلبكم في ${laundryName}\n\n📦 فاتورة: #${order.order_number}\n💰 الإجمالي: ${order.total.toFixed(2)} ر.س\n\n📄 مرفق نسخة الفاتورة الرسمية PDF.\n${DISCLAIMER_TEXT}`;
        return {
          message: fallbackMsg,
          phone: finalPhone,
          url: `https://wa.me/${finalPhone}?text=${encodeURIComponent(fallbackMsg)}`
        };
      }
    };

    (window as any).getWhatsAppUrlForPrint = async () => {
      const details = await (window as any).getWhatsAppDetailsForPrint();
      return details.url;
    };

    // Open window immediately to prevent popup blocker
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('الرجاء السماح بالنوافذ المنبثقة لعرض وطباعة الفاتورة.');
      return;
    }

    // Temporary loading state
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <title>فاتورة #${order.order_number}</title>
          <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Tajawal', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #475569; font-weight: bold; }
          </style>
        </head>
        <body>
          <div style="text-align: center;">
            <div style="font-size: 32px; margin-bottom: 8px;">🧾</div>
            <div>جاري تجهيز الفاتورة والباركود...</div>
          </div>
        </body>
      </html>
    `);

    // Generate authentic QR code data URL
    const qrDataUrl = await getInvoiceQRDataUrl(order, laundryName, 180);

    const itemsHtml = getGroupedItems(order.items || []).map((group, idx) => {
      const opts: string[] = [];
      const item = group.item;
      if (item.service_type === 'مستعجل' || (item as any).is_urgent) opts.push('مستعجل 🔥');
      if (item.is_ironing_only) opts.push('كوي');
      if ((item as any).is_no_ironing || item.ironing_type === 'بدون كوي') opts.push('بدون كوي');
      if (opts.length === 0) opts.push('عادي');
      const optionsText = opts.join(' + ');
      
      return `
        <tr class="group-header-row" onclick="const detail = document.getElementById('print-detail-${idx}'); if(detail) { detail.style.display = detail.style.display === 'none' ? 'table-row-group' : 'none'; }" style="cursor: pointer; transition: all 0.15s;">
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
            <div style="font-weight: 800; color: #1e293b;">${item.name}</div>
            <div style="font-size: 11px; color: #64748b; font-weight: normal; margin-top: 2px;">(${optionsText})</div>
          </td>
          <td style="text-align: center; padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: 900; color: #4f46e5;">
            <span style="background: #e0e7ff; padding: 4px 8px; border-radius: 8px;">${group.totalQty}</span>
            <div class="no-print" style="font-size: 8px; color: #94a3b8; font-weight: normal; margin-top: 2px;">(اضغط للتفاصيل)</div>
          </td>
          <td style="text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #1e293b;">${(group.totalPrice).toFixed(2)} ر.س</td>
        </tr>
        <tbody id="print-detail-${idx}" class="no-print" style="display: none; background: #f8fafc;">
          ${group.originalItems.map((orig, subIdx) => `
            <tr>
              <td style="padding: 8px 24px; font-size: 13px; color: #475569; font-weight: 600;">◀ قطعة ${subIdx + 1}: ${orig.name}</td>
              <td style="text-align: center; padding: 8px; font-size: 13px; color: #475569;">1</td>
              <td style="text-align: left; padding: 8px 12px; font-size: 13px; color: #475569; font-weight: 600;">${orig.price.toFixed(2)} ر.س</td>
            </tr>
          `).join('')}
        </tbody>
      `;
    }).join('');

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>فاتورة ضريبية #${order.order_number}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap" rel="stylesheet">
          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
            
            * {
              font-family: 'Tajawal', sans-serif !important;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Tajawal', sans-serif !important;
              padding: 30px 16px;
              color: #1e293b;
              background-color: #f1f5f9;
              margin: 0;
              direction: rtl;
              -webkit-font-smoothing: antialiased;
            }

            #invoice-container {
              max-width: 800px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 28px;
              padding: 40px;
              border: 1px solid #e2e8f0;
              box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
            }

            .header {
              text-align: center;
              margin-bottom: 35px;
            }

            .logo {
              font-size: 36px;
              font-weight: 900;
              background: #0f172a;
              color: #ffffff;
              width: 76px;
              height: 76px;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 16px;
              border-radius: 24px;
              box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
            }

            .badge-tax {
              display: inline-block;
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              color: #475569;
              padding: 4px 14px;
              border-radius: 12px;
              font-size: 13px;
              font-weight: 800;
              margin-top: 6px;
            }

            .info {
              margin-bottom: 35px;
              border-top: 1px solid #e2e8f0;
              border-bottom: 1px solid #e2e8f0;
              padding: 24px 0;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }

            .info-item {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }

            .info-label {
              font-size: 12px;
              font-weight: 700;
              color: #64748b;
            }

            .info-value {
              font-size: 15px;
              font-weight: 900;
              color: #0f172a;
            }

            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 35px;
            }

            .items-table th {
              text-align: right;
              padding: 12px;
              border-bottom: 2px solid #e2e8f0;
              color: #64748b;
              font-size: 14px;
              font-weight: 800;
            }

            .items-table td {
              padding: 12px;
              border-bottom: 1px solid #f1f5f9;
              font-size: 15px;
              font-weight: 700;
            }

            .summary {
              background: #f8fafc;
              padding: 28px;
              border-radius: 24px;
              margin-top: 30px;
              border: 1px solid #f1f5f9;
            }

            .summary-item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
              font-size: 14px;
              font-weight: 700;
              color: #64748b;
            }

            .summary-total {
              display: flex;
              justify-content: space-between;
              margin-top: 18px;
              padding-top: 18px;
              border-top: 2px dashed #cbd5e1;
            }

            .total-label {
              font-size: 19px;
              font-weight: 900;
              color: #0f172a;
            }

            .total-amount {
              font-size: 26px;
              font-weight: 900;
              color: #4f46e5;
            }

            .qr-wrapper {
              margin: 30px 0;
              padding: 24px;
              background: #f8fafc;
              border-radius: 24px;
              border: 1px solid #e2e8f0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              gap: 12px;
            }

            .qr-img {
              width: 140px;
              height: 140px;
              border-radius: 16px;
              border: 1px solid #cbd5e1;
              padding: 6px;
              background: #ffffff;
              box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            }

            .qr-title {
              font-size: 13px;
              font-weight: 900;
              color: #1e293b;
            }

            .qr-desc {
              font-size: 11px;
              font-weight: 700;
              color: #64748b;
            }

            .disclaimer {
              margin-top: 25px;
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              line-height: 1.8;
              padding: 0 20px;
              font-weight: 700;
            }

            .action-box {
              margin-top: 30px;
              padding: 24px;
              background: #f8fafc;
              border-radius: 24px;
              border: 1px solid #e2e8f0;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 14px;
            }

            .btn-group {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
              justify-content: center;
              width: 100%;
            }

            .btn {
              padding: 16px 28px;
              border: none;
              border-radius: 18px;
              font-size: 16px;
              font-weight: 900;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              text-decoration: none;
            }

            .btn-print {
              background: #4f46e5;
              color: white;
              box-shadow: 0 8px 18px rgba(79, 70, 229, 0.25);
            }
            .btn-print:hover { background: #4338ca; }

            .btn-pdf {
              background: #ea580c;
              color: white;
              box-shadow: 0 8px 18px rgba(234, 88, 12, 0.25);
            }
            .btn-pdf:hover { background: #c2410c; }

            .btn-whatsapp {
              background: #10b981;
              color: white;
              box-shadow: 0 8px 18px rgba(16, 185, 129, 0.25);
            }
            .btn-whatsapp:hover { background: #059669; }

            #wa-status-box {
              transition: all 0.3s;
              line-height: 1.6;
            }

            @media print {
              .no-print { display: none !important; }
              body { padding: 0; background: #fff; }
              #invoice-container { border: none; box-shadow: none; padding: 10mm; }
              .summary { background: #fff; border: 1px solid #e2e8f0; }
              .qr-wrapper { background: #fff; border: 1px solid #e2e8f0; }
            }
          </style>
        </head>
        <body>
          <div id="invoice-container">
            <div class="header">
              <div class="logo">${logoLetter}</div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #0f172a;">${laundryName}</h1>
              
              <!-- رمز التحقق الإلكتروني -->
              <div class="qr-wrapper">
                <img src="${qrDataUrl}" alt="رمز QR الفاتورة" class="qr-img" />
                <div class="qr-title">رمز التحقق الإلكتروني (QR Code)</div>
                <div class="qr-desc">فاتورة إلكترونية معتمدة - ${laundryName}</div>
              </div>
            </div>
            
            <div class="info">
              <div class="info-item"><span class="info-label">العميل</span><span class="info-value">${order.customer_name}</span></div>
              <div class="info-item"><span class="info-label">رقم الهاتف</span><span class="info-value" dir="ltr">${order.customer_phone}</span></div>
              <div class="info-item"><span class="info-label">رقم الفاتورة</span><span class="info-value">#${order.order_number}</span></div>
              <div class="info-item"><span class="info-label">التاريخ والوقت</span><span class="info-value">${new Date(order.created_at).toLocaleString('ar-SA-u-nu-latn')}</span></div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th style="text-align: center;">الكمية</th>
                  <th style="text-align: left;">السعر</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="summary">
              ${discountPercent > 0 ? `
                <div class="summary-item"><span>المجموع المبدئي</span><span>${(order.subtotal / (1 - discountPercent/100)).toFixed(2)} ر.س</span></div>
                <div class="summary-item" style="color: #ef4444; font-weight: 950;"><span>خصم (${discountPercent}%)</span><span>-${((order.subtotal / (1 - discountPercent/100)) * (discountPercent/100)).toFixed(2)} ر.س</span></div>
                <div class="summary-item"><span>المجموع بعد الخصم</span><span>${order.subtotal.toFixed(2)} ر.س</span></div>
              ` : `
                <div class="summary-item"><span>المجموع الفرعي</span><span>${order.subtotal.toFixed(2)} ر.س</span></div>
              `}
              <div class="summary-item"><span>ضريبة القيمة المضافة (15%)</span><span>${order.tax.toFixed(2)} ر.س</span></div>
              ${order.custom_adjustment !== 0 ? `<div class="summary-item"><span>تعديل إضافي</span><span>${order.custom_adjustment.toFixed(2)} ر.س</span></div>` : ''}
              <div class="summary-total">
                <span class="total-label">الإجمالي النهائي</span>
                <span class="total-amount">${order.total.toFixed(2)} ر.س</span>
              </div>
            </div>

            <div class="disclaimer">
              تنويه هام: المغسلة غير مسؤولة عن فقدان أي أغراض شخصية تُترك داخل الملابس عند استلامها، كما لا تتحمل مسؤولية حفظ الملابس أو الأغراض بعد مضي (15) يومًا من تاريخ الاستلام.
            </div>

            <!-- أزرار التحكم داخل صندوق أنيق تحت التنويه الهام -->
            <div class="action-box no-print">
              <div class="btn-group">
                <button class="btn btn-print" onclick="window.print()">🖨️ طباعة الفاتورة</button>
                <button class="btn btn-pdf" onclick="handleDownloadPDF()">📄 تحميل PDF الفاتورة</button>
                <button class="btn btn-whatsapp" onclick="handleWhatsApp()">إرسال واتساب يدوي</button>
              </div>
              <div id="wa-status-box" style="display: none; padding: 12px 20px; border-radius: 16px; font-size: 13px; font-weight: 700; width: 100%; max-width: 600px; text-align: center; margin-top: 6px;"></div>
              <p style="margin-top: 10px; margin-bottom: 0; font-size: 13px; color: #94a3b8; font-weight: 700;">شكراً لثقتكم بنا!</p>
            </div>
          </div>

          <script>
            async function handleDownloadPDF() {
              const btn = document.querySelector('.btn-pdf');
              if (btn) {
                btn.disabled = true;
                btn.innerHTML = '⏳ جاري التحميل...';
              }
              try {
                const element = document.getElementById('invoice-container');
                const opt = {
                  margin: [8, 8],
                  filename: 'فاتورة-${order.order_number}.pdf',
                  image: { type: 'jpeg', quality: 0.98 },
                  html2canvas: { scale: 2, useCORS: true, logging: false },
                  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };
                await window.html2pdf().from(element).set(opt).save();
              } catch (e) {
                console.error(e);
                alert('حدث خطأ في تحميل ملف PDF');
              } finally {
                if (btn) {
                  btn.disabled = false;
                  btn.innerHTML = '📄 تحميل PDF الفاتورة';
                }
              }
            }

            async function handleWhatsApp() {
              const btn = document.querySelector('.btn-whatsapp');
              if (!btn) return;
              const originalText = btn.innerHTML;
              btn.disabled = true;
              btn.innerHTML = '⏳ جاري تجهيز PDF والواتساب...';

              const statusBox = document.getElementById('wa-status-box');
              if (statusBox) {
                statusBox.style.display = 'block';
                statusBox.style.background = '#eff6ff';
                statusBox.style.color = '#1e40af';
                statusBox.style.border = '1px solid #bfdbfe';
                statusBox.innerHTML = '⏳ جاري توليد ملف PDF للفاتورة وتجهيز محادثة واتساب للعميل...';
              }

              try {
                // 1. Prepare message and phone
                const cleanPhone = "${order.customer_phone}".replace(/\\D/g, '');
                const finalPhone = cleanPhone.startsWith('966') ? cleanPhone : ('966' + cleanPhone.replace(/^0/, ''));
                
                let fullMsg = "مرحباً ${order.customer_name}،\\nنود إبلاغك بتسجيل طلبك في ${laundryName}\\n\\n📦 رقم الفاتورة: #${order.order_number}\\n💰 الإجمالي: ${order.total.toFixed(2)} ر.س\\n\\n📄 مرفق نسخة الفاتورة الرسمية بصيغة PDF.\\nشكراً لاختياركم ${laundryName}!";
                
                if (window.opener && window.opener.getWhatsAppDetailsForPrint) {
                  try {
                    const details = await window.opener.getWhatsAppDetailsForPrint();
                    if (details && details.message) fullMsg = details.message;
                  } catch (openerErr) {}
                }

                const waUrl = 'https://wa.me/' + finalPhone + '?text=' + encodeURIComponent(fullMsg);

                // 2. Generate PDF file using html2pdf
                const invoiceElement = document.getElementById('invoice-container');
                const opt = {
                  margin: [8, 8],
                  filename: 'فاتورة-${order.order_number}.pdf',
                  image: { type: 'jpeg', quality: 0.98 },
                  html2canvas: { scale: 2, useCORS: true, logging: false },
                  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                let pdfFile = null;
                if (window.html2pdf) {
                  try {
                    const pdfBlob = await window.html2pdf().from(invoiceElement).set(opt).outputPdf('blob');
                    pdfFile = new File([pdfBlob], 'فاتورة-${order.order_number}.pdf', { type: 'application/pdf' });
                  } catch (pdfErr) {
                    console.warn('PDF blob generation error:', pdfErr);
                  }
                }

                // 3. Try native Web Share API with File (Mobile / supported platforms)
                let sharedDirectly = false;
                if (pdfFile && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                  try {
                    await navigator.share({
                      files: [pdfFile],
                      title: 'فاتورة #${order.order_number} - ${laundryName}',
                      text: fullMsg
                    });
                    sharedDirectly = true;
                    if (statusBox) {
                      statusBox.style.background = '#ecfdf5';
                      statusBox.style.color = '#065f46';
                      statusBox.style.border = '1px solid #a7f3d0';
                      statusBox.innerHTML = '✓ تم فتح مشاركة الفاتورة PDF عبر واتساب بنجاح!';
                    }
                  } catch (shareErr) {
                    if (shareErr.name === 'AbortError') {
                      // User cancelled the share dialog
                      btn.disabled = false;
                      btn.innerHTML = originalText;
                      return;
                    }
                  }
                }

                // 4. Fallback for Desktop: Auto-download the PDF so user has it ready, and open WhatsApp Web/App
                if (!sharedDirectly) {
                  if (window.html2pdf) {
                    window.html2pdf().from(invoiceElement).set(opt).save();
                  }
                  window.open(waUrl, '_blank');

                  if (statusBox) {
                    statusBox.style.background = '#f0fdf4';
                    statusBox.style.color = '#15803d';
                    statusBox.style.border = '1px solid #bbf7d0';
                    statusBox.innerHTML = '📄 تم تنزيل الفاتورة بصيغة PDF لجهازك وفتح محادثة واتساب للعميل. يمكنك الآن إرفاق الفاتورة وإرسالها فوراً!';
                  }
                }
              } catch (err) {
                console.error("Error in handleWhatsApp:", err);
                alert('حدث خطأ أثناء معالجة إرسال الفاتورة عبر واتساب');
              } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
              }
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleUpdateStock = async (id: string, delta: number) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const newStock = Math.max(0, item.stock + delta);
    const updated = inventory.map(i => i.id === id ? { ...i, stock: newStock } : i);
    setInventory(updated);
    const laundryId = userProfile?.laundry_id;
    try {
      if (laundryId) localStorage.setItem(`laundry_inventory_${laundryId}`, JSON.stringify(updated));
      localStorage.setItem('laundry_inventory', JSON.stringify(updated));
    } catch (e) {}

    if (isBrowserOnline()) {
      try {
        const { error } = await supabase.from('inventory').update({ stock: newStock }).eq('id', id);
        if (error) throw error;
      } catch (e: any) {
        addOfflineAction({ type: 'UPDATE_INVENTORY', payload: { id, stock: newStock }, laundryId });
      }
    } else {
      addOfflineAction({ type: 'UPDATE_INVENTORY', payload: { id, stock: newStock }, laundryId });
    }
  };

  const handleCustomStockAdjust = async (id: string, amountVal: number, mode: 'add' | 'subtract') => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('الرجاء إدخال رقم صحيح وموجب أكبر من الصفر');
      return;
    }
    let newStock = item.stock;
    if (mode === 'add') {
      newStock = item.stock + amountVal;
    } else if (mode === 'subtract') {
      newStock = Math.max(0, item.stock - amountVal);
    }

    const updated = inventory.map(i => i.id === id ? { ...i, stock: newStock } : i);
    setInventory(updated);
    const laundryId = userProfile?.laundry_id;
    try {
      if (laundryId) localStorage.setItem(`laundry_inventory_${laundryId}`, JSON.stringify(updated));
      localStorage.setItem('laundry_inventory', JSON.stringify(updated));
    } catch (e) {}
    setCustomStockModalItem(null);

    setCustomStockLoading(true);
    if (isBrowserOnline()) {
      try {
        const { error } = await supabase.from('inventory').update({ stock: newStock }).eq('id', id);
        if (error) throw error;
      } catch (e: any) {
        addOfflineAction({ type: 'UPDATE_INVENTORY', payload: { id, stock: newStock }, laundryId });
      } finally {
        setCustomStockLoading(false);
      }
    } else {
      addOfflineAction({ type: 'UPDATE_INVENTORY', payload: { id, stock: newStock }, laundryId });
      setCustomStockLoading(false);
    }
  };

  const handleDeleteInventoryItem = async (id: string, name: string) => {
    const updated = inventory.filter(i => i.id !== id);
    setInventory(updated);
    const laundryId = userProfile?.laundry_id;
    try {
      if (laundryId) localStorage.setItem(`laundry_inventory_${laundryId}`, JSON.stringify(updated));
      localStorage.setItem('laundry_inventory', JSON.stringify(updated));
    } catch (e) {}

    if (isBrowserOnline()) {
      try {
        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) throw error;
        alert('تم حذف المادة بنجاح ✅');
      } catch (e: any) { 
        addOfflineAction({ type: 'DELETE_INVENTORY', payload: { id }, laundryId });
        alert('تم حذف المادة محلياً وسيتم المزامنة عند الاتصال ✅');
      }
    } else {
      addOfflineAction({ type: 'DELETE_INVENTORY', payload: { id }, laundryId });
      alert('تم حذف المادة محلياً في وضع الأوفلاين ✅');
    }
  };

  const filteredOrders = useMemo(() => {
    // Prevent duplicate order records in list
    const uniqueMap = new Map<string, Order>();
    orders.forEach(o => {
      if (o && o.id) uniqueMap.set(o.id, o);
    });
    const uniqueOrders = Array.from(uniqueMap.values());

    return uniqueOrders.filter(o => {
      const matchesSearch = o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           o.customer_phone.includes(searchQuery);
      if (!matchesSearch) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (timeFilter !== 'all') {
        const hour = 3600000;
        const day = 86400000;
        const twoDays = 172800000;
        const orderTimestamp = new Date(o.created_at).getTime();
        const passedTimeMs = Date.now() - orderTimestamp;
        if (timeFilter === '1h') return passedTimeMs >= hour && passedTimeMs < day;
        if (timeFilter === '24h') return passedTimeMs >= day && passedTimeMs < twoDays;
        if (timeFilter === '48h') return passedTimeMs >= twoDays;
      }
      return true;
    });
  }, [orders, searchQuery, timeFilter, statusFilter]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setOrdersCurrentPage(1);
  }, [searchQuery, timeFilter, statusFilter]);

  useEffect(() => {
    setFinanceClientsCurrentPage(1);
    setFinanceOrdersCurrentPage(1);
  }, [financeClientSearch, financePendingFilter, financeSelectedClientPhone, financeFromDate, financeToDate]);

  // Reset customer orders modal page when customer changes
  useEffect(() => {
    setCustomerModalOrdersPage(1);
  }, [selectedCustomerForOrders]);

  if (!session) {
    if (showAuthScreen) {
      return (
        <div className="min-h-screen flex flex-col bg-slate-50">
          <OfflineBar 
            laundryId={userProfile?.laundry_id} 
            onSyncSuccess={fetchData} 
            onSyncCompleted={fetchData} 
            onOpenOfflineModal={() => setIsOfflineModalOpen(true)}
          />
          <Auth 
            onAuthSuccess={() => setShowAuthScreen(false)} 
            onBackToLanding={() => setShowAuthScreen(false)} 
          />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <OfflineBar 
          laundryId={userProfile?.laundry_id} 
          onSyncSuccess={fetchData} 
          onSyncCompleted={fetchData} 
          onOpenOfflineModal={() => setIsOfflineModalOpen(true)}
        />
        <LandingPage
          onOpenAuth={() => setShowAuthScreen(true)}
          isLoggedIn={false}
          orders={orders}
        />
      </div>
    );
  }

  if (userProfile?.is_disabled || userProfile?.status === 'disabled') {
    const cleanWaNum = platformWhatsApp.replace(/[^\d]/g, '');
    const waLink = `https://wa.me/${cleanWaNum || '966500000000'}?text=${encodeURIComponent('السلام عليكم، تم تجميد حسابي أرجو الدعم لتفعيله.')}`;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6 text-right" dir="rtl">
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-red-100 max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <Lock size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900">الحساب معطل حالياً</h2>
            <span className="inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-black rounded-full">
              حالة الحساب: معطّل 🔒
            </span>
          </div>
          <p className="text-xs font-bold text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
            تم تجميد هذا الحساب من قبل إدارة النظام العليا. إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع إدارة المنصة.
          </p>

          <div className="space-y-3 pt-2">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
            >
              <MessageCircle size={18} /> التواصل عبر الواتساب مع الدعم
            </a>

            <button
              onClick={handleLogout}
              className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2"
            >
              <X size={18} /> تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border-t-4 border-red-500 text-center">
          <Database size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-black mb-4">خطأ في الاتصال</h2>
          <p className="text-slate-500 mb-8">{dbError}</p>
          <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold">تحديث الصفحة</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F4F6]">
      {/* Persistent Offline & Sync Status Banner at the top of the entire screen */}
      <OfflineBar 
        laundryId={userProfile?.laundry_id} 
        onSyncSuccess={fetchData} 
        onSyncCompleted={fetchData} 
        onOpenOfflineModal={() => setIsOfflineModalOpen(true)}
      />

      <div className="flex-1 flex flex-col md:flex-row min-w-0">
        {/* Sidebar Desktop */}
        <aside className="hidden md:flex flex-col w-24 xl:w-64 bg-white border-l border-slate-200/80 p-3 xl:p-5 py-6 sticky top-0 h-screen no-print transition-all shrink-0 overflow-hidden shadow-sm z-30">
          {/* Logo & Store Header */}
          <div className="flex items-center justify-center xl:justify-start gap-3 mb-6 px-1 shrink-0">
            <div className="w-11 h-11 xl:w-12 xl:h-12 bg-gradient-to-tr from-blue-600 via-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
              <ShoppingBag size={22} className="stroke-[2.5]" />
            </div>
            <div className="hidden xl:block overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">نظام كاشيري</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              </div>
              <h1 className="text-base font-black leading-tight text-slate-800 truncate">
                {userProfile?.laundry_name || 'منصة غسيل كلاود'}
              </h1>
            </div>
          </div>

          {/* Store Branch Pill (Desktop Expanded) */}
          <div className="hidden xl:flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200/70 rounded-2xl mb-4 text-xs font-bold text-slate-700">
            <div className="flex items-center gap-2 truncate">
              <Store size={15} className="text-blue-600 shrink-0" />
              <span className="truncate">{userProfile?.laundry_name || 'الفرع الرئيسي'}</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5 overflow-y-auto flex-1 pr-0.5 pl-0.5 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {allowedNavItems.map(item => {
              const isActive = activeTab === item.id;
              const pendingCount = item.id === 'orders' ? orders.filter(o => o.status !== 'Delivered').length : 0;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex flex-col xl:flex-row items-center justify-center xl:justify-between px-2 py-3 xl:px-4 xl:py-3.5 rounded-2xl transition-all relative group ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 font-black'
                      : 'text-slate-500 hover:bg-blue-50/70 hover:text-blue-600 font-bold'
                  }`}
                >
                  <div className="flex flex-col xl:flex-row items-center gap-1.5 xl:gap-3.5">
                    <item.icon size={20} className={`shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'stroke-[2.5]' : ''}`} />
                    <span className="text-[10px] xl:text-xs text-center xl:text-right">{item.label}</span>
                  </div>

                  {pendingCount > 0 && (
                    <span className={`hidden xl:inline-flex items-center justify-center text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Profile & Logout */}
          <div className="mt-auto pt-4 border-t border-slate-100 bg-white shrink-0 space-y-2.5">
            <div className="hidden xl:block px-1">
              <PWAInstallButton />
            </div>
            
            <div className="hidden xl:flex items-center gap-3 p-2 bg-slate-50 rounded-2xl border border-slate-100 mb-2">
              <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                {userProfile?.full_name ? userProfile.full_name.charAt(0) : (userProfile?.email?.charAt(0) || 'U')}
              </div>
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-xs font-black text-slate-800 truncate">{userProfile?.full_name || userProfile?.email}</p>
                <span className="text-[10px] font-bold text-blue-600 block truncate">
                  {userProfile?.role === 'admin' ? 'مدير النظام' : userProfile?.role === 'manager' ? 'مشرف' : 'موظف'}
                </span>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center xl:justify-start gap-3 px-3 xl:px-4 py-2.5 rounded-2xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all font-bold text-xs"
              title="تسجيل الخروج"
            >
              <X size={18} className="shrink-0" />
              <span className="hidden xl:block">تسجيل الخروج</span>
            </button>
          </div>
        </aside>

        {/* Mobile Top Header */}
        <nav className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200/80 sticky top-0 z-[110] shadow-2xs no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <ShoppingBag size={18} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold leading-none">مرحباً بك 👋</p>
              <h1 className="text-sm font-black text-slate-800 leading-tight truncate max-w-[140px]">
                {userProfile?.laundry_name || 'كاشيري'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Store Badge Pill */}
            <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200/70 rounded-full text-[10px] font-bold text-slate-700">
              <Store size={12} className="text-blue-600" />
              <span className="truncate max-w-[80px]">{userProfile?.laundry_name || 'الفرع'}</span>
            </div>

            {/* Offline Mode Toggle Button */}
            <button
              type="button"
              onClick={() => setIsOfflineModalOpen(true)}
              className={`p-2 rounded-xl border transition active:scale-95 ${
                isManualOffline()
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-200'
                  : 'text-slate-500 hover:text-amber-600 bg-slate-50 border-slate-200/60'
              }`}
              title="وضع العمل بدون إنترنت (الأوفلاين)"
            >
              <CloudOff size={18} />
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => setActiveTab('orders')}
              className="relative p-2 text-slate-500 hover:text-blue-600 bg-slate-50 rounded-xl border border-slate-200/60"
              title="الطلبات النشطة"
            >
              <Bell size={18} />
              {orders.filter(o => o.status !== 'Delivered').length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-black flex items-center justify-center">
                  {orders.filter(o => o.status !== 'Delivered').length}
                </span>
              )}
            </button>

            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className="p-2 text-slate-600 hover:text-blue-600 bg-slate-50 rounded-xl border border-slate-200/60"
              aria-label="القائمة"
            >
              <Menu size={18} />
            </button>
          </div>
        </nav>

        {/* Mobile Floating Bottom Bar (Matching Reference Screenshot) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-[120] bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] px-3 py-1.5 flex items-center justify-around no-print">
          {/* 1. الرئيسية (Home) */}
          <button 
            type="button" 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-2xl transition-all ${
              activeTab === 'dashboard' ? 'text-blue-600 font-black' : 'text-slate-400 font-bold hover:text-slate-600'
            }`}
          >
            <LayoutDashboard size={20} className={activeTab === 'dashboard' ? 'stroke-[2.5]' : ''} />
            <span className="text-[10px]">الرئيسية</span>
          </button>

          {/* 2. فواتير (Bills / Orders) */}
          <button 
            type="button" 
            onClick={() => setActiveTab('orders')} 
            className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-2xl relative transition-all ${
              activeTab === 'orders' ? 'text-blue-600 font-black' : 'text-slate-400 font-bold hover:text-slate-600'
            }`}
          >
            <FileText size={20} className={activeTab === 'orders' ? 'stroke-[2.5]' : ''} />
            <span className="text-[10px]">فواتير</span>
            {orders.filter(o => o.status !== 'Delivered').length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>

          {/* 3. Center Elevated Action Button: بيع (+) */}
          <button 
            type="button" 
            onClick={() => setActiveTab('new-order')} 
            className="flex flex-col items-center justify-center -mt-6 group active:scale-95 transition-transform"
            title="إنشاء فاتورة جديدة"
          >
            <div className="w-13 h-13 bg-gradient-to-tr from-blue-600 via-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-500/35 ring-4 ring-white group-hover:scale-105 transition-all">
              <Plus size={26} className="stroke-[3]" />
            </div>
            <span className="text-[10px] font-black text-blue-600 mt-1">بيع</span>
          </button>

          {/* 4. منتجات (Products / Inventory) */}
          <button 
            type="button" 
            onClick={() => setActiveTab('inventory')} 
            className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-2xl transition-all ${
              activeTab === 'inventory' ? 'text-blue-600 font-black' : 'text-slate-400 font-bold hover:text-slate-600'
            }`}
          >
            <Package size={20} className={activeTab === 'inventory' ? 'stroke-[2.5]' : ''} />
            <span className="text-[10px]">منتجات</span>
          </button>

          {/* 5. المزيد (More Options Menu) */}
          <button 
            type="button" 
            onClick={() => setIsMobileMenuOpen(true)} 
            className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-2xl transition-all ${
              isMobileMenuOpen || (!['dashboard', 'orders', 'new-order', 'inventory'].includes(activeTab))
                ? 'text-blue-600 font-black' 
                : 'text-slate-400 font-bold hover:text-slate-600'
            }`}
          >
            <MoreHorizontal size={20} />
            <span className="text-[10px]">المزيد</span>
          </button>
        </div>

        {/* Mobile Full Drawer / Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] no-print" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="absolute bottom-20 left-4 right-4 max-h-[80vh] overflow-y-auto bg-white rounded-[2.5rem] p-6 shadow-2xl border border-slate-100 animate-in slide-in-from-bottom-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black">
                    <LayoutDashboard size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">قائمة الأقسام والخدمات</h3>
                    <p className="text-[10px] text-slate-400 font-bold">{userProfile?.laundry_name || 'منصة كاشيري'}</p>
                  </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-4">
                {allowedNavItems.map(item => (
                  <button 
                    key={item.id} 
                    onClick={() => { setActiveTab(item.id as any); setIsMobileMenuOpen(false); }} 
                    className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all text-right ${
                      activeTab === item.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-50 text-slate-700 hover:bg-blue-50'
                    }`}
                  >
                    <item.icon size={18} className="shrink-0" />
                    <span className="text-xs font-black truncate">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                  <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center font-black text-sm">
                    {userProfile?.full_name ? userProfile.full_name.charAt(0) : 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-800 truncate">{userProfile?.full_name || userProfile?.email}</p>
                    <span className="inline-block text-[10px] font-bold text-blue-600">
                      {userProfile?.role === 'admin' ? 'مدير النظام' : userProfile?.role === 'manager' ? 'مشرف' : 'موظف'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <PWAInstallButton />
                  </div>
                  <button 
                    onClick={handleLogout} 
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-red-600 bg-red-50 hover:bg-red-100 transition-all text-xs font-black"
                  >
                    <X size={16} />
                    <span>خروج</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto no-print pb-28 md:pb-8">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div><h2 className="text-2xl font-black text-slate-900">{navItems.find(n => n.id === activeTab)?.label}</h2><p className="text-slate-500 text-sm font-medium">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <PWAInstallButton />
            </div>

            {/* Offline Mode Configuration Button */}
            <button
              type="button"
              onClick={() => setIsOfflineModalOpen(true)}
              className={`px-3.5 py-3 rounded-2xl border text-xs font-black flex items-center gap-2 transition-all shadow-sm shrink-0 active:scale-95 cursor-pointer ${
                isManualOffline()
                  ? 'bg-amber-500 border-amber-600 text-white hover:bg-amber-600 ring-2 ring-amber-300'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="إعدادات العمل بدون إنترنت وحفظ البيانات أوفلاين"
            >
              <CloudOff size={17} className={isManualOffline() ? 'text-white' : 'text-slate-500'} />
              <span className="hidden md:inline">
                {isManualOffline() ? 'وضع الأوفلاين نشط 🟡' : 'وضع الأوفلاين'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowWhatsAppBotModal(true)}
              className={`px-3.5 py-3 rounded-2xl border text-xs font-black flex items-center gap-2 transition-all shadow-sm shrink-0 active:scale-95 cursor-pointer ${
                whatsAppBotStatus.isConnected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
              }`}
              title="الربط مع الواتساب"
            >
              <MessageCircle size={17} className={whatsAppBotStatus.isConnected ? 'text-emerald-600' : 'text-amber-600'} />
              <span className="hidden md:inline">
                {whatsAppBotStatus.isConnected ? 'الواتساب: متصل' : 'الربط مع الواتساب'}
              </span>
              <span className={`w-2 h-2 rounded-full ${whatsAppBotStatus.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            </button>

            {/* Expandable Search: icon by default, expands on click */}
            {isSearchExpanded || searchQuery ? (
              <div className="relative flex-1 lg:flex-none flex items-center animate-in fade-in duration-200">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500" size={18} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="رقم الطلب أو العميل..."
                  className="w-full lg:w-72 pr-11 pl-10 py-3.5 bg-white border border-indigo-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold shadow-sm"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchExpanded(false);
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title="إغلاق البحث"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsSearchExpanded(true);
                  setTimeout(() => searchInputRef.current?.focus(), 80);
                }}
                className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex items-center justify-center shrink-0 cursor-pointer"
                title="بحث عن طلب أو عميل"
              >
                <Search size={19} />
              </button>
            )}

            {/* QR / Barcode Scanner for Order Ready Status */}
            <button
              type="button"
              onClick={() => setShowQRScannerModal(true)}
              className="p-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl active:scale-95 transition-all shadow-sm flex items-center justify-center shrink-0 cursor-pointer"
              title="مسح رمز QR أو باركود الفاتورة لتجهيز الطلب"
            >
              <div className="relative w-5 h-5 flex items-center justify-center pointer-events-none">
                <Scan size={20} strokeWidth={2.2} />
                <Barcode size={13} strokeWidth={2.4} className="absolute inset-0 m-auto" />
              </div>
            </button>
            <button onClick={fetchData} className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:bg-slate-50 active:scale-95 transition-all shadow-sm" title="تحديث البيانات"><Repeat size={20} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        </header>

        {activeTab === 'landing' && (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
            <LandingPage
              onOpenAuth={() => setActiveTab('dashboard')}
              onGoToDashboard={() => setActiveTab('dashboard')}
              isLoggedIn={true}
              orders={orders}
            />
          </div>
        )}

        {activeTab === 'new-order' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            <div className="lg:col-span-8 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h3 className="text-xl font-black flex items-center gap-3"><PlusCircle className="text-indigo-600" /> اختر الملابس</h3>
                <button onClick={() => setIsEditingPrices(!isEditingPrices)} className={`px-5 py-2 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${isEditingPrices ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-600 border'}`}><Settings2 size={14} /> {isEditingPrices ? 'حفظ الأسعار' : 'تعديل الأسعار'}</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {!isCategoriesLoaded && categories.length === 0 ? (
                  <div className="col-span-full flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                  </div>
                ) : (
                  <>
                    {categories.map((item, idx) => (
                      <div 
                        key={item.id || item.name || idx} 
                        className={`relative group transition-all duration-200 ${draggedIndex === idx ? 'opacity-40 scale-95 border-2 border-dashed border-indigo-400 rounded-3xl' : ''}`}
                        draggable={!isEditingPrices}
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnter={(e) => handleDragEnter(e, idx)}
                        onDragEnd={handleDragEnd}
                      >
                        <div 
                          onClick={() => {
                            if (isEditingPrices) {
                              openEditCategoryModal(idx);
                            } else {
                              togglePredefinedItem(item);
                            }
                          }} 
                          className={`w-full flex flex-col items-center justify-center p-5 bg-white border border-slate-100 rounded-3xl transition-all relative group cursor-pointer ${
                            isEditingPrices 
                              ? 'border-indigo-200 bg-indigo-50/10 hover:border-indigo-500 hover:shadow-md' 
                              : 'hover:bg-indigo-600 hover:text-white active:scale-95 cursor-grab active:cursor-grabbing'
                          }`}
                        >
                          {/* Edit Badge when in Edit Mode */}
                          {isEditingPrices && (
                            <div 
                              className="absolute top-3 left-3 bg-indigo-600 text-white p-1.5 rounded-full shadow-md group-hover:scale-110 transition-all flex items-center justify-center cursor-pointer"
                              title="تعديل الصنف"
                            >
                              <Edit2 size={12} />
                            </div>
                          )}

                          <div className="relative mb-2 flex items-center justify-center">
                            <div className="relative">
                              {renderCategoryIcon(item.icon, "w-14 h-14 text-3xl flex items-center justify-center bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden p-1 shadow-sm")}
                            </div>
                          </div>
                          <span className="text-sm font-black mb-2 text-center text-slate-900 group-hover:text-inherit">{item.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-200">
                            {getItemPrices(item).price_normal} ريال
                          </span>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setShowCustomItemModal(true)} className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl hover:bg-indigo-50 transition-all active:scale-95"><Plus size={24} className="mb-2"/><span className="text-sm font-black">صنف مخصص</span></button>
                  </>
                )}
              </div>
            </div>
            <div className="lg:col-span-4 bg-white rounded-[2.5rem] p-6 lg:p-7 shadow-sm border border-slate-100 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-2xs">
                    <ShoppingCart size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 leading-tight">تفاصيل الفاتورة</h3>
                    <span className="text-[11px] font-bold text-slate-400">
                      {newOrder.items.reduce((sum, i) => sum + (i.quantity || 1), 0)} قطع في السلة
                    </span>
                  </div>
                </div>
                {newOrder.items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setNewOrder(prev => ({ ...prev, items: [], custom_adjustment: 0, discount_percent: 0 }))}
                    className="text-xs font-bold text-red-500 hover:text-red-700 px-2.5 py-1.5 rounded-xl hover:bg-red-50 transition-colors flex items-center gap-1 active:scale-95"
                    title="تفريغ السلة"
                  >
                    <Trash2 size={13} />
                    <span>تفريغ</span>
                  </button>
                )}
              </div>

              {/* Customer Inputs */}
              <div className="space-y-2.5 mb-4">
                <div className="relative">
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="اسم العميل (اختياري)" 
                    className="w-full pr-10 pl-3 py-3 bg-slate-50/80 border border-slate-200 rounded-xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400" 
                    value={newOrder.customer_name} 
                    onChange={e => setNewOrder({...newOrder, customer_name: e.target.value})} 
                  />
                </div>
                <div className="relative text-left">
                  <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="tel" 
                    placeholder="رقم الواتساب / الجوال" 
                    className="w-full pr-10 pl-3 py-3 bg-slate-50/80 border border-slate-200 rounded-xl outline-none font-bold text-xs text-left text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400" 
                    dir="ltr" 
                    value={newOrder.customer_phone} 
                    onChange={e => setNewOrder({...newOrder, customer_phone: e.target.value})} 
                  />
                </div>
              </div>

              {/* Customer Stats & Subscription Card (When Phone is Entered) */}
              {newOrder.customer_phone && (
                <div className="mb-4 space-y-2.5">
                  {getCustomerStats(newOrder.customer_phone).totalItems > 0 && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Layers size={15} className="text-indigo-600" />
                        <span>سجل العميل:</span>
                        <span className="font-black text-indigo-700 font-mono">{getCustomerStats(newOrder.customer_phone).totalItems} قطعة</span>
                      </div>
                      {getCustomerStats(newOrder.customer_phone).totalItems >= 100 && (
                        <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-md text-[10px] font-black animate-pulse">
                          مؤهل للمكافأة! 🎁
                        </span>
                      )}
                    </div>
                  )}

                  {(() => {
                    const sub = getCustomerSubscription(newOrder.customer_phone);
                    if (sub) {
                      return (
                        <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-xs">
                                <CreditCard size={16} />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-emerald-700 uppercase">اشتراك نشط</p>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-black text-emerald-900 font-mono">{sub.items_remaining}</span>
                                  <span className="text-[10px] font-bold text-emerald-700">/ {sub.total_items} قطعة متبقية</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-left text-[10px] font-bold text-emerald-700">
                              <span>ينتهي: {safeFormatDate(sub.expiry_date)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 p-1 bg-white/80 rounded-xl border border-emerald-200/60 text-xs">
                            <button
                              type="button"
                              onClick={() => setUseSubscription(true)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                                useSubscription 
                                  ? 'bg-emerald-600 text-white shadow-xs' 
                                  : 'text-slate-600 hover:bg-emerald-50'
                              }`}
                            >
                              خصم من الباقة 🟢
                            </button>
                            <button
                              type="button"
                              onClick={() => setUseSubscription(false)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                                !useSubscription 
                                  ? 'bg-slate-800 text-white shadow-xs' 
                                  : 'text-slate-600 hover:bg-emerald-50'
                              }`}
                            >
                              دفع خارجي 💵
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="p-3.5 bg-amber-50/90 rounded-2xl border border-amber-200/70 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-xs">
                              <CreditCard size={16} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-amber-800 uppercase">باقة الاشتراك</p>
                              <p className="text-xs font-black text-amber-900">لا يوجد اشتراك نشط للعميل</p>
                            </div>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowAssignSubModal({ name: newOrder.customer_name || 'عميل جديد', phone: newOrder.customer_phone });
                          }}
                          className="w-full bg-amber-600 hover:bg-amber-700 active:scale-98 text-white py-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <PlusCircle size={14} /> تفعيل باقة اشتراك للعميل
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Order Options & Adjustments */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/70 mb-4 space-y-3">
                {/* Speed Toggle: Normal vs Urgent */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setNewOrder({...newOrder, order_type: 'Normal'})}
                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      newOrder.order_type === 'Normal'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <Clock size={13} />
                    <span>عادي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewOrder({...newOrder, order_type: 'Urgent'})}
                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      newOrder.order_type === 'Urgent'
                        ? 'bg-red-500 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <Zap size={13} />
                    <span>مستعجل 🔥</span>
                  </button>
                </div>

                {/* Quick Action Toggles: Tax & Free */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewOrder({...newOrder, is_tax_enabled: !newOrder.is_tax_enabled})}
                    className={`py-2 px-3 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      newOrder.is_tax_enabled
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Check size={14} className={newOrder.is_tax_enabled ? 'text-indigo-600' : 'opacity-0'} />
                    <span>{newOrder.is_tax_enabled ? 'الضريبة (15%)' : 'بدون ضريبة'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewOrder({...newOrder, is_free: !newOrder.is_free})}
                    className={`py-2 px-3 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      newOrder.is_free
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Gift size={14} className={newOrder.is_free ? 'text-emerald-600' : 'text-slate-400'} />
                    <span>{newOrder.is_free ? 'طلب مجاني ✅' : 'طلب مجاني؟'}</span>
                  </button>
                </div>

                {/* Financial Inputs: Discount % & Financial Adjustment */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-400 pointer-events-none">%</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="خصم %"
                      className="w-full pr-7 pl-2.5 py-2 bg-white border border-slate-200 rounded-xl outline-none font-bold text-xs text-slate-800 focus:border-red-400 focus:ring-1 focus:ring-red-400/20 text-center placeholder:text-slate-400"
                      value={newOrder.discount_percent || ''}
                      onChange={e => setNewOrder({...newOrder, discount_percent: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))})}
                    />
                  </div>
                  <div className="relative">
                    <Banknote size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="number"
                      placeholder="تعديل كامل على قيمة الفاتورة (+/-)"
                      title="تعديل كامل على قيمة الفاتورة (+/-)"
                      className="w-full pr-8 pl-2.5 py-2 bg-white border border-slate-200 rounded-xl outline-none font-bold text-xs text-slate-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 text-center placeholder:text-slate-400 text-ellipsis"
                      value={newOrder.custom_adjustment || ''}
                      onChange={e => setNewOrder({...newOrder, custom_adjustment: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>

              {/* Cart Items List */}
              <div className="space-y-2.5 mb-4">
                {newOrder.items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center border-2 border-dashed border-slate-200/80 rounded-2xl bg-slate-50/50">
                    <div className="w-11 h-11 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-2 shadow-2xs">
                      <ShoppingCart size={20} />
                    </div>
                    <p className="text-xs font-black text-slate-700">السلة فارغة</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">انقر على أي صنف من القائمة لإضافته</p>
                  </div>
                ) : (
                  newOrder.items.map(item => {
                    const itemIcon = item.icon || categories.find(c => c.name === item.name)?.icon;
                    const isPriceEditing = editingCartItemId === item.id;
                    const lineTotal = (item.quantity * item.price).toFixed(2);
                    
                    return (
                      <div key={item.id} className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-indigo-200 transition-all space-y-2.5 group">
                        {/* Top Row: Product Image + Info + Quick Actions (Settings & Remove) */}
                        <div className="flex items-start justify-between gap-2.5">
                          {/* Image and Name & Price */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="shrink-0">
                              {renderCategoryIcon(itemIcon, "w-10 h-10 text-lg flex items-center justify-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden shadow-2xs")}
                            </div>
                            <div className="min-w-0 flex-1 text-right">
                              <h4 className="text-xs font-black text-slate-800 truncate" title={item.name}>{item.name}</h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs font-black text-indigo-600 font-mono">{lineTotal} ر.س</span>
                                {item.quantity > 1 && (
                                  <span className="text-[10px] text-slate-400 font-bold font-mono">({item.price.toFixed(2)} للقطعة)</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Top-end actions: Price Settings & Remove */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditingCartItemId(isPriceEditing ? null : item.id)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                isPriceEditing ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                              }`}
                              title="تعديل السعر يدويًا"
                            >
                              <SlidersHorizontal size={13} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => removeOrderItem(item.id)} 
                              className="w-7 h-7 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center transition-all"
                              title="حذف من السلة"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Bottom Rows: First Quantity Stepper (100%), then Service Mode Selector (100%) */}
                        <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                          {/* 1. Stepper Quantity Controls (100% width, FIRST) */}
                          <div className="w-full flex items-center justify-between bg-slate-100/90 p-1 px-2.5 rounded-xl border border-slate-200/70">
                            <span className="text-[11px] font-black text-slate-500">الكمية</span>
                            <div className="flex items-center gap-2">
                              <button 
                                type="button"
                                onClick={() => updateItemQuantity(item.id, -1)} 
                                className="w-6 h-6 bg-white hover:bg-red-50 text-slate-600 hover:text-red-500 rounded-lg flex items-center justify-center transition-all shadow-2xs active:scale-95"
                                title={item.quantity === 1 ? 'حذف' : 'إنقاص'}
                              >
                                {item.quantity === 1 ? <Trash2 size={12} className="text-red-500" /> : <Minus size={12} />}
                              </button>
                              <span className="w-6 text-center text-xs font-black text-slate-800 font-mono">{item.quantity}</span>
                              <button 
                                type="button"
                                onClick={() => updateItemQuantity(item.id, 1)} 
                                className="w-6 h-6 bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 rounded-lg flex items-center justify-center transition-all shadow-2xs active:scale-95"
                                title="زيادة"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>

                          {/* 2. Service Mode Selector Pills (100% width, SECOND) */}
                          <div className="w-full flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-lg text-[10px]">
                            <button
                              type="button"
                              onClick={() => updateItemMode(item.id, 'عادي')}
                              className={`flex-1 py-1 rounded-md font-black transition-all ${
                                item.is_normal
                                  ? 'bg-slate-700 text-white shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              عادي
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItemMode(item.id, 'مستعجل')}
                              className={`flex-1 py-1 rounded-md font-black transition-all whitespace-nowrap ${
                                (item.is_urgent || item.service_type === 'مستعجل')
                                  ? 'bg-red-500 text-white shadow-2xs'
                                  : 'text-slate-500 hover:text-red-600'
                              }`}
                            >
                              مستعجل 🔥
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItemMode(item.id, 'كوي')}
                              className={`flex-1 py-1 rounded-md font-black transition-all ${
                                item.is_ironing_only
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'text-slate-500 hover:text-indigo-600'
                              }`}
                            >
                              كوي
                            </button>
                          </div>
                        </div>

                        {/* Inline Custom Unit Price (Only visible when toggled via SlidersHorizontal) */}
                        {isPriceEditing && (
                          <div className="p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-100 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <span className="font-bold text-indigo-900 text-[11px]">سعر القطعة المخصص:</span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  className="w-20 px-2 py-1 bg-white border border-indigo-200 rounded-lg text-center font-black text-xs text-indigo-700 outline-none focus:ring-1 focus:ring-indigo-500"
                                  value={item.price}
                                  onChange={e => updateItemUnitPrice(item.id, parseFloat(e.target.value) || 0)}
                                />
                                <span className="text-[10px] font-bold text-indigo-600">ر.س</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Totals & Checkout Panel */}
              <div className="bg-[#1E1B4B] text-white p-6 rounded-[2rem] shadow-xl space-y-4">
                <div className="space-y-2">
                  {newOrder.discount_percent > 0 && (
                    <div className="flex justify-between items-center text-slate-400 text-xs font-bold">
                      <span>المجموع المبدئي:</span>
                      <span className="font-mono">{(newOrder.items.reduce((acc, i) => acc + (i.price * i.quantity), 0) + newOrder.custom_adjustment).toFixed(2)} ر.س</span>
                    </div>
                  )}
                  {newOrder.discount_percent > 0 && (
                    <div className="flex justify-between items-center text-red-400 text-xs font-black">
                      <span>خصم ({newOrder.discount_percent}%):</span>
                      <span className="font-mono">-{((newOrder.items.reduce((acc, i) => acc + (i.price * i.quantity), 0) + newOrder.custom_adjustment) * (newOrder.discount_percent / 100)).toFixed(2)} ر.س</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-300 text-xs font-bold">
                    <span>المجموع الخاضع للضريبة:</span>
                    <span className="font-mono">{currentSubtotal.toFixed(2)} ر.س</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 text-xs font-bold">
                    <span>الضريبة ({newOrder.is_tax_enabled ? '15%' : '0%'}):</span>
                    <span className="font-mono">{currentTax.toFixed(2)} ر.س</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-white/10 pt-3">
                    <div>
                      <span className="text-xs font-bold text-slate-400 block">المبلغ المطلوب</span>
                      <span className="font-black text-lg text-white">الإجمالي النهائي</span>
                    </div>
                    <span className="font-black text-3xl text-emerald-400 font-mono tracking-tight">{currentTotal.toFixed(2)} <span className="text-sm font-bold text-slate-300">ر.س</span></span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button 
                    type="button"
                    onClick={() => setNewOrder({...newOrder, is_paid: !newOrder.is_paid})} 
                    className={`py-2.5 rounded-xl border font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
                      newOrder.is_paid 
                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-sm' 
                        : 'bg-white/10 border-white/15 text-slate-300 hover:bg-white/15'
                    }`}
                  >
                    <Check size={14} className={newOrder.is_paid ? 'opacity-100' : 'opacity-0'} />
                    <span>{newOrder.is_paid ? 'تم السداد ✅' : 'آجل (غير مسدد)'}</span>
                  </button>
                  {newOrder.is_paid ? (
                    <select 
                      className="bg-white/15 border border-white/20 rounded-xl py-2.5 px-3 text-xs font-black text-white outline-none text-right cursor-pointer focus:bg-white/25 transition-all" 
                      value={newOrder.payment_method} 
                      onChange={e => setNewOrder({...newOrder, payment_method: e.target.value as any})}
                    >
                      <option value="Cash" className="text-slate-900">نقدي (كاش)</option>
                      <option value="Card" className="text-slate-900">شبكة (مدى/بطاقة)</option>
                      <option value="Transfer" className="text-slate-900">تحويل بنكي</option>
                      {getCustomerSubscription(newOrder.customer_phone) && useSubscription && (
                        <option value="Subscription" className="text-slate-900">خصم من باقة الاشتراك</option>
                      )}
                    </select>
                  ) : (
                    <div className="flex items-center justify-center py-2 px-3 text-[11px] font-bold text-amber-300/80 bg-amber-500/10 rounded-xl border border-amber-500/20">
                      سيُسجل كطلب آجل
                    </div>
                  )}
                </div>

                <button 
                  disabled={loading || (newOrder.items.length === 0 && newOrder.custom_adjustment === 0)} 
                  onClick={handleCreateOrder} 
                  className="w-full bg-white text-indigo-950 py-3.5 rounded-2xl font-black text-base hover:bg-indigo-50 active:scale-98 transition-all flex items-center justify-center gap-2.5 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <><Printer size={20} className="text-indigo-600" /> حفظ وطباعة الفاتورة</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (() => {
          const ORDERS_PER_PAGE = 30;
          const ordersTotalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
          const safeOrdersPage = Math.min(Math.max(1, ordersCurrentPage), ordersTotalPages);
          const ordersStartIndex = (safeOrdersPage - 1) * ORDERS_PER_PAGE;
          const paginatedOrders = filteredOrders.slice(ordersStartIndex, ordersStartIndex + ORDERS_PER_PAGE);

          return (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3 bg-white border border-slate-200 p-2.5 rounded-2xl shadow-xs">
                     <Filter size={16} className="text-slate-400 mr-1" />
                     <select className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                        <option value="all">كل الحالات</option>{Object.entries(statusArabic).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                     </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQRScannerModal(true)}
                    className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2.5 rounded-2xl text-xs font-black transition-all active:scale-95 shadow-xs cursor-pointer"
                    title="مسح باركود / QR الفاتورة لتجهيز الطلب"
                  >
                    <div className="relative w-4 h-4 flex items-center justify-center text-indigo-600 pointer-events-none">
                      <Scan size={16} strokeWidth={2.2} />
                      <Barcode size={10} strokeWidth={2.4} className="absolute inset-0 m-auto" />
                    </div>
                    <span>مسح باركود / QR الفاتورة</span>
                  </button>
                </div>

                <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-xs">
                  {['all', '1h', '24h', '48h'].map(f => (
                    <button key={f} onClick={() => setTimeFilter(f as any)} className={`px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${timeFilter === f ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{f === 'all' ? 'الكل' : `+${f}`}</button>
                  ))}
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 p-8 space-y-3">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <Package size={32} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">لا توجد طلبات تطابق الفلتر المحدد</h3>
                  <p className="text-xs text-slate-400 font-bold">جرّب اختيار حالة أخرى أو تغيير الفلتر الزمني</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedOrders.map(order => (
                      <div key={order.id} className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-7 hover:border-indigo-100 transition-all group">
                         <div className="flex justify-between items-center mb-4">
                           <div className="flex items-center gap-1.5">
                             <span className="text-[10px] font-mono bg-slate-50 px-2 py-1 rounded">#{order.order_number}</span>
                             <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{(order.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0)} قطعة</span>
                           </div>
                           <span className={`px-3 py-1 rounded-full text-[10px] font-black ${order.order_type === 'Urgent' ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>{order.order_type === 'Urgent' ? 'مستعجل 🔥' : 'عادي'}</span>
                         </div>
                         <h4 className="font-black text-xl mb-1">{order.customer_name}</h4>
                         <p className="text-sm font-bold text-indigo-500 mb-5">{order.customer_phone}</p>
                         <div className="grid grid-cols-2 gap-3 mb-6 p-4 bg-slate-50 rounded-3xl border">
                            <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">الحالة</p><select className="w-full bg-transparent font-black text-indigo-700 text-xs outline-none" value={order.status} onChange={e => updateOrderStatus(order.id, e.target.value as any)}>{Object.entries(statusArabic).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                            <div className="text-left border-r pr-3 border-slate-200"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">الإجمالي</p><p className={`text-sm font-black ${order.is_paid ? 'text-emerald-600' : 'text-red-500'}`}>{order.total.toFixed(2)} ر.س</p></div>
                         </div>
                          {getCustomerSubscription(order.customer_phone) && (
                            <div className="mb-6 p-4 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CreditCard size={16} className="text-emerald-600" />
                                <div>
                                  <p className="text-[9px] font-black text-slate-400 uppercase">الرصيد المتبقي</p>
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-black text-emerald-700">{getCustomerSubscription(order.customer_phone)?.items_remaining}</span>
                                    <span className="text-[10px] font-bold text-emerald-600">قطعة</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-left">
                                <p className="text-[9px] font-black text-slate-400 uppercase">المنتهي في</p>
                                <p className="text-[10px] font-bold text-emerald-600">{safeFormatDate(getCustomerSubscription(order.customer_phone)?.expiry_date)}</p>
                              </div>
                            </div>
                          )}
                          {order.payment_method === 'Free' && (
                            <div className="mb-4 px-4 py-2 bg-emerald-500 text-white rounded-xl text-center text-xs font-black shadow-sm">
                              هذا الطلب مجاني 🎁
                            </div>
                          )}
                          <div className="grid grid-cols-4 gap-2">
                             <button onClick={(e) => { e.stopPropagation(); setShowPrintModal(order); }} className="p-3 bg-white border rounded-xl flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all" title="طباعة"><Printer size={18} className="pointer-events-none" /></button>
                             <button 
                               disabled={sendingMessageIds.has(order.id)}
                               onClick={(e) => { e.stopPropagation(); sendWhatsAppReminder(order, 'READY'); }} 
                               className="p-3 bg-white border rounded-xl flex items-center justify-center text-slate-500 hover:text-emerald-600 transition-all disabled:opacity-50" 
                               title="واتساب"
                             >
                               {sendingMessageIds.has(order.id) ? (
                                 <Loader2 size={18} className="animate-spin text-emerald-600 pointer-events-none" />
                               ) : (
                                 <Send size={18} className="pointer-events-none" />
                               )}
                             </button>
                             <button onClick={(e) => { e.stopPropagation(); setShowEditOrderModal(order); setOriginalOrder(JSON.parse(JSON.stringify(order))); }} className="p-3 bg-white border rounded-xl flex items-center justify-center text-slate-500 hover:text-blue-600 transition-all" title="تعديل"><Edit3 size={18} className="pointer-events-none" /></button>
                             {userProfile && (
                              <button 
                                disabled={deletingOrderId === order.id}
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  console.log("Setting order to delete:", order.order_number);
                                  setOrderToDelete(order);
                                }} 
                                className="p-3 bg-white border rounded-xl flex items-center justify-center text-slate-500 hover:text-red-600 transition-all disabled:opacity-50" 
                                title="حذف"
                              >
                                {deletingOrderId === order.id ? <Loader2 size={18} className="animate-spin pointer-events-none" /> : <Trash2 size={18} className="pointer-events-none" />}
                              </button>
                             )}
                             <button onClick={(e) => {
                               e.stopPropagation();
                               setNewOrder({
                                 customer_name: order.customer_name,
                                 customer_phone: order.customer_phone,
                                 order_type: 'Normal',
                                 items: [],
                                 is_paid: false,
                                 payment_method: 'Cash',
                                 custom_adjustment: 0,
                                 is_free: false,
                                 is_tax_enabled: true,
                                 discount_percent: 0
                               });
                               setActiveTab('new-order');
                             }} className="p-3 bg-white border rounded-xl flex items-center justify-center text-slate-500 hover:text-orange-600 transition-all" title="طلب جديد"><PlusCircle size={18} className="pointer-events-none" /></button>
                             <button onClick={(e) => { e.stopPropagation(); setShowAssignSubModal({ name: order.customer_name, phone: order.customer_phone }); }} className="p-3 bg-white border rounded-xl flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all" title="تفعيل اشتراك"><CreditCard size={18} className="pointer-events-none" /></button>
                             <button onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'Delivered'); }} className="col-span-2 p-3 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all gap-2 text-xs font-black"><CheckCircle size={18} className="pointer-events-none" /> تسليم</button>
                          </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Bar for Orders */}
                  <PaginationBar
                    currentPage={safeOrdersPage}
                    totalItems={filteredOrders.length}
                    pageSize={ORDERS_PER_PAGE}
                    onPageChange={(p) => setOrdersCurrentPage(p)}
                    itemLabel="طلب"
                    className="mt-6"
                  />
                </>
              )}
            </div>
          );
        })()}

        {activeTab === 'subscriptions' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl">
                    <CreditCard size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">الاشتراكات الشهرية المقدمة</h3>
                    <p className="text-slate-400 font-bold text-sm">إدارة باقات العملاء المسبقة الدفع</p>
                  </div>
                </div>
                <button onClick={() => { setEditingPackageId(null); setPackageForm({ name: '', total_items: '', price: '', duration_days: 30, discount_percent: '', isUnlimitedDays: false }); setShowPackageModal(true); }} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 shadow-lg shadow-indigo-100">
                  <PlusCircle size={20} /> إنشاء باقة جديدة
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subscriptionPackages.map(pkg => (
                  <div key={pkg.id} className="bg-indigo-900 text-white rounded-[2rem] p-8 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full -mr-12 -mt-12 group-hover:scale-150 transition-all"></div>
                    <h4 className="text-lg font-black mb-1">{pkg.name}</h4>
                    <p className="text-indigo-300 text-xs mb-6">
                      {pkg.total_items} قطعة / {pkg.duration_days === 0 || pkg.duration_days >= 36500 ? 'لا محدود' : `${pkg.duration_days} يوم`}
                    </p>
                    <div className="flex items-end gap-1.5 mb-8">
                      <span className="text-4xl font-black">{pkg.price === 0 ? '0' : pkg.price}</span>
                      <span className="text-sm font-bold opacity-60 mb-1">{pkg.price === 0 ? 'ريال (مجاني)' : 'ريال'}</span>
                    </div>
                    <ul className="space-y-3 mb-8 text-sm font-medium">
                      <li className="flex items-center gap-2"><Check size={16} className="text-indigo-400" /> غسيل وكي</li>
                      <li className="flex items-center gap-2">
                        <Check size={16} className="text-indigo-400" /> 
                        صالحة لمدة: <strong>{pkg.duration_days === 0 || pkg.duration_days >= 36500 ? 'غير محدودة (لا تنتهي)' : `${pkg.duration_days} يوم`}</strong>
                      </li>
                      {pkg.discount_percent !== undefined && pkg.discount_percent > 0 && (
                        <li className="flex items-center gap-2 text-emerald-300 font-bold"><Check size={16} className="text-emerald-300" /> خصم إضافي {pkg.discount_percent}% للطلبات</li>
                      )}
                    </ul>
                    <div className="flex justify-between items-center gap-3 mt-6 pt-4 border-t border-white/10 relative z-10">
                      <button 
                        onClick={() => handleStartEditPackage(pkg)} 
                        className="flex-1 py-2 px-3 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5"
                      >
                        <Edit2 size={12} /> تعديل
                      </button>
                      <button 
                        onClick={() => handleDeletePackage(pkg.id)} 
                        className="flex-1 py-2 px-3 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5"
                      >
                        <Trash2 size={12} /> حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {subscriptions.length > 0 && (
              <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
                <h3 className="text-xl font-black mb-8">العملاء المشتركين حالياً</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 font-black text-slate-400 text-sm">العميل</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">الباقة</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">الرصيد المتبقي</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">تاريخ الانتهاء</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {subscriptions.map(sub => {
                        const pkg = subscriptionPackages.find(p => p.id === sub.package_id);
                        const isExpired = sub.expiry_date && !isNaN(new Date(sub.expiry_date).getTime()) ? new Date(sub.expiry_date) < new Date() : true;
                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/50 transition-all">
                            <td className="py-6">
                              <p className="font-black text-slate-800">{sub.customer_name}</p>
                              <p className="text-xs text-slate-400">{sub.customer_phone}</p>
                            </td>
                            <td className="py-6 font-bold text-indigo-600">{pkg?.name || 'باقة محذوفة'}</td>
                            <td className="py-6">
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden max-w-[100px]">
                                  <div 
                                    className="bg-emerald-500 h-full" 
                                    style={{ width: `${(sub.items_remaining / sub.total_items) * 100}%` }}
                                  ></div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number" 
                                    className="w-12 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs font-black text-center"
                                    value={sub.items_remaining}
                                    onChange={(e) => updateSubscriptionBalance(sub.id, parseInt(e.target.value) || 0)}
                                  />
                                  <span className="text-xs font-bold text-slate-400">/ {sub.total_items}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-6 text-sm font-bold text-slate-500">
                              {safeFormatDate(sub.expiry_date)}
                            </td>
                            <td className="py-6">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                                !isExpired && sub.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {!isExpired && sub.is_active ? 'نشط' : 'منتهي'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-6 animate-in zoom-in-95 duration-500">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
               <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10">
                 <div>
                   <h3 className="text-xl font-black">المواد الاستهلاكية</h3>
                   <p className="text-slate-400 text-sm font-bold">إدارة المخزون والمواد المستخدمة</p>
                 </div>
                 <div className="flex items-center gap-3 w-full md:w-auto">
                   <div className="relative flex-1 md:w-64">
                     <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                     <input 
                       type="text" 
                       placeholder="بحث في المخزون..." 
                       className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                     />
                   </div>
                   <button onClick={fetchData} className="p-3 bg-slate-50 text-slate-500 rounded-2xl hover:text-indigo-600 transition-all">
                     <Repeat size={20} />
                   </button>
                   <button onClick={() => setIsInvModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">
                     <Plus size={18} /> إضافة مادة
                   </button>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {inventory
                   .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                   .map(item => (
                    <div key={item.id} className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-8 hover:border-indigo-100 transition-all group">
                       <div className="flex justify-between items-center mb-6">
                         <div className={`p-4 rounded-2xl transition-all ${item.stock <= item.threshold ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-600'}`}>
                           <Layers size={24} />
                         </div>
                         <div className="flex gap-2">
                           <button onClick={(e) => { e.stopPropagation(); handleDeleteInventoryItem(item.id, item.name); }} className="p-2 text-slate-300 hover:text-red-500 transition-all">
                             <Trash2 size={18} />
                           </button>
                         </div>
                       </div>
                       <h4 className="text-lg font-black text-slate-800 mb-1">{item.name}</h4>
                       <div className="flex items-baseline justify-between gap-2 mb-4">
                         <button 
                           type="button"
                           onClick={() => {
                             setCustomStockModalItem(item);
                             setCustomStockAmount('100');
                             setCustomStockMode('add');
                           }}
                           className="group/stock flex items-baseline gap-2 text-right hover:opacity-85 transition-all cursor-pointer"
                           title="انقر لإضافة كمية مخصصة أو تعديل الرصيد"
                         >
                           <p className={`text-4xl font-black ${item.stock <= item.threshold ? 'text-red-500' : 'text-indigo-600'}`}>{item.stock}</p>
                           <span className="text-sm font-bold text-slate-400">{item.unit}</span>
                           <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg opacity-0 group-hover/stock:opacity-100 transition-all">
                             تعديل ⚡
                           </span>
                         </button>
                       </div>
                       
                       {item.stock <= item.threshold && (
                         <div className="flex items-center gap-2 text-red-500 text-[10px] font-black uppercase tracking-wider mb-4 bg-red-50 w-fit px-3 py-1 rounded-full">
                           <AlertTriangle size={12} /> مخزون منخفض
                         </div>
                      )}

                      {/* Action Buttons */}
                      <div className="space-y-2.5">
                        <button 
                          onClick={() => {
                            setCustomStockModalItem(item);
                            setCustomStockAmount('100');
                            setCustomStockMode('add');
                          }} 
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                          title="إدخال أو تعديل كمية مخصصة"
                        >
                          <SlidersHorizontal size={14} />
                          <span>تعديل / كمية مخصصة</span>
                        </button>

                        {/* Quick addition chips */}
                        <div className="flex items-center justify-between bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-black text-slate-400">إضافة سريعة:</span>
                          <div className="flex items-center gap-1">
                            {[10, 50, 100].map(val => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleUpdateStock(item.id, val)}
                                className="px-2 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg text-[10px] font-black transition-all active:scale-95 shadow-2xs"
                                title={`إضافة ${val} ${item.unit} بنقرة واحدة`}
                              >
                                +{val}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setEditingInvConsumptionItem(item)} 
                        className="w-full mt-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <Settings2 size={14} /> ربط المادة بالأصناف الاستهلاكية
                      </button>
                    </div>
                  ))}
               </div>
               
               {inventory.length === 0 && !loading && (
                 <div className="text-center py-20">
                   <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                     <Package size={40} />
                   </div>
                   <h3 className="text-xl font-black text-slate-800 mb-2">لا يوجد مواد في المخزون</h3>
                   <p className="text-slate-400 font-bold">ابدأ بإضافة المواد الاستهلاكية التي تستخدمها في المغسلة</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-6 sm:space-y-8 animate-in slide-in-from-bottom-4 duration-500 text-right max-w-[1400px] mx-auto" dir="rtl">
            
            {/* 1. Page Header & Actions Bar */}
            <div className="bg-white rounded-[2rem] p-5 sm:p-7 shadow-xs border border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                    <Wallet size={22} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800">
                      {isFinancePendingOnlyUser ? 'متابعة المبالغ المعلقة والذمم' : 'المالية وكشوفات الحسابات'}
                    </h2>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">
                      {isFinancePendingOnlyUser 
                        ? 'متابعة مبيعات وحسابات العملاء وتصفية المبالغ المعلقة غير المحصلة' 
                        : 'متابعة الإيرادات المحصلة، الضرائب، طرق الدفع، والذمم وحسابات العملاء'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-end md:self-auto">
                {/* Reset Filters button if any filter active */}
                {(financeFromDate || financeToDate || financeSelectedClientPhone !== 'all' || financePendingFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setFinanceFromDate('');
                      setFinanceToDate('');
                      setFinanceSelectedClientPhone('all');
                      setFinancePendingFilter('all');
                    }}
                    className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/60 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>✕</span>
                    إعادة تعيين الفلاتر
                  </button>
                )}

                <button
                  onClick={downloadGeneralExcel}
                  className="py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet size={16} />
                  تصدير إكسل 📥
                </button>

                <button
                  onClick={downloadGeneralPDF}
                  className="py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <FileText size={16} />
                  تقرير PDF 📄
                </button>
              </div>
            </div>

            {/* 2. Interactive Filter Bar with Quick Presets */}
            <div className="bg-white rounded-[2rem] p-5 sm:p-7 shadow-xs border border-slate-100 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <Filter className={isFinancePendingOnlyUser ? "text-amber-600" : "text-indigo-600"} size={20} />
                  <span className="text-sm font-black text-slate-800">تصفية وتحديد فترة التقرير</span>
                  {(financeFromDate || financeToDate || financeSelectedClientPhone !== 'all' || financePendingFilter !== 'all') && (
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[10px] font-black px-2 py-0.5 rounded-full">
                      تصفية نشطة
                    </span>
                  )}
                </div>

                {/* Quick Period Presets */}
                {!isFinancePendingOnlyUser && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-400 ml-1">فترات سريعة:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setFinanceFromDate(today);
                        setFinanceToDate(today);
                      }}
                      className="px-3 py-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-xs font-bold rounded-lg border border-slate-200/80 transition-all cursor-pointer"
                    >
                      اليوم
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const today = now.toISOString().split('T')[0];
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        setFinanceFromDate(weekAgo);
                        setFinanceToDate(today);
                      }}
                      className="px-3 py-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-xs font-bold rounded-lg border border-slate-200/80 transition-all cursor-pointer"
                    >
                      آخر 7 أيام
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const today = now.toISOString().split('T')[0];
                        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                        setFinanceFromDate(startOfMonth);
                        setFinanceToDate(today);
                      }}
                      className="px-3 py-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-xs font-bold rounded-lg border border-slate-200/80 transition-all cursor-pointer"
                    >
                      هذا الشهر
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFinanceFromDate('');
                        setFinanceToDate('');
                      }}
                      className="px-3 py-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-xs font-bold rounded-lg border border-slate-200/80 transition-all cursor-pointer"
                    >
                      الكل
                    </button>
                  </div>
                )}
              </div>

              {/* Filter Form Controls */}
              {isFinancePendingOnlyUser ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <span>حالة المبالغ المعلقة</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">فلتر نشط</span>
                    </label>
                    <select
                      value={financePendingFilter}
                      onChange={(e) => setFinancePendingFilter(e.target.value as any)}
                      className="w-full px-4 py-3 bg-amber-50/40 border border-amber-300 rounded-xl outline-none font-bold text-sm text-right focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-amber-950"
                    >
                      <option value="all">جميع الحالات (الكل)</option>
                      <option value="has_pending">عملاء لديهم مبالغ معلقة 🔴</option>
                      <option value="no_pending">عملاء بدون مبالغ معلقة 🟢</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-600 block">اختر العميل المستهدف</label>
                    <select
                      value={financeSelectedClientPhone}
                      onChange={(e) => setFinanceSelectedClientPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-right focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-700"
                    >
                      <option value="all">جميع العملاء ({uniqueClients.length} عميل)</option>
                      {uniqueClients.map(c => (
                        <option key={c.phone} value={c.phone}>
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-600 flex items-center gap-1">
                      <Calendar size={13} className="text-slate-400" />
                      <span>من تاريخ</span>
                    </label>
                    <input
                      type="date"
                      value={financeFromDate}
                      onChange={(e) => setFinanceFromDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-right focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-600 flex items-center gap-1">
                      <Calendar size={13} className="text-slate-400" />
                      <span>إلى تاريخ</span>
                    </label>
                    <input
                      type="date"
                      value={financeToDate}
                      onChange={(e) => setFinanceToDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-right focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-600 flex items-center gap-1">
                      <User size={13} className="text-slate-400" />
                      <span>العميل المستهدف</span>
                    </label>
                    <select
                      value={financeSelectedClientPhone}
                      onChange={(e) => setFinanceSelectedClientPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-right focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-700"
                    >
                      <option value="all">جميع العملاء ({uniqueClients.length} عميل)</option>
                      {uniqueClients.map(c => (
                        <option key={c.phone} value={c.phone}>
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-600 flex items-center gap-1">
                      <Wallet size={13} className="text-slate-400" />
                      <span>حالة التحصيل والديون</span>
                    </label>
                    <select
                      value={financePendingFilter}
                      onChange={(e) => setFinancePendingFilter(e.target.value as any)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-right focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-700"
                    >
                      <option value="all">جميع الحالات (الكل)</option>
                      <option value="has_pending">عملاء لديهم مبالغ معلقة 🔴</option>
                      <option value="no_pending">عملاء بدون مبالغ معلقة 🟢</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Executive Financial KPI Cards (4 Cards Grid, 25% each on desktop) */}
            {!isFinancePendingOnlyUser && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {/* KPI 1: المبيعات المحصلة */}
                <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-emerald-200/70 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[200px] group hover:shadow-md transition-all">
                  <div className="w-full space-y-2.5">
                    <div className="w-full flex items-center justify-between">
                      <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <Banknote size={22} className="stroke-[2.5]" />
                      </div>
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-full text-xs font-black">
                        {formatInteger(financeStats.paidOrdersCount)} طلب مدفوع
                      </span>
                    </div>

                    <div className="w-full pt-1">
                      <span className="text-sm font-black text-slate-800 block">المبيعات المحصلة</span>
                      <span className="text-xs text-slate-400 font-medium block mt-0.5">المدفوعة في الصندوق والخزينة</span>
                    </div>

                    <div className="pt-1">
                      <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-600">
                        {formatMoney(financeStats.totalRevenue)} <span className="text-sm sm:text-base font-bold text-slate-500">ر.س</span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-bold mt-3">
                    <span>صافي المبيعات بدون الضريبة:</span>
                    <span className="font-mono text-slate-700 font-black">{formatMoney(Math.max(0, financeStats.totalRevenue - financeStats.taxTotal))} ر.س</span>
                  </div>
                </div>

                {/* KPI 2: المبالغ المعلقة غير المحصلة */}
                <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-amber-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[200px] group hover:shadow-md transition-all">
                  <div className="w-full space-y-2.5">
                    <div className="w-full flex items-center justify-between">
                      <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <Clock size={22} className="stroke-[2.5]" />
                      </div>
                      <span className="bg-amber-50 text-amber-700 border border-amber-200/60 px-2.5 py-1 rounded-full text-xs font-black">
                        {formatInteger(financeStats.pendingOrdersCount)} غير مسدد
                      </span>
                    </div>

                    <div className="w-full pt-1">
                      <span className="text-sm font-black text-slate-800 block">المبالغ المعلقة غير المحصلة</span>
                      <span className="text-xs text-slate-400 font-medium block mt-0.5">فواتير مستحقة بانتظار سداد العملاء</span>
                    </div>

                    <div className="pt-1">
                      <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-600">
                        {formatMoney(financeStats.pendingAmount)} <span className="text-sm sm:text-base font-bold text-slate-500">ر.س</span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-bold mt-3">
                    <span>حالة الذمم:</span>
                    <span className="text-amber-600 font-black">
                      {financeStats.pendingAmount > 0 ? 'تتطلب متابعة التحصيل' : 'لا توجد معلقات للفترة'}
                    </span>
                  </div>
                </div>

                {/* KPI 3: الضريبة المحصلة (15%) */}
                <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-indigo-100 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[200px] group hover:shadow-md transition-all">
                  <div className="w-full space-y-2.5">
                    <div className="w-full flex items-center justify-between">
                      <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <Layers size={22} className="stroke-[2.5]" />
                      </div>
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-full text-xs font-black">
                        15% الضريبة النظامية
                      </span>
                    </div>

                    <div className="w-full pt-1">
                      <span className="text-sm font-black text-slate-800 block">الضريبة المحصلة (15%)</span>
                      <span className="text-xs text-slate-400 font-medium block mt-0.5">ضريبة القيمة المضافة المحصلة</span>
                    </div>

                    <div className="pt-1">
                      <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-indigo-600">
                        {formatMoney(financeStats.taxTotal)} <span className="text-sm sm:text-base font-bold text-slate-500">ر.س</span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-bold mt-3">
                    <span>الفواتير المشمولة بالضريبة:</span>
                    <span className="font-mono text-slate-700 font-black">{formatInteger(financeStats.paidOrdersCount)} فاتورة</span>
                  </div>
                </div>

                {/* KPI 4: إجمالي الفواتير ومعدل التحصيل */}
                <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-100 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[200px] group hover:shadow-md transition-all">
                  <div className="w-full space-y-2.5">
                    <div className="w-full flex items-center justify-between">
                      <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <CheckCircle size={22} className="stroke-[2.5]" />
                      </div>
                      {(() => {
                        const rate = financeStats.totalOrdersCount > 0 
                          ? Math.round((financeStats.paidOrdersCount / financeStats.totalOrdersCount) * 100) 
                          : 0;
                        return (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200/60 px-2.5 py-1 rounded-full text-xs font-black">
                            {rate}% نسبة التحصيل
                          </span>
                        );
                      })()}
                    </div>

                    <div className="w-full pt-1">
                      <span className="text-sm font-black text-slate-800 block">إجمالي طلبات الفترة</span>
                      <span className="text-xs text-slate-400 font-medium block mt-0.5">سجل حركة الفواتير المعتمدة</span>
                    </div>

                    <div className="pt-1">
                      <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900">
                        {formatInteger(financeStats.totalOrdersCount)} <span className="text-sm sm:text-base font-bold text-slate-500">طلب</span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-bold mt-3">
                    <span className="text-emerald-600 font-black">{formatInteger(financeStats.paidOrdersCount)} مدفوع</span>
                    <span className="text-amber-600 font-black">{formatInteger(financeStats.pendingOrdersCount)} معلق</span>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Payment Method Distribution & Treasury Overview */}
            {!isFinancePendingOnlyUser && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Payment Methods Card (Takes 2 cols on lg) */}
                <div className="lg:col-span-2 bg-white rounded-[2rem] p-6 sm:p-7 shadow-xs border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-5">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-800">توزيع مبيعات طرق الدفع المحصلة</h3>
                          <p className="text-[11px] font-bold text-slate-400">إجمالي المبالغ المستلمة فعلياً حسب القناة</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-black text-slate-700 bg-slate-50 px-3 py-1 rounded-xl border border-slate-100">
                        {formatMoney(financeStats.totalRevenue)} ر.س
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Cash Card */}
                      {(() => {
                        const cashPct = financeStats.totalRevenue > 0 
                          ? Math.round((financeStats.cashRevenue / financeStats.totalRevenue) * 100) 
                          : 0;
                        return (
                          <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100/80 flex flex-col justify-between space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                                <span>💵</span>
                                <span>نقدي (كاش)</span>
                              </span>
                              <span className="text-[11px] font-black text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                                {cashPct}%
                              </span>
                            </div>
                            <div>
                              <p className="text-xl font-black font-mono text-emerald-700">
                                {formatMoney(financeStats.cashRevenue)} <span className="text-xs font-bold">ر.س</span>
                              </p>
                            </div>
                            <div className="w-full bg-emerald-100/60 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${cashPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Card / Mada */}
                      {(() => {
                        const cardPct = financeStats.totalRevenue > 0 
                          ? Math.round((financeStats.cardRevenue / financeStats.totalRevenue) * 100) 
                          : 0;
                        return (
                          <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-100/80 flex flex-col justify-between space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                                <span>💳</span>
                                <span>شبكة / مدى</span>
                              </span>
                              <span className="text-[11px] font-black text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded-md">
                                {cardPct}%
                              </span>
                            </div>
                            <div>
                              <p className="text-xl font-black font-mono text-blue-700">
                                {formatMoney(financeStats.cardRevenue)} <span className="text-xs font-bold">ر.س</span>
                              </p>
                            </div>
                            <div className="w-full bg-blue-100/60 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${cardPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Bank Transfer */}
                      {(() => {
                        const transferPct = financeStats.totalRevenue > 0 
                          ? Math.round((financeStats.transferRevenue / financeStats.totalRevenue) * 100) 
                          : 0;
                        return (
                          <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100/80 flex flex-col justify-between space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                                <span>🏦</span>
                                <span>تحويل بنكي</span>
                              </span>
                              <span className="text-[11px] font-black text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded-md">
                                {transferPct}%
                              </span>
                            </div>
                            <div>
                              <p className="text-xl font-black font-mono text-indigo-700">
                                {formatMoney(financeStats.transferRevenue)} <span className="text-xs font-bold">ر.س</span>
                              </p>
                            </div>
                            <div className="w-full bg-indigo-100/60 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${transferPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-bold">
                    <span>* تمثل المبالغ الإجمالية المحصلة شاملة ضريبة القيمة المضافة</span>
                    <span className="text-slate-600 font-black">3 قنوات دفع نشطة</span>
                  </div>
                </div>

                {/* Treasury & Collection Digest Card (Takes 1 col) */}
                <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-[2rem] p-6 sm:p-7 shadow-lg shadow-indigo-950/20 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-indigo-200">
                          <Wallet size={18} />
                        </div>
                        <h3 className="text-base font-black text-white">خلاصة الخزينة والفترة</h3>
                      </div>
                      <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-400/20">
                        محدث فورياً
                      </span>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-xs font-bold text-slate-300">إجمالي المبيعات مع المعلق:</span>
                        <span className="text-sm font-black font-mono text-white">
                          {formatMoney(financeStats.totalRevenue + financeStats.pendingAmount)} ر.س
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-xs font-bold text-emerald-300">المحصل في الصندوق:</span>
                        <span className="text-sm font-black font-mono text-emerald-400">
                          {formatMoney(financeStats.totalRevenue)} ر.س
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-xs font-bold text-amber-300">الذمم بانتظار التحصيل:</span>
                        <span className="text-sm font-black font-mono text-amber-400">
                          {formatMoney(financeStats.pendingAmount)} ر.س
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-slate-400 font-medium">
                    تتأثر هذه الإحصائيات فوراً بالفلاتر الزمنية واختيارات العملاء بالأعلى.
                  </div>
                </div>

              </div>
            )}

            {/* 5. Client Accounts & Sales Ledger */}
            <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-xs border border-slate-100 space-y-6">
              <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                      <User size={20} className="stroke-[2.5]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800">
                        كشوفات وإحصائيات مبيعات العملاء
                      </h3>
                      <p className="text-xs font-bold text-slate-400 mt-0.5">
                        سجل كل عميل، فواتير المبيعات، المبالغ المحصلة، والذمم المعلقة مع تصفح 30 عنصراً بكل صفحة
                      </p>
                    </div>
                  </div>
                </div>

                {/* View Switcher & Search Input */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                  {/* View Mode Toggle: Orders vs Clients */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => setFinanceSalesViewMode('orders')}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                        financeSalesViewMode === 'orders'
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Receipt size={14} />
                      <span>سجل الفواتير والطلبات</span>
                      <span className="font-mono text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full mr-1 font-bold">
                        {filteredFinanceOrders.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinanceSalesViewMode('clients')}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                        financeSalesViewMode === 'clients'
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Users size={14} />
                      <span>كشوفات حسابات العملاء</span>
                      <span className="font-mono text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full mr-1 font-bold">
                        {financeStats.clientList.length}
                      </span>
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:w-72">
                    <input
                      type="text"
                      placeholder={financeSalesViewMode === 'orders' ? "ابحث باسم العميل، الهاتف، أو رقم الفاتورة..." : "ابحث عن العميل بالاسم أو رقم الجوال..."}
                      value={financeClientSearch}
                      onChange={(e) => setFinanceClientSearch(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs text-right transition-all focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500"
                    />
                    <Search size={16} className="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400" />
                    {financeClientSearch && (
                      <button
                        onClick={() => setFinanceClientSearch('')}
                        className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* VIEW 1: Sales Orders Table (Paginated 30 items) */}
              {financeSalesViewMode === 'orders' && (() => {
                const searchedOrders = filteredFinanceOrders.filter(o => {
                  if (financePendingFilter === 'has_pending' && o.is_paid) return false;
                  if (financePendingFilter === 'no_pending' && !o.is_paid) return false;
                  if (!financeClientSearch.trim()) return true;
                  const query = financeClientSearch.toLowerCase();
                  return (
                    (o.customer_name && o.customer_name.toLowerCase().includes(query)) ||
                    (o.customer_phone && o.customer_phone.includes(query)) ||
                    (o.order_number && o.order_number.toLowerCase().includes(query))
                  );
                });

                if (searchedOrders.length === 0) {
                  return (
                    <div className="text-center py-16 text-slate-400 font-bold bg-slate-50/50 rounded-2xl p-6 space-y-3">
                      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <Receipt size={24} />
                      </div>
                      <p className="text-sm font-black text-slate-600">لا توجد فواتير مبيعات تطابق فلاتر البحث الحالية</p>
                      <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                        جرّب تعديل الكلمات المدخلة في البحث أو إعادة ضبط فلاتر التاريخ والعملاء بالأعلى.
                      </p>
                    </div>
                  );
                }

                const FINANCE_ORDERS_PER_PAGE = 30;
                const totalPages = Math.max(1, Math.ceil(searchedOrders.length / FINANCE_ORDERS_PER_PAGE));
                const safePage = Math.min(Math.max(1, financeOrdersCurrentPage), totalPages);
                const startIdx = (safePage - 1) * FINANCE_ORDERS_PER_PAGE;
                const paginatedOrders = searchedOrders.slice(startIdx, startIdx + FINANCE_ORDERS_PER_PAGE);

                return (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500 px-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-indigo-700">سجل فواتير المبيعات:</span>
                        <span className="bg-indigo-50 border border-indigo-100 text-indigo-800 font-mono px-2 py-0.5 rounded-lg text-xs">
                          {startIdx + 1} - {Math.min(startIdx + FINANCE_ORDERS_PER_PAGE, searchedOrders.length)} من {searchedOrders.length} طلب
                        </span>
                      </div>
                      <span className="text-slate-400">مرتب من الأحدث إلى الأقدم (30 طلب بكل صفحة)</span>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-slate-100">
                      <table className="w-full text-right divide-y divide-slate-100">
                        <thead className="bg-slate-50/80">
                          <tr className="text-slate-500 text-[11px] font-black">
                            <th className="py-3.5 px-4 font-black">رقم الفاتورة</th>
                            <th className="py-3.5 px-4 font-black">العميل</th>
                            <th className="py-3.5 px-4 font-black text-center">التاريخ والوقت</th>
                            <th className="py-3.5 px-4 font-black text-center">القطع</th>
                            <th className="py-3.5 px-4 font-black text-center">الإجمالي</th>
                            <th className="py-3.5 px-4 font-black text-center">السداد</th>
                            <th className="py-3.5 px-4 font-black text-center">طريقة الدفع</th>
                            <th className="py-3.5 px-4 font-black text-center">الحالة</th>
                            <th className="py-3.5 px-4 font-black text-left pl-6">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/70 bg-white">
                          {paginatedOrders.map((order) => {
                            const itemCount = (order.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
                            return (
                              <tr key={order.id} className="hover:bg-slate-50/60 transition-all font-bold">
                                {/* Order Number */}
                                <td className="py-3.5 px-4">
                                  <span className="font-mono text-xs font-black bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/60 inline-block">
                                    #{order.order_number}
                                  </span>
                                  {order.order_type === 'Urgent' && (
                                    <span className="mr-1.5 text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full inline-block">
                                      مستعجل 🔥
                                    </span>
                                  )}
                                </td>

                                {/* Client */}
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-black text-xs shrink-0">
                                      {order.customer_name?.[0] || '👤'}
                                    </div>
                                    <div>
                                      <span className="font-bold text-slate-900 text-sm block">{order.customer_name}</span>
                                      <span className="text-[11px] font-mono text-slate-400 dir-ltr">{order.customer_phone}</span>
                                    </div>
                                  </div>
                                </td>

                                {/* Date & Time */}
                                <td className="py-3.5 px-4 text-center text-xs text-slate-500 font-mono">
                                  <div>{safeFormatDate(order.created_at)}</div>
                                </td>

                                {/* Items Count */}
                                <td className="py-3.5 px-4 text-center">
                                  <span className="bg-slate-100 text-slate-700 font-mono text-xs px-2.5 py-0.5 rounded-lg">
                                    {itemCount} قطعة
                                  </span>
                                </td>

                                {/* Total Amount */}
                                <td className="py-3.5 px-4 text-center">
                                  <span className={`py-1 px-3 rounded-xl text-xs font-black font-mono inline-block ${
                                    order.is_paid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                  }`}>
                                    {order.total.toFixed(2)} ر.س
                                  </span>
                                </td>

                                {/* Payment Status */}
                                <td className="py-3.5 px-4 text-center">
                                  {order.is_paid ? (
                                    <span className="py-1 px-2.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black inline-flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      <span>مدفوع</span>
                                    </span>
                                  ) : (
                                    <span className="py-1 px-2.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-[10px] font-black inline-flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                      <span>معلق</span>
                                    </span>
                                  )}
                                </td>

                                {/* Payment Method */}
                                <td className="py-3.5 px-4 text-center">
                                  <span className="text-xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 font-bold">
                                    {order.payment_method === 'Cash' ? 'نقدي' : order.payment_method === 'Card' ? 'شبكة' : order.payment_method === 'Transfer' ? 'تحويل' : order.payment_method === 'Free' ? 'مجاني' : (order.payment_method || 'نقدي')}
                                  </span>
                                </td>

                                {/* Order Status */}
                                <td className="py-3.5 px-4 text-center">
                                  <span className="py-1 px-2.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold inline-block">
                                    {statusArabic[order.status] || order.status}
                                  </span>
                                </td>

                                {/* Action: Print & View */}
                                <td className="py-3.5 px-4 text-left pl-6">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => setShowPrintModal(order)}
                                      title="طباعة الفاتورة"
                                      className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs transition-all flex items-center justify-center shrink-0 shadow-xs cursor-pointer"
                                    >
                                      <Printer size={15} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setShowEditOrderModal(order);
                                        setOriginalOrder(JSON.parse(JSON.stringify(order)));
                                      }}
                                      title="عرض وتعديل الطلب"
                                      className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl text-xs transition-all flex items-center justify-center shrink-0 shadow-xs cursor-pointer"
                                    >
                                      <Edit3 size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Bar for Finance Orders */}
                    <PaginationBar
                      currentPage={safePage}
                      totalItems={searchedOrders.length}
                      pageSize={FINANCE_ORDERS_PER_PAGE}
                      onPageChange={(p) => setFinanceOrdersCurrentPage(p)}
                      itemLabel="طلب"
                    />
                  </div>
                );
              })()}

              {/* VIEW 2: Clients Accounts & Statements Table (Paginated 30 items) */}
              {financeSalesViewMode === 'clients' && (() => {
                const searchedClients = financeStats.clientList.filter(c => {
                  if (financePendingFilter === 'has_pending' && c.pendingSpent <= 0) return false;
                  if (financePendingFilter === 'no_pending' && c.pendingSpent > 0) return false;
                  if (!financeClientSearch.trim()) return true;
                  const query = financeClientSearch.toLowerCase();
                  return c.name.toLowerCase().includes(query) || c.phone.includes(query);
                });

                if (searchedClients.length === 0) {
                  return (
                    <div className="text-center py-16 text-slate-400 font-bold bg-slate-50/50 rounded-2xl p-6 space-y-3">
                      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <Search size={24} />
                      </div>
                      <p className="text-sm font-black text-slate-600">لا توجد حسابات عملاء تطابق فلاتر البحث الحالية</p>
                      <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                        جرّب تعديل الكلمات المدخلة في البحث أو إعادة ضبط فلاتر التاريخ والعملاء بالأعلى.
                      </p>
                    </div>
                  );
                }

                const CLIENTS_PER_PAGE = 30;
                const totalPages = Math.max(1, Math.ceil(searchedClients.length / CLIENTS_PER_PAGE));
                const safePage = Math.min(Math.max(1, financeClientsCurrentPage), totalPages);
                const startIdx = (safePage - 1) * CLIENTS_PER_PAGE;
                const paginatedClients = searchedClients.slice(startIdx, startIdx + CLIENTS_PER_PAGE);

                return (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500 px-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-indigo-700">كشوفات وحسابات العملاء:</span>
                        <span className="bg-indigo-50 border border-indigo-100 text-indigo-800 font-mono px-2 py-0.5 rounded-lg text-xs">
                          {startIdx + 1} - {Math.min(startIdx + CLIENTS_PER_PAGE, searchedClients.length)} من {searchedClients.length} عميل
                        </span>
                      </div>
                      <span className="text-slate-400">مرتب حسب أعلى قيمة مبيعات (30 عميل بكل صفحة)</span>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-slate-100">
                      <table className="w-full text-right divide-y divide-slate-100">
                        <thead className="bg-slate-50/80">
                          <tr className="text-slate-500 text-[11px] font-black">
                            <th className="py-3.5 px-4 font-black">العميل</th>
                            <th className="py-3.5 px-4 font-black text-center">الطلبات</th>
                            <th className="py-3.5 px-4 font-black text-center">المحصل</th>
                            <th className="py-3.5 px-4 font-black text-center">المعلق</th>
                            <th className="py-3.5 px-4 font-black text-center">باقة الاشتراك</th>
                            <th className="py-3.5 px-4 font-black text-center">الرصيد المتبقي</th>
                            <th className="py-3.5 px-4 font-black text-center">الحالة</th>
                            <th className="py-3.5 px-4 font-black text-center">آخر معاملة</th>
                            <th className="py-3.5 px-4 font-black text-left pl-6">فواتير وكشف الحساب</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/70 bg-white">
                          {paginatedClients.map((client, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60 transition-all font-bold">
                              {/* Client Info */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                                    {client.name[0] || '👤'}
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-900 text-sm block">{client.name}</span>
                                    <span className="text-[11px] font-mono text-slate-400 dir-ltr">{client.phone}</span>
                                  </div>
                                </div>
                              </td>

                              {/* Orders Count */}
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  onClick={() => setSelectedCustomerForOrders({ name: client.name, phone: client.phone })}
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono text-xs px-2.5 py-1 rounded-lg border border-indigo-200/60 transition-all cursor-pointer font-black"
                                  title="انقر لعرض فواتير هذا العميل"
                                >
                                  {formatInteger(client.totalOrders)} طلب
                                </button>
                              </td>

                              {/* Collected Total */}
                              <td className="py-3.5 px-4 text-center">
                                <span className="py-1 px-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black font-mono inline-block">
                                  {formatMoney(client.totalSpent)} ر.س
                                </span>
                              </td>

                              {/* Pending Amount */}
                              <td className="py-3.5 px-4 text-center">
                                {client.pendingSpent > 0 ? (
                                  <span className="py-1 px-3 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-xl text-xs font-black font-mono inline-flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    {formatMoney(client.pendingSpent)} ر.س
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-300 font-bold">-</span>
                                )}
                              </td>

                              {/* Subscription Plan */}
                              <td className="py-3.5 px-4 text-center">
                                {client.hasSubscription ? (
                                  <span className="py-1 px-2.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black inline-block">
                                    {client.subscriptionPlanName}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-300 font-bold">بدون باقة</span>
                                )}
                              </td>

                              {/* Remaining items */}
                              <td className="py-3.5 px-4 text-center">
                                {client.hasSubscription ? (
                                  <span className="font-mono text-xs text-slate-700 bg-slate-50 py-1 px-2 rounded-lg border border-slate-100">
                                    {client.itemsRemaining} / {client.totalItems} قطعة
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-300 font-bold">-</span>
                                )}
                              </td>

                              {/* Subscription Active / Expired */}
                              <td className="py-3.5 px-4 text-center">
                                {client.hasSubscription ? (
                                  client.subscriptionIsActive ? (
                                    <span className="py-1 px-2.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black inline-flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      <span>نشط</span>
                                    </span>
                                  ) : (
                                    <span className="py-1 px-2.5 bg-red-50 text-red-700 rounded-full text-[10px] font-black inline-flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                      <span>منتهي</span>
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-slate-300 font-bold">-</span>
                                )}
                              </td>

                              {/* Last Transaction Date */}
                              <td className="py-3.5 px-4 text-center text-xs text-slate-400 font-mono">
                                {client.lastOrderDate ? new Date(client.lastOrderDate).toLocaleDateString('ar-SA', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                }) : 'لا يوجد'}
                              </td>

                              {/* Action Buttons for Orders & Statement */}
                              <td className="py-3.5 px-4 text-left pl-6">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setSelectedCustomerForOrders({ name: client.name, phone: client.phone })}
                                    title="عرض فواتير العميل"
                                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs transition-all flex items-center justify-center gap-1 shrink-0 shadow-xs cursor-pointer font-bold"
                                  >
                                    <Receipt size={14} />
                                    <span className="text-[11px]">الفواتير</span>
                                  </button>
                                  <button
                                    onClick={() => downloadCustomerExcel(client.phone, client.name)}
                                    title="تنزيل كشف الحساب Excel"
                                    className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs transition-all flex items-center justify-center shrink-0 shadow-xs cursor-pointer"
                                  >
                                    <FileSpreadsheet size={15} />
                                  </button>
                                  <button
                                    onClick={() => downloadCustomerPDF(client.phone, client.name)}
                                    title="تنزيل كشف الحساب PDF"
                                    className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs transition-all flex items-center justify-center shrink-0 shadow-xs cursor-pointer"
                                  >
                                    <FileText size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Bar for Clients */}
                    <PaginationBar
                      currentPage={safePage}
                      totalItems={searchedClients.length}
                      pageSize={CLIENTS_PER_PAGE}
                      onPageChange={(p) => setFinanceClientsCurrentPage(p)}
                      itemLabel="عميل"
                    />
                  </div>
                );
              })()}
            </div>

            {/* Modal: Customer Invoices & Orders (30 orders per page) */}
            {selectedCustomerForOrders && (() => {
              const custOrders = orders
                .filter(o => o.customer_phone === selectedCustomerForOrders.phone)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

              const CUST_ORDERS_PER_PAGE = 30;
              const totalCustPages = Math.max(1, Math.ceil(custOrders.length / CUST_ORDERS_PER_PAGE));
              const safeCustPage = Math.min(Math.max(1, customerModalOrdersPage), totalCustPages);
              const startCustIdx = (safeCustPage - 1) * CUST_ORDERS_PER_PAGE;
              const paginatedCustOrders = custOrders.slice(startCustIdx, startCustIdx + CUST_ORDERS_PER_PAGE);

              return (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 text-right animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">
                          <Receipt size={20} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900">
                            فواتير وطلبات العميل: {selectedCustomerForOrders.name}
                          </h3>
                          <p className="text-xs font-mono font-bold text-slate-400 dir-ltr text-right">
                            {selectedCustomerForOrders.phone} • {custOrders.length} طلب إجمالي
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedCustomerForOrders(null)}
                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer text-sm font-black"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Orders Body */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                      {custOrders.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 font-bold bg-slate-50 rounded-2xl">
                          لا توجد فواتير مسجلة لهذا العميل
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-100">
                          <table className="w-full text-right divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                              <tr className="text-slate-500 text-[11px] font-black">
                                <th className="py-3 px-4">رقم الفاتورة</th>
                                <th className="py-3 px-4 text-center">التاريخ</th>
                                <th className="py-3 px-4 text-center">القطع</th>
                                <th className="py-3 px-4 text-center">الإجمالي</th>
                                <th className="py-3 px-4 text-center">السداد</th>
                                <th className="py-3 px-4 text-center">الحالة</th>
                                <th className="py-3 px-4 text-left pl-6">طباعة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/70 bg-white">
                              {paginatedCustOrders.map(order => {
                                const itemCount = (order.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
                                return (
                                  <tr key={order.id} className="hover:bg-slate-50/60 font-bold">
                                    <td className="py-3 px-4">
                                      <span className="font-mono text-xs font-black bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200/60">
                                        #{order.order_number}
                                      </span>
                                      {order.order_type === 'Urgent' && (
                                        <span className="mr-1 text-[10px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                                          مستعجل 🔥
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-center text-xs text-slate-400 font-mono">
                                      {safeFormatDate(order.created_at)}
                                    </td>
                                    <td className="py-3 px-4 text-center font-mono text-xs">
                                      {itemCount} قطعة
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <span className={`py-0.5 px-2.5 rounded-lg text-xs font-mono font-black ${
                                        order.is_paid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                      }`}>
                                        {order.total.toFixed(2)} ر.س
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      {order.is_paid ? (
                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                          مدفوع
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                          معلق
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <span className="text-xs text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">
                                        {statusArabic[order.status] || order.status}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-left pl-6">
                                      <button
                                        onClick={() => setShowPrintModal(order)}
                                        title="طباعة الفاتورة"
                                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs transition-all cursor-pointer"
                                      >
                                        <Printer size={15} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Pagination Footer */}
                    <div className="pt-4 border-t border-slate-100 shrink-0">
                      <PaginationBar
                        currentPage={safeCustPage}
                        totalItems={custOrders.length}
                        pageSize={CUST_ORDERS_PER_PAGE}
                        onPageChange={(p) => setCustomerModalOrdersPage(p)}
                        itemLabel="طلب"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {isCreatingUser ? (
              /* Dedicated New Page Sub-view for Creating User */
              <div className="max-w-2xl mx-auto space-y-6 text-right animate-in slide-in-from-left-4 duration-500">
                <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                  <button
                    type="button"
                    onClick={() => setIsCreatingUser(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs transition-all flex items-center gap-2"
                  >
                    <ArrowRight size={16} /> العودة لقائمة المستخدمين
                  </button>
                  <h3 className="text-xl font-black flex items-center gap-2 text-indigo-950">
                    <UserPlus className="text-indigo-600 font-bold" size={20} /> إنشاء حساب مستخدم جديد
                  </h3>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-6">
                  <div>
                    <p className="text-xs font-bold text-slate-400 mt-1">قم بإنشاء حساب موظف أو مشرف جديد وربطه بالمغسلة فوراً وحدد صلاحيات وصول الصفحات</p>
                  </div>

                  <form onSubmit={handleCreateStaffAccount} className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">الاسم الكامل</label>
                      <input
                        type="text"
                        placeholder="اسم الموظف"
                        required
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-sm transition-all text-right"
                        value={newStaffForm.full_name}
                        onChange={e => setNewStaffForm({...newStaffForm, full_name: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">البريد الإلكتروني</label>
                      <input
                        type="email"
                        placeholder="email@laundry.com"
                        required
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-sm transition-all text-left"
                        dir="ltr"
                        value={newStaffForm.email}
                        onChange={e => setNewStaffForm({...newStaffForm, email: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">كلمة المرور</label>
                      <input
                        type="password"
                        placeholder="كلمة المرور (6 خانات على الأقل)"
                        required
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-sm transition-all text-left"
                        dir="ltr"
                        value={newStaffForm.password}
                        onChange={e => setNewStaffForm({...newStaffForm, password: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">صلاحية النظام الافتراضية</label>
                      <select
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-xs transition-all"
                        value={newStaffForm.role}
                        onChange={e => {
                          const nextRole = e.target.value as UserRole;
                          setNewStaffForm({
                            ...newStaffForm, 
                            role: nextRole,
                            // Set standard fallback permissions for that role initially
                            permissions: ROLE_PERMISSIONS[nextRole] || []
                          });
                        }}
                      >
                        <option value="staff">موظف (Staff)</option>
                        <option value="manager">مشرف مغسلة (Manager)</option>
                        <option value="admin">مدير نظام عام (Admin)</option>
                      </select>
                    </div>



                    {/* Page permissions selection checkboxes */}
                    <div className="space-y-2 pt-4 border-t border-slate-100">
                      <label className="block text-xs font-black text-slate-600 flex items-center gap-1.5">
                        <Settings2 size={14} className="text-indigo-600" /> تحديد الصفحات المسموحة (Page Access)
                      </label>
                      <p className="text-[10px] text-slate-400 font-bold mb-3">اختر الصفحات المعينة التي يمكن لهذا الموظف الدخول إليها:</p>
                      <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                        {navItems.filter(item => item.id !== 'super-admin').map(item => {
                          const IconComponent = item.icon;
                          const isFinance = item.id === 'finance';
                          const isChecked = isFinance
                            ? (newStaffForm.permissions.includes('finance') || newStaffForm.permissions.includes('finance_pending_only'))
                            : newStaffForm.permissions.includes(item.id);
                          return (
                            <label key={item.id} className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border transition-all ${isChecked ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 font-black' : 'bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-500'}`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isFinance) {
                                    if (isChecked) {
                                      const newPerms = newStaffForm.permissions.filter(p => p !== 'finance' && p !== 'finance_pending_only');
                                      setNewStaffForm({ ...newStaffForm, permissions: newPerms });
                                    } else {
                                      setNewStaffForm({ ...newStaffForm, permissions: [...newStaffForm.permissions, 'finance'] });
                                    }
                                  } else {
                                    const newPerms = isChecked
                                      ? newStaffForm.permissions.filter(p => p !== item.id)
                                      : [...newStaffForm.permissions, item.id];
                                    setNewStaffForm({ ...newStaffForm, permissions: newPerms });
                                  }
                                }}
                                className="accent-indigo-600 rounded"
                              />
                              <span className="text-[11px] font-bold flex items-center gap-1">
                                <IconComponent size={12} className={isChecked ? "text-indigo-600" : "text-slate-400"} />
                                {item.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      {/* Sub-option if Finance page is checked */}
                      {(newStaffForm.permissions.includes('finance') || newStaffForm.permissions.includes('finance_pending_only')) && (
                        <div className="mt-3 p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-2.5 animate-in fade-in-50 duration-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                              <Wallet size={14} className="text-amber-600" />
                              <span>تخصيص صلاحية صفحة الحسابات:</span>
                            </span>
                            <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-full border border-amber-300">
                              {newStaffForm.permissions.includes('finance_pending_only') ? 'تصفية معلقات فقط 💰' : 'وصول كامل 📊'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {/* Option 1: Full Access */}
                            <label className={`flex items-start gap-2 p-2.5 rounded-xl cursor-pointer border transition-all ${!newStaffForm.permissions.includes('finance_pending_only') && newStaffForm.permissions.includes('finance') ? 'bg-white border-indigo-400 font-black text-indigo-950 shadow-sm' : 'bg-slate-50/80 border-slate-200/60 text-slate-500 font-bold'}`}>
                              <input
                                type="radio"
                                name="newStaffFinanceType"
                                checked={!newStaffForm.permissions.includes('finance_pending_only') && newStaffForm.permissions.includes('finance')}
                                onChange={() => {
                                  const next = newStaffForm.permissions.filter(p => p !== 'finance_pending_only');
                                  if (!next.includes('finance')) next.push('finance');
                                  setNewStaffForm({ ...newStaffForm, permissions: next });
                                }}
                                className="accent-indigo-600 mt-0.5"
                              />
                              <div>
                                <span className="block font-black text-xs">وصول كامل للحسابات</span>
                                <span className="block text-[10px] text-slate-400 font-bold mt-0.5">عرض كافة الإحصائيات، الأرباح، والتقارير المالية</span>
                              </div>
                            </label>

                            {/* Option 2: Pending Amounts Only */}
                            <label className={`flex items-start gap-2 p-2.5 rounded-xl cursor-pointer border transition-all ${newStaffForm.permissions.includes('finance_pending_only') ? 'bg-white border-amber-400 font-black text-amber-950 shadow-sm' : 'bg-slate-50/80 border-slate-200/60 text-slate-500 font-bold'}`}>
                              <input
                                type="radio"
                                name="newStaffFinanceType"
                                checked={newStaffForm.permissions.includes('finance_pending_only')}
                                onChange={() => {
                                  const next = newStaffForm.permissions.filter(p => p !== 'finance');
                                  if (!next.includes('finance_pending_only')) next.push('finance_pending_only');
                                  setNewStaffForm({ ...newStaffForm, permissions: next });
                                }}
                                className="accent-amber-600 mt-0.5"
                              />
                              <div>
                                <span className="block font-black text-xs text-amber-900 flex items-center gap-1">
                                  تصفية مبالغ معلقة فقط 💰
                                </span>
                                <span className="block text-[10px] text-amber-700/80 font-bold mt-0.5">
                                  إخفاء الإحصائيات العامة وعرض إحصائيات مبيعات العملاء وتصفية المبالغ المعلقة فقط
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={createStaffLoading}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {createStaffLoading ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <>
                          <UserPlus size={18} /> إنشاء الحساب وتعيينه
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Platform Support WhatsApp Card (Super Admin Only) */}
                {userProfile?.role === 'super_admin' && (
                  <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 text-right space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black shrink-0">
                          <MessageCircle size={24} />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-slate-900">رقم واتساب الدعم الفني للمنصة</h4>
                          <p className="text-xs font-bold text-slate-400 mt-0.5">الرقم المخصص لاستقبال رسائل الدعم الفني وتفعيل الحسابات المعطلة والمجمدة</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="text"
                          placeholder="مثال: 966500000000"
                          className="px-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-2xl outline-none font-bold text-xs text-left w-full sm:w-60"
                          dir="ltr"
                          value={platformWhatsAppInput}
                          onChange={e => setPlatformWhatsAppInput(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePlatformWhatsApp(platformWhatsAppInput)}
                          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl font-black text-xs transition-all shadow-md shrink-0 flex items-center gap-2"
                        >
                          <Save size={16} /> حفظ الرقم
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Spacious, Beautiful Table View of Accounts */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-6 text-right">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-xl font-black flex items-center gap-3 text-indigo-950">
                      <ShieldCheck className="text-indigo-600" /> إدارة المستخدمين والصلاحيات والمغاسل
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">تعديل صلاحيات الموظفين، ربطهم بالمغسلة الحالية، وتحديد وصول الصفحات</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsCreatingUser(true)}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs transition-all flex items-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <UserPlus size={16} /> إضافة مستخدم جديد
                    </button>
                    <button onClick={fetchProfiles} className="p-3 bg-slate-50 rounded-xl text-slate-500 hover:text-indigo-600 transition-all">
                      <Repeat size={20} />
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 font-black text-slate-400 text-sm">المستخدم</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">البريد الإلكتروني</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">الصلاحية</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">المغسلة المرتبطة</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">الصفحات المتاحة</th>
                        <th className="pb-4 font-black text-slate-400 text-sm text-left pl-4">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {profiles.map(profile => (
                        <tr key={profile.id} className="group hover:bg-slate-50/50 transition-all">
                          <td className="py-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black">
                                {profile.full_name?.[0] || profile.email?.[0].toUpperCase()}
                              </div>
                              <span className="font-black text-slate-800">{profile.full_name || 'بدون اسم'}</span>
                            </div>
                          </td>
                          <td className="py-6 text-sm font-bold text-slate-500">{profile.email}</td>
                          <td className="py-6">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black ${
                              profile.role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                              profile.role === 'manager' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {profile.role === 'admin' ? 'مدير نظام' : profile.role === 'manager' ? 'مشرف' : 'موظف'}
                            </span>
                          </td>
                          <td className="py-6 text-sm font-black text-slate-700">
                            {profile.laundry_name || 'بدون مغسلة'}
                          </td>
                          <td className="py-6">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {(() => {
                                const perms = (profile.permissions !== undefined && profile.permissions !== null)
                                  ? profile.permissions
                                  : (ROLE_PERMISSIONS[profile.role] || []);
                                return perms.map(pId => {
                                  if (pId === 'finance_pending_only') {
                                    return (
                                      <span key={pId} className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[9px] rounded-md font-bold flex items-center gap-1 border border-amber-200">
                                        <Wallet size={10} className="text-amber-600" /> الحسابات (معلقات فقط 💰)
                                      </span>
                                    );
                                  }
                                  const item = navItems.find(n => n.id === pId);
                                  if (!item) return null;
                                  return (
                                    <span key={pId} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] rounded-md font-bold flex items-center gap-1">
                                      {item.label}
                                    </span>
                                  );
                                });
                              })()}
                            </div>
                          </td>
                          <td className="py-6 text-left pl-4 flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingUserProfile(profile);
                                const expStr = profile.saas_expiry ? new Date(profile.saas_expiry) : new Date(Date.now() + 365*24*60*60*1000);
                                const validExpStr = !isNaN(expStr.getTime()) ? expStr.toISOString().split('T')[0] : new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0];
                                setEditingUserForm({
                                  full_name: profile.full_name || '',
                                  role: profile.role || 'staff',
                                  laundry_id: profile.laundry_id || '',
                                  laundry_name: profile.laundry_name || '',
                                  permissions: (profile.permissions !== undefined && profile.permissions !== null)
                                    ? profile.permissions 
                                    : ROLE_PERMISSIONS[profile.role] || [],
                                  saas_plan: (profile.saas_plan as any) || 'gold',
                                  saas_billing_cycle: (profile.saas_billing_cycle as any) || 'annual',
                                  saas_expiry: validExpStr
                                });
                              }}
                              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 rounded-lg transition-all"
                              title="تعديل المستخدم وصلاحياته"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => setUserToDelete(profile)}
                              disabled={profile.id === session?.user?.id}
                              className="p-2 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                              title="حذف المستخدم"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Background WhatsApp Card */}
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-slate-100 text-right overflow-hidden relative">
              <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600"></div>

              <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                    <MessageCircle size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-slate-900">الربط مع الواتساب</h3>
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-black rounded-full border border-emerald-100 flex items-center gap-1">
                        <Sparkles size={12} /> مفتوح المصدر ومجاني 100%
                      </span>
                    </div>
                    <p className="text-slate-400 font-bold text-xs mt-1">
                      إرسال صامت وتلقائي للرسائل والفواتير PDF إلى واتساب العميل مباشرة فور حفظ الطلب في (كاشير جديد) دون فتح أي تطبيق خارجي
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowWhatsAppBotModal(true)}
                  className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-100 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <QrCode size={16} /> {whatsAppBotStatus.isConnected ? 'إدارة الاتصال بالواتساب' : 'ربط جوال المغسلة (مسح رمز QR)'}
                </button>
              </div>

              {/* Status & Options Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase">حالة الارتباط</span>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black ${
                      whatsAppBotStatus.isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${whatsAppBotStatus.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      {whatsAppBotStatus.isConnected ? 'متصل بنشاط (سحابياً) ✅' : 'غير مرتبط (امسح QR) ⚠️'}
                    </span>
                  </div>
                </div>

                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase">رقم الجوال المرتبط (سحابي)</span>
                  <div className="mt-2">
                    <span className="text-base font-black text-slate-800 dir-ltr inline-block">
                      {whatsAppBotStatus.userPhone || 'لم يتم ربط رقم بعد'}
                    </span>
                  </div>
                </div>

                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase">الإرسال التلقائي في كاشير جديد</span>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-900">
                      {whatsAppBotAutoSend ? 'مفعل تلقائياً 🚀' : 'معطل'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={whatsAppBotAutoSend}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setWhatsAppBotAutoSend(val);
                          localStorage.setItem('laundry_whatsapp_bot_auto_send', val ? 'true' : 'false');
                          (async () => {
                            try {
                              await supabase.from('settings').upsert({
                                key: 'laundry_whatsapp_bot_auto_send',
                                value: { enabled: val },
                                updated_at: new Date().toISOString()
                              }, { onConflict: 'key' });
                            } catch (e) {}
                          })();
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* WhatsApp Info Banner */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex items-start gap-3">
                <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 leading-relaxed font-bold">
                  <p>
                    <span className="font-black">كيف يعمل الإرسال الصامت؟</span> تعتمد هذه الميزة على الربط المباشر مع جوال المغسلة عبر السيرفر. عند ربط الجوال مرة واحدة بمسح رمز QR، يصبح السيرفر قادراً على إرسال نص الفاتورة الرسمية وملف الـ PDF مباشرة لواتساب العميل بدون فتح أي شاشة أو تطبيق على جهاز الكاشير، وبشكل مجاني 100% دون الحاجة لاشتراكات أو خدمات وسيطة مدفوعة.
                  </p>
                </div>
              </div>
            </div>

            {/* USB Thermal Printer Card */}
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-slate-100 text-right overflow-hidden relative">
              <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700"></div>

              <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                    <Printer size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-slate-900">طابعة الفواتير الحرارية (USB POS Thermal Printer)</h3>
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-black rounded-full border border-indigo-100 flex items-center gap-1">
                        <Sparkles size={12} /> مقاس 80mm / 58mm
                      </span>
                    </div>
                    <p className="text-slate-400 font-bold text-xs mt-1">
                      الطباعة التلقائية للفواتير فور الضغط على زر (حفظ) في الكاشير عبر طابعات الإيصالات الحرارية المتصلة بالـ USB
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (orders.length > 0) {
                      setShowPrintModal(orders[0]);
                      setTimeout(() => window.print(), 350);
                    } else {
                      window.print();
                    }
                  }}
                  className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Printer size={16} /> طباعة تجريبية الآن
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-400 block uppercase">الطباعة التلقائية عند الحفظ</span>
                    <span className="text-sm font-black text-slate-800 mt-1 block">
                      {autoPrintThermalOnSave ? 'مفعلة تلقائياً فور الحفظ ✅' : 'معطلة (طباعة يدوية)'}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoPrintThermalOnSave}
                      onChange={(e) => {
                        setAutoPrintThermalOnSave(e.target.checked);
                        localStorage.setItem('laundry_auto_print_thermal', e.target.checked ? 'true' : 'false');
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-400 block uppercase">نوع الورق المدعوم</span>
                    <span className="text-sm font-black text-slate-800 mt-1 block">رول حراري 80mm و 58mm قياسي</span>
                  </div>
                  <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700">
                    POS Roll
                  </span>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-start gap-3">
                <Sparkles size={20} className="text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950 leading-relaxed font-bold">
                  <p>
                    <span className="font-black">ملاحظة للطابعات المتصلة بـ USB:</span> عند الضغط على زر حفظ، يفتح المتصفح أمر الطباعة مباشرة. لتفعيل الطباعة الصامتة الفورية دون الحاجة لتأكيد المتصفح في كل مرة، يمكنك فتح المتصفح مع تفعيل خيار Kiosk Printing: <span className="font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-900" dir="ltr">--kiosk-printing</span> واختيار طابعة الـ USB كطابعة افتراضية.
                  </p>
                </div>
              </div>

              {/* QR & Barcode Scanner Integration */}
              <div className="mt-4 p-5 bg-gradient-to-r from-emerald-50/90 to-teal-50/90 rounded-2xl border border-emerald-200/80 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                    <QrCode size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-emerald-950">المسح المباشر بقارئ الباركود والـ QR (Hardware Scanner)</h4>
                      <span className="px-2.5 py-0.5 bg-emerald-200/60 text-emerald-900 text-[10px] font-black rounded-full">
                        نشط تلقائياً ⚡
                      </span>
                    </div>
                    <p className="text-emerald-800 text-xs font-bold mt-1 leading-relaxed max-w-xl">
                      عند مسح رمز الـ QR أو الباركود لأي فاتورة أو منتج مطبوع عبر طابعة الفواتير الحرارية، يقوم النظام فوراً بتحويل الطلب إلى (جاهز للاستلام) وإرسال رسالة الواتساب للعميل تلقائياً تماماً كالمسح بكاميرا الجوال!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-white text-emerald-700 text-xs font-black rounded-xl border border-emerald-200 flex items-center gap-1.5 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    جاهز للمسح المباشر في أي وقت
                  </span>
                </div>
              </div>
            </div>

            {/* Laundry Subscription Control Card */}
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-slate-100 text-right overflow-hidden relative">
              {/* Top Accent Gradient */}
              <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600"></div>

              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                    <CreditCard size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-slate-900">إدارة اشتراك مغسلتك</h3>
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-black rounded-full border border-emerald-100 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        نظام مفعل
                      </span>
                    </div>
                    <p className="text-slate-400 font-bold text-xs mt-1">متابعة باقة المغسلة، حالة الحساب، وتجديد الاشتراك في المنصة</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowSaaSPaymentModal(true)}
                  className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
                >
                  <Sparkles size={16} /> تجديد اشتراك المغسلة الحالي
                </button>
              </div>

              {/* Status Overview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase">الباقة النشطة</span>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-lg font-black text-slate-800">
                      {userProfile?.saas_plan === 'basic' ? 'الباقة الأساسية' :
                       userProfile?.saas_plan === 'gold' ? 'الباقة الذهبية' :
                       userProfile?.saas_plan === 'silver' ? 'الباقة الفضية' :
                       userProfile?.saas_plan === 'platinum' ? 'الباقة البلاتينية' : 'الباقة التجريبية'}
                    </span>
                    <span className="text-base">
                      {userProfile?.saas_plan === 'basic' ? '🌟' :
                       userProfile?.saas_plan === 'gold' ? '👑' :
                       userProfile?.saas_plan === 'silver' ? '🥈' :
                       userProfile?.saas_plan === 'platinum' ? '💎' : '⏳'}
                    </span>
                  </div>
                </div>

                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase">حالة الباقة</span>
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black ${
                      userProfile?.saas_status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                      userProfile?.saas_status === 'trial' ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {userProfile?.saas_status === 'active' ? 'نشط ✅' :
                       userProfile?.saas_status === 'trial' ? 'فترة تجريبية ⏳' : 'منتهي الصلاحية ⚠️'}
                    </span>
                  </div>
                </div>

                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase">تاريخ التجديد القادم</span>
                  <p className="text-base font-black text-indigo-900 mt-2">
                    {userProfile?.saas_expiry && !isNaN(new Date(userProfile.saas_expiry).getTime()) ? new Date(userProfile.saas_expiry).toLocaleDateString('ar-SA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'مستمر (غير محدود)'}
                  </p>
                </div>
              </div>

              {/* Subscription Plans Available */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Zap size={20} className="text-amber-500" /> باقات منصة غسيل كلاود المتاحة
                  </h4>
                  <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                    ⚠️ الأسعار الموضحة لا تشمل ضريبة القيمة المضافة
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Basic Plan Card */}
                  <div className={`p-6 rounded-3xl border-2 transition-all flex flex-col justify-between ${
                    userProfile?.saas_plan === 'basic' ? 'bg-indigo-50/80 border-indigo-500 shadow-md ring-2 ring-indigo-200' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="px-3.5 py-1.5 bg-indigo-100 text-indigo-700 font-black text-xs rounded-full inline-flex items-center gap-1.5">
                          🌟 الباقة الأساسية
                        </span>
                        {userProfile?.saas_plan === 'basic' && (
                          <span className="px-3 py-1 bg-emerald-500 text-white font-black text-[10px] rounded-full shadow-sm">
                            بافتك الحالية ✅
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-bold">الخيار الأمثل للبدء والاستمتاع بالخدمة.</p>
                      
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-right space-y-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-slate-900">105</span>
                          <span className="text-xs font-bold text-slate-500">ريال / شهرياً</span>
                        </div>
                        <p className="text-xs font-bold text-slate-600">
                          الاشتراك السنوي: <span className="font-black text-indigo-900">1,050 ريال / سنوياً</span>
                        </p>
                        <p className="text-[11px] font-black text-emerald-600 pt-0.5">
                          🎁 (وفر 17% — احصل على شهرين مجاناً!)
                        </p>
                      </div>
                    </div>

                    <div className="pt-6">
                      <button
                        onClick={() => setShowSaaSPaymentModal(true)}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
                      >
                        {userProfile?.saas_plan === 'basic' ? 'تجديد الباقة الأساسية' : 'الاشتراك في الباقة الأساسية'}
                      </button>
                    </div>
                  </div>

                  {/* Gold Plan Card */}
                  <div className={`p-6 rounded-3xl border-2 transition-all flex flex-col justify-between ${
                    userProfile?.saas_plan === 'gold' || (!userProfile?.saas_plan && userProfile?.saas_plan !== 'basic') ? 'bg-amber-50/80 border-amber-400 shadow-md ring-2 ring-amber-200' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="px-3.5 py-1.5 bg-amber-100 text-amber-800 font-black text-xs rounded-full inline-flex items-center gap-1.5">
                          👑 الباقة الذهبية
                        </span>
                        {(userProfile?.saas_plan === 'gold' || (!userProfile?.saas_plan && userProfile?.saas_plan !== 'basic')) && (
                          <span className="px-3 py-1 bg-amber-500 text-white font-black text-[10px] rounded-full shadow-sm">
                            بافتك الحالية ✅
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-900/80 font-bold">للتجربة المكتملة والمميزات الإضافية.</p>
                      
                      <div className="p-4 bg-amber-100/50 rounded-2xl border border-amber-200/60 text-right space-y-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-amber-950">150</span>
                          <span className="text-xs font-bold text-amber-800">ريال / شهرياً</span>
                        </div>
                        <p className="text-xs font-bold text-amber-900">
                          الاشتراك السنوي: <span className="font-black text-amber-950">1,550 ريال / سنوياً</span>
                        </p>
                        <p className="text-[11px] font-black text-amber-700 pt-0.5">
                          🎁 (وفر 14% — أكثر من شهر ونصف مجاناً!)
                        </p>
                      </div>
                    </div>

                    <div className="pt-6">
                      <button
                        onClick={() => setShowSaaSPaymentModal(true)}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-indigo-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
                      >
                        {(userProfile?.saas_plan === 'gold' || (!userProfile?.saas_plan && userProfile?.saas_plan !== 'basic')) ? 'تجديد الباقة الذهبية 👑' : 'الترقية للباقة الذهبية 👑'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Offline Mode Configuration Card in Settings */}
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-slate-100 text-right overflow-hidden relative">
              {/* Top Accent Gradient */}
              <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600"></div>

              <div className="flex items-center justify-between flex-wrap gap-4 mb-6 border-b border-slate-100 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                    <CloudOff size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-slate-900">وضع العمل بدون إنترنت (الأوفلاين)</h3>
                      <span className={`px-3 py-1 text-xs font-black rounded-full border flex items-center gap-1.5 ${
                        isManualOffline()
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${isManualOffline() ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`}></span>
                        {isManualOffline() ? 'الوضع مفعل حالياً (أوفلاين)' : 'الوضع متوقف (افتراضي - أونلاين)'}
                      </span>
                    </div>
                    <p className="text-slate-400 font-bold text-xs mt-1">
                      تحكم بوضع عدم الاتصال، واختيار عدد الطلبات المراد حفظها محلياً (30، 50، 100، 200، 300، 500، 1000 أو الكل)، والتبديل بين الأوفلاين والمزامنة التلقائية.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOfflineModalOpen(true)}
                  className="px-6 py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-2xl font-black text-xs shadow-lg shadow-amber-200 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CloudOff size={16} /> فتح إعدادات وحفظ الأوفلاين
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-slate-400 block text-[11px]">حالة الأوفلاين الحالية</span>
                  <span className={`text-sm font-black ${isManualOffline() ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {isManualOffline() ? '🟡 وضع غير متصل يدوي (Offline)' : '🟢 متصل بالإنترنت وقاعدة البيانات'}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-slate-400 block text-[11px]">حد حفظ الطلبات المختار</span>
                  <span className="text-sm font-black text-indigo-900">
                    {getOfflineCacheLimit() === 'all' ? 'جميع البيانات والطلبات' : `آخر ${getOfflineCacheLimit()} طلب`}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-slate-400 block text-[11px]">الطلبات المحفوظة محلياً</span>
                  <span className="text-sm font-black text-slate-800">
                    {(() => {
                      try {
                        const local = localStorage.getItem(`laundry_orders_${userProfile?.laundry_id}`) || localStorage.getItem('laundry_orders');
                        if (local) {
                          const parsed = JSON.parse(local);
                          return Array.isArray(parsed) ? `${parsed.length} طلب محفوظ` : 'لا يوجد';
                        }
                      } catch (e) {}
                      return 'لا يوجد بيانات مخزنة';
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Data Backup & Restore Section */}
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-slate-100 text-right overflow-hidden relative">
              {/* Top Accent Gradient */}
              <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600"></div>

              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-4 mb-8 border-b border-slate-100 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                    <Database size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">النسخ الاحتياطي واستعادة البيانات</h3>
                    <p className="text-slate-400 font-bold text-xs mt-1">
                      تصدير وتنزيل كافة بيانات المغسلة (الطلبات، المخزون، الأصناف، الاشتراكات) أو استرجاعها بملف واحد
                    </p>
                  </div>
                </div>
              </div>

              {/* Backup Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export Card */}
                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-6 hover:border-emerald-300 transition-all">
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                      <Download size={22} />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900">تصدير نسخة احتياطية (Export Backup)</h4>
                      <p className="text-xs text-slate-500 font-bold mt-1 leading-relaxed">
                        قم بتنزيل ملف JSON شامل يحتوي على كامل بيانات المغسلة لحفظها أماناً على جهازك.
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 text-xs font-bold text-slate-600 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">سجلات الطلبات والفواتير:</span>
                        <span className="font-black text-indigo-900 px-2.5 py-0.5 bg-indigo-50 rounded-lg">{orders.length} طلب</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">عناصر المخزون:</span>
                        <span className="font-black text-indigo-900 px-2.5 py-0.5 bg-indigo-50 rounded-lg">{inventory.length} مادة</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">اشتراكات العملاء:</span>
                        <span className="font-black text-indigo-900 px-2.5 py-0.5 bg-indigo-50 rounded-lg">{subscriptions.length} اشتراك</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-200/60 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={18} />
                    <span>تنزيل النسخة الاحتياطية الآن (.JSON)</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-6 hover:border-indigo-300 transition-all">
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                      <Upload size={22} />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900">استعادة نسخة احتياطية (Import / Restore)</h4>
                      <p className="text-xs text-slate-500 font-bold mt-1 leading-relaxed">
                        اختر ملف النسخة الاحتياطية (.json) الذي قمت بتنزيله سابقاً لاسترجاع بياناتك وتطبيقها فوراً في النظام.
                      </p>
                    </div>

                    {importSuccess && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center justify-between gap-3 animate-fadeIn">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle size={20} className="text-emerald-600 shrink-0" />
                          <p className="whitespace-pre-line leading-relaxed">{importSuccess}</p>
                        </div>
                        <button onClick={() => setImportSuccess(null)} className="text-emerald-600 hover:text-emerald-800 p-1">
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    {importError && (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-900 flex items-center justify-between gap-3 animate-fadeIn">
                        <div className="flex items-center gap-2.5">
                          <AlertTriangle size={20} className="text-rose-600 shrink-0" />
                          <p className="leading-relaxed">{importError}</p>
                        </div>
                        <button onClick={() => setImportError(null)} className="text-rose-600 hover:text-rose-800 p-1">
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs font-bold text-amber-900 flex items-start gap-2.5">
                      <ShieldAlert size={18} className="shrink-0 text-amber-600 mt-0.5" />
                      <p className="leading-relaxed">
                        تنبيه هام: سيقوم النظام باستبدال وتحديث البيانات الحالية بالبيانات الموجودة داخل الملف المستورد. يُفضل تنزيل نسخة احتياطية حالية قبل الاستيراد.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-indigo-200/60 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer">
                      <Upload size={18} />
                      <span>اختيار ملف واسترجاع البيانات</span>
                      <input
                        ref={backupFileInputRef}
                        type="file"
                        accept=".json,application/json,text/json,text/plain,*"
                        onChange={handleImportBackup}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-[1400px] mx-auto text-right" dir="rtl">
            {/* Real Account Stats Grid (4 Cards, each 25% width on desktop) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {/* Card 1: المبيعات المحصلة */}
              <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 text-white p-5 sm:p-6 rounded-[2rem] shadow-lg shadow-blue-600/20 relative overflow-hidden flex flex-col justify-between min-h-[200px] group">
                <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-110 transition-transform"></div>
                
                <div className="w-full relative z-10 space-y-2.5">
                  {/* Top row: Icon + Badge */}
                  <div className="w-full flex items-center justify-between">
                    <div className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-inner">
                      <Banknote size={22} className="stroke-[2.5]" />
                    </div>
                    <span className="bg-white/20 backdrop-blur-md text-white border border-white/30 px-2.5 py-1 rounded-full text-xs font-black">
                      {formatInteger(overallStats.paidOrdersCount)} طلب مدفوع
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div className="w-full pt-1">
                    <span className="text-sm font-black text-white block">المبيعات المحصلة</span>
                    <span className="text-xs text-blue-100 font-medium block mt-0.5">المدفوعة في الصندوق والخزينة</span>
                  </div>

                  {/* Amount */}
                  <div className="pt-1">
                    <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white drop-shadow-xs">
                      {formatMoney(overallStats.totalRevenue)} <span className="text-sm sm:text-base font-bold text-blue-200">ر.س</span>
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-white/15 flex items-center justify-between text-[11px] text-blue-100 font-bold relative z-10 mt-3">
                  <span>صافي المبيعات بدون الضريبة:</span>
                  <span className="font-mono text-white font-black">
                    {formatMoney(Math.max(0, overallStats.totalRevenue - (overallStats.taxTotal || 0)))} ر.س
                  </span>
                </div>
              </div>

              {/* Card 2: المبالغ المعلقة غير المحصلة */}
              <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-amber-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[200px] group hover:shadow-md transition-all">
                <div className="w-full space-y-2.5">
                  {/* Top row: Icon + Badge */}
                  <div className="w-full flex items-center justify-between">
                    <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                      <Clock size={22} className="stroke-[2.5]" />
                    </div>
                    <span className="bg-amber-50 text-amber-700 border border-amber-200/60 px-2.5 py-1 rounded-full text-xs font-black">
                      {formatInteger(overallStats.pendingPaymentCount)} غير مسدد
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div className="w-full pt-1">
                    <span className="text-sm font-black text-slate-800 block">المبالغ المعلقة غير المحصلة</span>
                    <span className="text-xs text-slate-400 font-medium block mt-0.5">فواتير مستحقة بانتظار سداد العملاء</span>
                  </div>

                  {/* Amount */}
                  <div className="pt-1">
                    <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-600">
                      {formatMoney(overallStats.pendingAmount)} <span className="text-sm sm:text-base font-bold text-slate-500">ر.س</span>
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-bold mt-3">
                  <span>حالة الذمم:</span>
                  <span className="text-amber-600 font-black">
                    {overallStats.pendingAmount > 0 ? 'تتطلب متابعة التحصيل' : 'لا توجد معلقات'}
                  </span>
                </div>
              </div>

              {/* Card 3: الضريبة المحصلة (15%) */}
              <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-indigo-100 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[200px] group hover:shadow-md transition-all">
                <div className="w-full space-y-2.5">
                  {/* Top row: Icon + Badge */}
                  <div className="w-full flex items-center justify-between">
                    <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                      <Layers size={22} className="stroke-[2.5]" />
                    </div>
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-full text-xs font-black">
                      15% الضريبة النظامية
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div className="w-full pt-1">
                    <span className="text-sm font-black text-slate-800 block">الضريبة المحصلة (15%)</span>
                    <span className="text-xs text-slate-400 font-medium block mt-0.5">ضريبة القيمة المضافة المحصلة</span>
                  </div>

                  {/* Amount */}
                  <div className="pt-1">
                    <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-indigo-600">
                      {formatMoney(overallStats.taxTotal)} <span className="text-sm sm:text-base font-bold text-slate-500">ر.س</span>
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-bold mt-3">
                  <span>الفواتير المشمولة بالضريبة:</span>
                  <span className="font-mono text-slate-700 font-black">
                    {formatInteger(overallStats.paidOrdersCount)} فاتورة
                  </span>
                </div>
              </div>

              {/* Card 4: إجمالي طلبات الفترة ونسبة التحصيل */}
              <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-100 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[200px] group hover:shadow-md transition-all">
                <div className="w-full space-y-2.5">
                  {/* Top row: Icon + Badge */}
                  <div className="w-full flex items-center justify-between">
                    <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                      <CheckCircle size={22} className="stroke-[2.5]" />
                    </div>
                    <span className="bg-blue-50 text-blue-700 border border-blue-200/60 px-2.5 py-1 rounded-full text-xs font-black">
                      {overallStats.collectionRate}% نسبة التحصيل
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div className="w-full pt-1">
                    <span className="text-sm font-black text-slate-800 block">إجمالي طلبات الفترة</span>
                    <span className="text-xs text-slate-400 font-medium block mt-0.5">سجل حركة الفواتير المعتمدة</span>
                  </div>

                  {/* Amount */}
                  <div className="pt-1">
                    <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900">
                      {formatInteger(overallStats.totalOrdersCount)} <span className="text-sm sm:text-base font-bold text-slate-500">طلب</span>
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-bold mt-3">
                  <span className="text-emerald-600 font-black">{formatInteger(overallStats.paidOrdersCount)} مدفوع</span>
                  <span className="text-amber-600 font-black">{formatInteger(overallStats.pendingPaymentCount)} معلق</span>
                </div>
              </div>
            </div>

            {/* Today's Summary (ملخص اليوم) Placed before the Sales Chart */}
            <div className="bg-white rounded-[2.2rem] p-6 sm:p-7 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-800">ملخص اليوم</h3>
                <span className="text-xs font-bold text-slate-400">
                  {new Date().toLocaleDateString('ar-SA-u-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-100">
                {/* Metric 1: إجمالي المبيعات */}
                <div className="flex items-center gap-4 py-3 sm:py-2 sm:px-4 first:pr-0">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                    <Wallet size={22} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 block">إجمالي مبيعات اليوم</span>
                    <span className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                      {formatMoney(todayStats.todayTotalRevenue)} <span className="text-xs font-bold text-slate-500">ر.س</span>
                    </span>
                    <span className="text-[11px] text-emerald-600 font-bold block">
                      المحصل: {formatMoney(todayStats.todayPaidRevenue)} ر.س
                    </span>
                  </div>
                </div>

                {/* Metric 2: عدد الفواتير */}
                <div className="flex items-center gap-4 py-3 sm:py-2 sm:px-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                    <FileText size={22} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 block">عدد الفواتير اليوم</span>
                    <span className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                      {formatInteger(todayStats.todayOrdersCount)} <span className="text-xs font-bold text-slate-500">فاتورة</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-bold block">
                      {formatInteger(todayStats.todayPaidCount)} مدفوعة • {formatInteger(todayStats.todayPendingCount)} معلقة
                    </span>
                  </div>
                </div>

                {/* Metric 3: متوسط الفاتورة */}
                <div className="flex items-center gap-4 py-3 sm:py-2 sm:px-4 last:pl-0">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
                    <BarChart3 size={22} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 block">متوسط الفاتورة</span>
                    <span className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                      {formatMoney(todayStats.avgOrderValue)} <span className="text-xs font-bold text-slate-500">ر.س</span>
                    </span>
                    <span className="text-[11px] text-amber-600 font-bold block">
                      المعلق اليوم: {formatMoney(todayStats.todayPendingRevenue)} ر.س
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sales Chart Section (المبيعات وحركة الفواتير) */}
            <div className="bg-white rounded-[2.2rem] p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">
                      المبيعات خلال {dashboardChartPeriod === '30' ? '30 يوم' : (dashboardChartPeriod === '14' ? '14 يوم' : '7 أيام')}
                    </h3>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                      إجمالي الفترة: {formatMoney(chartDaysData.reduce((sum, d) => sum + d.amount, 0))} ر.س
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold mt-1">مؤشر حركة المبيعات اليومية وتطور الإيرادات الفعلية</p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-black">
                    <button
                      type="button"
                      onClick={() => setDashboardChartPeriod('7')}
                      className={`px-3 py-1.5 rounded-xl transition-all ${
                        dashboardChartPeriod === '7' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      7 أيام
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardChartPeriod('14')}
                      className={`px-3 py-1.5 rounded-xl transition-all ${
                        dashboardChartPeriod === '14' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      14 يوم
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardChartPeriod('30')}
                      className={`px-3 py-1.5 rounded-xl transition-all ${
                        dashboardChartPeriod === '30' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      30 يوم
                    </button>
                  </div>
                </div>
              </div>

              {/* Responsive SVG Smooth Area Chart */}
              <div className="relative w-full overflow-hidden pt-4 pb-2">
                {(() => {
                  const svgW = 700;
                  const svgH = 220;
                  const pad = { top: 35, bottom: 45, left: 35, right: 35 };
                  const maxVal = Math.max(...chartDaysData.map(d => d.amount), 1000);
                  
                  // Compute points
                  const points = chartDaysData.map((d, i) => {
                    const x = pad.left + (i / Math.max(1, chartDaysData.length - 1)) * (svgW - pad.left - pad.right);
                    const y = svgH - pad.bottom - (d.amount / maxVal) * (svgH - pad.top - pad.bottom);
                    return { x, y, data: d, index: i };
                  });

                  // Build smooth cubic bezier line path
                  let linePath = `M ${points[0].x} ${points[0].y}`;
                  for (let i = 0; i < points.length - 1; i++) {
                    const p0 = points[i === 0 ? 0 : i - 1];
                    const p1 = points[i];
                    const p2 = points[i + 1];
                    const p3 = points[i + 2] || p2;
                    const cp1x = p1.x + (p2.x - p0.x) / 6;
                    const cp1y = p1.y + (p2.y - p0.y) / 6;
                    const cp2x = p2.x - (p3.x - p1.x) / 6;
                    const cp2y = p2.y - (p3.y - p1.y) / 6;
                    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
                  }

                  const areaPath = `${linePath} L ${points[points.length - 1].x} ${svgH - pad.bottom} L ${points[0].x} ${svgH - pad.bottom} Z`;

                  // Peak Point
                  const peakPoint = points.reduce((prev, curr) => (curr.data.amount > prev.data.amount ? curr : prev), points[0]);

                  return (
                    <div className="relative">
                      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto overflow-visible select-none">
                        <defs>
                          <linearGradient id="salesAreaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Horizontal Grid Guidelines */}
                        {[0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                          const y = pad.top + (1 - ratio) * (svgH - pad.top - pad.bottom);
                          return (
                            <g key={idx}>
                              <line
                                x1={pad.left}
                                y1={y}
                                x2={svgW - pad.right}
                                y2={y}
                                stroke="#F1F5F9"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                              />
                            </g>
                          );
                        })}

                        {/* Baseline */}
                        <line
                          x1={pad.left}
                          y1={svgH - pad.bottom}
                          x2={svgW - pad.right}
                          y2={svgH - pad.bottom}
                          stroke="#E2E8F0"
                          strokeWidth="1.5"
                        />

                        {/* Gradient Area */}
                        <path d={areaPath} fill="url(#salesAreaGradient)" />

                        {/* Stroke Curve */}
                        <path
                          d={linePath}
                          fill="none"
                          stroke="#2563EB"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Data Points */}
                        {points.map((pt, i) => (
                          <g key={i} className="cursor-pointer">
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={hoveredChartPoint === i ? "8" : "5"}
                              fill="#FFFFFF"
                              stroke="#2563EB"
                              strokeWidth="3"
                              className="transition-all duration-150"
                              onMouseEnter={() => setHoveredChartPoint(i)}
                              onMouseLeave={() => setHoveredChartPoint(null)}
                            />
                            {/* X-axis Day Labels */}
                            {(() => {
                              const totalPts = points.length;
                              let showLabel = true;
                              if (totalPts > 14) {
                                showLabel = i % 5 === 0 || i === totalPts - 1;
                              } else if (totalPts > 7) {
                                showLabel = i % 2 === 0 || i === totalPts - 1;
                              }
                              if (!showLabel) return null;

                              return (
                                <text
                                  x={pt.x}
                                  y={svgH - 15}
                                  textAnchor="middle"
                                  fontSize={totalPts > 7 ? "9" : "11"}
                                  fontWeight="700"
                                  fill="#64748B"
                                >
                                  {totalPts > 7 ? pt.data.dateStr : pt.data.dayName}
                                </text>
                              );
                            })()}
                          </g>
                        ))}

                        {/* Peak Badge (matching screenshot tag) */}
                        {peakPoint && peakPoint.data.amount > 0 && (
                          <g transform={`translate(${peakPoint.x}, ${Math.max(15, peakPoint.y - 14)})`}>
                            <rect
                              x="-38"
                              y="-22"
                              width="76"
                              height="22"
                              rx="11"
                              fill="#2563EB"
                              filter="drop-shadow(0px 2px 4px rgba(37,99,235,0.3))"
                            />
                            <polygon points="0,3 -4,-1 4,-1" fill="#2563EB" />
                            <text
                              x="0"
                              y="-8"
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight="900"
                              fill="#FFFFFF"
                            >
                              {formatInteger(Math.round(peakPoint.data.amount))} ر.س
                            </text>
                          </g>
                        )}
                      </svg>

                      {/* Tooltip on Hover */}
                      {hoveredChartPoint !== null && points[hoveredChartPoint] && (
                        <div
                          className="absolute z-20 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl text-xs font-bold shadow-2xl pointer-events-none -translate-x-1/2 -translate-y-full border border-slate-700/60 min-w-[150px]"
                          style={{
                            left: `${(points[hoveredChartPoint].x / svgW) * 100}%`,
                            top: `${(points[hoveredChartPoint].y / svgH) * 100 - 15}%`,
                          }}
                        >
                          <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-between gap-3 border-b border-slate-800 pb-1">
                            <span>{points[hoveredChartPoint].data.dayName}</span>
                            <span>{points[hoveredChartPoint].data.dateStr}</span>
                          </div>
                          <div className="text-emerald-400 font-mono font-black text-sm">
                            {formatMoney(points[hoveredChartPoint].data.amount)} <span className="text-[10px]">ر.س</span>
                          </div>
                          <div className="text-[11px] text-blue-300 font-bold mt-0.5">
                            المحصل: {formatMoney(points[hoveredChartPoint].data.paidAmount)} ر.س
                          </div>
                          <div className="text-[10px] text-slate-300 mt-0.5">
                            {formatInteger(points[hoveredChartPoint].data.count)} فاتورة مسجلة
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Quick Customer Directory Modal */}
            {showCustomersModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4" onClick={() => setShowCustomersModal(false)}>
                <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                        <Users size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900">سجل العملاء النشطين</h3>
                        <p className="text-xs text-slate-400 font-bold">إجمالي العملاء: {uniqueCustomersList.length} عميل</p>
                      </div>
                    </div>
                    <button onClick={() => setShowCustomersModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="relative mb-4">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="البحث باسم العميل أو رقم الهاتف..."
                      value={customerSearchTerm}
                      onChange={e => setCustomerSearchTerm(e.target.value)}
                      className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all text-right"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 pl-1">
                    {uniqueCustomersList
                      .filter(c => !customerSearchTerm || c.name.includes(customerSearchTerm) || c.phone.includes(customerSearchTerm))
                      .map((cust, idx) => (
                        <div key={idx} className="p-3.5 bg-slate-50 hover:bg-emerald-50/40 rounded-2xl border border-slate-100 flex items-center justify-between gap-3 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center font-black text-emerald-700 text-sm">
                              {cust.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-800">{cust.name}</p>
                              <p className="text-[11px] font-mono text-slate-500" dir="ltr">{cust.phone}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-left hidden sm:block">
                              <span className="text-[10px] text-slate-400 block">{cust.totalOrders} فواتير</span>
                              <span className="text-xs font-black text-emerald-600 font-mono">{cust.totalSpent.toFixed(2)} ر.س</span>
                            </div>

                            <a
                              href={`https://wa.me/${cust.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all"
                              title="محادثة واتساب"
                            >
                              <MessageCircle size={16} />
                            </a>

                            <button
                              onClick={() => {
                                setNewOrder(prev => ({ ...prev, customer_name: cust.name, customer_phone: cust.phone }));
                                setShowCustomersModal(false);
                                setActiveTab('new-order');
                              }}
                              className="px-3 py-2 bg-white border border-slate-200 hover:border-emerald-500 text-slate-700 hover:text-emerald-700 rounded-xl text-xs font-black transition-all"
                            >
                              طلب جديد
                            </button>
                          </div>
                        </div>
                      ))}

                    {uniqueCustomersList.length === 0 && (
                      <div className="text-center py-10 text-slate-400">
                        <Users size={36} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-bold">لا يوجد عملاء مسجلين حالياً</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Cashier Notes Modal (المذكرات) */}
            {showNotesModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4" onClick={() => setShowNotesModal(false)}>
                <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-100" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center">
                        <FileCheck size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900">مذكرات الكاشير اليومية</h3>
                        <p className="text-xs text-slate-400 font-bold">ملاحظات سريعة وتعليمات التسليم</p>
                      </div>
                    </div>
                    <button onClick={() => setShowNotesModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <textarea
                      value={quickNotesText}
                      onChange={e => {
                        setQuickNotesText(e.target.value);
                        localStorage.setItem('laundry_quick_notes', e.target.value);
                      }}
                      rows={8}
                      placeholder="اكتب ملاحظاتك هنا... (مثال: تجهيز طلبات المستعجل، تنبيه غسيل القطع الحساسة...)"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-teal-500 focus:bg-white transition-all text-right leading-relaxed resize-none"
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-teal-600 font-bold flex items-center gap-1">
                        <Check size={14} /> يتم الحفظ تلقائياً في المتصفح
                      </span>

                      <button
                        onClick={() => setShowNotesModal(false)}
                        className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition-all"
                      >
                        إغلاق وحفظ
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'super-admin' && userProfile?.role === 'super_admin' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 text-right" dir="rtl">
            {/* Users Control Table Section */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-6">
              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="البحث باسم المستخدم، البريد، أو المغسلة..."
                    className="w-full pr-12 pl-4 py-3.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-xs text-right transition-all"
                    value={superAdminSearchQuery}
                    onChange={e => setSuperAdminSearchQuery(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <select
                    className="px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-700 outline-none"
                    value={superAdminRoleFilter}
                    onChange={e => setSuperAdminRoleFilter(e.target.value)}
                  >
                    <option value="all">كافة الصلاحيات</option>
                    <option value="super_admin">إدارة عليا (Super Admin)</option>
                    <option value="admin">مدير نظام (Admin)</option>
                    <option value="manager">مشرف (Manager)</option>
                    <option value="staff">موظف (Staff)</option>
                  </select>

                  <select
                    className="px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-700 outline-none"
                    value={superAdminStatusFilter}
                    onChange={e => setSuperAdminStatusFilter(e.target.value)}
                  >
                    <option value="all">كافة الحالات</option>
                    <option value="active">مفعّل فقط</option>
                    <option value="disabled">معطّل فقط</option>
                  </select>
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs font-black">
                      <th className="py-4 px-2">المستخدم والبريد</th>
                      <th className="py-4 px-2">الصلاحية والمغسلة</th>
                      <th className="py-4 px-2">انتهاء الاشتراك / الباقة</th>
                      <th className="py-4 px-2 text-left">التحكم والعمليات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredSuperAdminProfiles.map(p => {
                      const isDisabled = p.is_disabled || p.status === 'disabled';

                      // Calculate subscription status and expiry
                      let expiryDateDisplay = 'غير محدد';
                      let daysRemaining: number | null = null;
                      let isExpired = false;
                      if (p.saas_expiry) {
                        try {
                          const expDate = new Date(p.saas_expiry);
                          if (!isNaN(expDate.getTime())) {
                            expiryDateDisplay = expDate.toISOString().split('T')[0];
                            const diffDays = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            daysRemaining = diffDays;
                            isExpired = diffDays <= 0;
                          }
                        } catch (e) {}
                      }
                      const planLabel = p.saas_plan === 'basic' ? '🌟 باقة أساسية' : p.saas_plan === 'trial' ? '⏳ باقة تجريبية' : '👑 باقة ذهبية';
                      const cycleLabel = p.saas_billing_cycle === 'monthly' ? 'شهري' : p.saas_billing_cycle === 'trial' ? 'تجريبي' : 'سنوي';

                      return (
                        <tr key={p.id} className={`hover:bg-slate-50/80 transition-all ${isDisabled ? 'bg-red-50/20' : ''}`}>
                          <td className="py-5 px-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                                p.role === 'super_admin' ? 'bg-amber-100 text-amber-800' :
                                p.role === 'admin' ? 'bg-indigo-100 text-indigo-800' :
                                p.role === 'manager' ? 'bg-emerald-100 text-emerald-800' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {p.full_name ? p.full_name.charAt(0) : p.email.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-800">{p.full_name || 'بدون اسم'}</p>
                                <span className="text-[10px] font-mono text-slate-400 block" dir="ltr">{p.email}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-5 px-2">
                            <div className="space-y-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${
                                p.role === 'super_admin' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                p.role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                                p.role === 'manager' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {p.role === 'super_admin' ? '👑 إدارة عليا (Super Admin)' :
                                 p.role === 'admin' ? 'مدير نظام' :
                                 p.role === 'manager' ? 'مشرف' : 'موظف'}
                              </span>
                              <p className="text-[11px] font-bold text-slate-500">
                                🏢 {p.laundry_name || 'غير محدد'}
                              </p>
                            </div>
                          </td>

                          <td className="py-5 px-2">
                            {p.role === 'super_admin' ? (
                              <div className="space-y-1">
                                <span className="px-2.5 py-1 rounded-xl text-[10px] font-black inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200">
                                  <Crown size={12} className="text-amber-600" />
                                  <span>اشتراك دائم (إدارة عليا)</span>
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 block">غير محدود الصلاحية</span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                                    isExpired 
                                      ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                      : daysRemaining !== null && daysRemaining <= 7 
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}>
                                    {isExpired ? '⚠️ منتهي الصلاحية' : `ساري (متبقي ${daysRemaining} يوم)`}
                                  </span>
                                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                                    {planLabel} ({cycleLabel})
                                  </span>
                                </div>
                                <div className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                                  <span className="text-slate-400 font-bold text-[10px]">ينتهي في:</span>
                                  <span dir="ltr" className="font-mono text-slate-800 font-black">{expiryDateDisplay}</span>
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="py-5 px-2 text-left">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Toggle Active / Disabled Status Button - Only for non-super_admin users */}
                              {p.role !== 'super_admin' && (
                                <button
                                  onClick={() => toggleUserDisabledStatus(p)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                                    isDisabled
                                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                      : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
                                  }`}
                                  title={isDisabled ? 'تفعيل الحساب' : 'تعطيل الحساب'}
                                >
                                  {isDisabled ? 'تفعيل 🔓' : 'تعطيل 🔒'}
                                </button>
                              )}

                              {/* Edit / Renew SaaS Subscription Button */}
                              <button
                                onClick={() => {
                                  const expStr = p.saas_expiry ? new Date(p.saas_expiry) : new Date(Date.now() + 365*24*60*60*1000);
                                  const validExpStr = !isNaN(expStr.getTime()) ? expStr.toISOString().split('T')[0] : new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0];
                                  setSubscriptionForm({
                                    saas_plan: (p.saas_plan as any) || 'gold',
                                    saas_billing_cycle: (p.saas_billing_cycle as any) || 'annual',
                                    saas_expiry: validExpStr
                                  });
                                  setEditingSubscriptionUser(p);
                                }}
                                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 transition-all"
                                title="تعديل وتجديد اشتراك وباقة المنصة"
                              >
                                <CreditCard size={15} />
                              </button>

                              {/* Change Password Button */}
                              <button
                                onClick={() => {
                                  setChangingPasswordUser(p);
                                  setNewPasswordInput('');
                                }}
                                className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl border border-amber-200 transition-all"
                                title="تغيير كلمة المرور"
                              >
                                <Lock size={15} />
                              </button>

                              {/* Edit Profile Info Button */}
                              <button
                                onClick={() => {
                                  setEditingUserProfile(p);
                                  const expStr = p.saas_expiry ? new Date(p.saas_expiry) : new Date(Date.now() + 365*24*60*60*1000);
                                  const validExpStr = !isNaN(expStr.getTime()) ? expStr.toISOString().split('T')[0] : new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0];
                                  setEditingUserForm({
                                    full_name: p.full_name || '',
                                    role: p.role || 'staff',
                                    laundry_id: p.laundry_id || '',
                                    laundry_name: p.laundry_name || '',
                                    permissions: (p.permissions !== undefined && p.permissions !== null)
                                      ? p.permissions 
                                      : ROLE_PERMISSIONS[p.role] || [],
                                    saas_plan: (p.saas_plan as any) || 'gold',
                                    saas_billing_cycle: (p.saas_billing_cycle as any) || 'annual',
                                    saas_expiry: validExpStr
                                  });
                                }}
                                className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl border border-indigo-200 transition-all"
                                title="تعديل الحساب والصلاحيات"
                              >
                                <Edit3 size={15} />
                              </button>

                              {/* Delete User Button - Only for non-super_admin users */}
                              {p.role !== 'super_admin' && (
                                <button
                                  onClick={() => setUserToDelete(p)}
                                  disabled={p.id === session?.user?.id}
                                  className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="حذف الحساب"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredSuperAdminProfiles.length === 0 && (
                  <div className="text-center py-12 text-slate-400 font-bold">
                    لا توجد حسابات تنطبق عليها معايير البحث الحالية
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      </div>

      {/* Modals */}
      {changingPasswordUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 max-w-md w-full text-right space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Lock size={20} className="text-amber-600" /> تغيير كلمة المرور
              </h3>
              <button onClick={() => setChangingPasswordUser(null)} className="p-2 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 space-y-1">
              <p className="text-xs font-black text-amber-900">المستخدم المستهدف:</p>
              <p className="text-sm font-black text-slate-800">{changingPasswordUser.full_name || changingPasswordUser.email}</p>
              <p className="text-[11px] font-mono text-slate-500">{changingPasswordUser.email}</p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  placeholder="أدخل كلمة المرور الجديدة (6 خانات على الأقل)"
                  required
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 focus:border-amber-500 rounded-2xl outline-none font-bold text-sm text-right transition-all"
                  value={newPasswordInput}
                  onChange={e => setNewPasswordInput(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={passwordChangeLoading}
                  className="flex-1 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {passwordChangeLoading ? <Loader2 size={16} className="animate-spin" /> : 'حفظ كلمة المرور الجديدة 🔑'}
                </button>
                <button
                  type="button"
                  onClick={() => setChangingPasswordUser(null)}
                  className="px-5 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showPackageModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-right" dir="rtl">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black">{editingPackageId ? 'تعديل باقة الاشتراك' : 'إنشاء باقة اشتراك جديدة'}</h3>
              <button 
                onClick={() => { 
                  setShowPackageModal(false); 
                  setEditingPackageId(null); 
                  setPackageForm({ name: '', total_items: 0, price: 0, duration_days: 30, discount_percent: 0, isUnlimitedDays: false }); 
                }} 
                className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:text-red-500 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">اسم الباقة</label>
                <input 
                  type="text" 
                  placeholder="مثال: الباقة البرونزية" 
                  className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-500 transition-all" 
                  value={packageForm.name} 
                  onChange={e => setPackageForm({...packageForm, name: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">عدد القطع</label>
                  <input 
                    type="number" 
                    placeholder="30" 
                    className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-500 transition-all" 
                    value={packageForm.total_items} 
                    onChange={e => setPackageForm({...packageForm, total_items: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-400 uppercase">السعر (ريال)</label>
                    <button
                      type="button"
                      onClick={() => setPackageForm({ ...packageForm, price: 0 })}
                      className="text-[10px] font-black text-indigo-600 hover:underline"
                    >
                      مجاني (0)
                    </button>
                  </div>
                  <input 
                    type="number" 
                    placeholder="150" 
                    className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-500 transition-all" 
                    value={packageForm.price} 
                    onChange={e => setPackageForm({...packageForm, price: e.target.value})} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                {/* Duration Column */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-400 uppercase">المدة (أيام)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const isCurrentlyUnlimited = packageForm.isUnlimitedDays || packageForm.duration_days === 0 || packageForm.duration_days === '0';
                        const nextUnlimited = !isCurrentlyUnlimited;
                        setPackageForm({
                          ...packageForm,
                          isUnlimitedDays: nextUnlimited,
                          duration_days: nextUnlimited ? 0 : 30
                        });
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 border ${
                        packageForm.isUnlimitedDays || packageForm.duration_days === 0 || packageForm.duration_days === '0'
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      <span>♾️ لا محدود</span>
                    </button>
                  </div>

                  {packageForm.isUnlimitedDays || packageForm.duration_days === 0 || packageForm.duration_days === '0' ? (
                    <div className="w-full px-3 py-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 font-black text-xs">
                      <span>لا محدود</span>
                      <button
                        type="button"
                        onClick={() => setPackageForm({ ...packageForm, isUnlimitedDays: false, duration_days: 30 })}
                        className="text-[10px] text-indigo-600 hover:underline font-bold"
                      >
                        أيام
                      </button>
                    </div>
                  ) : (
                    <input 
                      type="number" 
                      placeholder="30" 
                      className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-500 transition-all" 
                      value={packageForm.duration_days} 
                      onChange={e => setPackageForm({...packageForm, duration_days: e.target.value, isUnlimitedDays: false})} 
                    />
                  )}
                </div>

                {/* Discount Column */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">الخصم (%)</label>
                  <input 
                    type="number" 
                    placeholder="الخصم (%)" 
                    className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-500 transition-all" 
                    value={packageForm.discount_percent} 
                    onChange={e => setPackageForm({...packageForm, discount_percent: e.target.value})} 
                  />
                </div>
              </div>

              <button onClick={handleCreatePackage} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black mt-4 transition-all shadow-lg shadow-indigo-100">
                {editingPackageId ? 'حفظ التعديلات' : 'حفظ الباقة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isInvModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-right" dir="rtl">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6 shrink-0 border-b border-slate-100 pb-4">
              <h3 className="text-xl font-black text-indigo-950">إضافة مادة جديدة للمخزون</h3>
              <button onClick={() => { setIsInvModalOpen(false); setNewInvConsumption({}); }} className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:text-red-500 transition-all"><X size={20} /></button>
            </div>
            <div className="space-y-4 overflow-y-auto custom-scrollbar pr-1 pl-1 flex-1">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">اختر من القائمة المسبقة أو مادة مخصصة</label>
                <select
                  className="w-full px-5 py-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl outline-none font-bold text-sm text-indigo-900 cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setNewInvItem({ name: '', stock: 0, unit: 'قطعة', threshold: 5, defaultConsumption: 10 });
                      setNewInvConsumption({});
                    } else {
                      const found = PRESET_INVENTORY_ITEMS.find(p => p.name === val);
                      if (found) {
                        const defVal = found.defaultConsumption !== undefined ? found.defaultConsumption : (found.threshold || 10);
                        setNewInvItem({
                          name: found.name,
                          stock: found.stock,
                          unit: found.unit,
                          threshold: found.threshold || 10,
                          defaultConsumption: defVal
                        });
                        setNewInvConsumption({});
                      }
                    }
                  }}
                  defaultValue="custom"
                >
                  <option value="custom">✨ مادة جديدة مخصصة...</option>
                  {PRESET_INVENTORY_ITEMS.map((item, idx) => (
                    <option key={idx} value={item.name}>
                      {item.name} ({item.stock} {item.unit} - استهلاك: {item.defaultConsumption})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">اسم المادة</label>
                <input type="text" placeholder="مثال: صابون سائل" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-850" value={newInvItem.name} onChange={e => setNewInvItem({...newInvItem, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">الكمية الحالية</label>
                  <input type="number" placeholder="0" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={newInvItem.stock || ''} onChange={e => setNewInvItem({...newInvItem, stock: parseInt(e.target.value) || 0})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">الوحدة</label>
                  <input type="text" placeholder="قطعة / مل / كيس" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={newInvItem.unit} onChange={e => setNewInvItem({...newInvItem, unit: e.target.value})} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">حد التنبيه</label>
                  <input type="number" placeholder="5" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={newInvItem.threshold || ''} onChange={e => setNewInvItem({...newInvItem, threshold: parseInt(e.target.value) || 0})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">عدد القطع للاستهلاك (لكل غسلة/طلب)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    placeholder="10" 
                    className="w-full px-5 py-4 bg-indigo-50/50 border border-indigo-100 text-indigo-900 rounded-2xl outline-none font-bold" 
                    value={newInvItem.defaultConsumption === undefined ? '' : newInvItem.defaultConsumption} 
                    onChange={e => setNewInvItem({...newInvItem, defaultConsumption: parseFloat(e.target.value) || 0})} 
                  />
                </div>
              </div>

              {/* Linked Laundry Categories (أصناف كاشير جديد) */}
              <div className="pt-2 text-right space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-black text-slate-600 block">
                    ربط المواد الاستهلاكية (الكمية المستهلكة من المخزون لكل صنف)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button 
                      type="button" 
                      onClick={() => {
                        const defVal = newInvItem.defaultConsumption !== undefined ? newInvItem.defaultConsumption : 10;
                        const updatedMap: Record<string, number> = {};
                        const catList = categories.length > 0 ? categories : INITIAL_ITEMS;
                        catList.forEach(c => { updatedMap[c.name] = defVal; });
                        setNewInvConsumption(updatedMap);
                      }}
                      className="text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-xl transition-all"
                    >
                      تطبيق على الجميع ⚡
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setNewInvConsumption({})}
                      className="text-[10px] font-black text-slate-500 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-xl transition-all"
                    >
                      إلغاء الكل ❌
                    </button>
                  </div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                  حدد الأصناف والكمية التي سيتم خصمها تلقائياً عند اختيار الصنف في الكاشير:
                </p>
                <div className="max-h-52 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 custom-scrollbar">
                  {(categories.length > 0 ? categories : INITIAL_ITEMS).map((cat, idx) => {
                    const currentConsVal = newInvConsumption[cat.name] || 0;
                    const isSelected = currentConsVal > 0;
                    return (
                      <div 
                        key={cat.id || `${cat.name}-${idx}`} 
                        className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all ${
                          isSelected ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const toggleVal = isSelected ? 0 : (newInvItem.defaultConsumption || 10);
                              setNewInvConsumption(prev => ({
                                ...prev,
                                [cat.name]: toggleVal
                              }));
                            }}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                              isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-100 border-slate-300 text-transparent hover:border-indigo-400'
                            }`}
                          >
                            <Check size={12} />
                          </button>
                          {renderCategoryIcon(cat.icon, "w-6 h-6 text-xs flex items-center justify-center rounded-md overflow-hidden bg-slate-100 shrink-0")}
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-800">{cat.name}</span>
                            <span className="text-[9px] font-bold text-slate-400">الوحدة: {newInvItem.unit || 'قطعة'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input 
                            type="number" 
                            step="0.1" 
                            min="0"
                            placeholder="0 (غير مرتبط)" 
                            className="w-20 px-2 py-1.5 text-center font-black text-xs bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-indigo-500"
                            value={currentConsVal === 0 ? '' : currentConsVal}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setNewInvConsumption(prev => ({
                                ...prev,
                                [cat.name]: val
                              }));
                            }}
                          />
                          <span className="text-[10px] font-bold text-slate-400">{newInvItem.unit || 'قطعة'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={handleAddInventoryItem} 
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black mt-4 flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 shrink-0"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> حفظ المادة وربط الاستهلاك</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Stock Adjustment Modal */}
      {customStockModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-right" dir="rtl">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-6 md:p-8 shadow-2xl animate-in zoom-in-95 max-h-[95vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <SlidersHorizontal size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">تعديل كمية المخزون</h3>
                  <p className="text-xs font-bold text-slate-400">{customStockModalItem.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setCustomStockModalItem(null)} 
                className="p-2 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto custom-scrollbar flex-1 pr-1 pl-1">
              {/* Current Stock Banner */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-black text-slate-400 block">الرصيد الحالي المتوفر</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-slate-800">{customStockModalItem.stock}</span>
                    <span className="text-xs font-bold text-slate-500">{customStockModalItem.unit}</span>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-xl text-xs font-black ${
                  customStockModalItem.stock <= customStockModalItem.threshold ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {customStockModalItem.stock <= customStockModalItem.threshold ? 'مخزون منخفض ⚠️' : 'متوفر بالمخزن ✅'}
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 block">نوع العملية</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCustomStockMode('add')}
                    className={`py-3.5 px-4 rounded-2xl text-xs font-black border transition-all flex items-center justify-center gap-2 ${
                      customStockMode === 'add' 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100' 
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Plus size={18} className={customStockMode === 'add' ? 'text-white' : 'text-emerald-600'} />
                    <span>+ زيادة المخزون (إضافة)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomStockMode('subtract')}
                    className={`py-3.5 px-4 rounded-2xl text-xs font-black border transition-all flex items-center justify-center gap-2 ${
                      customStockMode === 'subtract' 
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-100' 
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Minus size={18} className={customStockMode === 'subtract' ? 'text-white' : 'text-rose-600'} />
                    <span>- إنقاص المخزون (خصم)</span>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 block">
                  {customStockMode === 'add' ? 'الكمية المراد إضافتها إلى الرصيد' : 'الكمية المراد خصمها من الرصيد'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="أدخل الكمية..."
                    className="w-full pl-16 pr-5 py-4 bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl outline-none font-black text-xl text-slate-900 text-right transition-all"
                    value={customStockAmount}
                    onChange={e => setCustomStockAmount(e.target.value)}
                    autoFocus
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">
                    {customStockModalItem.unit}
                  </span>
                </div>
              </div>

              {/* Quick Presets Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-black text-slate-400 block">قيم جاهزة وسريعة:</span>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 25, 50, 100, 200, 500, 1000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCustomStockAmount(String(val))}
                      className={`py-2 rounded-xl text-xs font-black border transition-all active:scale-95 ${
                        customStockAmount === String(val)
                          ? customStockMode === 'add' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-rose-50 border-rose-400 text-rose-700'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {customStockMode === 'add' ? `+${val}` : `-${val}`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCustomStockAmount('')}
                    className="py-2 rounded-xl text-xs font-black border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 transition-all"
                  >
                    مسح
                  </button>
                </div>
              </div>

              {/* Live Preview Calculation */}
              {customStockAmount !== '' && !isNaN(Number(customStockAmount)) && (
                <div className={`${customStockMode === 'add' ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-rose-50/70 border-rose-200 text-rose-900'} border rounded-2xl p-4 space-y-1.5`}>
                  <span className="text-[11px] font-black block">
                    {customStockMode === 'add' ? 'معاينة الزيادة في المخزن:' : 'معاينة الخصم من المخزن:'}
                  </span>
                  <div className="flex items-center justify-between font-black text-sm">
                    <span className="text-slate-600">
                      {customStockModalItem.stock} {customStockMode === 'add' ? '+' : '-'} {Number(customStockAmount)} =
                    </span>
                    <span className="text-base font-black">
                      {customStockMode === 'add'
                        ? customStockModalItem.stock + Number(customStockAmount)
                        : Math.max(0, customStockModalItem.stock - Number(customStockAmount))} {customStockModalItem.unit}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center gap-3 shrink-0 mt-4">
              <button
                type="button"
                disabled={customStockLoading || customStockAmount === '' || isNaN(Number(customStockAmount))}
                onClick={() => {
                  const amt = Number(customStockAmount);
                  handleCustomStockAdjust(customStockModalItem.id, amt, customStockMode);
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 transition-all active:scale-95"
              >
                {customStockLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <Save size={18} />
                    <span>تأكيد وحفظ التعديل</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCustomStockModalItem(null)}
                className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignSubModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black">تفعيل اشتراك للعميل</h3>
              <button onClick={() => setShowAssignSubModal(null)} className="p-2 bg-slate-100 rounded-xl text-slate-500"><X size={20} /></button>
            </div>
            <div className="mb-8 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <p className="text-sm font-black text-indigo-900">{showAssignSubModal.name}</p>
              <p className="text-xs font-bold text-indigo-600">{showAssignSubModal.phone}</p>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-black text-slate-400 uppercase mb-2">اختر الباقة المناسبة</p>
              {subscriptionPackages.map(pkg => (
                <button 
                  key={pkg.id} 
                  onClick={() => handleAssignSubscription(pkg.id)}
                  className="w-full flex items-center justify-between p-5 bg-white border-2 border-slate-50 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                >
                  <div className="text-right">
                    <p className="font-black text-slate-800 group-hover:text-indigo-900">{pkg.name}</p>
                    <p className="text-xs font-bold text-slate-400">
                      {pkg.total_items} قطعة - {pkg.duration_days === 0 || pkg.duration_days >= 36500 ? 'لا محدود' : `${pkg.duration_days} يوم`}
                    </p>
                  </div>
                  <p className="font-black text-indigo-600">{pkg.price === 0 ? 'مجاني' : `${pkg.price} ريال`}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCustomItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="text-xl font-black">صنف مخصص جديد</h3>
                 <button onClick={() => { setShowCustomItemModal(false); setShowIconPicker(false); }} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-all"><X size={20} /></button>
              </div>
              <div className="space-y-4 mb-6 text-right">
                <div>
                  <label className="text-xs font-black text-slate-400 block mb-1">اسم الصنف</label>
                  <input 
                    type="text" 
                    placeholder="مثال: بطانية كبير" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-slate-850 text-right" 
                    value={customItemForm.name} 
                    onChange={e => setCustomItemForm({...customItemForm, name: e.target.value})} 
                  />
                </div>

                {/* Icon Selection */}
                <div className="relative space-y-1.5">
                  <label className="text-xs font-black text-slate-400 block mb-1">أيقونة أو صورة الصنف</label>
                  <div className="flex items-center gap-2">
                    {/* Preview Box */}
                    <div className="w-12 h-12 rounded-2xl border-2 border-indigo-100 bg-indigo-50/50 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                      {isImageIcon(customItemForm.icon) ? (
                        <img src={customItemForm.icon} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <span className="text-2xl">{customItemForm.icon || '✨'}</span>
                      )}
                    </div>

                    <input 
                      type="text" 
                      placeholder="رمز/إيموجي أو رابط صورة..." 
                      className="flex-1 min-w-0 px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 text-right text-xs focus:border-indigo-500 focus:bg-white transition-all" 
                      value={customItemForm.icon} 
                      onChange={e => setCustomItemForm({...customItemForm, icon: e.target.value})} 
                    />

                    {/* Upload Image Button */}
                    <label className="px-3 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl text-xs font-black transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-sm">
                      <ImageIcon size={16} className="text-indigo-600" />
                      <span>رفع صورة</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const compressedBase64 = await compressImageFile(file);
                              setCustomItemForm({...customItemForm, icon: compressedBase64});
                            } catch (err) {
                              alert('فشل معالجة الصورة، يرجى اختيار صورة أخرى');
                            }
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowIconPicker(!showIconPicker)}
                      className="px-3 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-2xl text-xs font-black text-slate-600 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Smile size={16} className="text-indigo-600" />
                      <span>الأيقونات</span>
                    </button>
                  </div>

                  {/* Icon Picker Popover Dropdown */}
                  {showIconPicker && (
                    <div className="absolute top-full right-0 mt-2 z-[250] bg-white border border-slate-200 rounded-3xl p-3 shadow-2xl w-full animate-in fade-in zoom-in-95">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[11px] font-black text-slate-500">اختر إيموجي الصنف:</span>
                        <button 
                          type="button" 
                          onClick={() => setShowIconPicker(false)}
                          className="text-slate-400 hover:text-red-500 text-xs font-bold p-1"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-8 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1 bg-slate-50/50 rounded-2xl border border-slate-100">
                        {PRESET_CUSTOM_ICONS.map((ic, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setCustomItemForm({...customItemForm, icon: ic});
                              setShowIconPicker(false);
                            }}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all ${
                              customItemForm.icon === ic 
                                ? 'bg-indigo-600 text-white scale-110 shadow-md ring-2 ring-indigo-300' 
                                : 'bg-white hover:bg-indigo-50 border border-slate-100 text-slate-700'
                            }`}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-black text-slate-400 block mb-1">السعر العادي (أساسي)</label>
                  <input 
                    type="number" 
                    placeholder="السعر الرئيسي" 
                    className="w-full px-5 py-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl outline-none font-black text-indigo-700 text-right" 
                    value={customItemForm.price === 0 ? '0' : (customItemForm.price || '')} 
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                      setCustomItemForm({
                        ...customItemForm, 
                        price: val
                      });
                    }} 
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1 text-center">عادي</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="w-full px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-black text-center text-slate-700 font-bold" 
                      value={customItemForm.price_normal === 0 ? '0' : (customItemForm.price_normal || '')} 
                      onChange={e => setCustomItemForm({...customItemForm, price_normal: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0)})} 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-red-500 block mb-1 text-center">مستعجل 🔥</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="w-full px-2 py-3 bg-red-50/20 border border-red-100 rounded-xl outline-none font-black text-center text-red-600" 
                      value={customItemForm.price_urgent === 0 ? '0' : (customItemForm.price_urgent || '')} 
                      onChange={e => setCustomItemForm({...customItemForm, price_urgent: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0)})} 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-indigo-600 block mb-1 text-center">كوي</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="w-full px-2 py-3 bg-indigo-50/20 border border-indigo-100 rounded-xl outline-none font-black text-center text-indigo-600" 
                      value={customItemForm.price_ironing === 0 ? '0' : (customItemForm.price_ironing || '')} 
                      onChange={e => setCustomItemForm({...customItemForm, price_ironing: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0)})} 
                    />
                  </div>
                </div>
                
                <div className="pt-2">
                  <label className="text-xs font-black text-slate-400 block mb-2">ربط المواد الاستهلاكية (الكمية المستهلكة من المخزون)</label>
                  <div className="max-h-36 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 custom-scrollbar">
                    {inventory.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-100">
                        <div className="flex flex-col text-right">
                          <span className="text-xs font-black text-slate-800">{inv.name}</span>
                          <span className="text-[9px] font-bold text-slate-400">الوحدة: {inv.unit} (مخزون: {inv.stock})</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input 
                            type="number" 
                            step="0.1" 
                            min="0"
                            placeholder="0 (لا يوجد)" 
                            className="w-20 px-2 py-1 text-center font-black text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800"
                            value={customItemConsumptions[inv.id] || ''}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setCustomItemConsumptions(prev => ({
                                ...prev,
                                [inv.id]: val
                              }));
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {inventory.length === 0 && (
                      <p className="text-xs font-bold text-slate-400 text-center py-2">لا توجد مواد مضافة في المخزون حالياً</p>
                    )}
                  </div>
                </div>
              </div>
              <button 
                type="button"
                disabled={isAddingCustomItem}
                onClick={handleAddCustomItem} 
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isAddingCustomItem ? 'جاري الإضافة...' : 'إضافة للسلة'}
              </button>
           </div>
        </div>
      )}

      {/* Editing Category Popup Modal */}
      {editingCategoryModalIndex !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-right" dir="rtl">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900">تعديل الصنف</h3>
              <button 
                type="button"
                onClick={() => setEditingCategoryModalIndex(null)} 
                className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-6 text-right">
              {/* Name Input */}
              <div>
                <label className="text-xs font-black text-slate-400 block mb-1">اسم الصنف</label>
                <input 
                  type="text"
                  placeholder="مثال: بطانية كبير" 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-slate-850 text-right focus:border-indigo-500 focus:bg-white transition-all" 
                  value={editingCategoryForm.name} 
                  onChange={e => setEditingCategoryForm({...editingCategoryForm, name: e.target.value})} 
                />
              </div>

              {/* Icon Selection */}
              <div className="relative space-y-1.5">
                <label className="text-xs font-black text-slate-400 block mb-1">أيقونة أو صورة الصنف</label>
                <div className="flex items-center gap-2">
                  {/* Preview Box */}
                  <div className="w-12 h-12 rounded-2xl border-2 border-indigo-100 bg-indigo-50/50 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                    {isImageIcon(editingCategoryForm.icon) ? (
                      <img src={editingCategoryForm.icon} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <span className="text-2xl">{editingCategoryForm.icon || '✨'}</span>
                    )}
                  </div>

                  <input 
                    type="text" 
                    placeholder="رمز/إيموجي أو رابط صورة..." 
                    className="flex-1 min-w-0 px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 text-right text-xs focus:border-indigo-500 focus:bg-white transition-all" 
                    value={editingCategoryForm.icon} 
                    onChange={e => setEditingCategoryForm({...editingCategoryForm, icon: e.target.value})} 
                  />

                  {/* Upload Image Button */}
                  <label className="px-3 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl text-xs font-black transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-sm">
                    <ImageIcon size={16} className="text-indigo-600" />
                    <span>رفع صورة</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const compressedBase64 = await compressImageFile(file);
                            setEditingCategoryForm({...editingCategoryForm, icon: compressedBase64});
                          } catch (err) {
                            alert('فشل معالجة الصورة، يرجى اختيار صورة أخرى');
                          }
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowEditCategoryIconPicker(!showEditCategoryIconPicker)}
                    className="px-3 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-2xl text-xs font-black text-slate-600 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Smile size={16} className="text-indigo-600" />
                    <span>الأيقونات</span>
                  </button>
                </div>

                {/* Icon Picker Popover Dropdown */}
                {showEditCategoryIconPicker && (
                  <div className="absolute top-full right-0 mt-2 z-[250] bg-white border border-slate-200 rounded-3xl p-3 shadow-2xl w-full animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[11px] font-black text-slate-500">اختر إيموجي الصنف:</span>
                      <button 
                        type="button" 
                        onClick={() => setShowEditCategoryIconPicker(false)}
                        className="text-slate-400 hover:text-red-500 text-xs font-bold p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-8 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1 bg-slate-50/50 rounded-2xl border border-slate-100">
                      {PRESET_CUSTOM_ICONS.map((ic, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setEditingCategoryForm({...editingCategoryForm, icon: ic});
                            setShowEditCategoryIconPicker(false);
                          }}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all cursor-pointer ${
                            editingCategoryForm.icon === ic 
                              ? 'bg-indigo-600 text-white scale-110 shadow-md ring-2 ring-indigo-300' 
                              : 'bg-white hover:bg-indigo-50 border border-slate-100 text-slate-700'
                          }`}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Normal Main Base Price */}
              <div>
                <label className="text-xs font-black text-slate-400 block mb-1">السعر العادي (أساسي)</label>
                <input 
                  type="number" 
                  placeholder="السعر الرئيسي" 
                  className="w-full px-5 py-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl outline-none font-black text-indigo-700 text-right focus:border-indigo-500 focus:bg-white transition-all" 
                  value={editingCategoryForm.price_normal === 0 ? '0' : (editingCategoryForm.price_normal || '')} 
                  onChange={e => {
                    const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                    setEditingCategoryForm({
                      ...editingCategoryForm, 
                      price: val,
                      price_normal: val
                    });
                  }} 
                />
              </div>

              {/* 3 Prices Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1 text-center">عادي</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="w-full px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-black text-center text-slate-700 focus:border-indigo-500 focus:bg-white transition-all" 
                    value={editingCategoryForm.price_normal === 0 ? '0' : (editingCategoryForm.price_normal || '')} 
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                      setEditingCategoryForm({
                        ...editingCategoryForm, 
                        price: val,
                        price_normal: val
                      });
                    }} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-red-500 block mb-1 text-center">مستعجل 🔥</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="w-full px-2 py-3 bg-red-50/20 border border-red-100 rounded-xl outline-none font-black text-center text-red-600 focus:border-red-400 focus:bg-white transition-all" 
                    value={editingCategoryForm.price_urgent === 0 ? '0' : (editingCategoryForm.price_urgent || '')} 
                    onChange={e => setEditingCategoryForm({...editingCategoryForm, price_urgent: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0)})} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-600 block mb-1 text-center">كوي</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="w-full px-2 py-3 bg-indigo-50/20 border border-indigo-100 rounded-xl outline-none font-black text-center text-indigo-600 focus:border-indigo-400 focus:bg-white transition-all" 
                    value={editingCategoryForm.price_ironing === 0 ? '0' : (editingCategoryForm.price_ironing || '')} 
                    onChange={e => setEditingCategoryForm({...editingCategoryForm, price_ironing: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0)})} 
                  />
                </div>
              </div>

              {/* Inventory Linked Consumption */}
              <div className="pt-2">
                <label className="text-xs font-black text-slate-400 block mb-2">ربط المواد الاستهلاكية (الكمية المستهلكة من المخزون)</label>
                <div className="max-h-36 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 custom-scrollbar">
                  {inventory.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-100">
                      <div className="flex flex-col text-right">
                        <span className="text-xs font-black text-slate-800">{inv.name}</span>
                        <span className="text-[9px] font-bold text-slate-400">الوحدة: {inv.unit} (مخزون: {inv.stock})</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input 
                          type="number" 
                          step="0.1" 
                          min="0"
                          placeholder="0 (لا يوجد)" 
                          className="w-20 px-2 py-1 text-center font-black text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-indigo-500 focus:bg-white transition-all"
                          value={editingCategoryConsumptions[inv.id] || ''}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditingCategoryConsumptions(prev => ({
                              ...prev,
                              [inv.id]: val
                            }));
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {inventory.length === 0 && (
                    <p className="text-xs font-bold text-slate-400 text-center py-2">لا توجد مواد مضافة في المخزون حالياً</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button 
                type="button"
                disabled={isSavingCategory || isDeletingCategory}
                onClick={handleSaveCategoryEdit} 
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save size={18} />
                {isSavingCategory ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>

              <button 
                type="button"
                disabled={isDeletingCategory || isSavingCategory}
                onClick={async () => {
                  const targetCat = editingCategoryModalIndex !== null ? categories[editingCategoryModalIndex] : null;
                  const catId = targetCat?.id || editingCategoryForm.id;
                  const catName = targetCat?.name || editingCategoryForm.name;

                  if (!showDeleteCategoryConfirm) {
                    setShowDeleteCategoryConfirm(true);
                    return;
                  }

                  await deleteCategory({ id: catId, name: catName });
                  setEditingCategoryModalIndex(null);
                  setShowDeleteCategoryConfirm(false);
                }}
                className={`py-4 px-5 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 ${
                  showDeleteCategoryConfirm 
                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200' 
                    : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-100'
                }`}
                title="حذف الصنف"
              >
                <Trash2 size={20} />
                {showDeleteCategoryConfirm ? 'تأكيد الحذف؟' : ''}
              </button>

              {showDeleteCategoryConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteCategoryConfirm(false)}
                  className="px-4 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0"
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editingConsumptionItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-right" dir="rtl">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">ربط واستهلاك المواد - {editingConsumptionItem.name}</h3>
              <button 
                onClick={() => setEditingConsumptionItem(null)} 
                className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-xs font-bold text-slate-400 mb-4 leading-relaxed text-right">
              حدد المواد الاستهلاكية التي يتم استخدامها عند غسيل أو كي هذا الصنف والكمية التي سيتم خصمها من المخزون تلقائياً عند إنشاء الطلب.
            </p>

            <div className="max-h-60 overflow-y-auto px-1 py-1 text-right space-y-3 custom-scrollbar mb-6">
              {inventory.map(inv => {
                const currentVal = inventoryConsumption[editingConsumptionItem.name]?.[inv.id] || 0;
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-black text-slate-800">{inv.name}</span>
                      <span className="text-[9px] font-bold text-slate-400">الوحدة الحالية: {inv.unit}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        step="0.1" 
                        min="0"
                        placeholder="0 (لا يوجد)" 
                        className="w-24 px-3 py-2 text-center font-black text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-800 focus:border-indigo-500"
                        value={currentVal === 0 ? '' : currentVal}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setInventoryConsumption(prev => {
                            const updated = { ...prev };
                            if (!updated[editingConsumptionItem.name]) {
                              updated[editingConsumptionItem.name] = {};
                            }
                            updated[editingConsumptionItem.name] = {
                              ...updated[editingConsumptionItem.name],
                              [inv.id]: val
                            };
                            localStorage.setItem('laundry_inventory_consumption', JSON.stringify(updated));
                            syncInventoryConsumptionToDb(updated);
                            return updated;
                          });
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {inventory.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-xs font-bold text-slate-400 text-center">لا توجد مواد مضافة في المخزون حالياً</p>
                </div>
              )}
            </div>

            <button 
              onClick={() => setEditingConsumptionItem(null)} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-indigo-100"
            >
              حفظ الإعدادات
            </button>
          </div>
        </div>
      )}

      {editingInvConsumptionItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-right" dir="rtl">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-6 shrink-0 border-b border-slate-100 pb-4">
              <div className="flex flex-col text-right">
                <h3 className="text-xl font-black text-indigo-950">ربط المادة بالأصناف - {editingInvConsumptionItem.name}</h3>
                <p className="text-xs font-bold text-slate-400">تحديد كمية الاستهلاك والخصم عند طلب أصناف كاشير جديد</p>
              </div>
              <button 
                onClick={() => setEditingInvConsumptionItem(null)} 
                className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="max-h-80 overflow-y-auto px-1 py-1 text-right space-y-2.5 custom-scrollbar mb-6 flex-1">
              {(categories.length > 0 ? categories : INITIAL_ITEMS).map((cat, idx) => {
                const currentVal = inventoryConsumption[cat.name]?.[editingInvConsumptionItem.id] || 0;
                return (
                  <div key={cat.id || `${cat.name}-${idx}`} className="flex items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2.5 text-right">
                      {renderCategoryIcon(cat.icon, "w-8 h-8 text-base flex items-center justify-center rounded-lg overflow-hidden bg-white border border-slate-100 shrink-0")}
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-800">{cat.name}</span>
                        <span className="text-[10px] font-bold text-slate-400">وحدة الخصم: {editingInvConsumptionItem.unit}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        step="0.1" 
                        min="0"
                        placeholder="0 (غير مرتبط)" 
                        className="w-24 px-3 py-2 text-center font-black text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-800 focus:border-indigo-500"
                        value={currentVal === 0 ? '' : currentVal}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setInventoryConsumption(prev => {
                            const updated = { ...prev };
                            if (!updated[cat.name]) {
                              updated[cat.name] = {};
                            }
                            updated[cat.name] = {
                              ...updated[cat.name],
                              [editingInvConsumptionItem.id]: val
                            };
                            localStorage.setItem('laundry_inventory_consumption', JSON.stringify(updated));
                            syncInventoryConsumptionToDb(updated);
                            return updated;
                          });
                        }}
                      />
                      <span className="text-xs font-bold text-slate-400">{editingInvConsumptionItem.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              onClick={() => setEditingInvConsumptionItem(null)} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-indigo-100 shrink-0"
            >
              حفظ الربط والتثبيت
            </button>
          </div>
        </div>
      )}

      {showEditOrderModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden text-right" dir="rtl">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
              <h3 className="text-2xl font-black text-indigo-950">تعديل الطلب #{showEditOrderModal.order_number}</h3>
              <button onClick={() => setShowEditOrderModal(null)} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-red-500 transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Side: Order & Customer Settings */}
                <div className="lg:col-span-5 space-y-6">
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider border-b pb-2">بيانات العميل والفاتورة</h4>
                  
                  {/* Customer Info */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase mb-2">اسم العميل</label>
                      <div className="relative">
                        <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          placeholder="اسم العميل"
                          className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:border-indigo-500 transition-all"
                          value={showEditOrderModal.customer_name}
                          onChange={e => setShowEditOrderModal({...showEditOrderModal, customer_name: e.target.value})}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase mb-2">رقم الهاتف (الواتساب)</label>
                      <div className="relative text-left">
                        <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          dir="ltr"
                          placeholder="رقم الهاتف"
                          className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:border-indigo-500 transition-all text-left"
                          value={showEditOrderModal.customer_phone}
                          onChange={e => setShowEditOrderModal({...showEditOrderModal, customer_phone: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Customer Subscription Info & Association */}
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-500 uppercase">الاشتراك الخاص بالعميل</label>
                      <div className="flex items-center gap-2">
                        {editedSubscription && editedSubscription.is_active ? (
                          <>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full">نشط ✅</span>
                            <button
                              type="button"
                              onClick={() => setIsEditingSub(!isEditingSub)}
                              className="p-1 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
                              title="تعديل الاشتراك"
                            >
                              <Edit3 size={11} />
                              {isEditingSub ? 'تم' : 'تعديل'}
                            </button>
                          </>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-200/60 text-slate-500 text-[10px] font-black rounded-full">لا يوجد اشتراك</span>
                        )}
                      </div>
                    </div>

                    {editedSubscription && editedSubscription.is_active ? (
                      !isEditingSub ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">اسم الاشتراك:</span>
                            <span className="font-black text-indigo-900">
                              {subscriptionPackages.find(p => p.id === editedSubscription.package_id)?.name || 'باقة مخصصة'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">الرصيد المتبقي:</span>
                            <span className="font-extrabold text-emerald-700">
                              {editedSubscription.items_remaining} قطعة / {editedSubscription.total_items} قطعة
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">تاريخ الانتهاء:</span>
                            <span className="font-bold text-slate-600">
                              {safeFormatDate(editedSubscription.expiry_date)}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-black text-slate-700">تفعيل الدفع من الاشتراك للطلب:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const usesSub = showEditOrderModal.payment_method === 'Subscription';
                                setShowEditOrderModal(prev => {
                                  if (!prev) return null;
                                  return {
                                    ...prev,
                                    payment_method: usesSub ? 'Cash' : 'Subscription',
                                    is_paid: usesSub ? prev.is_paid : true
                                  };
                                });
                              }}
                              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all border ${
                                showEditOrderModal.payment_method === 'Subscription'
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {showEditOrderModal.payment_method === 'Subscription' ? 'مفعل ✅' : 'تفعيل'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 p-3 bg-white border border-slate-200 rounded-2xl animate-in fade-in-50 duration-200 font-black">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-1 text-right">خطة الباقة</label>
                            <select
                              value={editedSubscription.package_id}
                              onChange={e => {
                                const selectedPkg = subscriptionPackages.find(p => p.id === e.target.value);
                                if (selectedPkg && editedSubscription) {
                                  const expIso = safeAddDaysISO(selectedPkg.duration_days);
                                  setEditedSubscription({
                                    ...editedSubscription,
                                    package_id: selectedPkg.id,
                                    total_items: selectedPkg.total_items,
                                    items_remaining: selectedPkg.total_items,
                                    expiry_date: expIso
                                  });
                                }
                              }}
                              className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-black outline-none focus:border-indigo-500 text-right"
                            >
                              {subscriptionPackages.map(pkg => (
                                <option key={pkg.id} value={pkg.id}>{pkg.name} ({pkg.total_items} قطعة - {pkg.price} ر.س)</option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 mb-1 text-right">الرصيد المتبقي</label>
                              <input
                                type="number"
                                value={editedSubscription.items_remaining}
                                onChange={e => setEditedSubscription({ ...editedSubscription, items_remaining: parseInt(e.target.value) || 0 })}
                                className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-black text-center font-mono outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 mb-1 text-right">الرصيد الكلي</label>
                              <input
                                type="number"
                                value={editedSubscription.total_items}
                                onChange={e => setEditedSubscription({ ...editedSubscription, total_items: parseInt(e.target.value) || 0 })}
                                className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-black text-center font-mono outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-1 text-right font-sans">تاريخ الانتهاء</label>
                            <input
                              type="date"
                              value={safeDateToInputVal(editedSubscription.expiry_date)}
                              onChange={e => {
                                if (!editedSubscription) return;
                                const d = new Date(e.target.value);
                                if (!isNaN(d.getTime())) {
                                  setEditedSubscription({ ...editedSubscription, expiry_date: d.toISOString() });
                                }
                              }}
                              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-black text-center outline-none focus:border-indigo-500 font-mono"
                            />
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!editedSubscription) return;
                                try {
                                  const { error: subErr } = await supabase
                                    .from('subscriptions')
                                    .update({
                                      package_id: editedSubscription.package_id,
                                      items_remaining: editedSubscription.items_remaining,
                                      total_items: editedSubscription.total_items,
                                      expiry_date: editedSubscription.expiry_date,
                                      is_active: editedSubscription.is_active
                                    })
                                    .eq('id', editedSubscription.id);
                                  if (subErr) throw subErr;

                                  setSubscriptions(prev => prev.map(s => s.id === editedSubscription.id ? editedSubscription : s));
                                  setIsEditingSub(false);
                                  alert("تم حفظ تعديلات الباقة بنجاح ✅");
                                } catch (err: any) {
                                  alert(`فشل حفظ تعديلات الباقة: ${err.message}`);
                                }
                              }}
                              className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-black hover:bg-indigo-700 transition-all text-center"
                            >
                              حفظ التغييرات للباقة
                            </button>
                            {subDeleteConfirmId === editedSubscription.id ? (
                              <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const { error: subErr } = await supabase
                                        .from('subscriptions')
                                        .update({ is_active: false })
                                        .eq('id', editedSubscription.id);
                                      if (subErr) throw subErr;

                                      setSubscriptions(prev => prev.map(s => s.id === editedSubscription.id ? { ...s, is_active: false } : s));
                                      setEditedSubscription(null);
                                      setIsEditingSub(false);
                                      setSubDeleteConfirmId(null);
                                      setShowEditOrderModal(prev => {
                                        if (!prev) return null;
                                        return {
                                          ...prev,
                                          payment_method: prev.payment_method === 'Subscription' ? 'Cash' : prev.payment_method
                                        };
                                      });
                                    } catch (err: any) {
                                      alert(`فشل حذف الاشتراك: ${err.message}`);
                                    }
                                  }}
                                  className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 shadow-sm"
                                >
                                  <Trash2 size={12} />
                                  تأكيد الحذف ⚠️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSubDeleteConfirmId(null)}
                                  className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black transition-all"
                                >
                                  تراجع
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSubDeleteConfirmId(editedSubscription.id)}
                                className="py-1.5 px-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1"
                              >
                                <Trash2 size={12} />
                                حذف الاشتراك
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="space-y-3">
                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                          العميل لا يمتلك أي باقة اشتراك سارية للاستخدام بالدفع. يمكنك تفعيل اشتراك فوري له الآن:
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAssignSubModal({
                              name: showEditOrderModal.customer_name || 'عميل مجهول',
                              phone: showEditOrderModal.customer_phone
                            });
                          }}
                          className="w-full py-2.5 px-4 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                        >
                          <UserPlus size={14} />
                          تفعيل اشتراك جديد للعميل
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Order Financial & Settings */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase mb-2">حالة الطلب</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black outline-none focus:border-indigo-500 transition-all text-right"
                        value={showEditOrderModal.status}
                        onChange={e => setShowEditOrderModal({...showEditOrderModal, status: e.target.value as OrderStatus})}
                      >
                        {Object.entries(statusArabic).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-2">تعديل مالي (رس)</label>
                        <div className="relative">
                          <Banknote className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            type="number" 
                            step="0.5"
                            placeholder="تعديل مالي" 
                            className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs" 
                            value={editCustomAdjustment || ''} 
                            onChange={e => setEditCustomAdjustment(parseFloat(e.target.value) || 0)} 
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-2">خصم %</label>
                        <div className="relative">
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">%</div>
                          <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            placeholder="خصم %" 
                            className="w-full pr-10 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs" 
                            value={editDiscountPercent || ''} 
                            onChange={e => {
                              const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                              setEditDiscountPercent(val);
                              setEditOrderItems(prev => prev.map(item => ({ ...item, discount_percent: val })));
                            }} 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Checkboxes/Grid details */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                        type="button"
                        onClick={() => {
                          const isFree = showEditOrderModal.payment_method === 'Free';
                          setShowEditOrderModal({
                            ...showEditOrderModal,
                            payment_method: isFree ? 'Cash' : 'Free',
                            is_paid: !isFree
                          });
                        }} 
                        className={`py-3.5 rounded-2xl border font-black transition-all flex items-center justify-center gap-2 text-xs ${showEditOrderModal.payment_method === 'Free' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                      >
                        {showEditOrderModal.payment_method === 'Free' ? <Check size={16} /> : <Gift size={16} />}
                        {showEditOrderModal.payment_method === 'Free' ? 'طلب مجاني ✅' : 'طلب مجاني؟'}
                      </button>
                      
                      <button 
                        type="button"
                        onClick={() => setEditIsTaxEnabled(!editIsTaxEnabled)} 
                        className={`py-3.5 rounded-2xl border font-black transition-all flex items-center justify-center gap-2 text-xs ${editIsTaxEnabled ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                      >
                        {editIsTaxEnabled ? <Check size={16} /> : <AlertTriangle size={16} />}
                        {editIsTaxEnabled ? 'الضريبة مفعلة (15%)' : 'بدون ضريبة'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Side: Predefined Categories & Selected Items */}
                <div className="lg:col-span-7 flex flex-col space-y-6">
                  
                  {/* Category badgess to select and add items */}
                  <div>
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider border-b pb-2 mb-3">إضافة مواد للطلب (اضغط للإضافة)</h4>
                    <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1">
                      {categories.map((cat, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const existing = editOrderItems.find(i => i.name === cat.name && !i.is_urgent && !i.is_ironing_only && !i.is_no_ironing && (i.service_type || 'عادي') === 'عادي');
                            if (existing) {
                              setEditOrderItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i));
                            } else {
                              const id = Math.random().toString(36).substr(2, 9);
                              const prices = getItemPrices(cat);
                              setEditOrderItems(prev => [...prev, {
                                id,
                                name: cat.name,
                                quantity: 1,
                                price: prices.price_normal,
                                service_type: 'عادي',
                                ironing_type: 'غسيل وكوي',
                                is_ironing_only: false,
                                is_urgent: false,
                                is_no_ironing: false,
                                price_normal: prices.price_normal,
                                price_urgent: prices.price_urgent,
                                price_ironing: prices.price_ironing,
                                price_no_ironing: prices.price_no_ironing,
                                discount_percent: editDiscountPercent
                              }]);
                            }
                          }}
                          className="py-2.5 px-3 bg-white border border-slate-100/90 rounded-2xl flex items-center gap-2 text-xs font-black shadow-sm hover:border-indigo-500 hover:bg-slate-50 transition-all active:scale-95"
                        >
                          {renderCategoryIcon(cat.icon, "w-6 h-6 text-sm flex items-center justify-center rounded-lg overflow-hidden bg-slate-50 shrink-0")}
                          <span>{cat.name}</span>
                          <span className="text-[10px] font-bold text-indigo-600 font-mono">{cat.price} ر.س</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* List of Current Items */}
                  <div className="flex-1 overflow-y-auto max-h-[35vh] space-y-3 pr-1 border-t pt-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase mb-2">مواد الفاتورة الحالية:</h4>
                    {editOrderItems.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs font-black">
                        لا توجد أصناف في هذا الطلب حالياً. الرجاء الإضافة من القائمة أعلاه.
                      </div>
                    ) : (
                      editOrderItems.map(item => (
                        <div key={item.id} className="flex flex-col gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-indigo-950">{item.name}</span>
                              <span className="text-xs font-extrabold text-indigo-600">{(item.quantity * item.price).toFixed(2)} ر.س <span className="text-[10px] text-slate-400 font-normal">({item.price.toFixed(2)} للقطعة)</span></span>
                            </div>
                            <div className="flex items-center gap-3">
                              <button type="button" onClick={() => updateEditItemQuantity(item.id, -1)} className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center text-red-500 hover:bg-slate-50 active:scale-90"><Trash2 size={14} /></button>
                              <span className="text-sm font-black w-4 text-center">{item.quantity}</span>
                              <button type="button" onClick={() => updateEditItemQuantity(item.id, 1)} className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center text-emerald-500 hover:bg-slate-50 active:scale-90"><Plus size={14} /></button>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                            {/* Option Selector checkboxes in row */}
                            <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100/90 rounded-xl">
                              <button
                                type="button"
                                onClick={() => {
                                  updateEditItemMode(item.id, 'عادي');
                                }}
                                className={`py-1.5 text-[10px] font-black rounded-lg transition-all ${
                                  item.is_normal
                                    ? 'bg-slate-500 text-white shadow-sm font-bold'
                                    : 'text-slate-500 hover:bg-white/50 bg-transparent'
                                }`}
                              >
                                عادي
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateEditItemMode(item.id, 'مستعجل');
                                }}
                                className={`py-1.5 text-[10px] font-black rounded-lg transition-all ${
                                  (item.is_urgent || item.service_type === 'مستعجل')
                                    ? 'bg-red-500 text-white shadow-sm font-bold'
                                    : 'text-slate-500 hover:bg-white/50 bg-transparent'
                                }`}
                              >
                                مستعجل 🔥
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateEditItemMode(item.id, 'كوي');
                                }}
                                className={`py-1.5 text-[10px] font-black rounded-lg transition-all ${
                                  item.is_ironing_only
                                    ? 'bg-indigo-600 text-white shadow-sm font-bold'
                                    : 'text-slate-500 hover:bg-white/50 bg-transparent'
                                }`}
                              >
                                كوي
                              </button>
                            </div>

                            {/* Custom prices inputs */}
                            <div className="grid grid-cols-3 gap-1.5 text-[8.5px] font-bold text-slate-400 mt-1">
                              <div className="flex flex-col gap-1 text-center font-bold">
                                <span className="text-slate-500 font-black">عادي</span>
                                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                                  <input 
                                    type="number" 
                                    step="0.5"
                                    className="w-full text-center font-black text-[9px] outline-none text-slate-700 bg-transparent"
                                    value={getItemPrices(item).price_normal}
                                    onChange={e => updateEditItemCustomPrice(item.id, 'normal', parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 text-center font-bold">
                                <span className="text-red-500 font-black">مستعجل</span>
                                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                                  <input 
                                    type="number" 
                                    step="0.5"
                                    className="w-full text-center font-black text-[9px] outline-none text-slate-700 bg-transparent"
                                    value={getItemPrices(item).price_urgent}
                                    onChange={e => updateEditItemCustomPrice(item.id, 'urgent', parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 text-center font-bold">
                                <span className="text-indigo-600">كوي</span>
                                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                                  <input 
                                    type="number" 
                                    step="0.5"
                                    className="w-full text-center font-black text-[9px] outline-none text-slate-700 bg-transparent"
                                    value={getItemPrices(item).price_ironing}
                                    onChange={e => updateEditItemCustomPrice(item.id, 'ironing', parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Financial calculation summary & payment */}
                  <div className="bg-[#1E1B4B] text-white p-6 rounded-3xl shadow-xl space-y-4 shrink-0">
                    <div className="space-y-2 text-sm">
                      {editDiscountPercent > 0 && (
                        <div className="flex justify-between items-center text-slate-400 text-xs">
                          <span>المجموع المبدئي:</span>
                          <span>{(editOrderItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) + editCustomAdjustment).toFixed(2)} ر.س</span>
                        </div>
                      )}
                      {editDiscountPercent > 0 && (
                        <div className="flex justify-between items-center text-red-400 text-xs font-black">
                          <span>خصم ({editDiscountPercent}%):</span>
                          <span>-{((editOrderItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) + editCustomAdjustment) * (editDiscountPercent / 100)).toFixed(2)} ر.س</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-slate-300 font-medium">
                        <span>المجموع:</span>
                        <span>{editSubtotal.toFixed(2)} ر.س</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300 font-medium">
                        <span>الضريبة ({editIsTaxEnabled ? '15%' : '0%'}):</span>
                        <span>{editTax.toFixed(2)} ر.س</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-white/10 pt-3">
                        <span className="font-black text-lg">الإجمالي الحالي:</span>
                        <span className="font-black text-2xl text-indigo-300">{editTotal.toFixed(2)} ر.س</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                        type="button" 
                        onClick={() => setShowEditOrderModal({...showEditOrderModal, is_paid: !showEditOrderModal.is_paid})} 
                        className={`py-3 rounded-xl border font-black text-xs transition-all ${showEditOrderModal.is_paid ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                      >
                        {showEditOrderModal.is_paid ? 'تم السداد ✅' : 'لم يسدد'}
                      </button>

                      {showEditOrderModal.is_paid && (
                        <select 
                          className="bg-white/10 border border-white/10 rounded-xl py-3 px-3 text-xs font-black text-white outline-none focus:border-white/40 text-right"
                          value={showEditOrderModal.payment_method} 
                          onChange={e => setShowEditOrderModal({...showEditOrderModal, payment_method: e.target.value as any})}
                        >
                          <option value="Cash" className="text-black">نقدي</option>
                          <option value="Card" className="text-black">شبكة</option>
                          <option value="Transfer" className="text-black">تحويل</option>
                          {getCustomerSubscription(showEditOrderModal.customer_phone) && (
                            <option value="Subscription" className="text-black">من الاشتراك</option>
                          )}
                          <option value="Free" className="text-black">مجاني</option>
                        </select>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
            
            {/* Modal Actions */}
            <div className="p-8 border-t border-slate-100 flex gap-4 shrink-0 bg-white">
              <button 
                type="button"
                onClick={() => {
                  const finalOrderSaved: Order = {
                    ...showEditOrderModal,
                    items: editOrderItems,
                    custom_adjustment: editCustomAdjustment,
                    subtotal: editSubtotal,
                    tax: editTax,
                    total: editTotal
                  };
                  handleUpdateOrder(finalOrderSaved);
                }}
                className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-indigo-700 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
              >
                <Check size={20} />
                حفظ التغييرات
              </button>
              <button 
                type="button"
                onClick={() => setShowEditOrderModal(null)}
                className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-lg hover:bg-slate-200 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
              >
                إلغاء التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[250] p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl relative animate-in zoom-in duration-200">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} />
              </div>
              <h2 className="text-2xl font-black mb-2">تأكيد حذف المستخدم</h2>
              <p className="text-slate-500 font-bold mb-8">
                هل أنت متأكد من حذف المستخدم <span className="text-red-600 font-black">{userToDelete.full_name || userToDelete.email}</span> نهائياً من النظام وقاعدة البيانات؟
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setUserToDelete(null)}
                  className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                >
                  إلغاء
                </button>
                <button 
                  disabled={deletingUserId === userToDelete.id}
                  onClick={() => handleDeleteUser(userToDelete.id)}
                  className="py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-200 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                >
                  {deletingUserId === userToDelete.id ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      جاري الحذف...
                    </>
                  ) : (
                    <>
                      <Trash2 size={20} />
                      حذف نهائي
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {orderToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[250] p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl relative animate-in zoom-in duration-200">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} />
              </div>
              <h2 className="text-2xl font-black mb-2">تأكيد الحذف</h2>
              <p className="text-slate-500 font-bold mb-8">
                هل أنت متأكد من حذف الطلب رقم <span className="text-red-600 font-black">{orderToDelete.order_number}</span> نهائياً من قاعدة البيانات؟
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setOrderToDelete(null)}
                  className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                >
                  إلغاء
                </button>
                <button 
                  disabled={deletingOrderId === orderToDelete.id}
                  onClick={() => deleteOrder(orderToDelete.id, orderToDelete.order_number)}
                  className="py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-200 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                >
                  {deletingOrderId === orderToDelete.id ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      جاري الحذف...
                    </>
                  ) : (
                    <>
                      <Trash2 size={20} />
                      حذف نهائي
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[200] p-3 sm:p-4 print-modal-overlay">
          <div className="bg-white rounded-3xl w-full max-w-[385px] shadow-2xl relative border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden print-modal-card">
            <button 
              onClick={() => setShowPrintModal(null)} 
              className="absolute top-4 left-4 p-2 bg-slate-100/90 hover:bg-slate-200 rounded-full text-slate-500 no-print transition-all z-20 cursor-pointer shadow-sm"
              title="إغلاق"
            >
              <X size={18} />
            </button>

            {/* Mode Switcher Tabs */}
            <div className="px-5 pt-4 pb-2 no-print flex gap-2 border-b border-slate-100 bg-slate-50/70 shrink-0">
              <button
                type="button"
                onClick={() => setPrintModalTab('receipt')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  printModalTab === 'receipt'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                إيصال الفاتورة الحرارية
              </button>
              <button
                type="button"
                onClick={() => setPrintModalTab('tags')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  printModalTab === 'tags'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                ملصقات باركود الملابس
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar p-5 sm:p-6 flex-1">
              <div id="print-area" className="text-center bg-white">
                {printModalTab === 'tags' ? (
                  /* ملصقات باركود الملابس والقطع للطابعة الحرارية */
                  <ClothingTagsPrintView
                    order={showPrintModal}
                    laundryName={userProfile?.laundry_name || 'مغسلة عود ونظافة'}
                  />
                ) : (
                  <>
                    {/* ترويسة الفاتورة */}
                    <div className="mb-2">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-2 text-xl font-black shadow-sm">
                        {(userProfile?.laundry_name || 'مغسلة عود ونظافة')[0]?.toUpperCase() || 'M'}
                      </div>
                      <h2 className="text-lg font-black text-slate-900">{userProfile?.laundry_name || 'مغسلة عود ونظافة'}</h2>
                    </div>

                    {/* رمز التحقق الإلكتروني والباركود */}
                    <div className="flex flex-col items-center justify-center my-2.5 space-y-2">
                      <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center">
                        <InvoiceQRCode order={showPrintModal} laundryName={userProfile?.laundry_name || 'مغسلة عود ونظافة'} size={120} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">رمز التحقق الإلكتروني (QR Code)</span>

                      {/* باركود رقم الفاتورة لمسحه بطابعة وقارئ الفواتير الحرارية */}
                      <div className="pt-1 flex flex-col items-center justify-center">
                        <BarcodeGenerator value={showPrintModal.order_number} width={1.3} height={32} />
                        <span className="text-[9px] text-slate-400 font-bold font-mono">باركود الفاتورة للمسح السريع (Code 128)</span>
                      </div>
                    </div>

                {/* تفاصيل العميل والفاتورة الأساسية */}
                <div className="bg-slate-50/80 rounded-2xl border border-slate-100 p-3 space-y-1.5 text-right text-xs">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-bold">العميل:</span>
                    <span className="font-black text-slate-900 text-sm">{showPrintModal.customer_name}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-bold">رقم الهاتف:</span>
                    <span dir="ltr" className="font-bold text-slate-800 text-sm">{showPrintModal.customer_phone}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-bold">رقم الفاتورة:</span>
                    <span className="font-mono font-black text-indigo-600 text-sm">#{showPrintModal.order_number}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400 font-bold">التاريخ والوقت:</span>
                    <span className="font-bold text-slate-700">{new Date(showPrintModal.created_at).toLocaleString('ar-SA-u-nu-latn')}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200/70 mt-1">
                    <span className="text-slate-500 font-bold">الإجمالي:</span>
                    <span className="font-black text-indigo-600 text-base">{showPrintModal.total.toFixed(2)} ر.س</span>
                  </div>
                </div>

                {/* الأصناف والتفاصيل الكاملة تُعرض فقط عند الطباعة */}
                <div className="print-only">
                  <div className="space-y-2 mb-4 text-right border-t border-slate-200 pt-3 mt-3">
                    <div className="text-xs font-black text-slate-500 mb-2">تفاصيل الأصناف والخدمات:</div>
                    {(() => {
                      const groups = getGroupedItems(showPrintModal.items || []);
                      return groups.map((group) => {
                        const optText = (() => {
                          const opts: string[] = [];
                          if (group.item.service_type === 'مستعجل' || (group.item as any).is_urgent) opts.push('مستعجل 🔥');
                          if (group.item.is_ironing_only) opts.push('كوي');
                          if ((group.item as any).is_no_ironing || group.item.ironing_type === 'بدون كوي') opts.push('بدون كوي');
                          if (opts.length === 0) opts.push('عادي');
                          return opts.join(' + ');
                        })();

                        return (
                          <div key={group.key} className="border-b border-slate-100 last:border-0 pb-2">
                            <div className="flex justify-between items-center text-sm font-black p-1">
                              <span className="flex items-center gap-1.5">
                                <span className="text-slate-900">{group.item.name}</span>
                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-black font-mono">x{group.totalQty}</span>
                                <span className="text-[10px] text-slate-400 font-normal">({optText})</span>
                              </span>
                              <span className="text-slate-900">{(group.totalPrice).toFixed(2)} ر.س</span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* تفاصيل الحسابات والضريبة للطباعة */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 mb-4 text-right">
                    {(() => {
                      const discountPercent = (showPrintModal.items?.[0] as any)?.discount_percent || 0;
                      return (
                        <>
                          {discountPercent > 0 ? (
                            <>
                              <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                                <span>المجموع المبدئي</span>
                                <span>{(showPrintModal.subtotal / (1 - discountPercent/100)).toFixed(2)} ر.س</span>
                              </div>
                              <div className="flex justify-between text-xs font-black text-red-500 mb-1.5">
                                <span>خصم ({discountPercent}%)</span>
                                <span>-{((showPrintModal.subtotal / (1 - discountPercent/100)) * (discountPercent/100)).toFixed(2)} ر.س</span>
                              </div>
                              <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                                <span>المجموع بعد الخصم</span>
                                <span>{showPrintModal.subtotal.toFixed(2)} ر.س</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                              <span>المجموع الفرعي</span>
                              <span>{showPrintModal.subtotal.toFixed(2)} ر.س</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                            <span>ضريبة القيمة المضافة (15%)</span>
                            <span>{showPrintModal.tax.toFixed(2)} ر.س</span>
                          </div>
                          {showPrintModal.custom_adjustment !== 0 && (
                            <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                              <span>تعديل إضافي</span>
                              <span>{showPrintModal.custom_adjustment.toFixed(2)} ر.س</span>
                            </div>
                          )}
                          <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t-2 border-dashed border-slate-200 mt-2">
                            <span>الإجمالي النهائي</span>
                            <span className="text-indigo-600 font-black">{showPrintModal.total.toFixed(2)} ر.س</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="text-[10px] text-slate-400 font-bold mb-4 leading-relaxed text-center">
                    تنويه هام: المغسلة غير مسؤولة عن فقدان أي أغراض شخصية تُترك داخل الملابس عند استلامها، كما لا تتحمل مسؤولية حفظ الملابس أو الأغراض بعد مضي (15) يومًا من تاريخ الاستلام.
                  </div>
                </div>
              </>
            )}
            </div>

              {/* أزرار الإجراءات داخل النافذة المنبثقة */}
              <div className="space-y-2 mt-4 no-print">
                <button 
                  onClick={() => window.print()} 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white py-3 px-4 rounded-2xl font-black text-sm shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer size={18}/> {printModalTab === 'tags' ? 'طباعة ملصقات وباركود الملابس والقطع' : 'طباعة الفاتورة الحرارية'}
                </button>

                <button 
                  onClick={() => sendWhatsAppReminder(showPrintModal, 'RECEIVED')} 
                  disabled={sendingMessageIds.has(showPrintModal.id)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white py-2.5 px-4 rounded-2xl font-black text-xs shadow-sm shadow-emerald-600/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {sendingMessageIds.has(showPrintModal.id) ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16}/>}
                  إرسال الفاتورة والـ PDF عبر الواتساب
                </button>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button 
                    onClick={() => handleDownloadPDF(showPrintModal)} 
                    disabled={isDownloadingPdf}
                    className="bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isDownloadingPdf ? <Loader2 size={14} className="animate-spin text-indigo-600" /> : <Download size={14} className="text-indigo-600"/>}
                    {isDownloadingPdf ? 'جاري تجهيز PDF...' : 'تحميل PDF الفاتورة'}
                  </button>
                  <button 
                    onClick={() => setShowPrintModal(null)} 
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <X size={14} /> إغلاق النافذة
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-between px-1 text-[11px] text-slate-500 font-bold border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <Printer size={13} className="text-indigo-600" />
                    طباعة حرارية تلقائية فور الحفظ (USB)
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoPrintThermalOnSave}
                      onChange={(e) => {
                        setAutoPrintThermalOnSave(e.target.checked);
                        localStorage.setItem('laundry_auto_print_thermal', e.target.checked ? 'true' : 'false');
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingUserProfile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[250] p-4 text-right">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 shadow-2xl relative animate-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => setEditingUserProfile(null)} 
              className="absolute top-6 left-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition-all"
            >
              <X size={18} />
            </button>
            
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-xl font-black flex items-center gap-2 text-indigo-950">
                  <Edit3 className="text-indigo-600" size={22} /> تعديل صلاحيات المستخدم
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-1">تحديث الاسم، نوع الحساب، المغسلة المرتبطة، وصفحات الوصول</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    required
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-sm transition-all"
                    value={editingUserForm.full_name}
                    onChange={e => setEditingUserForm({...editingUserForm, full_name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">البريد الإلكتروني (غير قابل للتعديل)</label>
                  <input
                    type="text"
                    disabled
                    className="w-full px-5 py-3 bg-slate-100 border border-slate-100 rounded-2xl outline-none font-bold text-sm text-left text-slate-400 cursor-not-allowed"
                    dir="ltr"
                    value={editingUserProfile.email || ''}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">نوع الحساب والصلاحية العامة</label>
                  <select
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-xs transition-all"
                    value={editingUserForm.role}
                    onChange={e => {
                      const nextRole = e.target.value as UserRole;
                      setEditingUserForm({
                        ...editingUserForm,
                        role: nextRole,
                        permissions: ROLE_PERMISSIONS[nextRole] || []
                      });
                    }}
                  >
                    <option value="staff">موظف (Staff)</option>
                    <option value="manager">مشرف مغسلة (Manager)</option>
                    <option value="admin">مدير نظام عام (Admin)</option>
                    <option value="super_admin">إدارة عليا (Super Admin)</option>
                  </select>
                </div>

                {/* Specific Pages Access / Permissions */}
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <label className="block text-xs font-black text-slate-600 flex items-center gap-1.5">
                    <Settings2 size={14} className="text-indigo-600" /> تعديل الصفحات المسموحة (Page Access)
                  </label>
                  <p className="text-[10px] text-slate-400 font-bold mb-3">حدد بالضبط الصفحات المسموح للمستخدم برؤيتها والدخول إليها:</p>
                  <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                    {navItems.filter(item => item.id !== 'super-admin' || editingUserForm.role === 'super_admin').map(item => {
                      const IconComponent = item.icon;
                      const isFinance = item.id === 'finance';
                      const isChecked = isFinance
                        ? (editingUserForm.permissions.includes('finance') || editingUserForm.permissions.includes('finance_pending_only'))
                        : editingUserForm.permissions.includes(item.id);
                      return (
                        <label key={item.id} className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border transition-all ${isChecked ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 font-black' : 'bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-500'}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isFinance) {
                                if (isChecked) {
                                  const newPerms = editingUserForm.permissions.filter(p => p !== 'finance' && p !== 'finance_pending_only');
                                  setEditingUserForm({ ...editingUserForm, permissions: newPerms });
                                } else {
                                  setEditingUserForm({ ...editingUserForm, permissions: [...editingUserForm.permissions, 'finance'] });
                                }
                              } else {
                                const newPerms = isChecked
                                  ? editingUserForm.permissions.filter(p => p !== item.id)
                                  : [...editingUserForm.permissions, item.id];
                                setEditingUserForm({ ...editingUserForm, permissions: newPerms });
                              }
                            }}
                            className="accent-indigo-600 rounded"
                          />
                          <span className="text-[11px] font-bold flex items-center gap-1">
                            <IconComponent size={12} className={isChecked ? "text-indigo-600" : "text-slate-400"} />
                            {item.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Sub-option if Finance page is checked */}
                  {(editingUserForm.permissions.includes('finance') || editingUserForm.permissions.includes('finance_pending_only')) && (
                    <div className="mt-3 p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-2.5 animate-in fade-in-50 duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                          <Wallet size={14} className="text-amber-600" />
                          <span>تخصيص صلاحية صفحة الحسابات:</span>
                        </span>
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-full border border-amber-300">
                          {editingUserForm.permissions.includes('finance_pending_only') ? 'تصفية معلقات فقط 💰' : 'وصول كامل 📊'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {/* Option 1: Full Access */}
                        <label className={`flex items-start gap-2 p-2.5 rounded-xl cursor-pointer border transition-all ${!editingUserForm.permissions.includes('finance_pending_only') && editingUserForm.permissions.includes('finance') ? 'bg-white border-indigo-400 font-black text-indigo-950 shadow-sm' : 'bg-slate-50/80 border-slate-200/60 text-slate-500 font-bold'}`}>
                          <input
                            type="radio"
                            name="editUserFinanceType"
                            checked={!editingUserForm.permissions.includes('finance_pending_only') && editingUserForm.permissions.includes('finance')}
                            onChange={() => {
                              const next = editingUserForm.permissions.filter(p => p !== 'finance_pending_only');
                              if (!next.includes('finance')) next.push('finance');
                              setEditingUserForm({ ...editingUserForm, permissions: next });
                            }}
                            className="accent-indigo-600 mt-0.5"
                          />
                          <div>
                            <span className="block font-black text-xs">وصول كامل للحسابات</span>
                            <span className="block text-[10px] text-slate-400 font-bold mt-0.5">عرض كافة الإحصائيات، الأرباح، والتقارير المالية</span>
                          </div>
                        </label>

                        {/* Option 2: Pending Amounts Only */}
                        <label className={`flex items-start gap-2 p-2.5 rounded-xl cursor-pointer border transition-all ${editingUserForm.permissions.includes('finance_pending_only') ? 'bg-white border-amber-400 font-black text-amber-950 shadow-sm' : 'bg-slate-50/80 border-slate-200/60 text-slate-500 font-bold'}`}>
                          <input
                            type="radio"
                            name="editUserFinanceType"
                            checked={editingUserForm.permissions.includes('finance_pending_only')}
                            onChange={() => {
                              const next = editingUserForm.permissions.filter(p => p !== 'finance');
                              if (!next.includes('finance')) next.push('finance_pending_only');
                              setEditingUserForm({ ...editingUserForm, permissions: next });
                            }}
                            className="accent-amber-600 mt-0.5"
                          />
                          <div>
                            <span className="block font-black text-xs text-amber-900 flex items-center gap-1">
                              تصفية مبالغ معلقة فقط 💰
                            </span>
                            <span className="block text-[10px] text-amber-700/80 font-bold mt-0.5">
                              إخفاء الإحصائيات العامة وعرض إحصائيات مبيعات العملاء وتصفية المبالغ المعلقة فقط
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUserProfile(null)}
                  className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all text-center"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={saveLoading}
                  onClick={handleUpdateUserProfile}
                  className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saveLoading ? <Loader2 className="animate-spin" size={16} /> : 'حفظ التعديلات'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Modal for Managing User Subscription & Renewal */}
      {editingSubscriptionUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[250] p-4 text-right">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 shadow-2xl relative animate-in zoom-in duration-200">
            <button 
              onClick={() => setEditingSubscriptionUser(null)} 
              className="absolute top-6 left-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition-all"
            >
              <X size={18} />
            </button>
            
            <form onSubmit={handleSaveSubscription} className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-xl font-black flex items-center gap-2 text-indigo-950">
                  <CreditCard className="text-indigo-600" size={22} /> إدارة وتجديد اشتراك المنصة
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-1">
                  المستخدم: <span className="text-slate-800 font-black">{editingSubscriptionUser.full_name || editingSubscriptionUser.email}</span> (المغسلة: {editingSubscriptionUser.laundry_name || 'غير محدد'})
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">نوع باقة الاشتراك</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl outline-none font-bold text-xs"
                      value={subscriptionForm.saas_plan}
                      onChange={e => setSubscriptionForm({...subscriptionForm, saas_plan: e.target.value as any})}
                    >
                      <option value="basic">🌟 الباقة الأساسية (105 ر.س/شهرياً - 1,050 ر.س/سنوياً)</option>
                      <option value="gold">👑 الباقة الذهبية (150 ر.س/شهرياً - 1,550 ر.س/سنوياً)</option>
                      <option value="trial">⏳ تجريبي</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">دورة الفوترة والدفع</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl outline-none font-bold text-xs"
                      value={subscriptionForm.saas_billing_cycle}
                      onChange={e => setSubscriptionForm({...subscriptionForm, saas_billing_cycle: e.target.value as any})}
                    >
                      <option value="annual">اشتراك سنوي 📅</option>
                      <option value="monthly">اشتراك شهري 🗓️</option>
                      <option value="trial">فترة تجريبية ⏳</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">تاريخ انتهاء الاشتراك</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl outline-none font-bold text-xs"
                    value={subscriptionForm.saas_expiry}
                    onChange={e => setSubscriptionForm({...subscriptionForm, saas_expiry: e.target.value})}
                  />
                </div>

                {/* Quick extension buttons */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1.5">تمديد سريع للفوترة:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const curr = subscriptionForm.saas_expiry ? new Date(subscriptionForm.saas_expiry) : new Date();
                        const base = isNaN(curr.getTime()) || curr.getTime() < Date.now() ? new Date() : curr;
                        base.setDate(base.getDate() + 30);
                        setSubscriptionForm({...subscriptionForm, saas_expiry: base.toISOString().split('T')[0]});
                      }}
                      className="py-2.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-black text-xs transition-all text-center border border-indigo-200"
                    >
                      + 30 يوماً (شهر)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const curr = subscriptionForm.saas_expiry ? new Date(subscriptionForm.saas_expiry) : new Date();
                        const base = isNaN(curr.getTime()) || curr.getTime() < Date.now() ? new Date() : curr;
                        base.setDate(base.getDate() + 60);
                        setSubscriptionForm({...subscriptionForm, saas_expiry: base.toISOString().split('T')[0]});
                      }}
                      className="py-2.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-black text-xs transition-all text-center border border-purple-200"
                    >
                      + 60 يوماً (شهرين)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const curr = subscriptionForm.saas_expiry ? new Date(subscriptionForm.saas_expiry) : new Date();
                        const base = isNaN(curr.getTime()) || curr.getTime() < Date.now() ? new Date() : curr;
                        base.setDate(base.getDate() + 365);
                        setSubscriptionForm({...subscriptionForm, saas_expiry: base.toISOString().split('T')[0]});
                      }}
                      className="py-2.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-black text-xs transition-all text-center border border-emerald-200"
                    >
                      + 365 يوماً (سنة كاملة)
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSubscriptionUser(null)}
                  className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all text-center"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={subscriptionSaveLoading}
                  className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {subscriptionSaveLoading ? <Loader2 className="animate-spin" size={16} /> : 'حفظ وتأكيد الاشتراك 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Modal for Changing User Password */}
      {changingPasswordUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[250] p-4 text-right">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in duration-200">
            <button 
              onClick={() => { setChangingPasswordUser(null); setNewPasswordInput(''); }} 
              className="absolute top-6 left-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition-all"
            >
              <X size={18} />
            </button>
            
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-xl font-black flex items-center gap-2 text-indigo-950">
                  <Lock className="text-indigo-600" size={22} /> تغيير كلمة المرور للمستخدم
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-1">
                  المستخدم: <span className="text-slate-800 font-black">{changingPasswordUser.full_name || changingPasswordUser.email}</span> ({changingPasswordUser.email})
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="أدخل كلمة المرور الجديدة (6 خانات على الأقل)"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl outline-none font-bold text-xs text-left"
                    dir="ltr"
                    value={newPasswordInput}
                    onChange={e => setNewPasswordInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setChangingPasswordUser(null); setNewPasswordInput(''); }}
                  className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all text-center"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={passwordChangeLoading || !newPasswordInput.trim()}
                  className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {passwordChangeLoading ? <Loader2 className="animate-spin" size={16} /> : 'حفظ كلمة المرور الجديدة 🔑'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSaaSPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[250] p-4 text-right">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in duration-200">
            <button 
              onClick={() => setShowSaaSPaymentModal(false)} 
              className="absolute top-6 left-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition-all"
            >
              <X size={18} />
            </button>
            
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <Sparkles size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">تجديد اشتراك المغسلة</h3>
                <p className="text-slate-400 font-bold text-xs mt-1">
                  تجديد اشتراك منصة غسيل كلاود
                </p>
              </div>

              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-right space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-indigo-950">
                  <span>الباقة الحالية:</span>
                  <span className="font-black text-indigo-600">
                    {userProfile?.saas_plan === 'basic' ? '🌟 الباقة الأساسية' : '👑 الباقة الذهبية'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-indigo-950">
                  <span>الاشتراك الشهري:</span>
                  <span className="font-black text-indigo-600">
                    {userProfile?.saas_plan === 'basic' ? '105 ريال / شهرياً' : '150 ريال / شهرياً'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-indigo-950">
                  <span>الاشتراك السنوي:</span>
                  <span className="font-black text-emerald-600">
                    {userProfile?.saas_plan === 'basic' ? '1,050 ريال / سنوياً (وفر 17%)' : '1,550 ريال / سنوياً (وفر 14%)'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-amber-800 border-t border-indigo-100/80 pt-2 text-[11px]">
                  <span>ملاحظة الضريبة:</span>
                  <span className="font-bold">الأسعار لا تشمل ضريبة القيمة المضافة</span>
                </div>
              </div>

              <div className="text-xs text-slate-500 font-bold leading-relaxed px-2">
                شكراً لثقتكم واختياركم منصة غسيل كلاود! لإتمام تجديد الاشتراك السنوي أو الشهري يرجى التواصل مباشرة مع الدعم الفني للمنصة.
              </div>

              <div className="grid grid-cols-1 gap-3 pt-4">
                <a
                  href="https://wa.me/966500000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  تواصل عبر الواتساب لتأكيد الدفع 💬
                </a>
                <button
                  type="button"
                  onClick={() => setShowSaaSPaymentModal(false)}
                  className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all"
                >
                  إغلاق النافذة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Restore Confirmation Modal */}
      {importModalData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto dir-rtl">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center shrink-0 border border-indigo-400/30">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">تأكيد استعادة النسخة الاحتياطية</h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">راجع بيانات الملف قبل تطبيق الاسترجاع</p>
                </div>
              </div>
              <button
                onClick={() => setImportModalData(null)}
                disabled={isImporting}
                className="w-9 h-9 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* File details card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">اسم الملف المستورد:</span>
                  <span className="font-black text-slate-800 dir-ltr truncate max-w-[220px]">{importModalData.fileName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">اسم المغسلة بالملف:</span>
                  <span className="font-black text-indigo-600">{importModalData.laundryName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">تاريخ تصدير الملف:</span>
                  <span className="font-bold text-slate-600">{importModalData.exportDate}</span>
                </div>
              </div>

              {/* Data counts summary */}
              <div>
                <h4 className="text-xs font-black text-slate-700 mb-3 flex items-center gap-1.5">
                  <Database size={15} className="text-indigo-600" />
                  <span>محتويات النسخة الاحتياطية الجاهزة للاسترجاع:</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-center">
                    <span className="text-lg font-black text-indigo-700 block">{importModalData.ordersCount}</span>
                    <span className="text-[11px] font-bold text-indigo-900/70">فواتير وطلبات</span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl text-center">
                    <span className="text-lg font-black text-emerald-700 block">{importModalData.inventoryCount}</span>
                    <span className="text-[11px] font-bold text-emerald-900/70">عناصر مخزون</span>
                  </div>

                  <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl text-center">
                    <span className="text-lg font-black text-blue-700 block">{importModalData.categoriesCount}</span>
                    <span className="text-[11px] font-bold text-blue-900/70">أصناف الكاشير</span>
                  </div>

                  <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-2xl text-center">
                    <span className="text-lg font-black text-purple-700 block">{importModalData.subscriptionsCount}</span>
                    <span className="text-[11px] font-bold text-purple-900/70">اشتراكات عملاء</span>
                  </div>

                  <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-2xl text-center">
                    <span className="text-lg font-black text-amber-700 block">{importModalData.packagesCount + importModalData.offersCount}</span>
                    <span className="text-[11px] font-bold text-amber-900/70">باقات وعروض</span>
                  </div>

                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl text-center flex flex-col justify-center">
                    <span className="text-xs font-black text-slate-700">تجهيزات كاملة</span>
                    <span className="text-[10px] font-bold text-slate-500">إعدادات & أسعار</span>
                  </div>
                </div>
              </div>

              {/* Warning notice */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-amber-900 leading-relaxed">
                  تنبيه: تطبيق هذه النسخة الاسترجاعية سيقوم باستبدال ودمج البيانات الحالية بالنظام وقاعدة البيانات مباشرة. هل ترغب في المتابعة؟
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setImportModalData(null)}
                disabled={isImporting}
                className="px-5 py-3 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={executeBackupRestore}
                disabled={isImporting}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>جاري تطبيق واسترجاع البيانات...</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    <span>تأكيد الاسترجاع وتطبيق البيانات 🚀</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Link Modal */}
      <WhatsAppBotModal
        isOpen={showWhatsAppBotModal}
        onClose={() => setShowWhatsAppBotModal(false)}
        onStatusChange={(status) => setWhatsAppBotStatus(status)}
      />

      {/* QR Code Scanner Modal for Fast Order Pickup & WhatsApp Alert */}
      <OrderQRScannerModal
        isOpen={showQRScannerModal}
        onClose={() => setShowQRScannerModal(false)}
        orders={orders}
        onOrderUpdated={(orderId, status, options) => updateOrderStatus(orderId, status, options)}
        laundryName={userProfile?.laundry_name || 'مغسلة عود ونظافة'}
        isWhatsAppConnected={whatsAppBotStatus.isConnected}
        onSendWhatsAppNotification={sendOrderReadyNotification}
      />

      {/* Offline Mode Configuration & Manual Download Modal */}
      <OfflineModeModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        laundryId={userProfile?.laundry_id}
        onDataSavedOffline={(savedOrders) => {
          setOrders(savedOrders);
          setToastNotification({
            type: 'success',
            message: `تم حفظ ${savedOrders.length} طلب بنجاح محلياً وتفعيل وضع عدم الاتصال! 🟡`
          });
        }}
        onReturnOnline={() => {
          fetchData();
          setToastNotification({
            type: 'success',
            message: 'تمت العودة للوضع المتصل بالإنترنت ومزامنة البيانات بنجاح! 🟢'
          });
        }}
      />

      {/* Floating Global Toast Notification */}
      {toastNotification && (
        <div
          dir="rtl"
          className={`fixed bottom-6 left-6 z-[300] max-w-md p-4 rounded-2xl shadow-2xl border flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-300 ${
            toastNotification.type === 'success'
              ? 'bg-slate-900/95 text-white border-emerald-500/50 backdrop-blur-md ring-1 ring-emerald-500/30'
              : toastNotification.type === 'warning'
              ? 'bg-slate-900/95 text-white border-amber-500/50 backdrop-blur-md ring-1 ring-amber-500/30'
              : 'bg-slate-900/95 text-white border-red-500/50 backdrop-blur-md ring-1 ring-red-500/30'
          }`}
        >
          <div className="flex items-center gap-3">
            {toastNotification.type === 'success' ? (
              <CheckCircle size={20} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle size={20} className="text-amber-400 shrink-0" />
            )}
            <p className="text-xs font-bold leading-relaxed">{toastNotification.message}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {toastNotification.actionLabel && toastNotification.onAction && (
              <button
                type="button"
                onClick={() => {
                  toastNotification.onAction?.();
                  setToastNotification(null);
                }}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer shrink-0"
              >
                {toastNotification.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => setToastNotification(null)}
              className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
