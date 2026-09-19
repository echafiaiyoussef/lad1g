import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Order } from '../types';

interface InvoiceQRCodeProps {
  order: Order;
  laundryName: string;
  size?: number;
  className?: string;
}

export const generateInvoiceQRData = (order: Order, laundryName: string): string => {
  return [
    `مغسلة: ${laundryName || 'مغسلة عود ونظافة'}`,
    `رقم الفاتورة: #${order.order_number}`,
    `معرف الطلب: ${order.id}`,
    `التاريخ: ${new Date(order.created_at).toLocaleString('ar-SA-u-nu-latn')}`,
    `العميل: ${order.customer_name} (${order.customer_phone})`,
    `المجموع: ${order.total.toFixed(2)} ر.س`,
    `حالة السداد: ${order.is_paid ? 'مدفوعة' : 'معلقة / غير مسددة'}`
  ].join('\n');
};

export const getInvoiceQRDataUrl = async (order: Order, laundryName: string, size = 160): Promise<string> => {
  try {
    const text = generateInvoiceQRData(order, laundryName);
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  } catch (e) {
    console.error('Failed to generate invoice QR code data URL:', e);
    return '';
  }
};

export const InvoiceQRCode: React.FC<InvoiceQRCodeProps> = ({ order, laundryName, size = 120, className = '' }) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    getInvoiceQRDataUrl(order, laundryName, size * 2).then(url => {
      if (active) setDataUrl(url);
    });
    return () => { active = false; };
  }, [order.id, order.order_number, order.total, order.is_paid, laundryName, size]);

  if (!dataUrl) {
    return (
      <div className={`flex flex-col items-center justify-center p-2 ${className}`}>
        <div className="w-24 h-24 bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400 text-xs font-bold font-mono">
          QR...
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 ${className}`}>
      <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-xs inline-block">
        <img 
          src={dataUrl} 
          alt={`QR Code فاتورة #${order.order_number}`}
          style={{ width: size, height: size }}
          className="block rounded-lg"
        />
      </div>
      <span className="text-[11px] font-bold text-slate-500 font-mono tracking-wide">
        رمز الفاتورة الإلكترونية (QR)
      </span>
    </div>
  );
};
