import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import { ArrowRight, BarChart3, Boxes, Check, Eye, EyeOff, Globe2, Loader2, LockKeyhole, Mail, Moon, ShieldCheck, Sun } from 'lucide-react';
import toast from 'react-hot-toast';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      if (!response.data?.success) throw new Error(response.data?.message || 'Login failed');
      login('secure-cookie-session', response.data.user);
      toast.success(`Welcome back, ${response.data.user.name}`);
      navigate('/');
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f3ee] text-slate-950 dark:bg-slate-950 dark:text-white lg:grid lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#10110f] px-10 py-9 text-white lg:flex lg:flex-col xl:px-16 xl:py-12">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
        <div className="absolute -right-28 top-24 h-96 w-96 rounded-full bg-[#d9ff57]/20 blur-[110px]" />
        <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-emerald-500/20 blur-[130px]" />
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#d9ff57] font-black text-[#10110f]">N</span>
          <div><p className="text-lg font-black tracking-[.24em]">NIX</p><p className="text-[10px] uppercase tracking-[.18em] text-white/45">Commerce operations</p></div>
        </div>
        <div className="relative z-10 my-auto max-w-2xl py-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-white/65"><span className="h-1.5 w-1.5 rounded-full bg-[#d9ff57] shadow-[0_0_14px_#d9ff57]" /> Operations workspace</span>
          <h1 className="mt-7 max-w-xl text-5xl font-semibold leading-[1.02] tracking-[-.055em] xl:text-6xl">Every order.<br /><span className="text-[#d9ff57]">One clear view.</span></h1>
          <p className="mt-6 max-w-lg text-sm leading-7 text-white/55">Run orders, inventory, couriers, customers and storefront operations from one focused workspace built for the NIX team.</p>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            {[
              { icon: Boxes, label: 'Inventory', note: 'Live stock' },
              { icon: Globe2, label: 'Storefront', note: 'Connected' },
              { icon: BarChart3, label: 'Insights', note: 'Real data' },
            ].map(({ icon: Icon, label, note }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[.055] p-4 backdrop-blur"><Icon className="h-4 w-4 text-[#d9ff57]" /><p className="mt-5 text-xs font-semibold">{label}</p><p className="mt-1 text-[10px] text-white/40">{note}</p></div>
            ))}
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between text-[10px] uppercase tracking-[.14em] text-white/30"><span>nix.bd</span><span>Order management system</span></div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 dark:bg-slate-950">
        <button type="button" onClick={toggleTheme} aria-label="Toggle color theme" className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-950 sm:right-8 sm:top-8 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 font-black text-[#d9ff57] dark:bg-[#d9ff57] dark:text-slate-950">N</span><p className="font-black tracking-[.22em]">NIX</p></div>
          <div className="mb-8">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-emerald-600 dark:text-emerald-400">Staff portal</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-slate-950 dark:text-white">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sign in with your authorised NIX staff account.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Email address
              <span className="relative mt-2 block"><Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@nix.bd" className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm shadow-sm shadow-slate-950/[.025] transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/[.05] dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600" /></span>
            </label>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Password
              <span className="relative mt-2 block"><LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm shadow-sm shadow-slate-950/[.025] transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/[.05] dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
            </label>
            <button type="submit" disabled={loading} className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#d9ff57] dark:text-slate-950 dark:hover:bg-[#c8ed4d]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in securely <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}
            </button>
          </form>
          <div className="mt-8 rounded-xl border border-slate-200/80 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"><ShieldCheck className="h-4 w-4" /></span><div><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Protected workspace</p><p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">HttpOnly session, role-based access and encrypted integration credentials.</p></div><Check className="ml-auto mt-1 h-4 w-4 text-emerald-500" /></div>
          </div>
          <p className="mt-8 text-center text-[10px] uppercase tracking-[.14em] text-slate-400">Authorised team members only</p>
        </div>
      </section>
    </main>
  );
};
