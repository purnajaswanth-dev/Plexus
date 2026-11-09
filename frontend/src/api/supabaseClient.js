import { createClient } from '@supabase/supabase-js';

const getConfig = () => {
  let url = null;
  let key = null;

  if (typeof window !== 'undefined') {
    url = window.__SUPABASE_URL__ || window.__SUPABASE_CONFIG__?.supabaseUrl;
    key = window.__SUPABASE_PUBLISHABLE_KEY__ || window.__SUPABASE_CONFIG__?.supabasePublishableKey;
  }

  if (!url || url.includes('placeholder')) {
    url = import.meta.env.VITE_SUPABASE_URL || 'https://nwqjgadidsawteueixaj.supabase.co';
  }

  if (!key || key.includes('placeholder')) {
    key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  }

  return { url, key };
};

const initialConfig = getConfig();

export const supabase = createClient(initialConfig.url, initialConfig.key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'codecity-supabase-auth-token'
  }
});

if (typeof window !== 'undefined') {
  window.supabase = supabase;
}

// Helper to get active access token synchronously or asynchronously
export const getActiveAccessToken = async () => {
  if (typeof window !== 'undefined' && window.__SUPABASE_ACCESS_TOKEN__) {
    return window.__SUPABASE_ACCESS_TOKEN__;
  }
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || null;
  if (typeof window !== 'undefined') {
    window.__SUPABASE_ACCESS_TOKEN__ = token;
  }
  return token;
};

