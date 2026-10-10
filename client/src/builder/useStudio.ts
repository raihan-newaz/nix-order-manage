import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import api from '../lib/api';
import { applyCommand, undo, redo, type EditorHistory, type Command, type PageDocument, migrateDocument } from './core';

export type Permissions = { access: boolean; edit: boolean; publish: boolean; templates: boolean; submissions: boolean };
export const errorMessage = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : 'Something went wrong';
export function downloadDocument(document: PageDocument) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'nix-studio', version: 1, document }, null, 2)], { type: 'application/json' }));
  const link = window.document.createElement('a'); link.href = url; link.download = `${document.slug}.studio.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function useStudio(id: string | undefined) {
  const [history, setHistory] = useState<EditorHistory | null>(null);
  const [siteName, setSiteName] = useState('');
  const [sitePhone, setSitePhone] = useState('');
  const [permissions, setPermissions] = useState<Permissions>({ access: false, edit: false, publish: false, templates: false, submissions: false });
  const [status, setStatus] = useState('Loading'); const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false); const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const version = useRef(0); const current = useRef(history); current.current = history;
  const saved = useRef(''); const pending = useRef<Promise<void> | null>(null); const stopped = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [page, access, context] = await Promise.all([api.get(`/builder/pages/${id}`), api.get('/builder/capabilities'), api.get('/builder/context')]);
      if (!mounted.current) return;
      const document = migrateDocument(page.data.document);
      version.current = page.data.version; saved.current = JSON.stringify(document);
      setHistory({ present: document, past: [], future: [] }); setPermissions(access.data.permissions);
      setSiteName(context.data.siteName);
      setSitePhone(context.data.sitePhone || '');
      setPublishedVersion(page.data.publishedVersion); setConflict(false); stopped.current = false; setError(''); setStatus('Saved');
    } catch (e) { setError(errorMessage(e)); setStatus('Unable to load'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const command = useCallback((cmd: Command, group?: string) => {
    if (!permissions.edit) return;
    try {
      if (!current.current) return;
      const next = applyCommand(current.current, cmd, group); current.current = next; setHistory(next); setStatus('Unsaved'); setError('');
    } catch (e) { setError(errorMessage(e)); }
  }, [permissions.edit]);
  const travel = (direction: 'undo' | 'redo') => {
    if (!permissions.edit || !current.current) return;
    const next = direction === 'undo' ? undo(current.current) : redo(current.current);
    current.current = next; setHistory(next); setStatus('Unsaved');
  };
  const save = useCallback(async () => {
    if (pending.current) await pending.current;
    if (!current.current || !id || stopped.current || !permissions.edit) return;
    const document = current.current.present; const serialized = JSON.stringify(document);
    if (saved.current === serialized) return;
    const operation = (async () => {
      setStatus('Saving');
      try {
        const result = await api.put(`/builder/pages/${id}/draft`, { document, baseVersion: version.current });
        version.current = result.data.version; saved.current = serialized;
        if (mounted.current) { setStatus(JSON.stringify(current.current?.present) === serialized ? 'Saved' : 'Unsaved'); setError(''); }
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 409) { stopped.current = true; setConflict(true); }
        setError(errorMessage(e)); setStatus('Save failed'); throw e;
      }
    })();
    pending.current = operation;
    try { await operation; } finally { pending.current = null; }
  }, [id, permissions.edit]);
  useEffect(() => {
    if (!history || !permissions.edit || conflict) return;
    const timer = setTimeout(() => { void save().catch(() => {}); }, 1200);
    return () => clearTimeout(timer);
  }, [history, save, permissions.edit, conflict]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (JSON.stringify(current.current?.present) !== saved.current && current.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, []);
  const publish = async (action: 'publish' | 'unpublish' = 'publish') => {
    try {
      await save(); if (stopped.current || !permissions.publish) return false;
      const result = await api.post(`/builder/pages/${id}/${action}`, { baseVersion: version.current });
      version.current = result.data.version; setPublishedVersion(result.data.publishedVersion); setStatus(action === 'publish' ? 'Published' : 'Unpublished');
      return true;
    } catch (e) { if (axios.isAxiosError(e) && e.response?.status === 409) { stopped.current = true; setConflict(true); } setError(errorMessage(e)); return false; }
  };
  const restore = async (revisionId: string) => {
    try {
      await save(); if (stopped.current) return;
      const result = await api.post(`/builder/pages/${id}/restore`, { revisionId, baseVersion: version.current });
      version.current = result.data.version; saved.current = JSON.stringify(result.data.document);
      setHistory({ present: result.data.document, past: [], future: [] }); setStatus('Revision restored as draft');
    } catch (e) { setError(errorMessage(e)); }
  };
  return { history, permissions, siteName, sitePhone, status, error, setError, conflict, publishedVersion, command, travel, save, publish, restore, load, version: version.current };
}
