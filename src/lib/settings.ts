import { createClient } from '@supabase/supabase-js';

// Реквізити продавця (ФОП/назва, РНОКПП, адреса, телефон, email) — раніше були
// захардкоджені в коді, тепер зберігаються в таблиці site_settings і редагуються
// власницею/клієнтом через адмінку (вкладка "Реквізити"), без потреби лізти в код.

export interface SiteSettings {
  sellerName: string;
  rnokpp: string;
  address: string;
  phone: string;
  email: string;
}

const FALLBACK: SiteSettings = {
  sellerName: '',
  rnokpp: '',
  address: '',
  phone: '',
  email: '',
};

function buildTimeClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return createClient(url, key);
}

function mapRow(row: Record<string, unknown> | null | undefined): SiteSettings {
  if (!row) return FALLBACK;
  return {
    sellerName: String(row.seller_name ?? ''),
    rnokpp: String(row.rnokpp ?? ''),
    address: String(row.address ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
  };
}

/**
 * Build-time запит (виконується під час `astro build`) — використовується
 * юридичними сторінками (оферта/конфіденційність/повернення/доставка/контакти).
 */
export async function fetchSiteSettings(): Promise<SiteSettings> {
  const client = buildTimeClient();
  const { data, error } = await client.from('site_settings').select('*').eq('id', 1).single();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[settings] fetch error:', error.message);
  }
  return mapRow(data);
}

export { mapRow as mapSiteSettingsRow };
