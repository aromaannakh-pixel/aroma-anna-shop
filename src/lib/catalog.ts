import { createClient } from '@supabase/supabase-js';

export interface CategoryRow {
  id: string;
  slug: string;
  name_ua: string;
  name_ru: string;
  sort_order: number;
}

export interface ProductRow {
  id: string;
  slug: string;
  category_id: string | null;
  name_ua: string;
  name_ru: string;
  short_desc_ua: string | null;
  short_desc_ru: string | null;
  description_ua: string | null;
  description_ru: string | null;
  seo_title_ua: string | null;
  seo_title_ru: string | null;
  seo_description_ua: string | null;
  seo_description_ru: string | null;
  images: string[];
  sku: string | null;
  price: number;
  sale_price: number | null;
  sale_active: boolean;
  sale_ends_at: string | null;
  stock: number;
  in_stock: boolean;
  published: boolean;
  created_at: string;
}

export interface ProductView extends ProductRow {
  categorySlug: string | null;
  effectivePrice: number;
  isOnSale: boolean;
}

/**
 * Клієнт для build-time запитів (виконується на Node під час `astro build`,
 * не в браузері). Використовує той самий publishable key — безпечно, бо RLS
 * дозволяє читати лише published-товари й усі категорії.
 */
function buildTimeClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return createClient(url, key);
}

function isSaleValid(product: ProductRow): boolean {
  if (!product.sale_active || product.sale_price == null) return false;
  if (!product.sale_ends_at) return true;
  return new Date(product.sale_ends_at).getTime() > Date.now();
}

export async function fetchCatalogData(): Promise<{
  categories: CategoryRow[];
  products: ProductView[];
}> {
  const supabase = buildTimeClient();

  const [{ data: categories, error: catErr }, { data: products, error: prodErr }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order', { ascending: true }),
    supabase.from('products').select('*').eq('published', true).order('created_at', { ascending: false }),
  ]);

  if (catErr) {
    // eslint-disable-next-line no-console
    console.error('[catalog] categories fetch error:', catErr.message);
  }
  if (prodErr) {
    // eslint-disable-next-line no-console
    console.error('[catalog] products fetch error:', prodErr.message);
  }

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  const productViews: ProductView[] = (products ?? []).map((p) => {
    const onSale = isSaleValid(p);
    return {
      ...p,
      categorySlug: p.category_id ? categoryById.get(p.category_id)?.slug ?? null : null,
      isOnSale: onSale,
      effectivePrice: onSale ? Number(p.sale_price) : Number(p.price),
    };
  });

  return { categories: categories ?? [], products: productViews };
}
