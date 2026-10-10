import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import {
  Settings,
  Truck,
  Plus,
  CheckCircle,
  X,
  Loader2,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import SecretInput from '../components/SecretInput';
import { useAuth } from '../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { section: routeSection = 'woocommerce' } = useParams();
  const section = ['woocommerce', 'couriers', 'payments', 'users', 'audit', 'security'].includes(routeSection) ? routeSection : 'woocommerce';
  const sectionDetails: Record<string, { title: string; description: string }> = {
    woocommerce: { title: 'WooCommerce Settings', description: 'Store connection and synchronization' },
    couriers: { title: 'Courier Settings', description: 'Provider connections and API credentials' },
    payments: { title: 'Payment Settings', description: 'Online checkout and payment gateway configuration' },
    users: { title: 'Staff Users', description: 'Staff accounts and access roles' },
    audit: { title: 'Audit Log', description: 'Review actions performed in the admin panel' },
    security: { title: 'Security Settings', description: 'Password and account security controls' },
  };
  const [payment, setPayment] = useState({ enabled: false, baseUrl: '', apiKey: '', hasApiKey: false });
  const [savingPayment, setSavingPayment] = useState(false);

  // WooCommerce config state
  const [wooStoreName, setWooStoreName] = useState('');
  const [wooStoreUrl, setWooStoreUrl] = useState('');
  const [wooKey, setWooKey] = useState('');
  const [wooSecret, setWooSecret] = useState('');
  const [wooWebhookSecret, setWooWebhookSecret] = useState('');
  const [testingWoo, setTestingWoo] = useState(false);
  const [wooTestResult, setWooTestResult] = useState<any>(null);

  // Courier config state
  const [sfApiKey, setSfApiKey] = useState('');
  const [sfSecretKey, setSfSecretKey] = useState('');
  const [sfWebhookSecret, setSfWebhookSecret] = useState('');
  const [sfEnabled, setSfEnabled] = useState(false);
  const [sfWebhookUrl, setSfWebhookUrl] = useState('');
  const [sfWebhookPublic, setSfWebhookPublic] = useState(false);
  const [sfBusy, setSfBusy] = useState(false);

  const [pathaoClientId, setPathaoClientId] = useState('');
  const [pathaoClientSecret, setPathaoClientSecret] = useState('');
  const [pathaoUsername, setPathaoUsername] = useState('');
  const [pathaoPassword, setPathaoPassword] = useState('');
  const [pathaoBaseUrl, setPathaoBaseUrl] = useState('https://api-hermes.pathao.com');
  const [pathaoStoreId, setPathaoStoreId] = useState('');
  const [pathaoEnabled, setPathaoEnabled] = useState(false);
  const [pathaoWebhookSecret, setPathaoWebhookSecret] = useState('');
  const [pathaoVerificationSecret, setPathaoVerificationSecret] = useState('');
  const [pathaoWebhookUrl, setPathaoWebhookUrl] = useState('');
  const [pathaoWebhookPublic, setPathaoWebhookPublic] = useState(false);
  const [pathaoEvents, setPathaoEvents] = useState<Array<{ id: string; event: string; merchantOrderId?: string; consignmentId?: string; occurredAt: string; applied: boolean }>>([]);
  const [pathaoStores, setPathaoStores] = useState<Array<{ store_id: string | number; store_name: string; is_active: number }>>([]);
  const [pathaoBusy, setPathaoBusy] = useState(false);
  const [showNewPathaoStore, setShowNewPathaoStore] = useState(false);
  const [pathaoCities, setPathaoCities] = useState<Array<{ city_id: number; city_name: string }>>([]);
  const [pathaoZones, setPathaoZones] = useState<Array<{ zone_id: number; zone_name: string }>>([]);
  const [pathaoAreas, setPathaoAreas] = useState<Array<{ area_id: number; area_name: string }>>([]);
  const [newPathaoStore, setNewPathaoStore] = useState({ name: '', contact_name: '', contact_number: '', secondary_contact: '', otp_number: '', address: '', city_id: '', zone_id: '', area_id: '' });

  const [redxApiKey, setRedxApiKey] = useState('');
  const [redxBaseUrl, setRedxBaseUrl] = useState('https://sandbox.redx.com.bd/v1.0.0-beta');
  const [redxEnabled, setRedxEnabled] = useState(false);
  const [redxWebhookSecret, setRedxWebhookSecret] = useState('');
  const [redxWebhookUrl, setRedxWebhookUrl] = useState('');
  const [redxWebhookUrlWithToken, setRedxWebhookUrlWithToken] = useState('');
  const [redxWebhookPublic, setRedxWebhookPublic] = useState(false);
  const [redxBusy, setRedxBusy] = useState(false);

  // Users & Audit Logs
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // New User modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editingStatus, setEditingStatus] = useState('ACTIVE');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('CALL_CENTER_AGENT');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        section === 'woocommerce' ? api.get('/woocommerce/config') : Promise.resolve(null),
        section === 'couriers' ? api.get('/couriers/configs') : Promise.resolve(null),
        section === 'users' ? api.get('/auth/users') : Promise.resolve(null),
        section === 'audit' ? api.get('/audit') : Promise.resolve(null),
        section === 'payments' ? api.get('/storefront/payment/config') : Promise.resolve(null),
        section === 'couriers' ? api.get('/couriers/pathao/events?limit=12') : Promise.resolve(null),
        section === 'couriers' ? api.get('/couriers/steadfast/events') : Promise.resolve(null),
        section === 'couriers' ? api.get('/couriers/redx/events') : Promise.resolve(null),
      ]);
      const [wooRes, courierRes, userRes, auditRes, paymentRes, pathaoEventsRes, sfEventsRes, redxEventsRes] = results.map((result) => result.status === 'fulfilled' ? result.value : null);
      if (redxEventsRes?.data) {
        setRedxWebhookUrl(redxEventsRes.data.webhookUrl || '');
        setRedxWebhookUrlWithToken(redxEventsRes.data.webhookUrlWithToken || '');
        setRedxWebhookPublic(Boolean(redxEventsRes.data.publiclyReachable));
      }
      if (sfEventsRes?.data) {
        setSfWebhookUrl(sfEventsRes.data.webhookUrl || '');
        setSfWebhookPublic(Boolean(sfEventsRes.data.publiclyReachable));
      }
      if (pathaoEventsRes?.data) {
        setPathaoEvents(pathaoEventsRes.data.events || []);
        setPathaoWebhookUrl(pathaoEventsRes.data.webhookUrl || '');
        setPathaoWebhookPublic(Boolean(pathaoEventsRes.data.publiclyReachable));
      }
      if (paymentRes?.data?.payment) setPayment({ ...paymentRes.data.payment, apiKey: '' });

      if (wooRes?.data?.store) {
        setWooStoreName(wooRes.data.store.storeName || '');
        setWooStoreUrl(wooRes.data.store.storeUrl || '');
        setWooKey(wooRes.data.store.consumerKey || '');
        setWooSecret(wooRes.data.store.consumerSecret || '');
        setWooWebhookSecret(wooRes.data.store.webhookSecret || '');
      }

      if (courierRes?.data?.configs) {
        const sf = courierRes.data.configs.find((c: any) => c.provider === 'STEADFAST');
        if (sf) {
          setSfApiKey(sf.apiKey || '');
          setSfSecretKey(sf.secretKey || '');
          setSfWebhookSecret(sf.webhookSecret || '');
          setSfEnabled(Boolean(sf.isEnabled));
        }
        const pth = courierRes.data.configs.find((c: any) => c.provider === 'PATHAO');
        if (pth) {
          setPathaoClientId(pth.clientId || '');
          setPathaoClientSecret(pth.clientSecret || '');
          setPathaoUsername(pth.username || '');
          setPathaoPassword(pth.password || '');
          setPathaoBaseUrl(pth.baseUrl || 'https://api-hermes.pathao.com');
          setPathaoStoreId(pth.storeId || '');
          setPathaoEnabled(Boolean(pth.isEnabled));
          setPathaoWebhookSecret(pth.webhookSecret || '');
          setPathaoVerificationSecret(pth.webhookVerificationSecret || '');
        }
        const rdx = courierRes.data.configs.find((c: any) => c.provider === 'REDX');
        if (rdx) {
          setRedxApiKey(rdx.apiKey || '');
          setRedxBaseUrl(rdx.baseUrl || 'https://sandbox.redx.com.bd/v1.0.0-beta');
          setRedxEnabled(Boolean(rdx.isEnabled));
          setRedxWebhookSecret(rdx.webhookSecret || '');
        }
      }

      if (userRes?.data?.users) setUsers(userRes.data.users);
      if (auditRes?.data?.logs) setAuditLogs(auditRes.data.logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [section]);

  const handleTestWooConnection = async () => {
    setTestingWoo(true);
    setWooTestResult(null);
    try {
      const res = await api.post('/woocommerce/test-connection', {
        storeUrl: wooStoreUrl,
        consumerKey: wooKey,
        consumerSecret: wooSecret,
        webhookSecret: wooWebhookSecret,
      });
      if (res.data?.success) {
        toast.success('Connection Successful! Store verified.');
        setWooTestResult(res.data.data);
      } else {
        toast.error(res.data?.message || 'Connection failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Connection test failed');
    } finally {
      setTestingWoo(false);
    }
  };

  const handleSaveWoo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/woocommerce/config', {
        storeName: wooStoreName,
        storeUrl: wooStoreUrl,
        consumerKey: wooKey,
        consumerSecret: wooSecret,
      });
      if (res.data?.success) toast.success('WooCommerce settings saved!');
    } catch (e) {
      toast.error('Failed to save settings');
    }
  };

  const handleSaveCourierKeys = async () => {
    setRedxBusy(true);
    try {
      await api.put('/couriers/configs/REDX', { apiKey: redxApiKey, baseUrl: redxBaseUrl, isEnabled: redxEnabled, webhookSecret: redxWebhookSecret });
      const { data } = await api.get('/couriers/redx/events');
      setRedxWebhookUrlWithToken(data.webhookUrlWithToken || '');
      toast.success('RedX settings saved');
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not save RedX settings'); }
    finally { setRedxBusy(false); }
  };

  const revealCourierSecret = async (provider: string, field: string) => {
    const { data } = await api.post(`/couriers/configs/${provider}/reveal/${field}`);
    return data.value as string;
  };

  const testRedx = async () => {
    setRedxBusy(true);
    try { const { data } = await api.get('/couriers/redx/test'); toast.success(`${data.message}; ${data.storeCount} pickup stores`); }
    catch (error: any) { toast.error(error.response?.data?.message || 'RedX connection failed'); }
    finally { setRedxBusy(false); }
  };

  const syncRedxAreas = async () => {
    setRedxBusy(true);
    try { const { data } = await api.post('/couriers/locations/REDX/refresh', { level: 'AREA' }); toast.success(`${data.count} RedX areas synced`); }
    catch (error: any) { toast.error(error.response?.data?.message || 'RedX area sync failed'); }
    finally { setRedxBusy(false); }
  };

  const saveSteadfast = async () => {
    setSfBusy(true);
    try {
      await api.put('/couriers/configs/STEADFAST', { apiKey: sfApiKey, secretKey: sfSecretKey, webhookSecret: sfWebhookSecret, isEnabled: sfEnabled });
      toast.success('Steadfast settings saved');
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not save Steadfast settings'); }
    finally { setSfBusy(false); }
  };

  const testSteadfast = async () => {
    setSfBusy(true);
    try { await api.get('/couriers/steadfast/test'); toast.success('Steadfast credentials verified'); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Steadfast connection failed'); }
    finally { setSfBusy(false); }
  };

  const generateSteadfastWebhookToken = () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    setSfWebhookSecret(Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(''));
  };

  const savePathao = async () => {
    setPathaoBusy(true);
    try {
      await api.put('/couriers/configs/PATHAO', {
        clientId: pathaoClientId, clientSecret: pathaoClientSecret,
        username: pathaoUsername, password: pathaoPassword,
        baseUrl: pathaoBaseUrl, storeId: pathaoStoreId, isEnabled: pathaoEnabled,
        webhookSecret: pathaoWebhookSecret, webhookVerificationSecret: pathaoVerificationSecret,
      });
      toast.success('Pathao connection saved');
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not save Pathao connection'); }
    finally { setPathaoBusy(false); }
  };

  const generatePathaoWebhookSecret = () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    setPathaoWebhookSecret(Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(''));
  };

  const refreshPathaoEvents = async () => {
    try {
      const { data } = await api.get('/couriers/pathao/events?limit=12');
      setPathaoEvents(data.events || []);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not load Pathao events'); }
  };

  const loadPathaoStores = async () => {
    setPathaoBusy(true);
    try {
      const response = await api.get('/couriers/pathao/stores');
      setPathaoStores(response.data.data || []);
      if (!response.data.data?.length) toast.error('No Pathao stores found for this merchant');
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not load Pathao stores'); }
    finally { setPathaoBusy(false); }
  };

  const openPathaoStoreForm = async () => {
    setShowNewPathaoStore(true);
    try { const response = await api.get('/couriers/pathao/locations?type=cities'); setPathaoCities(response.data.data || []); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Save Pathao credentials before loading cities'); }
  };

  const changePathaoStoreCity = async (cityId: string) => {
    setNewPathaoStore((current) => ({ ...current, city_id: cityId, zone_id: '', area_id: '' })); setPathaoZones([]); setPathaoAreas([]);
    if (!cityId) return;
    try { const response = await api.get(`/couriers/pathao/locations?type=zones&parentId=${cityId}`); setPathaoZones(response.data.data || []); }
    catch { toast.error('Could not load Pathao zones'); }
  };

  const changePathaoStoreZone = async (zoneId: string) => {
    setNewPathaoStore((current) => ({ ...current, zone_id: zoneId, area_id: '' })); setPathaoAreas([]);
    if (!zoneId) return;
    try { const response = await api.get(`/couriers/pathao/locations?type=areas&parentId=${zoneId}`); setPathaoAreas(response.data.data || []); }
    catch { toast.error('Could not load Pathao areas'); }
  };

  const createNewPathaoStore = async () => {
    setPathaoBusy(true);
    try {
      const response = await api.post('/couriers/pathao/stores', { ...newPathaoStore, secondary_contact: newPathaoStore.secondary_contact || undefined, otp_number: newPathaoStore.otp_number || undefined, city_id: Number(newPathaoStore.city_id), zone_id: Number(newPathaoStore.zone_id), area_id: Number(newPathaoStore.area_id) });
      toast.success(response.data.message || 'Store submitted to Pathao for approval');
      setShowNewPathaoStore(false);
      await loadPathaoStores();
    } catch (error: any) { toast.error(error.response?.data?.message || 'Could not create Pathao store'); }
    finally { setPathaoBusy(false); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/users', {
        name: userName,
        email: userEmail,
        password: userPassword,
        role: userRole,
      });
      if (res.data?.success) {
        toast.success('New user created!');
        setIsAddUserOpen(false);
        fetchSettings();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await api.put(`/auth/users/${editingUser.id}`, { name: userName, role: userRole, status: editingStatus, ...(userPassword ? { password: userPassword } : {}) });
      toast.success('Staff user updated. Previous sessions have been revoked.');
      setEditingUser(null);
      setUserPassword('');
      await fetchSettings();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to update user'); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('New passwords do not match'); return; }
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed. Please sign in again.');
      window.location.href = '/login';
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not change password');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          {sectionDetails[section].title}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {sectionDetails[section].description}
        </p>
      </div>



      {section === 'payments' && <form className="bg-white dark:bg-slate-900 border border-slate-100/90 dark:border-slate-800 rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] max-w-2xl space-y-5" onSubmit={async (event) => {
        event.preventDefault(); setSavingPayment(true);
        try {
          const response = await api.put('/storefront/payment/config', { enabled: payment.enabled, baseUrl: payment.baseUrl, ...(payment.apiKey ? { apiKey: payment.apiKey } : {}) });
          setPayment({ ...response.data.payment, apiKey: '' }); toast.success('Payment settings saved');
        } catch (error: any) { toast.error(error.response?.data?.message || 'Could not save payment settings'); }
        finally { setSavingPayment(false); }
      }}>
        <div><h2 className="text-base font-bold text-slate-900 dark:text-white">UddoktaPay checkout</h2><p className="text-xs text-slate-500 mt-1">API key is encrypted on the server and never returned to the browser. Only completed payments verified by UddoktaPay mark orders paid.</p></div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Gateway URL<input required type="url" placeholder="https://perfektion.paymently.io/api" value={payment.baseUrl} onChange={(event) => setPayment({ ...payment, baseUrl: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm" /><span className="mt-1 block font-normal text-slate-500">Root URL or URL ending in /api; saved as the installation root automatically.</span></label>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">API key {payment.hasApiKey && <span className="font-normal text-emerald-600">(saved)</span>}<SecretInput autoComplete="new-password" placeholder={payment.hasApiKey ? 'Leave blank to keep existing key' : 'Enter API key'} value={payment.apiKey} onChange={(event) => setPayment({ ...payment, apiKey: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm" /></label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200"><input type="checkbox" checked={payment.enabled} onChange={(event) => setPayment({ ...payment, enabled: event.target.checked })} />Enable online payments</label>
        <p className="text-xs text-slate-500">Use sandbox first. Production needs HTTPS STOREFRONT_URL and PUBLIC_API_URL on the server so redirects and webhooks can reach this store.</p>
        <button disabled={savingPayment} className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-5 py-2.5 text-sm font-bold shadow transition disabled:opacity-50">{savingPayment ? 'Saving…' : 'Save payment settings'}</button>
      </form>}

      {/* WooCommerce Tab */}
      {section === 'woocommerce' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100/90 dark:border-slate-800 rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] max-w-2xl space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">WooCommerce Store Connection</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                REST API Consumer Key and Consumer Secret for live 2-way sync.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestWooConnection}
              disabled={testingWoo}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-500/30 transition-all disabled:opacity-50"
            >
              {testingWoo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Test Connection
            </button>
          </div>

          {wooTestResult && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold">Live Connection Verified</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Store: {wooTestResult.storeName} • Currency: {wooTestResult.currency || 'BDT'}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveWoo} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Store Name</label>
              <input
                type="text"
                value={wooStoreName}
                onChange={(e) => setWooStoreName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Store URL</label>
              <input
                type="text"
                value={wooStoreUrl}
                onChange={(e) => setWooStoreUrl(e.target.value)}
                placeholder="https://nix.bd"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Consumer Key (ck_...)</label>
                <SecretInput
                  value={wooKey}
                  onChange={(e) => setWooKey(e.target.value)}
                  placeholder="ck_..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Consumer Secret (cs_...)</label>
                <SecretInput
                  value={wooSecret}
                  onChange={(e) => setWooSecret(e.target.value)}
                  placeholder="cs_..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Webhook URL:</span>
              <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300 select-all bg-white dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800">
                http://localhost:5000/api/woocommerce/webhook
              </p>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Webhook Secret</label>
              <SecretInput
                value={wooWebhookSecret}
                onChange={(e) => setWooWebhookSecret(e.target.value)}
                placeholder="Use the same secret in WooCommerce webhook settings"
                autoComplete="new-password"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-slate-100 font-mono"
              />
              <p className="mt-1 text-[11px] text-slate-500">Required to verify that incoming orders are genuinely sent by WooCommerce.</p>
            </div>

            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 font-semibold rounded-xl shadow transition"
            >
              Save WooCommerce Settings
            </button>
          </form>
        </div>
      )}

      {/* Courier API Keys Tab */}
      {section === 'couriers' && (
        <div className="space-y-4 max-w-3xl">
          {/* Steadfast */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-card space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Steadfast Courier API Keys
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">API Key</label>
                <SecretInput
                  value={sfApiKey}
                  onChange={(e) => setSfApiKey(e.target.value)}
                  loadSavedSecret={() => revealCourierSecret('STEADFAST', 'apiKey')}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Secret Key</label>
                <SecretInput
                  value={sfSecretKey}
                  onChange={(e) => setSfSecretKey(e.target.value)}
                  loadSavedSecret={() => revealCourierSecret('STEADFAST', 'secretKey')}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={sfEnabled} onChange={(e) => setSfEnabled(e.target.checked)}/> Enable Steadfast dispatch</label>
              <p className="text-slate-500">API endpoint: https://portal.packzy.com/api/v1. Credentials stay encrypted on the server.</p>
              <label className="block text-slate-700 dark:text-slate-300">Webhook authentication token<SecretInput autoComplete="new-password" value={sfWebhookSecret} onChange={(e) => setSfWebhookSecret(e.target.value)} loadSavedSecret={() => revealCourierSecret('STEADFAST', 'webhookSecret')} placeholder="Same Bearer token configured in Steadfast" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono dark:border-slate-800 dark:bg-slate-950"/></label>
              <div className="flex flex-wrap gap-2"><button type="button" onClick={generateSteadfastWebhookToken} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold dark:border-slate-700">Generate token</button><button type="button" disabled={sfBusy} onClick={saveSteadfast} className="rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white disabled:opacity-50">Save Steadfast</button><button type="button" disabled={sfBusy} onClick={testSteadfast} className="rounded-lg border border-emerald-300 px-3 py-2 font-bold text-emerald-700 disabled:opacity-50">Test connection</button></div>
              <p className="break-all text-slate-500">Webhook URL: {sfWebhookUrl || 'Set PUBLIC_API_URL on the server'}</p>
              {!sfWebhookPublic && <p className="font-semibold text-amber-700">Localhost is not reachable by Steadfast. Configure a public HTTPS PUBLIC_API_URL for live webhook updates.</p>}
              <p className="text-slate-500">Save the token, then register this URL and the same token in your Steadfast merchant panel. Never paste your API secret into the webhook token field.</p>
            </div>
          </div>

          {/* Pathao */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-card space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Truck className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              Pathao Courier
            </h3>
            <p className="text-xs text-slate-500">Save merchant credentials, load your approved stores, then select a pickup store and enable dispatch.</p>
            <label className="block text-xs text-slate-700 dark:text-slate-300">Environment
              <select value={pathaoBaseUrl} onChange={(e) => { setPathaoBaseUrl(e.target.value); setPathaoStores([]); setPathaoStoreId(''); setPathaoEnabled(false); }} className="mt-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100">
                <option value="https://api-hermes.pathao.com">Live</option>
                <option value="https://courier-api-sandbox.pathao.com">Sandbox</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Client ID</label>
                <input
                  type="text"
                  value={pathaoClientId}
                  onChange={(e) => setPathaoClientId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Client Secret</label>
                <SecretInput
                  value={pathaoClientSecret}
                  onChange={(e) => setPathaoClientSecret(e.target.value)}
                  loadSavedSecret={() => revealCourierSecret('PATHAO', 'clientSecret')}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Merchant email</label>
                <input type="email" value={pathaoUsername} onChange={(e) => setPathaoUsername(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Merchant password</label>
                <SecretInput autoComplete="new-password" value={pathaoPassword} onChange={(e) => setPathaoPassword(e.target.value)} loadSavedSecret={() => revealCourierSecret('PATHAO', 'password')} placeholder="Merchant panel password" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100" />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[220px] flex-1 text-xs text-slate-700 dark:text-slate-300">Pickup store
                <select value={pathaoStoreId} onChange={(e) => setPathaoStoreId(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100">
                  <option value="">Select an approved store</option>
                  {pathaoStoreId && !pathaoStores.some((store) => String(store.store_id) === pathaoStoreId) && <option value={pathaoStoreId}>Current store #{pathaoStoreId}</option>}
                  {pathaoStores.filter((store) => Number(store.is_active) === 1).map((store) => <option key={store.store_id} value={store.store_id}>{store.store_name} (#{store.store_id})</option>)}
                </select>
              </label>
              <button type="button" disabled={pathaoBusy} onClick={loadPathaoStores} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold dark:border-slate-700">Load stores</button>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300"><input type="checkbox" checked={pathaoEnabled} onChange={(e) => setPathaoEnabled(e.target.checked)} />Enable Pathao dispatch</label>
            <button type="button" disabled={pathaoBusy} onClick={savePathao} className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50">{pathaoBusy ? 'Working…' : 'Save Pathao connection'}</button>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pathao webhook</h4>
              <p className="text-xs text-slate-500">Register this callback URL in the Pathao merchant panel for order, payment, return, and store events.</p>
              <div className="flex items-center gap-2"><div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs break-all dark:border-slate-800 dark:bg-slate-900">{pathaoWebhookUrl || 'Loading webhook URL…'}</div><button type="button" disabled={!pathaoWebhookUrl} onClick={() => navigator.clipboard.writeText(pathaoWebhookUrl).then(() => toast.success('Webhook URL copied'))} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700 disabled:opacity-50">Copy</button></div>
              {!pathaoWebhookPublic && <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Pathao cannot call localhost. Set PUBLIC_API_URL to a public HTTPS address before enabling live webhooks.</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-700 dark:text-slate-300">X-PATHAO-Signature shared secret
                  <SecretInput autoComplete="new-password" value={pathaoWebhookSecret} onChange={(event) => setPathaoWebhookSecret(event.target.value)} loadSavedSecret={() => revealCourierSecret('PATHAO', 'webhookSecret')} placeholder="Use the same value in Pathao" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono dark:border-slate-800 dark:bg-slate-900" />
                </label>
                <label className="text-xs text-slate-700 dark:text-slate-300">Pathao integration verification value
                  <SecretInput autoComplete="new-password" value={pathaoVerificationSecret} onChange={(event) => setPathaoVerificationSecret(event.target.value)} loadSavedSecret={() => revealCourierSecret('PATHAO', 'webhookVerificationSecret')} placeholder="Value supplied by Pathao" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono dark:border-slate-800 dark:bg-slate-900" />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={generatePathaoWebhookSecret} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700">Generate signature secret</button>
                <button type="button" disabled={!pathaoWebhookSecret || pathaoWebhookSecret === '••••••••'} onClick={() => navigator.clipboard.writeText(pathaoWebhookSecret).then(() => toast.success('Signature secret copied'))} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700 disabled:opacity-50">Copy new secret</button>
                <button type="button" disabled={pathaoBusy} onClick={savePathao} className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50">Save webhook settings</button>
              </div>
              <p className="text-xs text-slate-500">The signature secret authenticates incoming events. The separate verification value is returned in the X-Pathao-Merchant-Webhook-Integration-Secret response header during Pathao’s URL test.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-bold">Recent Pathao events</h4><button type="button" onClick={refreshPathaoEvents} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">Refresh</button></div>
              {pathaoEvents.length ? <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800">{pathaoEvents.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="font-semibold">{event.event}</span><span className="text-slate-500">{event.merchantOrderId || event.consignmentId || 'Store event'} · {new Date(event.occurredAt).toLocaleString()}</span><span className={event.applied ? 'text-emerald-600' : 'text-amber-600'}>{event.applied ? 'Applied' : 'Recorded'}</span></div>)}</div> : <p className="mt-2 text-xs text-slate-500">No webhook events received yet.</p>}
            </div>
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <button type="button" onClick={showNewPathaoStore ? () => setShowNewPathaoStore(false) : openPathaoStoreForm} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">{showNewPathaoStore ? 'Close new store form' : 'Create a new Pathao store'}</button>
              {showNewPathaoStore && <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                {(['name', 'contact_name', 'contact_number', 'secondary_contact', 'otp_number', 'address'] as const).map((field) => <label key={field} className="block text-slate-700 dark:text-slate-300">{{ name: 'Store name', contact_name: 'Contact name', contact_number: 'Contact phone', secondary_contact: 'Secondary phone (optional)', otp_number: 'OTP phone (optional)', address: 'Pickup address' }[field]}<input value={newPathaoStore[field]} onChange={(event) => setNewPathaoStore({ ...newPathaoStore, [field]: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950" /></label>)}
                <label className="text-slate-700 dark:text-slate-300">City<select value={newPathaoStore.city_id} onChange={(event) => changePathaoStoreCity(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"><option value="">Select city</option>{pathaoCities.map((city) => <option key={city.city_id} value={city.city_id}>{city.city_name}</option>)}</select></label>
                <label className="text-slate-700 dark:text-slate-300">Zone<select value={newPathaoStore.zone_id} disabled={!newPathaoStore.city_id} onChange={(event) => changePathaoStoreZone(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"><option value="">Select zone</option>{pathaoZones.map((zone) => <option key={zone.zone_id} value={zone.zone_id}>{zone.zone_name}</option>)}</select></label>
                <label className="text-slate-700 dark:text-slate-300">Area<select value={newPathaoStore.area_id} disabled={!newPathaoStore.zone_id} onChange={(event) => setNewPathaoStore({ ...newPathaoStore, area_id: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"><option value="">Select area</option>{pathaoAreas.map((area) => <option key={area.area_id} value={area.area_id}>{area.area_name}</option>)}</select></label>
                <div className="flex items-end"><button type="button" disabled={pathaoBusy} onClick={createNewPathaoStore} className="rounded-xl border border-emerald-300 px-4 py-2 font-bold text-emerald-700 dark:border-emerald-600 dark:text-emerald-300 disabled:opacity-50">Submit store to Pathao</button></div>
              </div>}
            </div>
          </div>

          {/* RedX */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-card space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Truck className="w-4 h-4 text-red-600 dark:text-red-400" />
              RedX OpenAPI
            </h3>
            <label className="block text-xs text-slate-700 dark:text-slate-300">Environment
              <select value={redxBaseUrl} onChange={e => setRedxBaseUrl(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
                <option value="https://sandbox.redx.com.bd/v1.0.0-beta">Sandbox — simulated parcels</option>
                <option value="https://openapi.redx.com.bd/v1.0.0-beta">Production — live parcels</option>
              </select>
            </label>
            <div className="text-xs">
              <label className="block text-slate-700 dark:text-slate-300 mb-1">Token for selected environment</label>
              <SecretInput
                value={redxApiKey}
                onChange={(e) => setRedxApiKey(e.target.value)}
                loadSavedSecret={() => revealCourierSecret('REDX', 'apiKey')}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300"><input type="checkbox" checked={redxEnabled} onChange={e => setRedxEnabled(e.target.checked)} /> Enable RedX dispatch</label>
            <div className="space-y-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
              <p className="font-medium">Status callback</p>
              <p className="break-all font-mono text-slate-500">{redxWebhookUrl || 'Loading callback URL…'}</p>
              {redxWebhookUrlWithToken && <button type="button" onClick={() => navigator.clipboard.writeText(redxWebhookUrlWithToken).then(() => toast.success('RedX callback URL copied'))} className="rounded-lg border border-slate-300 px-3 py-1.5 dark:border-slate-700">Copy callback URL with token</button>}
              {!redxWebhookPublic && <p className="text-amber-700">RedX cannot reach localhost. Set PUBLIC_API_URL to public HTTPS before using live callbacks.</p>}
              <label className="block">Callback token (at least 32 characters)
                <SecretInput value={redxWebhookSecret} onChange={e => setRedxWebhookSecret(e.target.value)} loadSavedSecret={() => revealCourierSecret('REDX', 'webhookSecret')} placeholder="Generate or paste a separate callback token" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950" />
              </label>
              <button type="button" onClick={() => setRedxWebhookSecret(Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join(''))} className="rounded-lg border border-slate-300 px-3 py-1.5 dark:border-slate-700">Generate token</button>
              <p className="text-slate-500">In the RedX dashboard, set the callback URL above with <code>?token=YOUR_CALLBACK_TOKEN</code>. Save the same token here. Keep it separate from the API token.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2"><button
            type="button"
            onClick={handleSaveCourierKeys}
            disabled={redxBusy}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 font-semibold text-xs rounded-xl shadow transition-colors"
          >
            Save RedX Settings
          </button><button type="button" disabled={redxBusy} onClick={testRedx} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium disabled:opacity-50 dark:border-slate-700">Test connection</button><button type="button" disabled={redxBusy} onClick={syncRedxAreas} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium disabled:opacity-50 dark:border-slate-700">Sync RedX areas</button></div>
        </div>
      )}

      {/* Staff Users Tab */}
      {section === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Staff Users & Roles</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Manage user accounts and permissions.</p>
            </div>
            {currentUser?.role === 'SUPER_ADMIN' && <button
              onClick={() => setIsAddUserOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 text-xs font-semibold rounded-xl shadow transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Staff User
            </button>}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-card">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Status</th>
                  {currentUser?.role === 'SUPER_ADMIN' && <th className="py-3 px-3">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-200">{u.name}</td>
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400">{u.email}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{u.role}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20' : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'}`}>
                        {u.status}
                      </span>
                    </td>
                    {currentUser?.role === 'SUPER_ADMIN' && <td className="py-3 px-3"><button type="button" disabled={u.id === currentUser.id} onClick={() => { setEditingUser(u); setUserName(u.name); setUserEmail(u.email); setUserRole(u.role); setEditingStatus(u.status); setUserPassword(''); }} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Edit</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {section === 'audit' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Activity Audit Log</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Record of order changes, courier dispatch, and transactions.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-card">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Entity</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{log.userName || 'System'}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">{log.action}</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{log.entity}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {log.details || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === 'security' && (
        <form onSubmit={handleChangePassword} className="max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-card space-y-4 text-xs">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Change your password</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Use at least 10 characters with uppercase, lowercase, and a number. All current sessions are invalidated after signing out.</p>
          </div>
          <label className="block text-slate-700 dark:text-slate-300 font-semibold">Current password
            <input type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2" />
          </label>
          <label className="block text-slate-700 dark:text-slate-300 font-semibold">New password
            <input type="password" required minLength={10} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2" />
          </label>
          <label className="block text-slate-700 dark:text-slate-300 font-semibold">Confirm new password
            <input type="password" required minLength={10} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2" />
          </label>
          <button type="submit" className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 font-semibold rounded-xl shadow transition-colors">Update password</button>
        </form>
      )}

      {/* Add User Modal */}
      {(isAddUserOpen || editingUser) && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{editingUser ? 'Edit Staff User' : 'Create Staff User'}</h3>
              <button onClick={() => { setIsAddUserOpen(false); setEditingUser(null); }} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Email *</label>
                <input
                  type="email"
                  required
                  disabled={Boolean(editingUser)}
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">{editingUser ? 'New password (optional)' : 'Password *'}</label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={10}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Assigned Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="CALL_CENTER_AGENT">Call Center / Order Agent</option>
                  <option value="OPERATIONS_MANAGER">Operations Manager</option>
                  <option value="ACCOUNTANT">Accountant</option>
                  <option value="INVENTORY_MANAGER">Inventory Manager</option>
                  <option value="DISPATCHER">Dispatcher</option>
                  <option value="SUPER_ADMIN">Super Administrator</option>
                </select>
              </div>
              {editingUser && <div><label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Account status</label><select value={editingStatus} onChange={(e) => setEditingStatus(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="INACTIVE">Inactive</option></select></div>}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsAddUserOpen(false); setEditingUser(null); }}
                  className="px-4 py-2 text-slate-500 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 font-semibold rounded-xl shadow transition-colors"
                >
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
