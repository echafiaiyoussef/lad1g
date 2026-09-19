import React, { useState } from 'react';
import cashierImg from '../src/assets/images/1.png';
import ordersImg from '../src/assets/images/2.png';
import inventoryImg from '../src/assets/images/3.png';
import accountsImg from '../src/assets/images/4.png';
import { 
  CheckCircle2, 
  Shirt, 
  ShieldCheck, 
  Zap, 
  MessageCircle, 
  Crown, 
  Building2, 
  Printer, 
  BarChart3, 
  Store, 
  ChevronDown, 
  ChevronUp, 
  LogIn, 
  LayoutDashboard, 
  Layers, 
  ArrowLeft,
  Check,
  Menu,
  X,
  Lock,
  Star,
  Car,
  QrCode,
  XCircle,
  TrendingUp,
  PackageCheck,
  SlidersHorizontal,
  Sparkles,
  ExternalLink,
  PhoneCall,
  Clock,
  Sparkle
} from 'lucide-react';
import { Order } from '../types';

interface LandingPageProps {
  onOpenAuth: () => void;
  onGoToDashboard?: () => void;
  isLoggedIn?: boolean;
  orders?: Order[];
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenAuth,
  onGoToDashboard,
  isLoggedIn = false
}) => {
  // Mobile navigation menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sector / Activity templates state
  const [selectedSector, setSelectedSector] = useState<'laundry' | 'carpets' | 'dryclean' | 'cars' | 'corporate'>('laundry');

  // Interactive Screen Showcase Tab
  const [activeScreenTab, setActiveScreenTab] = useState<'cashier' | 'orders' | 'inventory' | 'accounts'>('cashier');

  // ROI Calculator state
  const [dailyOrdersCount, setDailyOrdersCount] = useState<number>(120);

  // Subscription Pricing Toggle state ('yearly' | 'monthly')
  const [billingCycle, setBillingCycle] = useState<'yearly' | 'monthly'>('yearly');

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Sector content data
  const sectorData = {
    laundry: {
      title: 'مغاسل الملابس والمصابغ',
      badge: 'الخيار الأكثر شعبية',
      description: 'نظام متكامل لتسجيل الثياب، الأشمغة، والملابس اليومية مع طباعة باركود خاص بكل قطعة وإرسال إشعار جاهزية فوري على الواتساب.',
      features: [
        {
          title: 'خريطة وحالة الطلبات التفاعلية',
          desc: 'شاهد حالة كل طلب لحظياً (قيد الغسيل، الكي، جاهز للاستلام) وسرّع التسليم بدون طوابير.',
          icon: <LayoutDashboard className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'شاشة العمليات ومحطات الغسيل (KDS)',
          desc: 'الأوردرات تصل فوراً لعامل الغسيل ومكواة البخار على أي شاشة أو جوال مع تنبيهات صوتية.',
          icon: <Store className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'الطلب والاستعلام الذاتي بـ QR كود',
          desc: 'العميل يستطيع مسح باركود الفاتورة بهاتفه لمعرفة موعد تسليم ملابسه دون الحاجة للاتصال.',
          icon: <QrCode className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'إشعارات الواتساب الذكية بدون لمس',
          desc: 'رسالة واتساب آلية بفاتورة PDF عند التسليم، ورسالة ثانية فور تجهيز الملابس للاستلام.',
          icon: <MessageCircle className="w-5 h-5 text-sky-500" />
        }
      ]
    },
    carpets: {
      title: 'غسيل السجاد والمفارش والبطاطين',
      badge: 'إدارة مساحات وقطع كبرى',
      description: 'حساب دقيق لأسعار السجاد بالمتر المربع أو القطعة، وإدارة مراحل النقع، الغسيل، والتجفيف مع جدول تسليم دقيق.',
      features: [
        {
          title: 'حاسبة أمتار السجاد الآلية',
          desc: 'إدخال الطول والعرض ليحسب الكاشير الإجمالي والضريبة تلقائياً بدون أخطاء حسابية.',
          icon: <SlidersHorizontal className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'تتبع مدة التجفيف والتعطير',
          desc: 'تنبيه الكاشير عندما يحين موعد تغليف السجادة وتعطيرها بدهن العود الملكي المفضل.',
          icon: <PackageCheck className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'ملصقات باركود حرارية مقاومة للماء',
          desc: 'طباعة كود باركود قوي يُلصق على ظهر السجاد والبطاطين ليمنع الخلط والضياع تماماً.',
          icon: <Printer className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'خدمة الاستلام والتوصيل المنزلي',
          desc: 'إسناد طلبات السجاد للسائق وتتبع حالة الاستلام من منزل العميل وتسليمه.',
          icon: <TrendingUp className="w-5 h-5 text-sky-500" />
        }
      ]
    },
    dryclean: {
      title: 'التنظيف الجاف (Dry Clean) والرسميات',
      badge: 'عناية فائقة وخامات حساسة',
      description: 'إدارة متخصصة لفساتين السهرة، البدل الفاخرة، والجلديات مع تسجيل ملاحظات البقع والعيوب قبل الاستلام لحماية المغسلة.',
      features: [
        {
          title: 'توثيق حالة القطعة وملاحظات البقع',
          desc: 'تسجيل أي عيب أو بقعة مستعصية بالفاتورة فوراً لحماية المغسلة من ادعاءات التلف.',
          icon: <ShieldCheck className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'ترميز الأقمشة الحساسة',
          desc: 'تحديد نوع التنظيف المطلوب (دراي كلين، بخار خاص، غسيل يدوي) على شاشة محطة العمل.',
          icon: <Shirt className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'فواتير ضريبية مفصلة وباركود ثنائي',
          desc: 'فواتير معتمدة من هيئة الزكاة والضريبة والجمارك تناسب الملابس الراقية والمناسبات.',
          icon: <QrCode className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'تذكير VIP للعملاء المميزين',
          desc: 'إرسال رسائل مخصصة للعملاء ذوي الاشتراكات الدورية وفساتين المناسبات الخاصة.',
          icon: <Crown className="w-5 h-5 text-sky-500" />
        }
      ]
    },
    cars: {
      title: 'مغاسل ومحطات غسيل السيارات',
      badge: 'سرعة وكفاءة بالمسارات',
      description: 'تنظيم حركة دخول السيارات، تحديد نوع الغسيل (داخلي، خارجي، تلميع ساطع، بخار) وطباعة إيصال فوري.',
      features: [
        {
          title: 'تسجيل رقم اللوحة ونوع المركبة',
          desc: 'إدخال رقم اللوحة ونوع السيارة (صغيرة، جيب، بيك آب) لاحتساب السعر المناسب في ثوانٍ.',
          icon: <Car className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'إشعار انتهاء الغسيل عبر الواتساب',
          desc: 'إرسال رسالة واتساب للزبون وهو في صالة الانتظار فور الانتهاء من تلميع مركبته.',
          icon: <MessageCircle className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'إدارة المواد والملمعات المستهلكة',
          desc: 'مراقبة استهلاك الشامبو، الواكس، ومعطرات المقاعد لمنع الهدر وسرقة المواد.',
          icon: <Layers className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'باقات اشتراكات الغسيل الشهري',
          desc: 'إصدار باقات غسيل دورية للعملاء لضمان تدفق نقدي مسبق وزيادة الإيرادات.',
          icon: <Crown className="w-5 h-5 text-sky-500" />
        }
      ]
    },
    corporate: {
      title: 'مغاسل الفنادق والشركات والعقود',
      badge: 'أحجام ضخمة وفواتير آجلة',
      description: 'إدارة عقود المغاسل المركزية للفنادق، المستشفيات، والمطاعم مع فواتير شهرية وكشوفات حساب مفصلة.',
      features: [
        {
          title: 'تسجيل الحسابات والمديونيات الآجلة',
          desc: 'تتبع مبيعات كل شركة وفندق على حدة وإصدار كشف حساب شهري بضغطة زر.',
          icon: <BarChart3 className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'توليد فواتير B2B المعتمدة',
          desc: 'إصدار فواتير ضريبية رسمية تتضمن الرقم الضريبي للشركة وبيانات الاعتماد الرسمية.',
          icon: <Building2 className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'استلام بالوزن (بالكيلو) والكميات الكبرى',
          desc: 'دعم محاسبة الشراشف والمفارش الفندقية بالوزن الإجمالي لتسريع دورة العمل.',
          icon: <Layers className="w-5 h-5 text-sky-500" />
        },
        {
          title: 'تصدير التقارير لملفات Excel و PDF',
          desc: 'تصدير سجل المبيعات والعمليات إلى إكسل لإرسالها للإدارة المالية ومراجعي الحسابات.',
          icon: <PackageCheck className="w-5 h-5 text-sky-500" />
        }
      ]
    }
  };

  // ROI Calculator metrics
  const savedHoursMonthly = Math.round(dailyOrdersCount * 0.45);
  const preventedLossSAR = Math.round(dailyOrdersCount * 12.5);
  const revenueGrowthPercent = 28;

  const faqs = [
    {
      q: 'هل يعمل نظام ghasil.cloud بدون إنترنت (Offline 100%) إذا انقطع النت؟',
      a: 'نعم تماماً! نظام ghasil.cloud مصمم بتقنية Offline-First المتطورة؛ تستطيع تسجيل الفواتير، طباعة الإيصالات، واختيار الملابس حتى لو انقطع الإنترنت، وبمجرد عودة الاتصال تتم المزامنة السحابية التلقائية دون فقدان أي بيانات.'
    },
    {
      q: 'هل النظام متوافق مع متطلبات هيئة الزكاة والضريبة والجمارك (ZATCA)؟',
      a: 'نعم، يصدر النظام فواتير ضريبية مبسطة معتمدة تتضمن رمز الاستجابة السريع المشفر (QR Code) ونسبة ضريبة القيمة المضافة 15% واسم وبيانات المنشأة طبقاً للمواصفات السعودية والخليجية.'
    },
    {
      q: 'كيف يعمل بوت الواتساب التلقائي مع العملاء؟',
      a: 'بمجرد تسجيل الطلب على ghasil.cloud، يُرسل النظام تلقائياً رسالة واتساب للعميل برقم الفاتورة ورابط نسختها الرسمية PDF. وعند تغيير الحالة إلى (جاهز للاستلام)، يُرسل النظام إشعاراً ثانياً للعميل فوراً للاستلام دون أي تدخل يدوي.'
    },
    {
      q: 'ما هي الطابعات والأجهزة المدعومة للطباعة ومسح الباركود؟',
      a: 'يعمل النظام بسلاسة على كافة طابعات الفواتير الحرارية (80mm و 58mm) عبر منفذ USB أو البلوتوث أو الشبكة، ويدعم قارئات الباركود الحرارية USB وقارئ الكاميرا للملابس والفواتير.'
    },
    {
      q: 'هل أحتاج لشراء جهاز كاشير خاص أو شاشة غالية؟',
      a: 'أبداً! يعمل ghasil.cloud عبر متصفح الويب وعلى أي جوال ذكي (آيفون أو أندرويد)، أو آيباد/تابلت، أو كمبيوتر مكتبي متوفر لديك بالفعل دون أي تكاليف عتاد إضافية.'
    },
    {
      q: 'هل توجد فترة تجربة مجانية للنظام؟',
      a: 'نعم، يمكنك البدء بتجربة مجانية كاملة المزايا لمدة 14 يوماً بدون الحاجة لإدخال أي بطاقة ائتمانية، مع إمكانية التواصل المباشر مع فريق الدعم عبر الواتساب للمساعدة في الإعداد.'
    }
  ];

  return (
    <div 
      className="min-h-screen text-slate-900 font-sans overflow-x-hidden selection:bg-cyan-500 selection:text-white" 
      dir="rtl" 
      style={{ fontFamily: "'Tajawal', sans-serif" }}
    >
      
      {/* Top Announcement Bar (Dark) */}
      <div className="relative z-50 bg-[#080e1c] text-cyan-300 text-xs py-2 px-4 text-center font-bold border-b border-cyan-500/20 flex items-center justify-center gap-2">
        <span className="bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs">
          جديد 2026 ⚡
        </span>
        <span className="text-slate-200 text-[11px] sm:text-xs">
          منظومة <span className="text-cyan-400 font-black font-mono">ghasil.cloud</span> السحابية الذكية لإدارة المغاسل — فواتير، ملصقات باركود، وبوت واتساب فوري 🚀
        </span>
      </div>

      {/* Modern Top Header / Navbar (Dark Obsidian) */}
      <header className="sticky top-0 z-50 bg-[#060c1d]/95 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25 text-slate-950 shrink-0 font-black">
              <Shirt className="w-6 h-6 stroke-[2.4]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
                  ghasil<span className="text-cyan-400">.cloud</span>
                </span>
                <span className="text-[10px] font-black text-cyan-300 bg-cyan-950/90 px-2 py-0.5 rounded-md border border-cyan-500/40">
                  سحابي
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold tracking-wide">المنظومة السحابية الذكية للمغاسل</p>
            </div>
          </div>

          {/* Nav Links (Desktop) - Strictly 5 high-priority items */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-black text-slate-300">
            <a href="#features" className="hover:text-cyan-400 transition-colors">المميزات</a>
            <a href="#why-us" className="hover:text-cyan-400 transition-colors">مقارنة الحلول</a>
            <a href="#sectors" className="hover:text-cyan-400 transition-colors">قطاعات النشاط</a>
            <a href="#screens" className="hover:text-cyan-400 transition-colors">معاينة الشاشات</a>
            <a href="#pricing" className="hover:text-cyan-400 transition-colors flex items-center gap-1.5">
              <span>الباقات</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {isLoggedIn && onGoToDashboard ? (
              <button
                onClick={onGoToDashboard}
                className="px-4 py-2.5 bg-blue-950/90 hover:bg-blue-900 text-cyan-300 border border-cyan-500/40 rounded-xl font-black text-xs transition-all flex items-center gap-2 active:scale-95 shadow-xs"
              >
                <LayoutDashboard size={15} />
                <span>لوحة التحكم</span>
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="hidden sm:flex px-4 py-2.5 bg-[#0d1a38] hover:bg-[#132552] text-slate-200 border border-slate-700/60 rounded-xl font-black text-xs transition-all items-center gap-2 active:scale-95"
              >
                <LogIn size={15} className="text-cyan-400" />
                <span>تسجيل الدخول</span>
              </button>
            )}

            <button
              onClick={onOpenAuth}
              className="px-5 py-2.5 bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-cyan-400/25 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <span>ابدأ مجاناً</span>
              <ArrowLeft size={14} className="stroke-[3]" />
            </button>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl transition-all flex items-center justify-center shrink-0 active:scale-95"
              aria-label="القائمة"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#091124] border-b border-slate-800 px-4 pt-3 pb-6 space-y-3 shadow-2xl animate-in slide-in-from-top duration-200">
            <nav className="flex flex-col space-y-1 font-black text-xs text-slate-300 border-b border-slate-800 pb-3">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="p-3 hover:bg-slate-800/80 rounded-xl flex items-center justify-between">
                <span>المميزات</span>
                <ArrowLeft size={14} className="text-slate-500" />
              </a>
              <a href="#why-us" onClick={() => setMobileMenuOpen(false)} className="p-3 hover:bg-slate-800/80 rounded-xl flex items-center justify-between">
                <span>مقارنة الحلول</span>
                <ArrowLeft size={14} className="text-slate-500" />
              </a>
              <a href="#sectors" onClick={() => setMobileMenuOpen(false)} className="p-3 hover:bg-slate-800/80 rounded-xl flex items-center justify-between">
                <span>قطاعات النشاط</span>
                <ArrowLeft size={14} className="text-slate-500" />
              </a>
              <a href="#screens" onClick={() => setMobileMenuOpen(false)} className="p-3 hover:bg-slate-800/80 rounded-xl flex items-center justify-between">
                <span>معاينة الشاشات</span>
                <ArrowLeft size={14} className="text-slate-500" />
              </a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="p-3 bg-cyan-950/40 text-cyan-300 rounded-xl flex items-center justify-between border border-cyan-500/20">
                <span>باقات الاشتراك</span>
                <ArrowLeft size={14} className="text-cyan-400" />
              </a>
            </nav>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => { setMobileMenuOpen(false); onOpenAuth(); }}
                className="w-full py-3 bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                <span>ابدأ تجربتك المجانية ⚡</span>
              </button>
              <a
                href="https://wa.me/966500000000"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 font-black text-xs rounded-xl flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} />
                <span>تواصل عبر الواتساب</span>
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ============================================================ */}
      {/* SECTION 1 (DARK): HERO SECTION WITH MOBILE MOCKUP            */}
      {/* ============================================================ */}
      <section className="relative bg-[#070c18] text-white pt-14 pb-20 lg:pt-20 lg:pb-28 overflow-hidden z-10 border-b border-slate-800/80">
        
        {/* Subtle Ambient Backlights */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[400px] bg-gradient-to-b from-cyan-500/15 via-blue-600/5 to-transparent blur-[140px] pointer-events-none z-0" />
        <div className="absolute bottom-0 right-10 w-[450px] h-[350px] bg-sky-600/10 blur-[150px] pointer-events-none z-0" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column (RTL text content) */}
            <div className="lg:col-span-7 space-y-7 text-right">
              
              {/* Category Pill Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-xs font-black shadow-inner backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>منظومة ghasil.cloud السحابية — الأكثر تطوراً لمغاسل المستقبل ✦</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.25] tracking-tight">
                أدر مبيعاتك وعمليات مغسلتك من{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-teal-300 drop-shadow-[0_0_30px_rgba(56,189,248,0.35)]">
                  شاشة ذكية واحدة
                </span>
              </h1>

              {/* Sub-headline slogan */}
              <div className="flex items-center gap-3 text-cyan-400 font-black text-base sm:text-lg tracking-wide">
                <span>أسهل</span>
                <span className="text-slate-600">···</span>
                <span>أسرع</span>
                <span className="text-slate-600">···</span>
                <span>أوفر</span>
              </div>

              {/* Description */}
              <p className="text-slate-300 text-xs sm:text-sm lg:text-base font-bold leading-relaxed max-w-2xl">
                منظومة سحابية متكاملة للمغاسل والمصابغ — فواتير حرارية معتمدة، باركود و QR لملصقات الملابس، تنبيهات واتساب تلقائية، وتقارير أرباح فورية. يعمل مباشرة على جوالك أو التابلت، وحتى لو انقطع النت!
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={onOpenAuth}
                  className="px-8 py-4 bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 rounded-2xl font-black text-sm shadow-xl shadow-cyan-400/25 active:scale-95 transition-all flex items-center gap-2.5"
                >
                  <Zap size={18} className="fill-slate-950" />
                  <span>ابدأ تجربتك المجانية — 14 يوم</span>
                </button>

                <a
                  href="#features"
                  className="px-7 py-4 bg-[#0d1a38] hover:bg-[#142650] text-slate-200 border border-slate-700/80 rounded-2xl font-black text-sm transition-all flex items-center gap-2 active:scale-95"
                >
                  <span>استكشف المميزات</span>
                  <ArrowLeft size={16} />
                </a>
              </div>

              {/* Hero Stats Grid */}
              <div className="pt-8 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3.5 bg-[#091124]/90 rounded-2xl border border-slate-800">
                  <div className="text-xl sm:text-2xl font-black text-cyan-400">+10,000</div>
                  <div className="text-[11px] font-bold text-slate-400 mt-0.5">فاتورة يومياً</div>
                </div>

                <div className="p-3.5 bg-[#091124]/90 rounded-2xl border border-slate-800">
                  <div className="text-xl sm:text-2xl font-black text-cyan-400">100%</div>
                  <div className="text-[11px] font-bold text-slate-400 mt-0.5">أوفلاين تماماً</div>
                </div>

                <div className="p-3.5 bg-[#091124]/90 rounded-2xl border border-slate-800">
                  <div className="text-xl sm:text-2xl font-black text-cyan-400">5 دقائق</div>
                  <div className="text-[11px] font-bold text-slate-400 mt-0.5">وقت الإعداد</div>
                </div>

                <div className="p-3.5 bg-[#091124]/90 rounded-2xl border border-slate-800">
                  <div className="text-xl sm:text-2xl font-black text-amber-400 flex items-center justify-center gap-1">
                    <span>4.9</span>
                    <Star size={16} className="fill-amber-400 text-amber-400" />
                  </div>
                  <div className="text-[11px] font-bold text-slate-400 mt-0.5">تقييم المشتركين</div>
                </div>
              </div>

            </div>

            {/* Right Column: Realistic Mobile Mockup with Floating Badges */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              
              {/* Radial glow around mockup */}
              <div className="absolute w-[360px] h-[360px] bg-cyan-500/15 rounded-full blur-[100px] pointer-events-none" />

              {/* Floating Badge 1: Offline 100% */}
              <div className="absolute -top-4 right-2 sm:-right-6 z-30 bg-[#091228]/95 backdrop-blur-md border border-cyan-500/40 px-3.5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-right">
                <div className="w-8 h-8 rounded-xl bg-blue-600/30 text-cyan-400 flex items-center justify-center shrink-0">
                  <Zap size={16} />
                </div>
                <div>
                  <div className="text-xs font-black text-white">يعمل Offline 100%</div>
                  <div className="text-[10px] text-cyan-300 font-bold">بدون انقطاع حتى بدون إنترنت 📶</div>
                </div>
              </div>

              {/* Floating Badge 2: Instant Reports */}
              <div className="absolute bottom-20 -right-4 sm:-right-8 z-30 bg-[#091228]/95 backdrop-blur-md border border-cyan-500/40 px-3.5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-right">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
                  <BarChart3 size={16} />
                </div>
                <div>
                  <div className="text-xs font-black text-white">تقارير لحظية</div>
                  <div className="text-[10px] text-cyan-300 font-bold">أرباحك ومبيعاتك في جيبك 📊</div>
                </div>
              </div>

              {/* Floating Badge 3: Manager PIN Lock */}
              <div className="absolute top-1/2 -left-4 sm:-left-8 -translate-y-1/2 z-30 bg-[#091228]/95 backdrop-blur-md border border-blue-500/40 px-3.5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-right">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0">
                  <Lock size={16} />
                </div>
                <div>
                  <div className="text-xs font-black text-white">حماية PIN للمدير</div>
                  <div className="text-[10px] text-slate-300 font-bold">أمان كامل للصندوق والمرتجعات 🔒</div>
                </div>
              </div>

              {/* Mobile Device Frame */}
              <div className="relative w-full max-w-[320px] sm:max-w-[340px] bg-slate-950 rounded-[3rem] p-3 border-4 border-slate-800 shadow-2xl shadow-cyan-500/20">
                
                {/* Speaker notch */}
                <div className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-900 rounded-full z-20 flex items-center justify-center">
                  <div className="w-10 h-1 bg-slate-700 rounded-full" />
                </div>

                {/* Inner Phone Screen */}
                <div className="rounded-[2.4rem] bg-white text-slate-900 overflow-hidden text-right p-3.5 pt-7 space-y-3 font-sans shadow-inner">
                  
                  {/* Phone Header Status Bar */}
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1 border-b border-slate-100 pb-2">
                    <span className="text-slate-800 font-mono font-bold">9:41</span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-600 font-mono">
                      <span>ghasil.cloud</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                  </div>

                  {/* Laundry greeting */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold">مرحباً بك 👋</div>
                      <div className="text-xs font-black text-slate-900">مغسلة الأناقة والعطور 🧺</div>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold text-xs border border-cyan-100 font-mono">
                      GC
                    </div>
                  </div>

                  {/* Quick stats banner inside phone */}
                  <div className="bg-gradient-to-l from-blue-600 to-cyan-500 rounded-2xl p-3 text-white space-y-1 shadow-sm">
                    <div className="flex justify-between items-center text-[10px] text-cyan-100 font-bold">
                      <span>إجمالي المبيعات اليوم</span>
                      <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[9px]">+112% عن أمس</span>
                    </div>
                    <div className="text-lg font-black tracking-tight font-mono">12,540 ر.س</div>
                    <div className="text-[10px] text-cyan-100">عدد الفواتير المنفذة: 86 فاتورة</div>
                  </div>

                  {/* Quick Action Buttons Grid inside phone */}
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="bg-cyan-50 p-2 rounded-xl border border-cyan-100">
                      <div className="text-xs">➕</div>
                      <div className="text-[9px] font-black text-cyan-950 mt-0.5">طلب جديد</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div className="text-xs">🧾</div>
                      <div className="text-[9px] font-black text-slate-700 mt-0.5">فواتير</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div className="text-xs">👔</div>
                      <div className="text-[9px] font-black text-slate-700 mt-0.5">الملابس</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div className="text-xs">👥</div>
                      <div className="text-[9px] font-black text-slate-700 mt-0.5">العملاء</div>
                    </div>
                  </div>

                  {/* 7-Day Curve Chart Illustration inside phone */}
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                    <div className="flex justify-between items-center text-[9px] font-black text-slate-700 mb-1">
                      <span>المبيعات خلال 7 أيام</span>
                      <span className="text-cyan-600 font-bold">أرباح متصاعدة ↗</span>
                    </div>
                    <div className="h-12 w-full flex items-end justify-between gap-1 pt-2 px-1">
                      <div className="w-3 bg-cyan-200 rounded-t h-[35%]" />
                      <div className="w-3 bg-cyan-300 rounded-t h-[48%]" />
                      <div className="w-3 bg-cyan-400 rounded-t h-[60%]" />
                      <div className="w-3 bg-cyan-300 rounded-t h-[52%]" />
                      <div className="w-3 bg-blue-500 rounded-t h-[75%]" />
                      <div className="w-3 bg-blue-600 rounded-t h-[88%]" />
                      <div className="w-3 bg-cyan-500 rounded-t h-[100%]" />
                    </div>
                  </div>

                  {/* Bottom nav inside phone */}
                  <div className="flex justify-around text-slate-400 border-t border-slate-100 pt-2 text-[8px] font-bold">
                    <div className="text-cyan-600 flex flex-col items-center">
                      <Store size={14} />
                      <span>الرئيسية</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <Shirt size={14} />
                      <span>الملابس</span>
                    </div>
                    <div className="w-7 h-7 -mt-3 bg-cyan-500 text-white rounded-full flex items-center justify-center shadow-md">
                      <Zap size={13} />
                    </div>
                    <div className="flex flex-col items-center">
                      <BarChart3 size={14} />
                      <span>التقارير</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <Lock size={14} />
                      <span>المزيد</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 2 (WHITE): CORE FEATURES                             */}
      {/* ============================================================ */}
      <section id="features" className="py-20 bg-white text-slate-900 border-b border-slate-200 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-black">
              <Sparkles size={14} className="text-sky-600" />
              <span>مميزات ghasil.cloud الحصرية</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-950 leading-tight">
              كل ما تحتاجه لإدارة وتطوير مغسلتك في منصة واحدة
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm font-bold leading-relaxed">
              أدوات عصرية صُممت خصيصاً لأصحاب المغاسل والمصابغ؛ لمنع السرقات، تفادي ضياع الملابس، ومضاعفة الأرباح.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-right">
            
            {/* Feature 1 */}
            <div className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-sky-400 p-8 rounded-3xl transition-all shadow-xs hover:shadow-md space-y-4 group">
              <div className="w-14 h-14 bg-sky-100 text-sky-600 group-hover:bg-sky-500 group-hover:text-white rounded-2xl flex items-center justify-center font-black transition-colors">
                <Zap size={26} />
              </div>
              <h3 className="text-lg font-black text-slate-950">يعمل 100% أوفلاين بدون نت</h3>
              <p className="text-xs sm:text-sm font-bold text-slate-600 leading-relaxed">
                لا تتوقف مغسلتك أبداً لو انقطع الإنترنت. أصدر الفواتير واطبع الإيصالات لحظياً، وعند عودة الشبكة تتم المزامنة السحابية تلقائياً.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-sky-400 p-8 rounded-3xl transition-all shadow-xs hover:shadow-md space-y-4 group">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white rounded-2xl flex items-center justify-center font-black transition-colors">
                <Printer size={26} />
              </div>
              <h3 className="text-lg font-black text-slate-950">طباعة حرارية + ملصقات ملابس</h3>
              <p className="text-xs sm:text-sm font-bold text-slate-600 leading-relaxed">
                طباعة إيصالات حرارية متوافقة مع هيئة الزكاة مع طباعة باركود خاص بالقطع لتعليقه على الملابس لمنع ضياع أو خلط ملابس الزبائن.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-sky-400 p-8 rounded-3xl transition-all shadow-xs hover:shadow-md space-y-4 group">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white rounded-2xl flex items-center justify-center font-black transition-colors">
                <MessageCircle size={26} />
              </div>
              <h3 className="text-lg font-black text-slate-950">إشعارات الواتساب وفاتورة PDF</h3>
              <p className="text-xs sm:text-sm font-bold text-slate-600 leading-relaxed">
                بوت واتساب آلي يرسل نسخة رسمية من الفاتورة للعميل، ويرسل إشعاراً آلياً فور الانتهاء من غسيل وكي ملابسه لتشجيعه على الاستلام الفوري.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-sky-400 p-8 rounded-3xl transition-all shadow-xs hover:shadow-md space-y-4 group">
              <div className="w-14 h-14 bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white rounded-2xl flex items-center justify-center font-black transition-colors">
                <Lock size={26} />
              </div>
              <h3 className="text-lg font-black text-slate-950">حماية الصندوق وصلاحية PIN للمدير</h3>
              <p className="text-xs sm:text-sm font-bold text-slate-600 leading-relaxed">
                منع تلاعب العمالة بطلب رمز PIN السري للمدير عند الرغبة في حذف أو تعديل أو عمل مرتجع لأي فاتورة سابقة لضمان أمان أموالك.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-sky-400 p-8 rounded-3xl transition-all shadow-xs hover:shadow-md space-y-4 group">
              <div className="w-14 h-14 bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white rounded-2xl flex items-center justify-center font-black transition-colors">
                <Layers size={26} />
              </div>
              <h3 className="text-lg font-black text-slate-950">مراقبة المخزون والمواد الاستهلاكية</h3>
              <p className="text-xs sm:text-sm font-bold text-slate-600 leading-relaxed">
                متابعة آلية لكميات الصابون، النيلة، المعطرات، والعلاقات مع كل عملية غسيل وتنبيهك تلقائياً عند اقتراب نفاد أي مادة لطلبها مبكراً.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-sky-400 p-8 rounded-3xl transition-all shadow-xs hover:shadow-md space-y-4 group">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 group-hover:bg-rose-600 group-hover:text-white rounded-2xl flex items-center justify-center font-black transition-colors">
                <BarChart3 size={26} />
              </div>
              <h3 className="text-lg font-black text-slate-950">تقارير المبيعات وضريبة 15%</h3>
              <p className="text-xs sm:text-sm font-bold text-slate-600 leading-relaxed">
                تصفية كاشير يومية بنقرة واحدة، تفصيل طرق الدفع (كاش، شبكة، مدى، تحويل) وتجهيز تقرير ضريبة القيمة المضافة لتقديمه بسهولة.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 3 (BLACK): COMPARISON (GHASIL.CLOUD VS TRADITIONAL)  */}
      {/* ============================================================ */}
      <section id="why-us" className="py-20 bg-[#080d1a] text-white border-b border-slate-800/80 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Heading */}
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-black">
              <span>مقارنة الحلول الذكية</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight">
              هل تعاني من مشاكل البرامج القديمة والمكلفة؟
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm font-bold leading-relaxed">
              تم بناء منظومة <span className="text-cyan-400 font-mono">ghasil.cloud</span> لتجاوز كافة التحديات التي تواجه أصحاب المغاسل والمصابغ يومياً
            </p>
          </div>

          {/* Comparison Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch max-w-6xl mx-auto">
            
            {/* Card 1: ghasil.cloud */}
            <div className="bg-gradient-to-b from-[#0f1d44] to-[#0a1432] border-2 border-cyan-400/50 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-cyan-950/40 flex flex-col justify-between">
              
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-blue-800/60 pb-5">
                  <div>
                    <h3 className="text-2xl font-black text-white flex items-center gap-2">
                      <span className="font-mono text-cyan-400">ghasil.cloud</span>
                      <span>— المنظومة الذكية</span>
                    </h3>
                    <p className="text-xs font-bold text-cyan-300 mt-1">مصممة خصيصاً للسرعة، الدقة، والأمان المالي</p>
                  </div>
                  <div className="w-12 h-12 bg-cyan-500/20 text-cyan-400 rounded-2xl flex items-center justify-center shrink-0 border border-cyan-400/30">
                    <CheckCircle2 size={24} />
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-3.5 text-right">
                  
                  <div className="flex items-start gap-3.5 bg-blue-950/50 p-3.5 rounded-2xl border border-blue-900/50">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={14} className="stroke-[3]" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-200 leading-relaxed">
                      <strong className="text-white font-black">بيع وأصدر فواتيرك أوفلاين 100%</strong> — يتزامن تلقائياً عند عودة النت دون تعطيل الزبائن ثانية واحدة.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5 bg-blue-950/50 p-3.5 rounded-2xl border border-blue-900/50">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={14} className="stroke-[3]" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-200 leading-relaxed">
                      <strong className="text-white font-black">Manager PIN إجباري لكل مرتجع أو تعديل</strong> — حماية كاملة لأموال الصندوق من تلاعب أو إلغاء العمالة.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5 bg-blue-950/50 p-3.5 rounded-2xl border border-blue-900/50">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={14} className="stroke-[3]" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-200 leading-relaxed">
                      <strong className="text-white font-black">يعمل على جوالك، التابلت، أو اللابتوب</strong> — دون الحاجة لشراء أجهزة كاشير ضخمة ومكلفة.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5 bg-blue-950/50 p-3.5 rounded-2xl border border-blue-900/50">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={14} className="stroke-[3]" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-200 leading-relaxed">
                      <strong className="text-white font-black">طباعة ملصقات باركود و QR للملابس</strong> — ربط كل قطعة ملابس برقم الفاتورة والعميل لمنع الخلط نهائياً.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5 bg-blue-950/50 p-3.5 rounded-2xl border border-blue-900/50">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={14} className="stroke-[3]" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-200 leading-relaxed">
                      <strong className="text-white font-black">بوت واتساب تلقائي لإشعار العميل</strong> — يرسل الفاتورة وتنبيه الجاهزية تلقائياً دون أي مجهود يدوي.
                    </p>
                  </div>

                </div>
              </div>

              {/* Bottom CTA within card */}
              <div className="pt-6 mt-6 border-t border-blue-800/60">
                <button
                  onClick={onOpenAuth}
                  className="w-full py-3.5 bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-cyan-400/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Zap size={16} />
                  <span>انتقل إلى ghasil.cloud الآن مجاناً 🚀</span>
                </button>
              </div>

            </div>

            {/* Card 2: الأنظمة التقليدية القديمة */}
            <div className="bg-white text-slate-900 rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200 flex flex-col justify-between">
              
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-150 pb-5">
                  <div>
                    <h3 className="text-2xl font-black text-rose-600 flex items-center gap-2">
                      الأنظمة التقليدية القديمة
                    </h3>
                    <p className="text-xs font-bold text-slate-500 mt-1">برامج معقدة كثيرة الأعطال وتكلفك خسائر مستمرة</p>
                  </div>
                  <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shrink-0 border border-rose-100">
                    <XCircle size={24} />
                  </div>
                </div>

                {/* Pain Points List */}
                <div className="space-y-3.5 text-right">
                  
                  <div className="flex items-start gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <X size={14} className="stroke-[3]" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">
                      <strong className="text-rose-700 font-black">لو النت انقطع السيستم يوقف</strong> والعملاء ينتظرون في طابور وتتعطل أعمال المغسلة تماماً.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <X size={14} className="stroke-[3]" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">
                      <strong className="text-rose-700 font-black">تلاعب العمالة في الفواتير</strong> وإلغاء العمليات النقدية دون إشعار أو إذن مباشر من الإدارة.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <X size={14} className="stroke-[3]" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">
                      <strong className="text-rose-700 font-black">أجهزة ثقيلة ومكلفة جداً</strong> تتطلب مهندس صيانة وأسلاك معقدة كل فترة برسوم إضافية.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <X size={14} className="stroke-[3]" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">
                      <strong className="text-rose-700 font-black">خلط وضياع ملابس الزبائن</strong> لعدم وجود ملصقات باركود دقيقة مربوطة إلكترونياً بالطلب.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <X size={14} className="stroke-[3]" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">
                      <strong className="text-rose-700 font-black">رسوم ترخيص باهظة</strong> وتكاليف دعم فني سنوية دون تقديم تطويرات أو حلول حقيقية.
                    </p>
                  </div>

                </div>
              </div>

              {/* Bottom Note */}
              <div className="pt-6 mt-6 border-t border-slate-100 text-center">
                <span className="text-xs font-bold text-slate-500">
                  ⚠️ الأنظمة القديمة تكلفك سنوياً آلاف الريالات من الخسائر وضياع وقت العمالة.
                </span>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 4 (WHITE): SECTOR SOLUTIONS & SMART TEMPLATES        */}
      {/* ============================================================ */}
      <section id="sectors" className="py-20 bg-slate-50 text-slate-900 border-b border-slate-200 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Heading */}
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-black">
              <span>قوالب مهيأة لكل نشاط</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-950 leading-tight">
              حلول مصممة خصيصاً لنوع عملك
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm font-bold leading-relaxed">
              بمجرد اختيار نوع نشاطك، يخصص <span className="text-sky-600 font-mono font-bold">ghasil.cloud</span> المسميات، وحدات القياس، والواجهات تلقائياً
            </p>
          </div>

          {/* Interactive Sector Selection Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-w-5xl mx-auto mb-10">
            
            <button
              type="button"
              onClick={() => setSelectedSector('laundry')}
              className={`p-4 rounded-2xl transition-all text-center flex flex-col items-center justify-center gap-2.5 cursor-pointer border ${
                selectedSector === 'laundry'
                  ? 'bg-white border-sky-500 text-sky-950 shadow-md ring-2 ring-sky-500/20'
                  : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedSector === 'laundry' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Shirt size={24} />
              </div>
              <span className="text-xs font-black">مغاسل الملابس والمصابغ</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSector('carpets')}
              className={`p-4 rounded-2xl transition-all text-center flex flex-col items-center justify-center gap-2.5 cursor-pointer border ${
                selectedSector === 'carpets'
                  ? 'bg-white border-sky-500 text-sky-950 shadow-md ring-2 ring-sky-500/20'
                  : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedSector === 'carpets' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Layers size={24} />
              </div>
              <span className="text-xs font-black">غسيل السجاد والبطاطين</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSector('dryclean')}
              className={`p-4 rounded-2xl transition-all text-center flex flex-col items-center justify-center gap-2.5 cursor-pointer border ${
                selectedSector === 'dryclean'
                  ? 'bg-white border-sky-500 text-sky-950 shadow-md ring-2 ring-sky-500/20'
                  : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedSector === 'dryclean' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Crown size={24} />
              </div>
              <span className="text-xs font-black">التنظيف الجاف (Dry Clean)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSector('cars')}
              className={`p-4 rounded-2xl transition-all text-center flex flex-col items-center justify-center gap-2.5 cursor-pointer border ${
                selectedSector === 'cars'
                  ? 'bg-white border-sky-500 text-sky-950 shadow-md ring-2 ring-sky-500/20'
                  : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedSector === 'cars' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Car size={24} />
              </div>
              <span className="text-xs font-black">مغاسل السيارات والمحطات</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSector('corporate')}
              className={`p-4 rounded-2xl transition-all text-center flex flex-col items-center justify-center gap-2.5 cursor-pointer border ${
                selectedSector === 'corporate'
                  ? 'bg-white border-sky-500 text-sky-950 shadow-md ring-2 ring-sky-500/20'
                  : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedSector === 'corporate' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Building2 size={24} />
              </div>
              <span className="text-xs font-black">مغاسل الفنادق والشركات</span>
            </button>

          </div>

          {/* Active Sector Sub-features Showcase */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 max-w-5xl mx-auto shadow-md">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-8 text-right">
              <div>
                <span className="text-[11px] font-black text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
                  {sectorData[selectedSector].badge}
                </span>
                <h3 className="text-2xl font-black text-slate-950 mt-2">
                  {sectorData[selectedSector].title}
                </h3>
                <p className="text-xs sm:text-sm font-bold text-slate-600 mt-1 max-w-2xl">
                  {sectorData[selectedSector].description}
                </p>
              </div>

              <button
                onClick={onOpenAuth}
                className="px-6 py-3 bg-slate-900 hover:bg-sky-600 text-white font-black text-xs rounded-xl shadow-md transition-all shrink-0 active:scale-95"
              >
                تفعيل هذا القالب لمغسلتك ⚡
              </button>
            </div>

            {/* 4 Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-right">
              {sectorData[selectedSector].features.map((feat, idx) => (
                <div 
                  key={idx} 
                  className="bg-slate-50 hover:bg-sky-50/50 p-5 rounded-2xl border border-slate-200/90 transition-all space-y-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                    {feat.icon}
                  </div>
                  <h4 className="text-sm font-black text-slate-900">{feat.title}</h4>
                  <p className="text-xs font-bold text-slate-600 leading-relaxed">{feat.desc}</p>
                </div>
              ))}
            </div>

          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 5 (BLACK): LIVE SCREEN PREVIEWS                      */}
      {/* ============================================================ */}
      <section id="screens" className="py-20 bg-[#060b16] text-white border-b border-slate-800/80 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-black">
              <span>استعراض المنظومة الحية</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight">
              شاهد واجهات النظام السحابي الفعلي
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm font-bold leading-relaxed">
              تصميم عربي مريح للعين، بأزرار لمس سريعة تمكنك من إصدار وطباعة الفاتورة في أقل من 5 ثوانٍ
            </p>

            {/* Screen Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setActiveScreenTab('cashier')}
                className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeScreenTab === 'cashier'
                    ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/25'
                    : 'bg-[#0e1933] text-slate-300 hover:bg-[#152449]'
                }`}
              >
                1. واجهة الكاشير السريع
              </button>

              <button
                type="button"
                onClick={() => setActiveScreenTab('orders')}
                className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeScreenTab === 'orders'
                    ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/25'
                    : 'bg-[#0e1933] text-slate-300 hover:bg-[#152449]'
                }`}
              >
                2. متابعة وتسليم الطلبات
              </button>

              <button
                type="button"
                onClick={() => setActiveScreenTab('inventory')}
                className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeScreenTab === 'inventory'
                    ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/25'
                    : 'bg-[#0e1933] text-slate-300 hover:bg-[#152449]'
                }`}
              >
                3. المخزون والمواد الاستهلاكية
              </button>

              <button
                type="button"
                onClick={() => setActiveScreenTab('accounts')}
                className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeScreenTab === 'accounts'
                    ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/25'
                    : 'bg-[#0e1933] text-slate-300 hover:bg-[#152449]'
                }`}
              >
                4. التقارير المالية والضريبة
              </button>
            </div>
          </div>

          {/* Screen Showcase Container */}
          <div className="max-w-5xl mx-auto bg-slate-950 rounded-3xl p-3 sm:p-4 border border-slate-800 shadow-2xl overflow-hidden">
            
            <div className="bg-[#0c1630] px-5 py-3 rounded-t-2xl border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="mr-2 font-black text-white">
                  {activeScreenTab === 'cashier' && 'شاشة الكاشير السريع واختيار الملابس'}
                  {activeScreenTab === 'orders' && 'شاشة سجل الطلبات وتحديث حالات الغسيل'}
                  {activeScreenTab === 'inventory' && 'شاشة إدارة المخزون والصابون والمعطرات'}
                  {activeScreenTab === 'accounts' && 'شاشة الحسابات والمبيعات والضريبة'}
                </span>
              </div>
              <span className="text-cyan-400 font-bold font-mono hidden sm:inline-block">ghasil.cloud</span>
            </div>

            <div className="relative rounded-b-2xl overflow-hidden bg-slate-900">
              <img
                src={
                  activeScreenTab === 'cashier' ? cashierImg :
                  activeScreenTab === 'orders' ? ordersImg :
                  activeScreenTab === 'inventory' ? inventoryImg : accountsImg
                }
                alt="معاينة شاشة النظام"
                referrerPolicy="no-referrer"
                className="w-full h-auto object-cover max-h-[580px] shadow-md"
              />
            </div>

          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 6 (WHITE): ROI SAVINGS CALCULATOR                    */}
      {/* ============================================================ */}
      <section id="calculator" className="py-20 bg-white text-slate-900 border-b border-slate-200 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm space-y-8 text-right">
            
            <div className="space-y-3">
              <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                حاسبة العائد المالي لمغسلتك 💰
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-950">
                احسب كم يوفر لك النظام شهرياً
              </h2>
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                حرّك المؤشر بحسب عدد الطلبات اليومية في مغسلتك وشاهد الأثر المالي الفوري:
              </p>
            </div>

            {/* Slider Control */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-black text-slate-700">عدد الطلبات اليومية في مغسلتك:</span>
                <span className="text-2xl font-black text-sky-600 font-mono">{dailyOrdersCount} طلب / يوم</span>
              </div>
              
              <input
                type="range"
                min="30"
                max="400"
                step="10"
                value={dailyOrdersCount}
                onChange={(e) => setDailyOrdersCount(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                <span>30 طلب (مغسلة مبتدئة)</span>
                <span>200 طلب (مغسلة متوسطة)</span>
                <span>400 طلب (مغسلة كبرى)</span>
              </div>
            </div>

            {/* Calculation Output Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center space-y-1 shadow-xs">
                <div className="text-2xl sm:text-3xl font-black text-sky-600 font-mono">+{savedHoursMonthly} ساعة</div>
                <div className="text-xs font-black text-slate-900">وقت موفر شهرياً</div>
                <div className="text-[10px] font-bold text-slate-500">في الحسابات وتفادي الأخطاء اليدوية</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center space-y-1 shadow-xs">
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">+{preventedLossSAR} ر.س</div>
                <div className="text-xs font-black text-slate-900">أموال محمية شهرياً</div>
                <div className="text-[10px] font-bold text-slate-500">بمنع ضياع القطع وتلاعب الصندوق</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center space-y-1 shadow-xs">
                <div className="text-2xl sm:text-3xl font-black text-amber-600 font-mono">+{revenueGrowthPercent}%</div>
                <div className="text-xs font-black text-slate-900">زيادة تكرار الزبائن</div>
                <div className="text-[10px] font-bold text-slate-500">بفضل تنبيهات الواتساب الاحترافية</div>
              </div>

            </div>

            {/* CTA inside calculator */}
            <div className="text-center pt-2">
              <button
                onClick={onOpenAuth}
                className="px-8 py-4 bg-slate-950 hover:bg-sky-600 text-white font-black text-xs rounded-2xl shadow-md active:scale-95 transition-all"
              >
                احصل على هذا التوفير لمغسلتك مجاناً لمدة 14 يوم ⚡
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 7 (BLACK): PRICING PLANS                             */}
      {/* ============================================================ */}
      <section id="pricing" className="py-20 bg-[#080d1a] text-white border-b border-slate-800/80 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-black">
              <span>باقات واضحة وشفافة</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight">
              اختر الباقة المناسبة لحجم مغسلتك
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm font-bold max-w-lg mx-auto">
              أنظمة سحابية متطورة تلبي طموح عملك مع خيارات مرنة للفوترة الشهرية والسنوية
            </p>

            {/* Monthly / Yearly Toggle Selector */}
            <div className="flex items-center justify-center gap-3 pt-4">
              <div className="bg-[#0e172e] p-1.5 rounded-2xl border border-slate-700 inline-flex items-center gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  اشتراك شهري
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 ${
                    billingCycle === 'yearly'
                      ? 'bg-cyan-400 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>اشتراك سنوي</span>
                  <span className="bg-slate-950 text-cyan-300 text-[10px] px-2 py-0.5 rounded-full border border-cyan-400/40">وفر شهرين مجاناً 🎁</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch max-w-5xl mx-auto">
            
            {/* Card 1: الباقة الأساسية */}
            <div className="bg-[#0b1429] border border-slate-700/80 rounded-3xl p-8 sm:p-10 shadow-xl flex flex-col justify-between relative">
              
              <div className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-blue-500/20 border border-blue-400/30 text-blue-300 rounded-full text-xs font-black mb-3">
                    <span>🌟 الباقة الأساسية</span>
                  </div>
                  <h3 className="text-2xl font-black text-white">الباقة الأساسية</h3>
                  <p className="text-xs text-slate-300 font-bold mt-1">الخيار الأمثل للبدء والاستمتاع بكافة مزايا الكاشير السحابي.</p>
                </div>

                {/* Price Display */}
                <div className="bg-[#060c1d] p-5 rounded-2xl border border-slate-800 text-right space-y-2">
                  {billingCycle === 'yearly' ? (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-black text-cyan-400 font-mono">1,050</span>
                        <span className="text-xs font-bold text-slate-300">ريال / سنوياً</span>
                      </div>
                      <p className="text-xs font-bold text-slate-400 mt-1">
                        الاشتراك الشهري: <span className="line-through text-slate-500 ml-1">105 ر.س</span> 87.5 ر.س / شهرياً
                      </p>
                      <div className="mt-2.5 inline-block bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black px-3 py-1 rounded-xl">
                        🎁 (وفر 17% — احصل على شهرين مجاناً!)
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-black text-white font-mono">105</span>
                        <span className="text-xs font-bold text-slate-300">ريال / شهرياً</span>
                      </div>
                      <p className="text-xs font-bold text-slate-400 mt-1">
                        الاشتراك السنوي: 1,050 ريال / سنوياً
                      </p>
                    </div>
                  )}

                  <p className="text-[11px] font-bold text-slate-400 pt-1 border-t border-slate-800">
                    ⚠️ الأسعار الموضحة لا تشمل ضريبة القيمة المضافة.
                  </p>
                </div>

                {/* Features Included */}
                <div className="space-y-2.5 text-xs font-bold text-slate-300 text-right">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-cyan-400 shrink-0" />
                    <span>فواتير لا محدودة وأوفلاين 100%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-cyan-400 shrink-0" />
                    <span>طباعة حرارية + باركود ملابس Code 128</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-cyan-400 shrink-0" />
                    <span>فواتير إلكترونية معتمدة من هيئة الزكاة (ZATCA)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-cyan-400 shrink-0" />
                    <span>إدارة المخزون والمواد الاستهلاكية وتنبيه النواقص</span>
                  </div>
                </div>
              </div>

              {/* Button */}
              <div className="pt-8">
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span>الاشتراك في الباقة الأساسية 🚀</span>
                </button>
              </div>

            </div>

            {/* Card 2: الباقة الذهبية */}
            <div className="bg-gradient-to-b from-[#101f4a] via-[#0c1738] to-[#070f26] border-2 border-cyan-400 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-cyan-950/60 flex flex-col justify-between relative scale-[1.02] z-20">
              
              {/* Featured Ribbon Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 font-black text-[11px] px-5 py-1.5 rounded-full shadow-lg">
                👑 الأكثر طلباً — التجربة المكتملة
              </div>

              <div className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-cyan-400/20 border border-cyan-400/40 text-cyan-300 rounded-full text-xs font-black mb-3">
                    <Crown size={14} className="text-cyan-400" />
                    <span>👑 الباقة الذهبية المتكاملة</span>
                  </div>
                  <h3 className="text-2xl font-black text-white">الباقة الذهبية</h3>
                  <p className="text-xs text-cyan-200/90 font-bold mt-1">تتضمن بوت الواتساب التلقائي وتقارير الأرباح المتقدمة.</p>
                </div>

                {/* Price Display */}
                <div className="bg-[#050b1d] p-5 rounded-2xl border border-cyan-500/30 text-right space-y-2">
                  {billingCycle === 'yearly' ? (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-black text-cyan-400 font-mono">1,550</span>
                        <span className="text-xs font-bold text-slate-300">ريال / سنوياً</span>
                      </div>
                      <p className="text-xs font-bold text-slate-300 mt-1">
                        الاشتراك الشهري: <span className="line-through text-slate-500 ml-1">150 ر.س</span> 129.1 ر.س / شهرياً
                      </p>
                      <div className="mt-2.5 inline-block bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-[11px] font-black px-3 py-1 rounded-xl">
                        🎁 (وفر 14% — أكثر من شهر ونصف مجاناً!)
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-black text-cyan-400 font-mono">150</span>
                        <span className="text-xs font-bold text-slate-300">ريال / شهرياً</span>
                      </div>
                      <p className="text-xs font-bold text-slate-300 mt-1">
                        الاشتراك السنوي: 1,550 ريال / سنوياً
                      </p>
                    </div>
                  )}

                  <p className="text-[11px] font-bold text-cyan-400 pt-1 border-t border-slate-800">
                    ⚠️ الأسعار الموضحة لا تشمل ضريبة القيمة المضافة.
                  </p>
                </div>

                {/* Features Included */}
                <div className="space-y-2.5 text-xs font-bold text-slate-200 text-right">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-cyan-400 shrink-0" />
                    <span className="font-black text-white">كل مميزات الباقة الأساسية +</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-cyan-400 shrink-0" />
                    <span>بوت واتساب آلي لإرسال فواتير PDF وتنبيهات الجاهزية</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-cyan-400 shrink-0" />
                    <span>حماية الصندوق ورمز PIN المدير للمرتجعات</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-cyan-400 shrink-0" />
                    <span>إدارة باقات اشتراكات العملاء الشهرية المسبقة</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-cyan-400 shrink-0" />
                    <span>دعم فني مخصص وأولوية على مدار الساعة</span>
                  </div>
                </div>
              </div>

              {/* Button */}
              <div className="pt-8">
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="w-full py-4 bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-black text-xs rounded-2xl shadow-xl shadow-cyan-400/25 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Crown size={16} />
                  <span>الاشتراك في الباقة الذهبية 👑</span>
                </button>
              </div>

            </div>

          </div>

          <div className="text-center mt-10">
            <p className="text-xs text-slate-400 font-bold">
              جميع الباقات تشمل تجربة مجانية كاملة المزايا لمده 14 يوماً • لا تتطلب بطاقة ائتمانية للتسجيل • إعداد سهل وفوري
            </p>
          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 8 (WHITE): HOW IT WORKS & TESTIMONIALS               */}
      {/* ============================================================ */}
      <section className="py-20 bg-slate-50 text-slate-900 border-b border-slate-200 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
          
          {/* Sub-part 1: 3 Steps */}
          <div>
            <div className="text-center space-y-4 max-w-3xl mx-auto mb-14">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-black">
                <span>سرعة وسهولة</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-950 leading-tight">
                كيف تبدأ العمل في 3 خطوات بسيطة؟
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm font-bold">
                في أقل من 5 دقائق، ستكون جاهزاً بالكامل لاستقبال العملاء وإصدار الفواتير
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right max-w-5xl mx-auto">
              
              <div className="bg-white border border-slate-200 p-8 rounded-3xl space-y-3 shadow-xs">
                <div className="w-12 h-12 bg-sky-500 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md">
                  1
                </div>
                <h3 className="text-lg font-black text-slate-950">سجّل حسابك مجاناً</h3>
                <p className="text-xs sm:text-sm font-bold text-slate-600 leading-relaxed">
                  أدخل اسم المغسلة ورقم الجوال في ثوانٍ دون الحاجة لبطاقة ائتمان، وابدأ تجربة المنظومة فوراً.
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-8 rounded-3xl space-y-3 shadow-xs">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md">
                  2
                </div>
                <h3 className="text-lg font-black text-slate-950">خصّص خدماتك وأسعارك</h3>
                <p className="text-xs sm:text-sm font-bold text-slate-600 leading-relaxed">
                  استخدم القوالب الجاهزة للثياب والأشمغة أو عدّل الأسعار بما يناسب قائمة خدمات مغسلتك بدقة.
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-8 rounded-3xl space-y-3 shadow-xs">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md">
                  3
                </div>
                <h3 className="text-lg font-black text-slate-950">اطبع وابدأ البيع فوراً</h3>
                <p className="text-xs sm:text-sm font-bold text-slate-600 leading-relaxed">
                  اربط طابعتك الحرارية وابدأ بإصدار الفواتير، طباعة الباركود، وإرسال رسائل الواتساب للعملاء.
                </p>
              </div>

            </div>
          </div>

          {/* Sub-part 2: Real Testimonials */}
          <div className="pt-10 border-t border-slate-200">
            <div className="text-center space-y-4 max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-black">
                <span>تجارب حقيقية</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-950 leading-tight">
                يثق بنا مئات أصحاب المغاسل في السعودية والخليج
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right max-w-6xl mx-auto">
              
              <div className="bg-white border border-slate-200 p-7 rounded-3xl space-y-4 shadow-xs">
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="fill-amber-400" />
                  ))}
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">
                  "أفضل شيء في ghasil.cloud إنه شغال أوفلاين. لما يقطع النت في الحي مغسلتنا شغالة وما تتأثر. ورسائل الواتساب وفرت علينا مئات الاتصالات اليومية."
                </p>
                <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 font-black flex items-center justify-center">
                    أ
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-950">أبو راكان العتيبي</div>
                    <div className="text-[10px] text-slate-500">مغسلة الأناقة الذهبية — الرياض</div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-7 rounded-3xl space-y-4 shadow-xs">
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="fill-amber-400" />
                  ))}
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">
                  "ميزة ملصقات الباركود على الملابس حلت أكبر مشكلة كنا نعاني منها وهي خلط وضياع الملابس. الحين كل قطعة معروف عميلها وفاتورتها برمشة عين."
                </p>
                <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center">
                    ف
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-950">م. فهد السلمي</div>
                    <div className="text-[10px] text-slate-500">مغسلة اللؤلؤة للملابس والسجاد — جدة</div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-7 rounded-3xl space-y-4 shadow-xs">
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="fill-amber-400" />
                  ))}
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">
                  "حماية الـ PIN للمدير منعت أي تلاعب في المرتجعات. الحسابات صارت واضحة بنهاية كل يوم، وتقرير الضريبة جاهز بنقرة زر بدون أي محاسب."
                </p>
                <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-black flex items-center justify-center">
                    س
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-950">سلطان الدوسري</div>
                    <div className="text-[10px] text-slate-500">مصبغة الأفق الحديثة — الدمام</div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 9 (WHITE): FAQ ACCORDION                             */}
      {/* ============================================================ */}
      <section id="faq" className="py-20 bg-white text-slate-900 border-b border-slate-200 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center space-y-3 mb-12">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">
              <span>الأسئلة الشائعة</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950">
              إجابات على أهم الاستفسارات حول المنظومة
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div 
                key={idx}
                className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden transition-all shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-5 text-right font-black text-xs sm:text-sm text-slate-900 flex items-center justify-between gap-4 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {openFaq === idx ? <ChevronUp size={18} className="text-sky-600 shrink-0" /> : <ChevronDown size={18} className="text-slate-400 shrink-0" />}
                </button>

                {openFaq === idx && (
                  <div className="p-5 pt-0 text-xs sm:text-sm font-bold text-slate-600 leading-relaxed border-t border-slate-200 bg-white">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 10 (BLACK): FINAL HIGH-IMPACT CTA & FOOTER           */}
      {/* ============================================================ */}
      <section className="py-20 bg-[#070c18] text-white relative z-10 text-center border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <span className="px-4 py-1.5 bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-xs font-black rounded-full inline-block">
            ابدأ الترقية اليوم ⚡
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight">
            جاهز لترقية مغسلتك إلى <span className="text-cyan-400 font-mono">ghasil.cloud</span>؟
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm font-bold max-w-xl mx-auto leading-relaxed">
            انضم الآن لمئات المغاسل التي تدير مبيعاتها وفواتيرها وملصقات ملابسها بأعلى كفاءة وسرعة، بدون أجهزة باهظة أو تعقيدات.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={onOpenAuth}
              className="px-9 py-4 bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-cyan-400/25 active:scale-95 transition-all"
            >
              ابدأ تجربتك المجانية — 14 يوم 🚀
            </button>

            <a
              href="https://wa.me/966500000000"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-[#0e1a38] hover:bg-[#142650] text-cyan-300 border border-slate-700 font-black text-sm rounded-2xl transition-all flex items-center gap-2 active:scale-95"
            >
              <MessageCircle size={18} />
              <span>تحدث مع فريق المبيعات</span>
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER (Deep Black) */}
      <footer className="bg-[#040710] text-slate-400 py-12 text-xs font-bold">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-400 text-slate-950 rounded-xl flex items-center justify-center font-black">
                <Shirt size={22} />
              </div>
              <div>
                <h3 className="font-black text-white text-base font-mono">ghasil<span className="text-cyan-400">.cloud</span></h3>
                <p className="text-[11px] text-slate-400">المنظومة السحابية الذكية لإدارة المغاسل والمصابغ ومغاسل السيارات</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-slate-300 font-bold">
              <a href="#features" className="hover:text-cyan-400 transition-colors">المميزات</a>
              <a href="#why-us" className="hover:text-cyan-400 transition-colors">مقارنة الحلول</a>
              <a href="#sectors" className="hover:text-cyan-400 transition-colors">قطاعات النشاط</a>
              <a href="#screens" className="hover:text-cyan-400 transition-colors">معاينة الشاشات</a>
              <a href="#pricing" className="hover:text-cyan-400 transition-colors">الباقات</a>
            </div>

          </div>

          <div className="border-t border-slate-800/80 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-slate-500">
            <p>© {new Date().getFullYear()} ghasil.cloud. جميع الحقوق محفوظة.</p>
            <p className="flex items-center gap-2 text-cyan-400">
              <ShieldCheck size={16} />
              <span>متوافق 100% مع الفاتورة الإلكترونية وهيئة الزكاة والضريبة 🇸🇦</span>
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
};
