import { Order, TwilioConfig } from "../types";

export const sendTwilioWhatsApp = async (order: Order, message: string, config: TwilioConfig): Promise<boolean> => {
  if (!config.enabled || !config.accountSid || !config.authToken || !config.fromNumber) {
    console.warn("Twilio is not configured or disabled.");
    return false;
  }

  const cleanPhone = order.customer_phone.replace(/\D/g, '');
  const toPhone = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.replace(/^0/, '')}`;

  try {
    const response = await fetch('/api/twilio/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountSid: config.accountSid,
        authToken: config.authToken,
        fromNumber: config.fromNumber,
        toPhone: `whatsapp:+${toPhone}`,
        message: message
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Twilio Proxy Server Error:", errorData);
      return false;
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Twilio Network Error via Proxy:", error);
    return false;
  }
};
