import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync token to window for non-React fetch clients (api.js, etc.)
  const syncToken = (sess) => {
    const token = sess?.access_token || null;
    if (typeof window !== 'undefined') {
      window.__SUPABASE_ACCESS_TOKEN__ = token;
      window.__SUPABASE_USER__ = sess?.user || null;
      window.dispatchEvent(new CustomEvent('supabase-auth-state-change', {
        detail: { authenticated: !!sess, user: sess?.user || null }
      }));
    }
  };

  const clearUserDataState = () => {
    if (typeof window !== 'undefined') {
      window.__SUPABASE_ACCESS_TOKEN__ = null;
      window.__SUPABASE_USER__ = null;
      try {
        localStorage.removeItem('codecity_selected_repo');
        localStorage.removeItem('codecity_impact_cache');
      } catch (e) {}
    }
  };

  useEffect(() => {
    // 1. Initial Session Restoration
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user || null);
      syncToken(initialSession);
      setLoading(false);
    }).catch(err => {
      console.warn('Supabase getSession failed:', err);
      setLoading(false);
    });

    // 2. Auth State Change Listener (Sign In, Token Refresh, Sign Out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user || null);
      syncToken(newSession);

      if (event === 'SIGNED_OUT') {
        clearUserDataState();
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async ({ email, password, displayName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName,
          name: displayName
        }
      }
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    clearUserDataState();
    const { error } = await supabase.auth.signOut();
    if (error) console.error('SignOut error:', error);
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#reset-password`
    });
    if (error) throw error;
    return data;
  };

  const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      token: session?.access_token || null,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      clearUserDataState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

