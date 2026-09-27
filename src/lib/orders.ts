import { supabase } from './supabase';

export interface OrderItemRow {
  id: string;
  product_id: string | null;
  product_name_ua: string;
  product_name_ru: string;
  unit_price: number;
  quantity: number;
  products: { images: string[] | null } | null;
}

export interface OrderRow {
  id: string;
  order_number: number;
  status: string;
  total: number;
  created_at: string;
  order_items: OrderItemRow[];
}

/**
 * Замовлення поточного користувача. RLS дозволяє адміну бачити всі замовлення
 * (потрібно для вкладки "Замовлення" в адмінці) — тому тут ДОДАТКОВО явно
 * фільтруємо по user_id у коді, щоб на особистій сторінці "Кабінет" адмін
 * теж бачив лише свої власні замовлення, а не всі підряд.
 */
export async function fetchMyOrders(): Promise<OrderRow[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, total, created_at, order_items(id, product_id, product_name_ua, product_name_ru, unit_price, quantity, products(images))'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[orders] fetch error:', error.message);
    return [];
  }

  return (data ?? []) as unknown as OrderRow[];
}
