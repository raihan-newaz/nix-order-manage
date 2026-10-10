import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { customerSignin, customerSignout, customerSignup, getCustomerAccount, updateCustomerAccount } from '../api';
import type { CustomerAccount } from '../types';

type AuthValue = {
  customer: CustomerAccount | null; loading: boolean;
  signin: (identifier: string, password: string) => Promise<void>;
  signup: (input: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  signout: () => Promise<void>; updateProfile: (input: Partial<CustomerAccount>) => Promise<void>;
};
const Context = createContext<AuthValue | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getCustomerAccount().then((response) => setCustomer(response.customer)).catch(() => setCustomer(null)).finally(() => setLoading(false)); }, []);
  const value = useMemo<AuthValue>(() => ({
    customer, loading,
    signin: async (identifier, password) => { const response = await customerSignin({ identifier, password }); setCustomer(response.customer); },
    signup: async (input) => { const response = await customerSignup(input); setCustomer(response.customer); },
    signout: async () => { await customerSignout(); setCustomer(null); },
    updateProfile: async (input) => { const response = await updateCustomerAccount(input); setCustomer(response.customer); },
  }), [customer, loading]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCustomerAuth() { const value = useContext(Context); if (!value) throw new Error('CustomerAuthProvider is missing'); return value; }
