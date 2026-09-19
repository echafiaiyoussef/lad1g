import { Order } from "../types";

export type MessageContext = 'RECEIVED' | 'READY' | 'REMINDER_24H' | 'REMINDER_48H' | 'REMINDER_1H';

export const generateSmartReminder = async (order: Order, context: MessageContext | number): Promise<string> => {
  const fallbackMessages = {
    RECEIVED: `مرحباً ${order.customer_name} نود إعلامكم بأننا استلمنا طلبكم رقم ${order.order_number} ونحن نعمل عليه الآن لضمان تقديمه بأفضل جودة. إجمالي قيمة الطلب هي ${order.total.toFixed(2)} ريال سعودي. شكراً لاختياركم لنا ويسعدنا دائماً خدمتكم.`,
    READY: `مرحباً ${order.customer_name} نود إعلامكم بأن طلبكم رقم ${order.order_number} قد تم الانتهاء منه وهو جاهز تماماً وبانتظاركم لاستلامه الآن. إجمالي المبلغ هو ${order.total.toFixed(2)} ريال سعودي. يسعدنا حضوركم.`,
    REMINDER: `مرحباً ${order.customer_name}، نود تذكيركم بأن طلبكم رقم ${order.order_number} جاهز للاستلام. نسعد بزيارتكم.`
  };

  try {
    const response = await fetch('/api/gemini/generate-reminder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ order, context })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    return data.text || (context === 'RECEIVED' ? fallbackMessages.RECEIVED : fallbackMessages.READY);
  } catch (error) {
    console.error("Gemini Proxy Error, using fallback:", error);
    if (context === 'RECEIVED') return fallbackMessages.RECEIVED;
    if (context === 'READY') return fallbackMessages.READY;
    return fallbackMessages.REMINDER;
  }
};

export const getFinancialSummary = async (orders: Order[], inventory: any[]): Promise<string> => {
  try {
    const response = await fetch('/api/gemini/financial-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ orders, inventory })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    return data.text || "المؤشرات المالية مستقرة.";
  } catch (error) {
    console.error("Financial Summary Proxy Error, using fallback:", error);
    return "لا يمكن حالياً تحليل البيانات المالية.";
  }
};
