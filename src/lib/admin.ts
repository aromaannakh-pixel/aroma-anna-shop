import { supabase } from './supabase';
import type { CategoryRow, ProductRow } from './catalog';
import type { BlogPostRow } from './blog';
import { mapSiteSettingsRow, type SiteSettings } from './settings';

export type { SiteSettings };

export interface CurrentAdmin {
  userId: string;
  email: string | null;
}

/**
 * Перевірка адмін-доступу на клієнті — лише для UI (показати/сховати адмінку).
 * Реальний захист даних — RLS-політики в базі (is_admin()), які все одно
 * відхилять запис/редагування, навіть якщо хтось обійде цю перевірку в браузері.
 */
export async function requireAdmin(): Promise<CurrentAdmin | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return null;

  return { userId: user.id, email: user.email ?? null };
}

// ---------- Фото товарів ----------

/**
 * Завантажує файл у Supabase Storage bucket "products" (публічний, доступ на
 * запис лише для адміна — див. supabase_storage_setup.sql) і повертає
 * публічне посилання на файл.
 */
export async function uploadProductImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from('products').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('products').getPublicUrl(path);
  return data.publicUrl;
}

// ---------- Замовлення ----------

export interface AdminOrderItem {
  id: string;
  product_name_ua: string;
  product_name_ru: string;
  unit_price: number;
  quantity: number;
}

export interface AdminOrder {
  id: string;
  order_number: number;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_method: string | null;
  city: string | null;
  delivery_address: string | null;
  comment: string | null;
  subtotal: number;
  total: number;
  created_at: string;
  order_items: AdminOrderItem[];
}

export async function listAllOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, customer_name, customer_phone, customer_email, delivery_method, city, delivery_address, comment, subtotal, total, created_at, order_items(id, product_name_ua, product_name_ru, unit_price, quantity)'
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AdminOrder[];
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) throw error;
}

// ---------- Товари ----------

export async function listAllProducts(): Promise<ProductRow[]> {
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProductRow[];
}

export async function saveProduct(payload: Record<string, unknown> & { id?: string }): Promise<void> {
  const { id, ...rest } = payload;
  const { error } = id
    ? await supabase.from('products').update(rest).eq('id', id)
    : await supabase.from('products').insert(rest);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Категорії ----------

export async function listAllCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

export async function saveCategory(payload: Record<string, unknown> & { id?: string }): Promise<void> {
  const { id, ...rest } = payload;
  const { error } = id
    ? await supabase.from('categories').update(rest).eq('id', id)
    : await supabase.from('categories').insert(rest);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Блог ----------

export async function listAllBlogPosts(): Promise<BlogPostRow[]> {
  const { data, error } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlogPostRow[];
}

export async function saveBlogPost(payload: Record<string, unknown> & { id?: string }): Promise<void> {
  const { id, ...rest } = payload;
  const { error } = id
    ? await supabase.from('blog_posts').update(rest).eq('id', id)
    : await supabase.from('blog_posts').insert(rest);
  if (error) throw error;
}

export async function deleteBlogPost(id: string): Promise<void> {
  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Реквізити продавця ----------

export async function fetchSiteSettingsAdmin(): Promise<SiteSettings> {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).single();
  if (error) throw error;
  return mapSiteSettingsRow(data);
}

export async function saveSiteSettings(settings: SiteSettings): Promise<void> {
  const { error } = await supabase
    .from('site_settings')
    .update({
      seller_name: settings.sellerName,
      rnokpp: settings.rnokpp,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
    })
    .eq('id', 1);
  if (error) throw error;
}
