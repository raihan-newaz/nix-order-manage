import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageTemplate } from '../types';
import api from '../lib/api';
import {
  MessageSquare,
  Send,
  Radio,
  Edit2,
  Loader2,
  FileCode,
} from 'lucide-react';
import toast from 'react-hot-toast';
import SecretInput from '../components/SecretInput';

export const MessagingPage: React.FC = () => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Baileys config
  const [baileysUrl, setBaileysUrl] = useState('http://localhost:8000');
  const [baileysApiKey, setBaileysApiKey] = useState('');
  const [baileysEnabled, setBaileysEnabled] = useState(true);
  const [greenToken, setGreenToken] = useState('');
  const [greenEnabled, setGreenEnabled] = useState(false);
  const [savingGreen, setSavingGreen] = useState(false);
  const [greenStats, setGreenStats] = useState<Record<string, string | null> | null>(null);
  const [greenStatsError, setGreenStatsError] = useState('');
  const [greenStatsLoading, setGreenStatsLoading] = useState(false);
  const [statsMonth, setStatsMonth] = useState('');

  // Direct test message
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('NIX: SMS test.');
  const [testChannel, setTestChannel] = useState<'SMS' | 'WHATSAPP'>('SMS');
  const [sendingTest, setSendingTest] = useState(false);

  // Editing template
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [updatingTemplateIds, setUpdatingTemplateIds] = useState<string[]>([]);
  const greenTokenSaved = configs.some((config: any) => config.type === 'GREENWEB' && Boolean(config.apiKey));
  const loadGreenStats = async (month = statsMonth) => {
    setGreenStatsLoading(true); setGreenStatsError('');
    try {
      const formattedMonth = month ? `${month.slice(5, 7)}-${month.slice(0, 4)}` : undefined;
      const response = await api.get('/messaging/greensms/stats', { params: formattedMonth ? { month: formattedMonth } : {} });
      setGreenStats(response.data.stats);
    } catch (error: any) { setGreenStatsError(error.response?.data?.message || 'Could not load GreenSMS account data'); setGreenStats(null); }
    finally { setGreenStatsLoading(false); }
  };

  const fetchMessagingData = async () => {
    setLoading(true);
    try {
      const [tplRes, confRes, logRes] = await Promise.all([
        api.get('/messaging/templates'),
        api.get('/messaging/configs'),
        api.get('/messaging/logs'),
      ]);
      if (tplRes.data?.success) setTemplates(tplRes.data.templates);
      if (logRes.data?.success) setLogs(logRes.data.logs || []);
      if (confRes.data?.success) {
        setConfigs(confRes.data.configs);
        const b = confRes.data.configs.find((c: any) => c.type === 'WHATSAPP_BAILEYS');
        if (b) {
          setBaileysUrl(b.apiUrl || 'http://localhost:8000');
          setBaileysApiKey(b.apiKey || '');
          setBaileysEnabled(b.isEnabled);
        }
        const green = confRes.data.configs.find((c: any) => c.type === 'GREENWEB');
        if (green) { setGreenToken(green.apiKey || ''); setGreenEnabled(Boolean(green.isEnabled)); }
      }
    } catch (e) {
      toast.error('Failed to load messaging settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessagingData();
  }, []);
  useEffect(() => { if (greenTokenSaved) loadGreenStats(); }, [greenTokenSaved]);

  const handleSaveBaileysConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.put('/messaging/configs/WHATSAPP_BAILEYS', {
        apiUrl: baileysUrl,
        apiKey: baileysApiKey,
        isEnabled: baileysEnabled,
      });
      if (res.data?.success) {
        toast.success('WhatsApp Baileys configuration saved!');
        fetchMessagingData();
      }
    } catch (e: any) {
      toast.error('Failed to save configuration');
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    try {
      const res = await api.post('/messaging/send', {
        recipient: testPhone,
        message: testMessage,
        channel: testChannel,
      });
      if (res.data?.success) {
        toast.success(`${testChannel} accepted by gateway`);
        fetchMessagingData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Send test failed');
    } finally {
      setSendingTest(false);
    }
  };

  const saveGreen = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingGreen(true);
    try { await api.put('/messaging/configs/GREENWEB', { apiKey: greenToken, isEnabled: greenEnabled, isDefault: true }); toast.success('GreenSMS settings saved'); await fetchMessagingData(); await loadGreenStats(); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not save GreenSMS settings'); }
    finally { setSavingGreen(false); }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    try {
      const res = await api.put(`/messaging/templates/${editingTemplate.id}`, {
        name: editingTemplate.name,
        body: editingTemplate.body,
        channel: editingTemplate.channel,
        isActive: editingTemplate.isActive,
      });
      if (res.data?.success) {
        toast.success('Template updated!');
        setEditingTemplate(null);
        fetchMessagingData();
      }
    } catch (e) {
      toast.error('Failed to update template');
    }
  };

  const toggleTemplate = async (template: MessageTemplate) => {
    if (updatingTemplateIds.includes(template.id)) return;
    const isActive = !template.isActive;
    setUpdatingTemplateIds(current => [...current, template.id]);
    try {
      await api.put(`/messaging/templates/${template.id}`, {
        name: template.name,
        body: template.body,
        channel: template.channel,
        isActive,
      });
      setTemplates(current => current.map(item => item.id === template.id ? { ...item, isActive } : item));
      toast.success(`${template.name} ${isActive ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not update template status');
    } finally {
      setUpdatingTemplateIds(current => current.filter(id => id !== template.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            WhatsApp & SMS
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            GreenSMS, WhatsApp and editable order notifications
          </p>
        </div>
        <button type="button" onClick={() => document.getElementById('message-templates')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <Edit2 className="h-3.5 w-3.5" /> Edit templates
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* WhatsApp Baileys Settings */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">WhatsApp Baileys</h3>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">{baileysEnabled ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          </div>

          <form onSubmit={handleSaveBaileysConfig} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">API Endpoint URL</label>
              <input
                type="text"
                value={baileysUrl}
                onChange={(e) => setBaileysUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">API Secret Token</label>
              <SecretInput
                value={baileysApiKey}
                onChange={(e) => setBaileysApiKey(e.target.value)}
                placeholder="Optional Secret"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="enableBaileys"
                checked={baileysEnabled}
                onChange={(e) => setBaileysEnabled(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-800 text-emerald-600"
              />
              <label htmlFor="enableBaileys" className="text-slate-700 dark:text-slate-300 text-xs">
                Enable WhatsApp dispatch
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-sm"
            >
              Save Connection
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">GreenSMS (GreenWeb API)</h3>
          <p className="mt-1 text-xs text-slate-500">HTTPS JSON API. A real token is required before messages are sent.</p>
          <form onSubmit={saveGreen} className="mt-4 space-y-3 text-xs">
            <label className="block font-medium text-slate-700 dark:text-slate-300">API endpoint
              <input type="text" readOnly value="https://api.bdbulksms.net/api.php?json" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 font-mono text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300" />
            </label>
            <label className="block font-medium text-slate-700 dark:text-slate-300">API token
              <SecretInput value={greenToken} onChange={e => setGreenToken(e.target.value)} loadSavedSecret={async () => (await api.post('/messaging/configs/GREENWEB/reveal')).data.apiKey} placeholder={greenTokenSaved ? 'Token saved securely · enter only to replace' : 'Paste token from SMS panel'} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono dark:border-slate-800 dark:bg-slate-950" />
            </label>
            <p className="text-[11px] text-slate-500">{greenTokenSaved ? 'A token is saved encrypted in the database. Leave this blank to keep it; the secret is hidden after reload.' : 'No token saved yet.'}</p>
            <label className="flex items-center gap-2"><input type="checkbox" checked={greenEnabled} onChange={e => setGreenEnabled(e.target.checked)} /> Enable automated SMS</label>
            <button type="submit" disabled={savingGreen} className="w-full rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-emerald-600">Save GreenSMS settings</button>
          </form>
          <p className="mt-3 text-[11px] text-slate-500">Order stages can be turned off individually in the templates below.</p>
        </div>

        {/* Direct Send Console */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-card space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Send a test message
          </h3>

          <form onSubmit={handleSendTest} className="space-y-3 text-xs">
            <label className="block font-medium">Channel<select value={testChannel} onChange={e => setTestChannel(e.target.value as 'SMS' | 'WHATSAPP')} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950"><option value="SMS">GreenSMS</option><option value="WHATSAPP">WhatsApp</option></select></label>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Phone Number</label>
              <input
                type="text"
                required
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Message Content</label>
              <textarea
                rows={3}
                required
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={sendingTest}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 font-semibold rounded-xl shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Test Message
            </button>
          </form>
        </div>

        {/* Dynamic Tags */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-card space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
            <FileCode className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Dynamic Template Tags
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Placeholders for automated notifications:</p>
          <div className="space-y-1.5 text-xs">
            <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg flex justify-between border border-slate-100 dark:border-slate-800">
              <code className="text-emerald-600 dark:text-emerald-400 font-bold">{'{customer_name}'}</code>
              <span className="text-slate-500">Customer Name</span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg flex justify-between border border-slate-100 dark:border-slate-800">
              <code className="text-emerald-600 dark:text-emerald-400 font-bold">{'{order_number}'}</code>
              <span className="text-slate-500">Order Number</span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg flex justify-between border border-slate-100 dark:border-slate-800">
              <code className="text-emerald-600 dark:text-emerald-400 font-bold">{'{tracking_code}'}</code>
              <span className="text-slate-500">Courier Tracking</span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg flex justify-between border border-slate-100 dark:border-slate-800">
              <code className="text-emerald-600 dark:text-emerald-400 font-bold">{'{grand_total}'}</code>
              <span className="text-slate-500">Total BDT</span>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">GreenSMS account data</h2><p className="mt-1 text-xs text-slate-500">Live balance, rate, validity and send counts from the provider. Your token is never shown here.</p></div><div className="flex items-end gap-2"><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Usage month<input type="month" value={statsMonth} onChange={(event) => setStatsMonth(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950" /></label><button type="button" disabled={!greenTokenSaved || greenStatsLoading} onClick={() => loadGreenStats()} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{greenStatsLoading ? 'Loading…' : 'Refresh data'}</button></div></div>
        {!greenTokenSaved ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950">Save a GreenSMS token above to view provider data.</p> : greenStatsError ? <p className="mt-4 rounded-lg bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/30">{greenStatsError}</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([
          ['balance', 'SMS balance'], ['rate', 'Rate per SMS'], ['expiry', 'Validity'], ['tokensms', 'Total sent by token'], ['totalsms', 'Total sent by account'], ['tokenmonthlysms', 'Token sends in month'], ['monthlysms', 'Account sends in month'],
        ] as const).map(([key, label]) => <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"><span className="text-xs text-slate-500">{label}</span><p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{greenStats?.[key] ?? (greenStatsLoading ? 'Loading…' : '—')}</p></div>)}</div>}
        <p className="mt-3 text-xs text-slate-500">Monthly figures use the selected month; without a selection the provider returns the current month. Values are reported by GreenSMS, not calculated from local message logs.</p>
      </section>

      {/* Templates */}
      <div id="message-templates" className="scroll-mt-4 bg-white dark:bg-slate-900 border border-slate-100/90 dark:border-slate-800 rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-4">
        <div><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Message Templates</h2><p className="text-xs text-slate-500">Each stage has its own editable message and on/off switch.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div key={tpl.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {tpl.eventTrigger}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{tpl.channel}</span>
                    <button type="button" role="switch" aria-checked={tpl.isActive} aria-label={`${tpl.isActive ? 'Turn off' : 'Turn on'} ${tpl.name}`} disabled={updatingTemplateIds.includes(tpl.id)} onClick={() => toggleTemplate(tpl)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${tpl.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${tpl.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className={`w-7 text-[11px] font-semibold ${tpl.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>{tpl.isActive ? 'On' : 'Off'}</span>
                  </div>
                </div>
                <h4 className="font-bold text-slate-900 dark:text-slate-200 text-sm">{tpl.name}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-4 leading-relaxed bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  {tpl.body}
                </p>
              </div>

              <button
                onClick={() => setEditingTemplate(tpl)}
                className="w-full py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
              Edit message & switch
              </button>
            </div>
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold">Recent message attempts</h2>
        <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {logs.slice(0, 30).map(log => <div key={log.id} className="grid gap-1 py-2 text-xs sm:grid-cols-[120px_130px_1fr_90px] sm:items-center">
            <span className={log.status === 'SENT' ? 'text-emerald-700' : 'text-amber-700'}>{log.channel} · {log.status}</span>
            <span>{log.recipient}</span>
            <span className="truncate text-slate-600 dark:text-slate-400" title={log.body}>{log.eventTrigger || 'Manual'} · {log.body}{log.errorMessage ? ` · ${log.errorMessage}` : ''}</span>
            <span className="text-slate-400">{new Date(log.createdAt).toLocaleDateString()}</span>
          </div>)}
          {!logs.length && <p className="py-3 text-xs text-slate-500">No messages attempted yet.</p>}
        </div>
      </section>

      {/* Edit Template Modal */}
      {editingTemplate && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingTemplate(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-message-template-title" className="my-auto max-h-[min(90dvh,760px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 id="edit-message-template-title" className="font-bold text-base text-slate-900 dark:text-slate-100">Edit Template: {editingTemplate.name}</h3>
              <button type="button" aria-label="Close editor" onClick={() => setEditingTemplate(null)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveTemplate} className="space-y-3 text-xs">
              <label className="block font-medium">Name<input value={editingTemplate.name} onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950" /></label>
              <label className="block font-medium">Channel<select value={editingTemplate.channel} onChange={e => setEditingTemplate({ ...editingTemplate, channel: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950"><option value="SMS">SMS</option><option value="WHATSAPP">WhatsApp</option><option value="BOTH">Both</option></select></label>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Message Body</label>
                <textarea
                  rows={5}
                  value={editingTemplate.body}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 leading-relaxed font-sans text-xs focus:border-emerald-500 outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">{editingTemplate.body.length} characters · SMS over 160 English or 70 Bangla characters may cost multiple segments.</p>
              </div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={editingTemplate.isActive} onChange={e => setEditingTemplate({ ...editingTemplate, isActive: e.target.checked })} /> Enable this message</label>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2 text-slate-500 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 font-semibold rounded-xl shadow transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
