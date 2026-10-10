import { useEffect, useState } from 'react';
import api from '../lib/api';
import { errorMessage, type Permissions } from './useStudio';

type StaffAccess = { id: string; name: string; role: string; updatedAt: string; effective: Permissions };
export function AccessPanel() {
  const [users, setUsers] = useState<StaffAccess[]>([]); const [error, setError] = useState(''); const [saving, setSaving] = useState(''); const [message, setMessage] = useState('');
  const load = () => api.get('/builder/permissions').then(response => setUsers(response.data.users)).catch(error => setError(errorMessage(error)));
  useEffect(() => { void load(); }, []);
  const save = async (user: StaffAccess, reset = false) => {
    setSaving(user.id); setMessage(''); setError('');
    try {
      await api.put(`/builder/permissions/${user.id}`, { updatedAt: user.updatedAt, permissions: reset ? {} : user.effective });
      await load(); setMessage(`Access updated for ${user.name}. Navigation updates on their next sign-in or reload.`);
    } catch (error) { setError(errorMessage(error)); } finally { setSaving(''); }
  };
  return <section className="studio-access" aria-label="Builder access management"><h2>Studio access</h2><p>Changes apply to builder APIs immediately. Editing allows content, styles and structure. Super administrators retain all capabilities.</p>{error && <p role="alert" className="studio-error">{error}</p>}{message && <p role="status">{message}</p>}<div className="studio-access-scroll"><table><thead><tr><th>Staff member</th>{['Access', 'Edit', 'Publish', 'Templates', 'Submissions'].map(label => <th key={label}>{label}</th>)}<th>Actions</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><th>{user.name}<small>{user.role.replace(/_/g, ' ')}</small></th>{(['access', 'edit', 'publish', 'templates', 'submissions'] as const).map(key => <td key={key}><input type="checkbox" aria-label={`${user.name}: ${key}`} disabled={user.role === 'SUPER_ADMIN' || !!saving} checked={user.effective[key]} onChange={event => setUsers(current => current.map(item => item.id === user.id ? { ...item, effective: { ...item.effective, [key]: event.target.checked } } : item))} /></td>)}<td><button disabled={user.role === 'SUPER_ADMIN' || !!saving} onClick={() => void save(user)}>Save access</button><button disabled={user.role === 'SUPER_ADMIN' || !!saving} onClick={() => void save(user, true)}>Role defaults</button></td></tr>)}</tbody></table></div></section>;
}
