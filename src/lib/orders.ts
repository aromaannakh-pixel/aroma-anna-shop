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

/** Замовлення поточного користувача — RLS сам обмежує вибіркою лише своїх (orders.user_id = auth.uid()). */
export async function fetchMyOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, total, created_at, order_items(id, product_id, product_name_ua, product_name_ru, unit_price, quantity, products(images))'
    )
    .order('created_at', { ascending: false });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[orders] fetch error:', error.message);
    return [];
  }

  return (data ?? []) as unknown as OrderRow[];
}
