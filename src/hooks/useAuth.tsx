import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // Start as true so we show a loader until the first auth event arrives
  const [loading, setLoading] = useState(true);
  // Guard against duplicate subscriptions in React StrictMode double-effect
  const subscriptionRef = useRef<ReturnType<typeof supabase.auth.onAuthStateChange> | null>(null);

  useEffect(() => {
    // Skip if a subscription is already active (StrictMode second call)
    if (subscriptionRef.current) return;

    // Use onAuthStateChange as the single source of truth.
    // The INITIAL_SESSION event fires synchronously with the persisted session
    // (or null) before any other event, so we never need a separate getSession() call.
    const result = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    subscriptionRef.current = result;

    return () => {
      result.data.subscription.unsubscribe();
      subscriptionRef.current = null;
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    // State will be cleared via the SIGNED_OUT event in onAuthStateChange
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
