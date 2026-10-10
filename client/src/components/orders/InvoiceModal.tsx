import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Order } from '../../types';
import { Printer, X, FileText, Check, QrCode } from 'lucide-react';

interface InvoiceModalProps {
  order?: Order | null;
  orders?: Order[] | null;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, orders, onClose }) => {
  const [printFormat, setPrintFormat] = useState<'A4' | 'POS_80MM'>('POS_80MM');

  const orderList: Order[] = orders && orders.length > 0 ? orders : (order ? [order] : []);

  if (orderList.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  const isBulk = orderList.length > 1;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-lg">Print Invoice & Shipping Label</h3>
              <p className="text-xs text-slate-400">
                {isBulk ? `${orderList.length} orders selected for printing` : `Order #${orderList[0].orderNumber}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Format Toggle */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setPrintFormat('POS_80MM')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  printFormat === 'POS_80MM'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                80mm Thermal POS
              </button>
              <button
                onClick={() => setPrintFormat('A4')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  printFormat === 'A4'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                A4 Standard
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print {isBulk ? `(${orderList.length})` : ''}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-6 bg-slate-950/70 printable-area">
          {orderList.map((singleOrder, index) => {
            const codAmount = singleOrder.codAmount > 0 ? singleOrder.codAmount : singleOrder.grandTotal - singleOrder.advancePaid;
            const isLast = index === orderList.length - 1;

            return printFormat === 'POS_80MM' ? (
              /* 80mm Thermal Receipt Layout */
              <div
                key={singleOrder.id}
                className={`w-[320px] bg-white text-black p-4 text-xs font-mono rounded shadow-xl border border-gray-300 leading-tight space-y-3 ${
                  !isLast ? 'print:break-after-page print:page-break-after-always' : ''
                }`}
              >
                {/* Receipt Header */}
                <div className="text-center border-b border-dashed border-gray-400 pb-2">
                  <h2 className="text-base font-bold tracking-tight uppercase">NIX FASHION & LIFESTYLE</h2>
                  <p className="text-[10px] text-gray-600">Dhanmondi, Dhaka | Hotline: 01711000000</p>
                  <p className="text-[10px] text-gray-600 font-semibold mt-1">
                    PARCEL INVOICE / POS RECEIPT
                  </p>
                </div>

                {/* Order Info */}
                <div className="space-y-0.5 text-[11px]">
                  <div className="flex justify-between">
                    <span>Order No:</span>
                    <span className="font-bold">{singleOrder.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{new Date(singleOrder.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Courier:</span>
                    <span className="font-bold">{singleOrder.courierName || 'Pending'}</span>
                  </div>
                  {singleOrder.courierTrackingCode && (
                    <div className="flex justify-between">
                      <span>Tracking:</span>
                      <span className="font-bold">{singleOrder.courierTrackingCode}</span>
                    </div>
                  )}
                </div>

                {/* Customer Box */}
                <div className="border border-black p-2 rounded text-[11px] space-y-0.5">
                  <p className="font-bold uppercase">{singleOrder.customerName}</p>
                  <p className="font-bold text-xs">{singleOrder.customerPhone}</p>
                  <p className="text-[10px] leading-tight">{singleOrder.customerAddress}</p>
                </div>

                {/* Line Items with Variations */}
                <div className="border-t border-b border-dashed border-gray-400 py-1.5 space-y-1">
                  <div className="flex justify-between font-bold text-[10px] uppercase">
                    <span>Item & Variant</span>
                    <span>Qty</span>
                    <span>Total</span>
                  </div>
                  {singleOrder.items.map((it) => (
                    <div key={it.id} className="text-[11px]">
                      <div className="flex justify-between">
                        <span className="font-bold truncate max-w-[170px]">{it.productName}</span>
                        <span>x{it.quantity}</span>
                        <span>{it.totalPrice} ৳</span>
                      </div>
                      {(it.variantName || it.color || it.size) && (
                        <p className="text-[10px] font-semibold text-gray-700">
                          [{it.variantName || `${it.color || ''} ${it.size ? `/ ${it.size}` : ''}`}]
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{singleOrder.subtotal} ৳</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Charge:</span>
                    <span>+{singleOrder.deliveryCharge} ৳</span>
                  </div>
                  {singleOrder.discount > 0 && (
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span>-{singleOrder.discount} ৳</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm border-t border-black pt-1">
                    <span>COD AMOUNT:</span>
                    <span>{codAmount} ৳</span>
                  </div>
                </div>

                {/* Barcode Graphic Placeholder */}
                <div className="text-center pt-2 border-t border-dashed border-gray-400">
                  <div className="tracking-widest font-bold text-xs">|||||||||||||||||||||||||||||||||</div>
                  <p className="text-[10px] text-gray-500 font-bold">{singleOrder.orderNumber}</p>
                  <p className="text-[9px] text-gray-500 mt-1">Thank you for shopping with NIX Fashion!</p>
                </div>
              </div>
            ) : (
              /* Standard A4 Corporate Invoice Layout */
              <div
                key={singleOrder.id}
                className={`w-full max-w-2xl bg-white text-slate-800 p-8 rounded-lg shadow-xl border border-gray-200 space-y-6 ${
                  !isLast ? 'print:break-after-page print:page-break-after-always' : ''
                }`}
              >
                {/* Header */}
                <div className="flex justify-between items-start border-b border-gray-200 pb-4">
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">NIX FASHION & LIFESTYLE</h1>
                    <p className="text-xs text-gray-500">Premium Apparel & Fashion Supply Logistics</p>
                    <p className="text-xs text-gray-500">Dhaka, Bangladesh • support@nix.com</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-lg font-bold text-slate-800">INVOICE</h2>
                    <p className="text-xs font-semibold text-gray-600">#{singleOrder.orderNumber}</p>
                    <p className="text-xs text-gray-500">Date: {new Date(singleOrder.createdAt).toLocaleDateString()}</p>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                      {singleOrder.paymentMethod} - {singleOrder.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Bill To & Ship To */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-bold text-gray-700 uppercase mb-1">Customer / Bill To:</p>
                    <p className="font-semibold text-sm text-slate-900">{singleOrder.customerName}</p>
                    <p className="text-gray-700">{singleOrder.customerPhone}</p>
                    <p className="text-gray-600 mt-1">{singleOrder.customerAddress}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-bold text-gray-700 uppercase mb-1">Logistics / Shipping:</p>
                    <p className="font-semibold text-slate-900">Courier: {singleOrder.courierName || 'Standard Delivery'}</p>
                    <p className="text-gray-700">Tracking Code: {singleOrder.courierTrackingCode || 'N/A'}</p>
                    <p className="text-gray-600 mt-1">Status: {singleOrder.status}</p>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-300 text-gray-600 uppercase">
                      <th className="py-2">Item & Variation</th>
                      <th className="py-2 text-center">SKU</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Unit Price</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {singleOrder.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2.5">
                          <div className="font-semibold text-slate-900">{it.productName}</div>
                          {(it.variantName || it.color || it.size) && (
                            <div className="text-[11px] font-bold text-emerald-700 mt-0.5">
                              Color: {it.color || 'Standard'} | Size: {it.size || 'Free Size'}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 text-center text-gray-500 font-mono text-[11px]">{it.productSku || '-'}</td>
                        <td className="py-2.5 text-center font-bold">{it.quantity}</td>
                        <td className="py-2.5 text-right">{it.unitPrice} ৳</td>
                        <td className="py-2.5 text-right font-bold text-slate-900">{it.totalPrice} ৳</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Financial Calculation Summary */}
                <div className="flex justify-end pt-2">
                  <div className="w-64 space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal:</span>
                      <span className="font-semibold text-slate-800">{singleOrder.subtotal} ৳</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Delivery Charge:</span>
                      <span>+{singleOrder.deliveryCharge} ৳</span>
                    </div>
                    {singleOrder.discount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount:</span>
                        <span>-{singleOrder.discount} ৳</span>
                      </div>
                    )}
                    {singleOrder.advancePaid > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Advance Paid:</span>
                        <span>-{singleOrder.advancePaid} ৳</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-slate-900 border-t-2 border-gray-300 pt-1.5">
                      <span>Total COD Due:</span>
                      <span className="text-emerald-700">{codAmount} ৳</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 text-center text-[10px] text-gray-500">
                  This is a computer generated invoice and requires no physical signature.
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};
