import { useEffect, useState } from 'react';
import api from '../lib/api';
import { errorMessage } from './useStudio';

type Rule = { id: string; area: 'header' | 'footer'; pageId: string; include: string[]; exclude: string[]; priority: number };
type Theme = { schemaVersion: 1; rules: Rule[] };
type Page = { id: string; title: string; publishedVersion: number | null };
type Revision = { id: string; version: number; action: string; authorName: string; createdAt: string };

export function ThemePanel({ pages, canEdit }: { pages: Page[]; canEdit: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [version, setVersion] = useState(0);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [canPublish, setCanPublish] = useState(false);
  const [previewPageId, setPreviewPageId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = async () => {
    const [record, history, access] = await Promise.all([api.get('/builder/theme'), api.get('/builder/theme/revisions'), api.get('/builder/capabilities')]);
    setTheme(record.data.document); setVersion(record.data.version); setPublishedVersion(record.data.publishedVersion);
    setRevisions(history.data.revisions); setCanPublish(access.data.permissions.publish);
  };
  useEffect(() => { load().catch(error => setMessage(errorMessage(error))); }, []);
  const change = (id: string, patch: Partial<Rule>) => setTheme(current => current && ({ ...current, rules: current.rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule) }));
  const run = async (action: 'save' | 'publish' | 'restore', revisionId?: string) => {
    if (!theme) return; setBusy(true); setMessage('');
    try {
      const result = action === 'save' ? await api.put('/builder/theme/draft', { baseVersion: version, document: theme }) : action === 'publish' ? await api.post('/builder/theme/publish', { baseVersion: version }) : await api.post('/builder/theme/restore', { baseVersion: version, revisionId });
      setVersion(result.data.version); setPublishedVersion(result.data.publishedVersion); setTheme(result.data.document);
      setMessage(action === 'publish' ? 'Route rules published.' : action === 'restore' ? 'Revision restored to the draft.' : 'Draft rules saved.');
      const history = await api.get('/builder/theme/revisions'); setRevisions(history.data.revisions);
    } catch (error) { setMessage(errorMessage(error)); } finally { setBusy(false); }
  };
  if (!theme) return <p role="status">{message || 'Loading site templates…'}</p>;
  return <section className="studio-theme" aria-label="Site templates"><div className="studio-theme-heading"><div><h2>Site headers and footers</h2><p>Publish a page, then assign it to matching /b/ routes. Rules with higher priority win.</p></div><span>{publishedVersion ? `Published version ${publishedVersion}` : 'Draft only'}</span></div>
    {theme.rules.map(rule => <div className="studio-theme-rule" key={rule.id}><label>Region<select aria-label="Region" disabled={!canEdit} value={rule.area} onChange={event => change(rule.id, { area: event.target.value as Rule['area'] })}><option value="header">Header</option><option value="footer">Footer</option></select></label><label>Published page<select aria-label="Template page" disabled={!canEdit} value={rule.pageId} onChange={event => change(rule.id, { pageId: event.target.value })}><option value="">Select page</option>{pages.filter(page => page.publishedVersion || page.id === rule.pageId).map(page => <option key={page.id} value={page.id}>{page.title}{!page.publishedVersion ? ' (not published)' : ''}</option>)}</select></label><label>Include routes<input aria-label="Include routes" disabled={!canEdit} value={rule.include.join(', ')} onChange={event => change(rule.id, { include: event.target.value.split(',').map(value => value.trim()) })} placeholder="/b/*" /></label><label>Exclude routes<input aria-label="Exclude routes" disabled={!canEdit} value={rule.exclude.join(', ')} onChange={event => change(rule.id, { exclude: event.target.value ? event.target.value.split(',').map(value => value.trim()) : [] })} placeholder="/b/checkout" /></label><label>Priority<input aria-label="Rule priority" type="number" min={-100} max={100} disabled={!canEdit} value={rule.priority} onChange={event => change(rule.id, { priority: Number(event.target.value) })} /></label><button type="button" disabled={!canEdit} onClick={() => setTheme({ ...theme, rules: theme.rules.filter(item => item.id !== rule.id) })}>Remove</button></div>)}
    <div className="studio-theme-actions"><button type="button" disabled={!canEdit || !pages.some(page => page.publishedVersion)} onClick={() => { const page = pages.find(item => item.publishedVersion); if (page) setTheme({ ...theme, rules: [...theme.rules, { id: crypto.randomUUID(), area: 'header', pageId: page.id, include: ['/b/*'], exclude: [], priority: 0 }] }); }}>Add rule</button><button type="button" disabled={!canEdit || busy} onClick={() => run('save')}>Save draft</button><button type="button" disabled={!canPublish || busy} onClick={() => run('publish')}>Publish saved rules</button><select aria-label="Preview page" value={previewPageId} onChange={event => setPreviewPageId(event.target.value)}><option value="">Choose a preview page</option>{pages.map(page => <option key={page.id} value={page.id}>{page.title}</option>)}</select><a href={previewPageId ? `/api/builder/theme/preview/${previewPageId}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!previewPageId} onClick={event => { if (!previewPageId) event.preventDefault(); }}>Preview saved draft</a></div>
    {message && <p role="status">{message}</p>}
    <details><summary>Theme revisions</summary>{revisions.map(revision => <div key={revision.id}>v{revision.version} · {revision.action} · {revision.authorName} · {new Date(revision.createdAt).toLocaleString()} <button disabled={!canEdit || busy} onClick={() => run('restore', revision.id)}>Restore to draft</button></div>)}</details>
  </section>;
}
