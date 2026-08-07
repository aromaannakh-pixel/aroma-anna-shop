import { createClient } from '@supabase/supabase-js';

// Публічний клієнт для браузера. Використовує Publishable key — низькі права,
// доступ до даних керується RLS-політиками з supabase_schema.sql
// (публічний read лише для published-товарів/категорій/блогу, свої замовлення для user_id = auth.uid()).
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] Відсутні PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_PUBLISHABLE_KEY у .env — Supabase-запити не працюватимуть.'
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
