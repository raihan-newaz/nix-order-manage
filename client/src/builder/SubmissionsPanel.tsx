import { useCallback, useEffect, useState } from 'react';
import api from '../lib/api';
import { errorMessage } from './useStudio';

type Submission = {
  id: string;
  formName: string;
  status: 'NEW' | 'REVIEWED' | 'SPAM';
  createdAt: string;
  updatedAt: string;
  values: Record<string, string>;
};

export function SubmissionsPanel({ pageId }: { pageId: string }) {
  const [rows, setRows] = useState<Submission[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const load = useCallback(async (nextCursor?: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get(`/builder/pages/${pageId}/submissions`, {
        params: { status: status || undefined, search: search || undefined, cursor: nextCursor }
      });
      setRows(current => (nextCursor ? [...current, ...result.data.submissions] : result.data.submissions));
      setCursor(result.data.nextCursor);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [pageId, status, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const changeStatus = async (row: Submission, newStatus: Submission['status']) => {
    try {
      await api.patch(`/builder/submissions/${row.id}`, { status: newStatus, updatedAt: row.updatedAt });
      await load();
    } catch (error) {
      setError(errorMessage(error));
    }
  };

  const query = new URLSearchParams({
    format: 'csv',
    ...(status ? { status } : {}),
    ...(search ? { search } : {})
  });

  return (
    <div className="elementor-panel-content">
      <div className="elementor-section-group">
        <div className="elementor-group-title">
          <span>Form Submissions</span>
        </div>
        <div className="elementor-group-content">
          <p style={{ fontSize: '11px', color: 'var(--e-text-muted, #71717a)', margin: '0 0 10px 0' }}>
            Responses collected from form widgets on this page.
          </p>

          <div className="elementor-control-row">
            <input
              className="elementor-control-input"
              aria-label="Search submissions"
              value={search}
              placeholder="Search by name, email, phone..."
              onChange={event => setSearch(event.target.value)}
            />
          </div>

          <div className="elementor-control-row">
            <label className="elementor-control-label">Filter Status</label>
            <select
              className="elementor-control-input"
              value={status}
              onChange={event => setStatus(event.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="NEW">NEW</option>
              <option value="REVIEWED">REVIEWED</option>
              <option value="SPAM">SPAM</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              className="elementor-btn"
              style={{ flex: 1, padding: '6px' }}
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <a
              className="elementor-btn"
              style={{
                flex: 1,
                padding: '6px',
                textAlign: 'center',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              href={`/api/builder/pages/${pageId}/submissions?${query}`}
              download
            >
              Export CSV
            </a>
          </div>

          {error && (
            <p role="alert" style={{ fontSize: '11px', color: '#ef4444', marginTop: '8px' }}>
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="elementor-section-group">
        <div className="elementor-group-title">
          <span>Entries ({rows.length})</span>
        </div>
        <div className="elementor-group-content">
          {loading && rows.length === 0 && (
            <p style={{ fontSize: '11px', color: 'var(--e-text-muted, #71717a)' }}>Loading entries...</p>
          )}
          {!loading && rows.length === 0 && (
            <p style={{ fontSize: '11px', color: 'var(--e-text-muted, #71717a)' }}>No submissions found.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rows.map(row => (
              <details
                key={row.id}
                style={{
                  border: '1px solid var(--e-border, #e4e4e7)',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  background: 'var(--e-bg-alt, #fafafa)'
                }}
              >
                <summary
                  style={{
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{row.formName || 'Form Submission'}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: row.status === 'NEW' ? '#10b981' : row.status === 'SPAM' ? '#ef4444' : '#6b7280',
                      color: '#fff',
                      fontWeight: 600
                    }}
                  >
                    {row.status}
                  </span>
                </summary>

                <div style={{ fontSize: '10px', color: 'var(--e-text-muted, #71717a)', marginTop: '4px', marginBottom: '8px' }}>
                  {new Date(row.createdAt).toLocaleString()}
                </div>

                <div
                  style={{
                    background: 'var(--e-bg, #fff)',
                    border: '1px solid var(--e-border, #e4e4e7)',
                    borderRadius: '3px',
                    padding: '6px 8px',
                    fontSize: '11px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    marginBottom: '8px'
                  }}
                >
                  {Object.entries(row.values).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--e-text-muted, #71717a)' }}>{key}:</span>
                      <span style={{ color: 'var(--e-text, #18181b)', wordBreak: 'break-all', textAlign: 'right' }}>
                        {value || '—'}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <select
                    className="elementor-control-input"
                    style={{ flex: 1, padding: '3px 6px', fontSize: '11px' }}
                    value={row.status}
                    onChange={event => void changeStatus(row, event.target.value as Submission['status'])}
                  >
                    <option value="NEW">Status: NEW</option>
                    <option value="REVIEWED">Status: REVIEWED</option>
                    <option value="SPAM">Status: SPAM</option>
                  </select>
                  <button
                    className="elementor-btn"
                    style={{ padding: '3px 8px', fontSize: '11px', color: '#ef4444' }}
                    onClick={async () => {
                      if (!window.confirm('Permanently delete this submission?')) return;
                      try {
                        await api.delete(`/builder/submissions/${row.id}`);
                        await load();
                      } catch (error) {
                        setError(errorMessage(error));
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </details>
            ))}
          </div>

          {cursor && (
            <button
              className="elementor-btn"
              style={{ width: '100%', marginTop: '10px', padding: '6px' }}
              disabled={loading}
              onClick={() => void load(cursor)}
            >
              Load more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
