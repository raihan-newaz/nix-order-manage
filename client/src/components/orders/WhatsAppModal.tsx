import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Order } from '../../types';
import api from '../../lib/api';
import { MessageSquare, X, Send, Loader2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

interface WhatsAppModalProps {
  order: Order | null;
  onClose: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  const templates = [
    {
      title: 'Order Confirmation',
      text: `Hello ${order.customerName}! Thank you for placing Order #${order.orderNumber} with NIX Store. Total amount: ${order.grandTotal} BDT. Please confirm your delivery address: ${order.customerAddress}`,
    },
    {
      title: 'Courier Dispatched & Tracking Link',
      text: `Dear ${order.customerName}, your order #${order.orderNumber} has been dispatched via ${order.courierName || 'Courier'}. Tracking Code: ${order.courierTrackingCode || 'N/A'}. Track your parcel here: https://steadfast.com.bd/t/${order.courierTrackingCode || ''}`,
    },
    {
      title: 'Out for Delivery Alert',
      text: `Dear ${order.customerName}, your parcel #${order.orderNumber} is out for delivery today with our rider! Please keep ${order.codAmount || order.grandTotal} BDT ready.`,
    },
  ];

  const [messageText, setMessageText] = useState(templates[0].text);
  const [loading, setLoading] = useState(false);

  const cleanPhone = order.customerPhone.replace(/[^\d]/g, '');
  const formattedPhone = cleanPhone.startsWith('88') ? cleanPhone : '88' + cleanPhone;

  const handleSendBaileys = async () => {
    setLoading(true);
    try {
      const res = await api.post('/messaging/send', {
        recipient: order.customerPhone,
        message: messageText,
        channel: 'WHATSAPP',
        orderId: order.id,
      });

      if (res.data?.success) {
        toast.success('WhatsApp message sent successfully via Baileys!');
        onClose();
      } else {
        toast.error(res.data?.message || 'Failed to send WhatsApp message');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const openWhatsAppWeb = () => {
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-emerald-950/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-lg">Send WhatsApp Message</h3>
              <p className="text-xs text-slate-400">To: {order.customerName} ({order.customerPhone})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Quick Templates */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Quick Templates
            </label>
            <div className="flex flex-wrap gap-2">
              {templates.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMessageText(tpl.text)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700/60 transition-colors"
                >
                  {tpl.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Message Content (WhatsApp Baileys / Web)
            </label>
            <textarea
              rows={5}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-t border-slate-800">
          <button
            type="button"
            onClick={openWhatsAppWeb}
            className="flex items-center gap-2 text-xs font-medium text-emerald-400 hover:text-emerald-300"
          >
            <ExternalLink className="w-4 h-4" />
            Open WhatsApp Web Directly
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSendBaileys}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send via Baileys API
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
