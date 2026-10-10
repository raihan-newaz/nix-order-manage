import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Product, ProductVariant } from '../../types';
import api from '../../lib/api';
import { ShoppingBag, X, Plus, Trash2, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const variantLabel = (variant: ProductVariant) => {
  try {
    const attributes = variant.attributes ? JSON.parse(variant.attributes) : {};
    const values = Object.values(attributes).filter(Boolean);
    if (values.length) return values.join(' / ');
  } catch { /* keep compatibility with older Color / Size variations */ }
  return [variant.color, variant.size].filter(Boolean).join(' / ') || variant.name;
};

interface CreateOrderModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ onClose, onSuccess }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [district, setDistrict] = useState('Dhaka');
  const [deliveryCharge, setDeliveryCharge] = useState(60);
  const [discount, setDiscount] = useState(0);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [internalNote, setInternalNote] = useState('');

  const [orderItems, setOrderItems] = useState<
    {
      productId: string;
      variantId?: string;
      productName: string;
      variantName?: string;
      color?: string;
      size?: string;
      productSku: string;
      quantity: number;
      unitPrice: number;
      unitBuyPrice: number;
    }[]
  >([]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get('/inventory/products');
        if (res.data?.success) {
          setProducts(res.data.products);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchProducts();
  }, []);

  const activeProduct = products.find((p) => p.id === selectedProductId);

  const handleAddCurrentItem = () => {
    if (!activeProduct) return;

    let variant: ProductVariant | undefined;
    if (activeProduct.variants && activeProduct.variants.length > 0) {
      if (!selectedVariantId) {
        toast.error('Please choose a product variation');
        return;
      }
      variant = activeProduct.variants.find((v) => v.id === selectedVariantId);
    }

    const price = variant?.salePrice || variant?.regularPrice || activeProduct.salePrice || activeProduct.regularPrice;
    const buyCost = variant?.buyPrice || activeProduct.buyPrice;
    const sku = variant?.sku || activeProduct.sku;
    const vName = variant ? variantLabel(variant) : undefined;

    setOrderItems((prev) => {
      const matchIdx = prev.findIndex(
        (it) => it.productId === activeProduct.id && it.variantId === (variant?.id || undefined)
      );

      if (matchIdx >= 0) {
        return prev.map((it, i) => (i === matchIdx ? { ...it, quantity: it.quantity + 1 } : it));
      }

      return [
        ...prev,
        {
          productId: activeProduct.id,
          variantId: variant?.id,
          productName: activeProduct.name,
          variantName: vName,
          color: variant?.color,
          size: variant?.size,
          productSku: sku,
          quantity: 1,
          unitPrice: price,
          unitBuyPrice: buyCost,
        },
      ];
    });

    // Reset selection
    setSelectedProductId('');
    setSelectedVariantId('');
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const subtotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const grandTotal = Math.max(0, subtotal + Number(deliveryCharge) - Number(discount));
  const codAmount = Math.max(0, grandTotal - Number(advancePaid));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      toast.error('Customer name and phone number are required');
      return;
    }
    if (orderItems.length === 0) {
      toast.error('Please add at least one product item');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/orders', {
        customerName,
        customerPhone,
        customerAddress,
        district,
        items: orderItems,
        deliveryCharge: Number(deliveryCharge),
        discount: Number(discount),
        advancePaid: Number(advancePaid),
        paymentMethod,
        internalNote,
      });

      if (res.data?.success) {
        toast.success('Fashion Order created successfully!');
        onSuccess();
        onClose();
      } else {
        toast.error(res.data?.message || 'Failed to create order');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-lg">Create Fashion Order</h3>
              <p className="text-xs text-slate-400">Direct Call-Center / Social Media Booking with Variations</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Customer Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Customer Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Nusrat Jahan"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number *</label>
              <input
                type="text"
                required
                placeholder="017xxxxxxxx"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Delivery Address *</label>
            <input
              type="text"
              required
              placeholder="House, Road, Area, City"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:border-emerald-500"
            />
          </div>

          {/* Product & Variant Selector */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Add Fashion Item & Select Color / Size
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Product Select */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Select Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setSelectedVariantId('');
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-emerald-500"
                >
                  <option value="">-- Choose Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stockQuantity}) - {p.salePrice || p.regularPrice} ৳
                    </option>
                  ))}
                </select>
              </div>

              {/* Variant Select (if available) */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Color & Size Variation</label>
                <select
                  disabled={!activeProduct || !activeProduct.variants?.length}
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 disabled:opacity-40"
                >
                  <option value="">
                    {activeProduct?.variants?.length ? '-- Select variation --' : 'Standard Item (No variations)'}
                  </option>
                  {activeProduct?.variants?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {variantLabel(v)} (Stock: {v.stockQuantity} pcs) - {v.salePrice || v.regularPrice} ৳
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddCurrentItem}
              disabled={!selectedProductId}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 font-semibold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              Add Item to Cart
            </button>

            {/* Added Items List */}
            {orderItems.length > 0 && (
              <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80 mt-3">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-slate-900/70 p-3">
                    <div className="flex-1">
                      <p className="font-bold text-slate-200">{item.productName}</p>
                      {item.variantName && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {item.variantName}
                        </span>
                      )}
                      <p className="text-slate-500 text-[10px] font-mono mt-0.5">{item.productSku}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-xs">{item.unitPrice} ৳ x</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 1;
                          setOrderItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                          );
                        }}
                        className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-bold text-slate-100"
                      />
                      <span className="font-black text-emerald-400 w-16 text-right">
                        {item.quantity * item.unitPrice} ৳
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-rose-400 hover:text-rose-300 p-1.5 rounded hover:bg-slate-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing & Discounts */}
          <div className="grid grid-cols-3 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Delivery Charge (৳)</label>
              <input
                type="number"
                value={deliveryCharge}
                onChange={(e) => setDeliveryCharge(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Discount (৳)</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Advance Paid (৳)</label>
              <input
                type="number"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              />
            </div>
          </div>

          {/* Summary Box */}
          <div className="flex justify-between items-center bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm">
            <div>
              <span className="text-xs text-slate-400">Grand Total: </span>
              <span className="font-bold text-slate-100">{grandTotal} ৳</span>
            </div>
            <div>
              <span className="text-xs text-emerald-400 font-semibold">COD Collection Due: </span>
              <span className="font-black text-emerald-400 text-lg">{codAmount} ৳</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Order
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
