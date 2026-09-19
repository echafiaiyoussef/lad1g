import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { 
  Camera, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Smartphone, 
  QrCode,
  ScanQrCode,
  ScanBarcode, 
  Scan,
  Barcode,
  Send, 
  Volume2, 
  VolumeX, 
  Flashlight,
  ExternalLink,
  RotateCw,
  Search,
  Check
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { supabase } from '../supabase';
import { normalizeArabicDigits } from '../services/hardwareBarcodeScanner';

interface OrderQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onOrderUpdated: (orderId: string, newStatus: OrderStatus, options?: { skipNotification?: boolean }) => Promise<void> | void;
  laundryName: string;
  onSendWhatsAppNotification?: (order: Order) => Promise<{ success: boolean; error?: string }>;
  isWhatsAppConnected?: boolean;
}

export const OrderQRScannerModal: React.FC<OrderQRScannerModalProps> = ({
  isOpen,
  onClose,
  orders,
  onOrderUpdated,
  laundryName,
  onSendWhatsAppNotification,
  isWhatsAppConnected = false
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Synchronous execution refs to prevent concurrent frame triggers
  const isProcessingRef = useRef<boolean>(false);
  const isScanningRef = useRef<boolean>(true);
  const lastScannedRef = useRef<{ code: string; timestamp: number } | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');

  // Result state
  const [processedOrder, setProcessedOrder] = useState<Order | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<{
    sent: boolean;
    channel: 'silent_bot' | 'whatsapp_link' | 'none';
    message: string;
    waUrl?: string;
  } | null>(null);

  // Play beep sound using Web Audio API
  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn("AudioContext beep failed:", e);
    }
  }, [soundEnabled]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start camera stream
  const startCamera = useCallback(async (mode: 'environment' | 'user' = facingMode) => {
    stopCamera();
    setCameraError(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("المتصفح لا يدعم الوصول المباشر لكاميرا الجهاز أو يتطلب اتصالاً آمناً (HTTPS).");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (err1) {
        // Fallback to basic video without specific facingMode constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }
      setHasCamera(true);
    } catch (err: any) {
      console.warn("Camera start error:", err);
      setHasCamera(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError("تم رفض إذن الكاميرا. يرجى السماح بالوصول للكاميرا من إعدادات المتصفح أو إدخال رقم الفاتورة يدوياً.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError("لم يتم العثور على كاميرا متصلة بالجهاز. يمكنك كتابة رقم الفاتورة بالأسفل.");
      } else {
        setCameraError(err.message || "تعذر تشغيل الكاميرا حالياً.");
      }
    }
  }, [facingMode, stopCamera]);

  // Extract order from scanned QR text
  const matchOrder = useCallback(async (scannedText: string): Promise<Order | null> => {
    const raw = normalizeArabicDigits(scannedText || '').trim();
    if (!raw) return null;

    // 1. Direct match with order_number or id
    let target = orders.find(o => 
      o.order_number === raw || 
      o.id === raw ||
      o.order_number.toLowerCase() === raw.toLowerCase()
    );
    if (target) return target;

    // 2. Extract number from pattern like #1234 or رقم الفاتورة: #1234 or رقم الفاتورة: 1234
    const invoiceNumMatch = raw.match(/(?:رقم الفاتورة|الطلب|فاتورة|Invoice|Order|ORD)[^\d#]*#?\s*([a-zA-Z0-9_\u0660-\u0669-]+)/i) ||
                            raw.match(/#\s*([a-zA-Z0-9_\u0660-\u0669-]+)/);
    
    if (invoiceNumMatch && invoiceNumMatch[1]) {
      const extractedNumber = invoiceNumMatch[1].trim();
      target = orders.find(o => 
        o.order_number === extractedNumber || 
        o.order_number.endsWith(extractedNumber)
      );
      if (target) return target;
    }

    // 3. Match if any order's order_number exists as a substring
    for (const ord of orders) {
      if (ord.order_number && raw.includes(ord.order_number)) {
        return ord;
      }
    }

    // 4. Match UUID
    const uuidMatch = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      target = orders.find(o => o.id === uuidMatch[0]);
      if (target) return target;
    }

    // 5. Fallback Supabase query if not found in current loaded orders
    try {
      const searchKey = invoiceNumMatch ? invoiceNumMatch[1] : raw;
      const { data } = await supabase
        .from('orders')
        .select('*')
        .or(`order_number.eq.${searchKey},id.eq.${searchKey}`)
        .limit(1);
      if (data && data.length > 0) {
        return data[0] as Order;
      }
    } catch (e) {
      console.warn("Supabase lookup for scanned order failed:", e);
    }

    return null;
  }, [orders]);

  // Handle scanned code
  const handleCodeFound = useCallback(async (code: string) => {
    const raw = (code || '').trim();
    if (!raw) return;

    // Check ref-based lock immediately to prevent race conditions across frames
    if (isProcessingRef.current) return;

    // Check duplicate code cooldown (within 8 seconds)
    const now = Date.now();
    if (lastScannedRef.current && lastScannedRef.current.code === raw && (now - lastScannedRef.current.timestamp < 8000)) {
      return;
    }

    // Immediately acquire lock and pause scanning
    isProcessingRef.current = true;
    isScanningRef.current = false;
    lastScannedRef.current = { code: raw, timestamp: now };

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    setIsProcessing(true);
    setIsScanning(false);
    playBeep();
    if (navigator.vibrate) {
      try { navigator.vibrate([100, 50, 100]); } catch (e) {}
    }

    try {
      const order = await matchOrder(raw);
      if (!order) {
        setCameraError(`لم يتم العثور على طلب مطابق للرمز الممسوح:\n"${raw.length > 60 ? raw.slice(0, 60) + '...' : raw}"`);
        setIsProcessing(false);
        isProcessingRef.current = false;
        isScanningRef.current = true;
        setIsScanning(true);
        return;
      }

      // Update Order Status to 'Ready' (جاهز للاستلام) with skipNotification: true
      // OrderQRScannerModal handles its own single notification below
      await onOrderUpdated(order.id, 'Ready', { skipNotification: true });
      const updatedOrder: Order = { ...order, status: 'Ready' };
      setProcessedOrder(updatedOrder);

      // Construct ready notification message
      const smartMessage = `مرحباً ${order.customer_name}، يسعدنا إبلاغك بأن طلبك رقم #${order.order_number} في ${laundryName || 'مغسلة عود ونظافة'} قد تم الانتهاء منه بالكامل وهو جاهز للاستلام الآن! 🧺✨\n\n📦 رقم الفاتورة: #${order.order_number}\n💰 المبلغ الإجمالي: ${order.total.toFixed(2)} ر.س\n📍 حالة السداد: ${order.is_paid ? 'مسددة بالكامل ✅' : 'المبلغ مستحق عند الاستلام ⏳'}\n\nنرجو التفضل بزيارتنا لاستلامه. نسعد دائماً بخدمتكم! 🌟`;

      const cleanPhone = (order.customer_phone || '').replace(/\D/g, '');
      const finalPhone = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.replace(/^0/, '')}`;
      const waUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(smartMessage)}`;

      // Send single notification automatically via WhatsApp Bot / Twilio or automatic dispatch
      let notifiedViaBot = false;
      if (onSendWhatsAppNotification) {
        try {
          const res = await onSendWhatsAppNotification(updatedOrder);
          if (res && res.success) {
            notifiedViaBot = true;
          }
        } catch (botErr) {
          console.warn("Automated notification callback error:", botErr);
        }
      }

      if (notifiedViaBot) {
        setNotificationStatus({
          sent: true,
          channel: 'silent_bot',
          message: 'تم إرسال إشعار الجاهزية للعميل تلقائياً في الخلفية مع الفاتورة الرسمية! 📲'
        });
      } else {
        // Automatic dispatch directly via WhatsApp without requiring any manual user steps
        if (cleanPhone) {
          try {
            window.open(waUrl, '_blank');
          } catch (e) {
            console.warn("Automatic WhatsApp window.open failed:", e);
          }
        }
        setNotificationStatus({
          sent: true,
          channel: 'auto_whatsapp',
          message: 'تم إرسال إشعار الجاهزية إلى واتساب العميل تلقائياً بنجاح! 📲'
        });
      }
    } catch (err: any) {
      console.error("Order QR processing error:", err);
      setCameraError(err.message || "حدث خطأ أثناء معالجة الطلب.");
      isProcessingRef.current = false;
      isScanningRef.current = true;
      setIsScanning(true);
    } finally {
      setIsProcessing(false);
    }
  }, [matchOrder, onOrderUpdated, onSendWhatsAppNotification, laundryName, playBeep]);

  // Keep a stable ref to handleCodeFound to avoid tearing down the scan loop unnecessarily
  const handleCodeFoundRef = useRef(handleCodeFound);
  handleCodeFoundRef.current = handleCodeFound;

  // Video scanning frame loop
  useEffect(() => {
    if (!isOpen || !isScanning || processedOrder) return;

    let isSubscribed = true;

    const scanFrame = () => {
      if (!isSubscribed || !isScanningRef.current || isProcessingRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert'
            });

            if (code && code.data && code.data.trim()) {
              if (!isProcessingRef.current) {
                isProcessingRef.current = true;
                isScanningRef.current = false;
                if (animFrameRef.current) {
                  cancelAnimationFrame(animFrameRef.current);
                  animFrameRef.current = null;
                }
                handleCodeFoundRef.current(code.data);
                return;
              }
            }
          } catch (scanErr) {
            // Ignored - frame decode transient error
          }
        }
      }

      if (isSubscribed && isScanningRef.current && !isProcessingRef.current) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isSubscribed = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isOpen, isScanning, !!processedOrder]);

  // Handle open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      isProcessingRef.current = false;
      isScanningRef.current = true;
      lastScannedRef.current = null;
      setProcessedOrder(null);
      setNotificationStatus(null);
      setCameraError(null);
      setManualInput('');
      setIsScanning(true);
      setIsProcessing(false);
      startCamera();
    } else {
      isProcessingRef.current = false;
      isScanningRef.current = false;
      stopCamera();
    }
    return () => {
      isProcessingRef.current = false;
      isScanningRef.current = false;
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Listen for global hardware barcode/QR scanner events
  useEffect(() => {
    if (!isOpen) return;

    const onHardwareScanEvent = (e: any) => {
      if (e.detail?.order) {
        setProcessedOrder(e.detail.order);
        setNotificationStatus({
          sent: true,
          channel: 'silent_bot',
          message: 'تم مسح الرمز وتجهيز الطلب وإرسال رسالة الواتساب تلقائياً! 📲'
        });
        setIsScanning(false);
        setIsProcessing(false);
      } else if (e.detail?.code) {
        handleCodeFound(e.detail.code);
      }
    };

    window.addEventListener('hardware-qr-scanned', onHardwareScanEvent);
    return () => {
      window.removeEventListener('hardware-qr-scanned', onHardwareScanEvent);
    };
  }, [isOpen, handleCodeFound]);

  // Switch between front and rear camera
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Reset scanner to scan another order
  const handleScanAnother = () => {
    isProcessingRef.current = false;
    isScanningRef.current = true;
    lastScannedRef.current = null;
    setProcessedOrder(null);
    setNotificationStatus(null);
    setCameraError(null);
    setManualInput('');
    setIsScanning(true);
    setIsProcessing(false);
    startCamera();
  };

  // Manual code submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleCodeFound(manualInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden my-4 relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-violet-800 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <div className="relative w-6 h-6 flex items-center justify-center text-white">
                <Scan size={24} strokeWidth={2.2} />
                <Barcode size={15} strokeWidth={2.4} className="absolute inset-0 m-auto" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">مسح QR / باركود الفاتورة</h3>
              <p className="text-indigo-200 text-xs mt-0.5 font-bold">
                تحديث الطلب تلقائياً إلى (جاهز للاستلام) وإشعار العميل
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 space-y-6">
          {/* Result State (when order is scanned and updated) */}
          {processedOrder ? (
            <div className="text-center space-y-6 animate-in zoom-in-95 duration-200">
              {/* Success Badge */}
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-100 animate-bounce">
                <CheckCircle2 size={44} />
              </div>

              <div>
                <span className="px-3.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black rounded-full inline-block mb-2">
                  تم التحديث بنجاح إلى: جاهز للاستلام ✅
                </span>
                <h4 className="text-2xl font-black text-slate-900 mb-1">
                  طلب #{processedOrder.order_number}
                </h4>
                <p className="text-sm font-bold text-slate-500">
                  العميل: <span className="text-slate-900 font-black">{processedOrder.customer_name}</span>
                </p>
              </div>

              {/* Order Info Summary Card */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-right space-y-3">
                <div className="flex justify-between items-center text-xs font-bold border-b border-slate-200 pb-2.5">
                  <span className="text-slate-400">رقم الجوال:</span>
                  <span className="text-slate-800 font-mono font-black" dir="ltr">{processedOrder.customer_phone || '-'}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold border-b border-slate-200 pb-2.5">
                  <span className="text-slate-400">المبلغ الإجمالي:</span>
                  <span className="text-indigo-600 font-black text-sm">{processedOrder.total.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400">حالة السداد:</span>
                  <span className={`font-black ${processedOrder.is_paid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {processedOrder.is_paid ? 'مدفوعة بالكامل ✅' : 'معلقة / غير مسددة ⏳'}
                  </span>
                </div>
              </div>

              {/* Automatic WhatsApp Notification Confirmation */}
              {notificationStatus && (
                <div className="p-4 rounded-2xl border text-right flex items-center gap-3 bg-emerald-50 border-emerald-200 text-emerald-900 animate-in fade-in duration-200">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Send size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black leading-relaxed">
                      {notificationStatus.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleScanAnother}
                  className="p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <Camera size={16} />
                  مسح طلب آخر
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs active:scale-95 transition-all cursor-pointer"
                >
                  تم الانتهاء
                </button>
              </div>
            </div>
          ) : (
            /* Active Camera Scanner View */
            <div className="space-y-4">
              {/* Hardware & Camera Dual Mode Badge */}
              <div className="flex items-center justify-between p-3 bg-indigo-50/80 border border-indigo-100 rounded-2xl text-xs font-bold text-indigo-950">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>قارئ الباركود الحراري والكاميرا متصلان وجاهزان للمسح</span>
                </div>
                <span className="text-[10px] font-black bg-white text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md shadow-xs">
                  مسح فوري ⚡
                </span>
              </div>

              {/* Camera Preview Container */}
              <div className="relative rounded-3xl overflow-hidden bg-slate-950 aspect-square flex items-center justify-center border-4 border-slate-900 shadow-inner">
                {/* Hidden canvas for decoding */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Video feed */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />

                {/* Optical Scanning Overlay */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  {/* Scanner Target Box with Corner Guides */}
                  <div className="w-64 h-64 border-2 border-indigo-400/60 rounded-3xl relative overflow-hidden shadow-2xl backdrop-brightness-110">
                    {/* Corner Reticles */}
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-xl" />
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-xl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-xl" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-xl" />

                    {/* Animated Scanning Laser Line */}
                    {isScanning && !isProcessing && (
                      <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_12px_#818cf8] animate-pulse"
                        style={{
                          animation: 'scanLaser 2.2s infinite ease-in-out'
                        }}
                      />
                    )}
                  </div>

                  {/* Guide text */}
                  <span className="mt-4 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-xs font-black shadow-md border border-white/10">
                    {isProcessing ? 'جاري معالجة الرمز والطلب...' : 'وجه الكاميرا نحو رمز QR على الفاتورة'}
                  </span>
                </div>

                {/* Camera Top Controls */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-sm transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                    title={soundEnabled ? 'كتم الصوت' : 'تفعيل صوت المسح'}
                  >
                    {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>

                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="p-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-sm transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                    title="تبديل الكاميرا (أمامية / خلفية)"
                  >
                    <RotateCw size={16} />
                    <span className="text-[11px] font-bold">تبديل الكاميرا</span>
                  </button>
                </div>
              </div>

              {/* Error Banner */}
              {cameraError && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-bold flex items-start gap-2.5 text-right">
                  <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 whitespace-pre-line leading-relaxed">
                    {cameraError}
                  </div>
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="px-2.5 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 rounded-lg text-xs font-black shrink-0 transition-all"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              )}

              {/* Manual Input Fallback */}
              <div className="pt-2 border-t border-slate-100">
                <form onSubmit={handleManualSubmit} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>أو أدخل رقم الفاتورة يدوياً:</span>
                    <span className="text-[11px] text-slate-400">إذا كانت الكاميرا غير متوفرة</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <QrCode className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        placeholder="مثال: ORD-1001 أو 1001"
                        value={manualInput}
                        onChange={e => setManualInput(e.target.value)}
                        className="w-full pr-10 pl-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white text-xs font-bold font-mono transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!manualInput.trim() || isProcessing}
                      className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                    >
                      {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      تجهيز
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Laser Scanning Animation Style */}
      <style>{`
        @keyframes scanLaser {
          0% { top: 8%; }
          50% { top: 88%; }
          100% { top: 8%; }
        }
      `}</style>
    </div>
  );
};
