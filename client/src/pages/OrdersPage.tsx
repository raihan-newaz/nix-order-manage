import React, { useState, useEffect } from 'react';
import { Order, User } from '../types';
import api from '../lib/api';
import { io } from 'socket.io-client';
import {
  Search,
  Truck,
  MessageSquare,
  Phone,
  Printer,
  Plus,
  Clock,
  AlertTriangle,
  RotateCcw,
  CheckSquare,
  Loader2,
  RefreshCw,
  ShoppingCart,
  Pencil,
  Archive,
  Trash2,
  UserRound,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CourierDispatchModal } from '../components/orders/CourierDispatchModal';
import { InvoiceModal } from '../components/orders/InvoiceModal';
import { WhatsAppModal } from '../components/orders/WhatsAppModal';
import { CreateOrderModal } from '../components/orders/CreateOrderModal';
import { OrderEditModal } from '../components/orders/OrderEditModal';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [urlParams, setUrlParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [staffList, setStaffList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingWoo, setSyncingWoo] = useState(false);

  // Filters initialized from URL search params for direct bookmarking/sharing
  const [activeTab, setActiveTab] = useState(urlParams.get('status') || (urlParams.get('trash') === 'true' ? 'TRASH' : (urlParams.get('isFraudSuspect') === 'true' ? 'FRAUD_SUSPECT' : 'ALL')));
  const [searchQuery, setSearchQuery] = useState(urlParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(urlParams.get('search') || '');
  const [selectedCourier, setSelectedCourier] = useState(urlParams.get('courier') || 'ALL');
  const [selectedAssignee, setSelectedAssignee] = useState(urlParams.get('assignee') || urlParams.get('assignedToId') || 'ALL');
  const [selectedPriority, setSelectedPriority] = useState(urlParams.get('priority') || 'ALL');
  const [selectedOrderAge, setSelectedOrderAge] = useState(urlParams.get('orderAge') || 'ALL');
  const [selectedSettlement, setSelectedSettlement] = useState(urlParams.get('settlement') || 'ALL');
  const [page, setPage] = useState(Number(urlParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [selectedOrderForCourier, setSelectedOrderForCourier] = useState<Order | null>(null);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [bulkOrdersForInvoice, setBulkOrdersForInvoice] = useState<Order[] | null>(null);
  const [selectedOrderForWhatsApp, setSelectedOrderForWhatsApp] = useState<Order | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<Order | null>(null);

  // Bulk selections
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Load staff list for assignment
  useEffect(() => {
    let cancelled = false;
    api.get('/users')
      .then((res) => {
        if (!cancelled && res.data?.users) {
          setStaffList(res.data.users.filter((u: User) => u.status === 'ACTIVE'));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync state to URL search parameters so views can be shared or bookmarked
  useEffect(() => {
    const nextParams: Record<string, string> = {};
    if (activeTab === 'TRASH') {
      nextParams.trash = 'true';
    } else if (activeTab === 'FRAUD_SUSPECT') {
      nextParams.isFraudSuspect = 'true';
    } else if (activeTab !== 'ALL') {
      nextParams.status = activeTab;
    }
    if (debouncedSearch) nextParams.search = debouncedSearch;
    if (selectedCourier !== 'ALL') nextParams.courier = selectedCourier;
    if (selectedAssignee !== 'ALL') nextParams.assignee = selectedAssignee;
    if (selectedPriority !== 'ALL') nextParams.priority = selectedPriority;
    if (selectedOrderAge !== 'ALL') nextParams.orderAge = selectedOrderAge;
    if (selectedSettlement !== 'ALL') nextParams.settlement = selectedSettlement;
    if (page > 1) nextParams.page = String(page);

    setUrlParams(nextParams, { replace: true });
  }, [
    activeTab,
    debouncedSearch,
    selectedCourier,
    selectedAssignee,
    selectedPriority,
    selectedOrderAge,
    selectedSettlement,
    page,
  ]);

  const handleBulkPrint = () => {
    if (selectedOrderIds.length === 0) return;
    const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
    if (selectedOrders.length > 0) {
      setBulkOrdersForInvoice(selectedOrders);
    }
  };

  const formatOrderDate = (dateString: string | Date) => {
    const d = new Date(dateString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (activeTab === 'TRASH') {
        params.trash = 'true';
      } else if (activeTab !== 'ALL') {
        if (activeTab === 'FRAUD_SUSPECT') {
          params.isFraudSuspect = 'true';
        } else {
          params.status = activeTab;
        }
      }
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedCourier !== 'ALL') params.courier = selectedCourier;
      if (selectedAssignee !== 'ALL') params.assignee = selectedAssignee;
      if (selectedPriority !== 'ALL') params.priority = selectedPriority;
      if (selectedOrderAge !== 'ALL') params.orderAge = selectedOrderAge;
      if (selectedSettlement !== 'ALL') params.settlement = selectedSettlement;

      const res = await api.get('/orders', { params });
      if (res.data?.success) {
        setOrders(res.data.data);
        setTotalPages(res.data.pagination?.totalPages || 1);
        if (res.data.statusCounts) {
          setStatusCounts(res.data.statusCounts);
        }
      }
    } catch (err: any) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const socket = io();
    socket.on('order:new', (newOrder: Order) => {
      toast.success(`🔔 New Order #${newOrder.orderNumber} received!`, {
        icon: '🛒',
        duration: 5000,
      });
      fetchOrders();
    });

    return () => {
      socket.disconnect();
    };
  }, [
    activeTab,
    selectedCourier,
    selectedAssignee,
    selectedPriority,
    selectedOrderAge,
    selectedSettlement,
    page,
    debouncedSearch,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
    setSelectedOrderIds([]);
  }, [
    activeTab,
    selectedCourier,
    selectedAssignee,
    selectedPriority,
    selectedOrderAge,
    selectedSettlement,
  ]);

  const handleSyncWooCommerce = async () => {
    setSyncingWoo(true);
    try {
      const res = await api.post('/woocommerce/sync-orders', { perPage: 50, page: 1 });
      if (res.data?.success) {
        toast.success(res.data.message || 'WooCommerce orders synced!');
        fetchOrders();
      } else {
        toast.error(res.data?.message || 'Sync failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to sync with WooCommerce');
    } finally {
      setSyncingWoo(false);
    }
  };

  const handleSingleAssign = async (orderId: string, assignedToId: string | null) => {
    try {
      const res = await api.patch(`/orders/${orderId}/assignment`, { assignedToId });
      if (res.data?.success) {
        toast.success(assignedToId ? 'Order assigned' : 'Order unassigned');
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  assignedTo: assignedToId
                    ? staffList.find((s) => s.id === assignedToId) || { id: assignedToId, name: 'Staff' }
                    : undefined,
                }
              : o
          )
        );
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update assignment');
    }
  };

  const handleSinglePriority = async (orderId: string, priority: 'NORMAL' | 'URGENT') => {
    try {
      const res = await api.patch(`/orders/${orderId}/priority`, { priority });
      if (res.data?.success) {
        toast.success(`Priority set to ${priority}`);
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, priority } : o))
        );
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update priority');
    }
  };

  const handleBulkAssign = async (assignedToId: string | null) => {
    if (selectedOrderIds.length === 0) return;
    try {
      const res = await api.post('/orders/bulk-assign', {
        orderIds: selectedOrderIds,
        assignedToId,
      });
      if (res.data?.success) {
        toast.success(`Assigned ${selectedOrderIds.length} orders`);
        fetchOrders();
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Bulk assignment failed');
    }
  };

  const handleBulkPriority = async (priority: 'NORMAL' | 'URGENT') => {
    if (selectedOrderIds.length === 0) return;
    try {
      const res = await api.post('/orders/bulk-priority', {
        orderIds: selectedOrderIds,
        priority,
      });
      if (res.data?.success) {
        toast.success(`Set priority to ${priority} for ${selectedOrderIds.length} orders`);
        fetchOrders();
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Bulk priority update failed');
    }
  };


  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const currentOrder = orders.find((o) => o.id === orderId);
    const oldStatus = currentOrder?.status;
    if (!currentOrder || oldStatus === newStatus) return;

    // Real-time optimistic in-place update: update state immediately
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as any } : o))
    );
    if (oldStatus) {
      setStatusCounts((prev) => ({
        ...prev,
        [oldStatus]: Math.max(0, (prev[oldStatus] || 0) - 1),
        [newStatus]: (prev[newStatus] || 0) + 1,
      }));
    }

    try {
      const res = await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      if (res.data?.success) {
        toast.success(`Order #${res.data?.order?.orderNumber || currentOrder.orderNumber} updated to ${newStatus}`);
      } else {
        throw new Error(res.data?.message || 'Failed to update status');
      }
    } catch (e: any) {
      // Rollback on failure
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: oldStatus as any } : o))
      );
      if (oldStatus) {
        setStatusCounts((prev) => ({
          ...prev,
          [oldStatus]: (prev[oldStatus] || 0) + 1,
          [newStatus]: Math.max(0, (prev[newStatus] || 0) - 1),
        }));
      }
      toast.error('Failed to update status');
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedOrderIds.length === 0) return;
    try {
      const res = await api.post('/orders/bulk-status', {
        orderIds: selectedOrderIds,
        status: newStatus,
      });
      if (res.data?.success) {
        toast.success(`Updated ${selectedOrderIds.length} orders to ${newStatus}`);
        setSelectedOrderIds([]);
        fetchOrders();
      }
    } catch (e: any) {
      toast.error('Bulk update failed');
    }
  };

  const handleBulkCourier = async (courierName: 'STEADFAST' | 'PATHAO' | 'REDX') => {
    if (selectedOrderIds.length === 0) return;
    try {
      const res = await api.post('/couriers/dispatch-bulk', {
        orderIds: selectedOrderIds,
        courierName,
      });
      if (res.data?.success) {
        if (res.data.failed) toast.error(`${res.data.failed} dispatch failed: ${res.data.errors?.[0]?.error || 'Check courier settings'}`);
        if (res.data.accepted) toast.success(`${res.data.accepted} Pathao request${res.data.accepted === 1 ? '' : 's'} accepted; waiting for consignment webhooks`);
        else if (res.data.dispatched) toast.success(`${res.data.dispatched} order${res.data.dispatched === 1 ? '' : 's'} booked with ${courierName}`);
        setSelectedOrderIds(res.data.errors?.map((entry: { orderId: string }) => entry.orderId) || []);
        fetchOrders();
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Bulk courier dispatch failed');
    }
  };

  const handleTrashOrders = async (ids = selectedOrderIds) => {
    if (!ids.length || !window.confirm(`Move ${ids.length} selected order(s) to Trash? They can be restored later.`)) return;
    try {
      const res = await api.post('/orders/trash', { orderIds: ids });
      toast.success(res.data.message || 'Orders moved to Trash');
      setSelectedOrderIds([]);
      fetchOrders();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Could not move orders to Trash'); }
  };

  const handleRestoreOrders = async (ids = selectedOrderIds) => {
    if (!ids.length) return;
    try {
      const res = await api.post('/orders/restore', { orderIds: ids });
      toast.success(res.data.message || 'Orders restored');
      setSelectedOrderIds([]);
      fetchOrders();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Could not restore orders'); }
  };

  const handlePermanentDeleteOrders = async (ids = selectedOrderIds) => {
    if (!ids.length || !window.confirm(`Permanently delete ${ids.length} selected order(s)? This cannot be undone. Finance entries, message logs, and audit records will be retained.`)) return;
    try {
      const res = await api.post('/orders/permanently-delete', { orderIds: ids });
      toast.success(res.data.message || 'Orders permanently deleted');
      setSelectedOrderIds([]);
      fetchOrders();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Could not permanently delete orders'); }
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const tabs = [
    { id: 'ALL', label: 'All', count: statusCounts.ALL || 0 },
    { id: 'PENDING', label: 'Pending', count: statusCounts.PENDING || 0, color: 'text-amber-500' },
    { id: 'CONFIRMED', label: 'Confirmed', count: statusCounts.CONFIRMED || 0, color: 'text-blue-500' },
    { id: 'PACKAGING', label: 'Packaging', count: statusCounts.PACKAGING || 0, color: 'text-sky-500' },
    { id: 'IN_TRANSIT', label: 'In Courier', count: statusCounts.IN_TRANSIT || 0, color: 'text-purple-500' },
    { id: 'DELIVERED', label: 'Delivered', count: statusCounts.DELIVERED || 0, color: 'text-emerald-500' },
    { id: 'RETURNED', label: 'Returned', count: statusCounts.RETURNED || 0, color: 'text-rose-500' },
    { id: 'CANCELLED', label: 'Cancelled', count: statusCounts.CANCELLED || 0, color: 'text-slate-400' },
    { id: 'FRAUD_SUSPECT', label: '⚠️ Suspects', count: 1, color: 'text-red-500' },
    { id: 'TRASH', label: 'Trash', count: statusCounts.TRASH || 0, color: 'text-rose-500' },
  ];

  return (
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <ShoppingCart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Orders
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Manage customer orders, variations, and courier dispatch • nix.bd
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncWooCommerce}
            disabled={syncingWoo}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            {syncingWoo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync WooCommerce
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl shadow-sm transition-all dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Plus className="w-4 h-4" />
            Create Order
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedOrderIds([]);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === tab.id
                  ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search & Operations Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100/90 dark:border-slate-800 p-3.5 rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2 w-full lg:max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by order #, phone, customer, tracking..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full bg-slate-50/70 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 pl-9 pr-3 rounded-xl focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          {/* Assignee Filter */}
          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            className="h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 rounded-xl px-2.5 focus:border-emerald-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Assignees</option>
            <option value="UNASSIGNED">Unassigned</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.role.replace(/_/g, ' ')})
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 rounded-xl px-2.5 focus:border-emerald-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Priority</option>
            <option value="NORMAL">Normal</option>
            <option value="URGENT">⚡ Urgent</option>
          </select>

          {/* Courier Filter */}
          <select
            value={selectedCourier}
            onChange={(e) => setSelectedCourier(e.target.value)}
            className="h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 rounded-xl px-2.5 focus:border-emerald-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Couriers</option>
            <option value="STEADFAST">Steadfast</option>
            <option value="PATHAO">Pathao</option>
            <option value="REDX">RedX</option>
          </select>

          {/* Order Age Filter */}
          <select
            value={selectedOrderAge}
            onChange={(e) => setSelectedOrderAge(e.target.value)}
            className="h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 rounded-xl px-2.5 focus:border-emerald-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Any Age</option>
            <option value="today">Today</option>
            <option value="under24h">&lt; 24 Hours</option>
            <option value="24h">&gt; 24 Hours</option>
            <option value="48h">&gt; 48 Hours</option>
            <option value="7d">&gt; 7 Days</option>
          </select>

          {/* Settlement Filter */}
          <select
            value={selectedSettlement}
            onChange={(e) => setSelectedSettlement(e.target.value)}
            className="h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 rounded-xl px-2.5 focus:border-emerald-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Settlements</option>
            <option value="PENDING">Settlement Pending</option>
            <option value="RECONCILED">Reconciled</option>
            <option value="DISCREPANCY">Discrepancy</option>
          </select>

          <button
            onClick={fetchOrders}
            title="Refresh"
            className="h-9 w-9 inline-flex items-center justify-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bulk Action Banner */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
            <CheckSquare className="w-4 h-4" />
            <span className="font-medium">{selectedOrderIds.length} orders selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {activeTab === 'TRASH' ? <>
              <button onClick={() => handleRestoreOrders()} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl">Restore</button>
              <button onClick={() => handlePermanentDeleteOrders()} className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl"><Trash2 className="h-3.5 w-3.5"/> Delete permanently</button>
            </> : <>
            {/* Bulk Assign Dropdown */}
            <select
              onChange={(e) => {
                if (e.target.value !== '') {
                  handleBulkAssign(e.target.value === 'UNASSIGN' ? null : e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="h-9 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded-xl px-2.5 focus:outline-none cursor-pointer"
            >
              <option value="" disabled>Assign to Staff...</option>
              <option value="UNASSIGN">Unassign</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Bulk Priority Toggle */}
            <button
              onClick={() => handleBulkPriority('URGENT')}
              className="h-9 px-3 inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl shadow-sm"
            >
              ⚡ Mark Urgent
            </button>
            <button
              onClick={() => handleBulkPriority('NORMAL')}
              className="h-9 px-3 inline-flex items-center bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-300"
            >
              Normal
            </button>

            <button
              onClick={handleBulkPrint}
              className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              Print ({selectedOrderIds.length})
            </button>
            <button
              onClick={() => handleBulkStatusChange('CONFIRMED')}
              className="h-9 px-3.5 inline-flex items-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm"
            >
              Confirm
            </button>
            <button
              onClick={() => handleBulkStatusChange('PACKAGING')}
              className="h-9 px-3.5 inline-flex items-center bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl shadow-sm"
            >
              Packaging
            </button>
            <button
              onClick={() => handleBulkCourier('STEADFAST')}
              className="h-9 px-3.5 inline-flex items-center bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-sm"
            >
              Steadfast ({selectedOrderIds.length})
            </button>
            <button
              onClick={() => handleBulkCourier('PATHAO')}
              className="h-9 px-3.5 inline-flex items-center bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-sm"
            >
              Pathao ({selectedOrderIds.length})
            </button>
            <button
              onClick={() => handleBulkStatusChange('CANCELLED')}
              className="h-9 px-3.5 inline-flex items-center bg-slate-200 dark:bg-slate-800 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button onClick={() => handleTrashOrders()} className="h-9 px-3.5 inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl"><Trash2 className="h-3.5 w-3.5"/> Move to Trash</button>
            </>}
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-card">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
            <AlertTriangle className="w-8 h-8 mb-2 text-slate-400" />
            <p>{activeTab === 'TRASH' ? 'Trash is empty.' : 'No orders found matching the filter.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[1040px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.length === orders.length && orders.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="py-3.5 px-3 min-w-[100px]">Order</th>
                  <th className="py-3.5 px-3 min-w-[150px]">Customer</th>
                  <th className="py-3.5 px-3 min-w-[180px]">Items & Variations</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[120px]">COD Due</th>
                  <th className="py-3.5 px-3 min-w-[120px]">Assignee</th>
                  <th className="py-3.5 px-3 min-w-[100px] text-center">Priority</th>
                  <th className="py-3.5 px-3 min-w-[130px]">Status</th>
                  <th className="py-3.5 px-3 min-w-[120px]">Courier</th>
                  <th className="py-3.5 px-3 text-center min-w-[160px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/orders/${o.id}`)}
                    className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                      o.isFraudSuspect ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3.5 text-center" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(o.id)}
                        onChange={() => toggleSelectOrder(o.id)}
                        className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>

                    {/* Order Number & Time */}
                    <td className="py-3.5 px-3 min-w-[100px] whitespace-nowrap">
                      <div className="font-normal text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5 hover:text-emerald-600">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">#{o.orderNumber}</span>
                        {o.wooOrderId && (
                          <span className="text-[9px] font-semibold px-1 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                            Woo
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400 font-normal leading-tight">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="mt-0.5 text-slate-400 font-medium">
                          {formatOrderDate(o.createdAt)}
                        </div>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-3 min-w-[150px]">
                      <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span>{o.customerName}</span>
                        {o.isFraudSuspect && (
                          <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
                            SUSPECT
                          </span>
                        )}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 font-normal text-[11px] mt-0.5">{o.customerPhone}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[170px] mt-0.5">
                        {o.customerAddress}
                      </div>
                    </td>

                    {/* Items & Variations */}
                    <td className="py-3.5 px-3 min-w-[180px]">
                      <div className="space-y-1">
                        {o.items.map((it) => (
                          <div key={it.id} className="text-xs">
                            <div className="flex items-center gap-1 font-normal text-slate-800 dark:text-slate-200">
                              <span>{it.productName}</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">x{it.quantity}</span>
                            </div>
                            {(it.variantName || it.color || it.size) && (
                              <span className="inline-block text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 mt-0.5">
                                {it.variantName || `${it.color || ''} ${it.size ? `/ ${it.size}` : ''}`}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* COD Amount */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap min-w-[120px]">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs tabular-nums">
                        ৳{(o.codAmount || o.grandTotal).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 tabular-nums mt-0.5 font-normal">
                        Delivery: ৳{o.deliveryCharge}
                      </div>
                    </td>

                    {/* Assignee Inline Selector */}
                    <td className="py-3.5 px-3 min-w-[120px] whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
                      {activeTab !== 'TRASH' ? (
                        <select
                          value={o.assignedTo?.id || ''}
                          onChange={(e) => handleSingleAssign(o.id, e.target.value ? e.target.value : null)}
                          className={`h-8 text-xs font-medium rounded-lg px-2 border focus:outline-none transition-colors cursor-pointer inline-flex items-center w-full max-w-[130px] ${
                            o.assignedTo
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                              : 'bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40 font-semibold'
                          }`}
                        >
                          <option value="">Unassigned</option>
                          {staffList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[11px] text-slate-400">{o.assignedTo?.name || '—'}</span>
                      )}
                    </td>

                    {/* Priority Toggle */}
                    <td className="py-3.5 px-3 min-w-[100px] text-center whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
                      {activeTab !== 'TRASH' ? (
                        <button
                          onClick={() => handleSinglePriority(o.id, o.priority === 'URGENT' ? 'NORMAL' : 'URGENT')}
                          title="Click to toggle priority"
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold tracking-tight transition-all ${
                            o.priority === 'URGENT'
                              ? 'bg-amber-500 text-white shadow-sm hover:bg-amber-600'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {o.priority === 'URGENT' ? '⚡ URGENT' : 'Normal'}
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">{o.priority}</span>
                      )}
                    </td>

                    {/* Status Dropdown */}
                    <td className="py-3.5 px-3 min-w-[130px] whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
                      {activeTab !== 'TRASH' && <select
                        value={o.status}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                        className={`h-9 text-xs font-medium rounded-xl px-3 py-0 border focus:outline-none transition-colors cursor-pointer inline-flex items-center ${
                          o.status === 'DELIVERED'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                            : o.status === 'IN_TRANSIT'
                            ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30'
                            : o.status === 'CONFIRMED'
                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30'
                            : o.status === 'PACKAGING'
                            ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/30'
                            : o.status === 'RETURNED'
                            ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                            : o.status === 'CANCELLED'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                            : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                        }`}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="PACKAGING">Packaging</option>
                        <option value="IN_TRANSIT">In Courier</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="RETURNED">Returned</option>
                        <option value="CANCELLED">Cancelled</option>
                        <option value="HOLD">Hold</option>
                      </select>}
                    </td>

                    {/* Courier Logistics */}
                    <td className="py-3.5 px-3 min-w-[120px] whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
                      {o.courierName ? (
                        <div className="h-9 flex flex-col justify-center">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs leading-none">{o.courierName}</span>
                          {o.courierTrackingCode && (
                            <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 leading-tight mt-1">
                              {o.courierTrackingCode}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedOrderForCourier(o)}
                          className="h-9 inline-flex items-center justify-center gap-1.5 px-3.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-xl border border-emerald-200 dark:border-emerald-500/30 transition-all shadow-sm"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          Send
                        </button>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {activeTab === 'TRASH' ? <>
                          <button onClick={() => handleRestoreOrders([o.id])} title="Restore order" className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300"><RotateCcw className="h-3.5 w-3.5"/> Restore</button>
                          <button onClick={() => handlePermanentDeleteOrders([o.id])} title="Delete permanently" className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300"><Trash2 className="h-3.5 w-3.5"/></button>
                        </> : <>
                        <a
                          href={`tel:${o.customerPhone}`}
                          title="Call"
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 text-slate-600 dark:text-slate-300 hover:text-white rounded-lg transition-all"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>

                        <button
                          onClick={() => setSelectedOrderForWhatsApp(o)}
                          title="WhatsApp"
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-teal-600 text-slate-600 dark:text-slate-300 hover:text-white rounded-lg transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setSelectedOrderForCourier(o)}
                          title="Courier"
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 text-slate-600 dark:text-slate-300 hover:text-white rounded-lg transition-all"
                        >
                          <Truck className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setSelectedOrderForEdit(o)}
                          title="Edit order"
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-900 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-white rounded-lg transition-all"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setSelectedOrderForInvoice(o)}
                          title="Print Receipt"
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleTrashOrders([o.id])} title="Delete order" className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 text-slate-600 dark:text-slate-300 hover:text-white rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800"><span className="text-slate-500">Page {page} of {totalPages}</span><div className="flex gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button><button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-slate-700">Next</button></div></div>}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedOrderForCourier && (
        <CourierDispatchModal
          order={selectedOrderForCourier}
          onClose={() => setSelectedOrderForCourier(null)}
          onSuccess={() => fetchOrders()}
        />
      )}

      {(selectedOrderForInvoice || bulkOrdersForInvoice) && (
        <InvoiceModal
          order={selectedOrderForInvoice}
          orders={bulkOrdersForInvoice}
          onClose={() => {
            setSelectedOrderForInvoice(null);
            setBulkOrdersForInvoice(null);
          }}
        />
      )}

      {selectedOrderForWhatsApp && (
        <WhatsAppModal
          order={selectedOrderForWhatsApp}
          onClose={() => setSelectedOrderForWhatsApp(null)}
        />
      )}

      {isCreateModalOpen && (
        <CreateOrderModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => fetchOrders()}
        />
      )}

      {selectedOrderForEdit && (
        <OrderEditModal
          order={selectedOrderForEdit}
          onClose={() => setSelectedOrderForEdit(null)}
          onSuccess={() => fetchOrders()}
        />
      )}
    </div>
  );
};
