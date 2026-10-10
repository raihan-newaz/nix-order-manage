import React from 'react';
import clsx from 'clsx';

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }> = ({
  label,
  className,
  children,
  ...props
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={clsx(
      'inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

