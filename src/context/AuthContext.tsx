"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { SessionUser } from "@/types/auth";
import { supabase } from "@/utils/supabaseClient";

interface AuthContextValue {
  sessionUser: SessionUser | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  const refreshSession = useCallback(async () => {
    const request = ++requestRef.current;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (request !== requestRef.current) return;
    if (!user) {
      setSessionUser(null);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (request !== requestRef.current) return;
    setSessionUser({ user, profile });
    setLoading(false);
  }, []);

  useEffect(() => {
    let timer = window.setTimeout(() => { void refreshSession(); }, 0);

    const { data } = supabase.auth.onAuthStateChange(() => {
      // Defer auth calls until Supabase releases the auth event lock.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void refreshSession(); }, 0);
    });

    return () => {
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
      requestRef.current += 1;
    };
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      sessionUser,
      loading,
      refreshSession,
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        requestRef.current += 1;
        setSessionUser(null);
      },
    }),
    [loading, sessionUser, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
