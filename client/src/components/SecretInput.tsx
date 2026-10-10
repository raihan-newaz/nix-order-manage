import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type SecretInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

type Props = SecretInputProps & { loadSavedSecret?: () => Promise<string> };

const SecretInput: React.FC<Props> = ({ className = '', loadSavedSecret, ...props }) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revealedSavedSecret, setRevealedSavedSecret] = useState('');
  const savedSecretMask = props.value === '••••••••';

  const toggleVisibility = async () => {
    if (visible) { setVisible(false); setRevealedSavedSecret(''); return; }
    if (savedSecretMask && loadSavedSecret) {
      setLoading(true);
      try { setRevealedSavedSecret(await loadSavedSecret()); setVisible(true); }
      catch { setVisible(false); }
      finally { setLoading(false); }
      return;
    }
    setVisible(true);
  };

  return (
    <div className="relative">
      <input {...props} value={savedSecretMask ? (visible ? revealedSavedSecret : '') : props.value} placeholder={props.placeholder || (savedSecretMask ? 'Saved securely · leave blank to keep' : undefined)} type={visible ? 'text' : 'password'} className={`${className} pr-10`} />
      <button
        type="button"
        aria-label={visible ? 'Hide token' : 'Show token'}
        aria-pressed={visible}
        onClick={toggleVisibility}
        disabled={loading}
        className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

export default SecretInput;
