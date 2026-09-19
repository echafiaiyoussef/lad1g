import React from 'react';
import { Order } from '../types';
import { InvoiceQRCode } from './InvoiceQRCode';
import { BarcodeGenerator } from './BarcodeGenerator';

interface ClothingTagsPrintViewProps {
  order: Order;
  laundryName: string;
}

export const ClothingTagsPrintView: React.FC<ClothingTagsPrintViewProps> = ({ order, laundryName }) => {
  // Expand items by quantity into individual pieces
  const pieces: { item: any; pieceIndex: number; totalPieces: number }[] = [];
  let totalCount = 0;
  order.items?.forEach(item => {
    totalCount += (item.quantity || 1);
  });

  let runningIndex = 1;
  order.items?.forEach(item => {
    const qty = Math.max(1, item.quantity || 1);
    for (let q = 1; q <= qty; q++) {
      pieces.push({
        item,
        pieceIndex: runningIndex,
        totalPieces: totalCount
      });
      runningIndex++;
    }
  });

  return (
    <div className="space-y-4">
      <div className="text-center no-print mb-2">
        <span className="text-xs font-black text-slate-700">
          ملصقات الملابس للمسح السريع ({pieces.length} قطعة)
        </span>
        <p className="text-[11px] text-slate-500 mt-0.5">
          يمكنك طباعة هذه الملصقات ولصقها على الملابس، وعند مسح أي ملصق بقارئ الباركود سيتم تجهيز الطلب وإرسال رسالة الواتساب فوراً.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {pieces.map((piece, i) => (
          <div 
            key={i} 
            className="p-3 bg-white border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-2 break-inside-avoid print:border-black print:rounded-none"
          >
            <div className="flex justify-between items-center text-[11px] font-black border-b border-slate-200 pb-1">
              <span className="text-slate-900">{laundryName}</span>
              <span className="text-indigo-600 font-mono font-black">#{order.order_number}</span>
            </div>

            <div className="flex items-center justify-between gap-2 text-right">
              <div>
                <h4 className="text-xs font-black text-slate-900">
                  {piece.item.name} ({piece.item.service_type || 'عادي'})
                </h4>
                <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                  العميل: <span className="text-slate-800 font-black">{order.customer_name}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                  {order.customer_phone}
                </div>
              </div>
              <div className="text-left">
                <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-black text-slate-700">
                  قطعة {piece.pieceIndex} من {piece.totalPieces}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-1 border-t border-slate-100">
              <div className="p-1 bg-white border border-slate-200 rounded-xl shrink-0">
                <InvoiceQRCode order={order} laundryName={laundryName} size={65} />
              </div>
              <div className="flex flex-col items-center justify-center shrink-0">
                <BarcodeGenerator value={order.order_number} width={1.2} height={26} />
                <span className="text-[9px] text-slate-400 font-mono">#{order.order_number}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
