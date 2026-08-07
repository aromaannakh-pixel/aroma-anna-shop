import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Ця функція — єдине місце, де довіряють ціні. Клієнт присилає лише
// productId + quantity; сервер сам підтягує актуальну ціну/наявність
// з бази через service_role (secret) key, який обходить RLS.

interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

interface CheckoutCustomer {
  name: string;
  phone: string;
  email?: string;
  deliveryMethod: 'nova_poshta' | 'ukrposhta' | 'pickup';
  city?: string;
  address?: string;
  comment?: string;
  lang?: 'ua' | 'ru';
}

interface CheckoutBody {
  items: CheckoutItemInput[];
  customer: CheckoutCustomer;
}

const DELIVERY_LABELS: Record<CheckoutCustomer['deliveryMethod'], string> = {
  nova_poshta: 'Нова Пошта',
  ukrposhta: 'Укрпошта',
  pickup: 'Самовивіз',
};

function jsonResponse(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function isSaleValid(product: {
  sale_active: boolean;
  sale_price: number | null;
  sale_ends_at: string | null;
}): boolean {
  if (!product.sale_active || product.sale_price == null) return false;
  if (!product.sale_ends_at) return true;
  return new Date(product.sale_ends_at).getTime() > Date.now();
}

async function sendTelegramNotification(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const EMAIL_TEXT = {
  ua: {
    subject: (n: number) => `Замовлення №${n} прийнято — AromaAnna`,
    greeting: (name: string) => `Привіт, ${name}!`,
    intro: (n: number) => `Дякуємо за замовлення №${n}. Ми отримали його і незабаром зв'яжемося з вами для підтвердження.`,
    itemsHeading: 'Ваше замовлення:',
    total: 'Разом:',
    delivery: 'Доставка:',
    address: 'Адреса:',
    footer: 'Якщо виникнуть питання — просто дайте нам знати у відповідь на цей лист.',
    signoff: 'До зустрічі,\nAromaAnna',
  },
  ru: {
    subject: (n: number) => `Заказ №${n} принят — AromaAnna`,
    greeting: (name: string) => `Привет, ${name}!`,
    intro: (n: number) => `Спасибо за заказ №${n}. Мы получили его и скоро свяжемся с вами для подтверждения.`,
    itemsHeading: 'Ваш заказ:',
    total: 'Итого:',
    delivery: 'Доставка:',
    address: 'Адрес:',
    footer: 'Если возникнут вопросы — просто ответьте на это письмо.',
    signoff: 'До встречи,\nAromaAnna',
  },
} as const;

async function sendConfirmationEmail(params: {
  to: string;
  lang: 'ua' | 'ru';
  customerName: string;
  orderNumber: number;
  items: { name: string; quantity: number; lineTotal: number }[];
  total: number;
  deliveryLabel: string;
  address?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'AromaAnna <onboarding@resend.dev>';
  if (!apiKey) return false;

  const t = EMAIL_TEXT[params.lang];
  const itemsHtml = params.items
    .map((i) => `<tr><td style="padding:4px 0;">${i.name} × ${i.quantity}</td><td style="padding:4px 0;text-align:right;">${i.lineTotal.toFixed(0)} ₴</td></tr>`)
    .join('');

  const html = `
    <div style="font-family:Georgia,serif;color:#2b2e22;max-width:480px;margin:0 auto;">
      <h2 style="color:#256b57;">AromaAnna</h2>
      <p>${t.greeting(params.customerName)}</p>
      <p>${t.intro(params.orderNumber)}</p>
      <p style="font-weight:700;margin-bottom:4px;">${t.itemsHeading}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${itemsHtml}</table>
      <p style="font-weight:700;text-align:right;border-top:1px solid #e2e2d2;padding-top:8px;">${t.total} ${params.total.toFixed(0)} ₴</p>
      <p style="font-size:14px;">${t.delivery} ${params.deliveryLabel}${params.address ? `<br>${t.address} ${params.address}` : ''}</p>
      <p style="font-size:13px;color:#6b715c;">${t.footer}</p>
      <p style="font-size:13px;white-space:pre-line;">${t.signoff}</p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: params.to,
        reply_to: 'aromaannakh@gmail.com',
        subject: t.subject(params.orderNumber),
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed' });
  }

  let body: CheckoutBody;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { success: false, error: 'Invalid JSON' });
  }

  const { items, customer } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return jsonResponse(400, { success: false, error: 'empty_cart' });
  }
  if (!customer?.name?.trim() || !customer?.phone?.trim()) {
    return jsonResponse(400, { success: false, error: 'missing_customer_info' });
  }
  if (customer.deliveryMethod !== 'pickup' && !customer.address?.trim()) {
    return jsonResponse(400, { success: false, error: 'missing_address' });
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const secretKey = process.env.SUPABASE_SECRET_KEY!;
  const supabase = createClient(supabaseUrl, secretKey);

  // Хто оформлює: якщо прийшов Bearer-токен залогіненого користувача — прив'язуємо
  // замовлення до нього; інакше це гість (user_id = null).
  let userId: string | null = null;
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const { data } = await supabase.auth.getUser(token);
    if (data.user) userId = data.user.id;
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds);

  if (productsError) {
    return jsonResponse(500, { success: false, error: 'db_error' });
  }

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const unavailable: string[] = [];
  const orderItems: {
    product_id: string;
    product_name_ua: string;
    product_name_ru: string;
    unit_price: number;
    quantity: number;
  }[] = [];

  for (const requested of items) {
    const product = productById.get(requested.productId);
    const qty = Number(requested.quantity) || 0;

    if (!product || !product.published || !product.in_stock || qty <= 0) {
      if (product) unavailable.push(product.slug);
      continue;
    }

    const onSale = isSaleValid(product);
    const unitPrice = onSale ? Number(product.sale_price) : Number(product.price);

    orderItems.push({
      product_id: product.id,
      product_name_ua: product.name_ua,
      product_name_ru: product.name_ru,
      unit_price: unitPrice,
      quantity: qty,
    });
  }

  if (orderItems.length === 0) {
    return jsonResponse(400, { success: false, error: 'no_available_items', unavailable });
  }

  const total = orderItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      customer_name: customer.name.trim(),
      customer_email: customer.email?.trim() || null,
      customer_phone: customer.phone.trim(),
      delivery_method: customer.deliveryMethod,
      delivery_address: customer.address?.trim() || null,
      city: customer.city?.trim() || null,
      comment: customer.comment?.trim() || null,
      status: 'new',
      subtotal: total,
      total,
    })
    .select()
    .single();

  if (orderError || !order) {
    return jsonResponse(500, { success: false, error: 'order_insert_failed' });
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems.map((i) => ({ ...i, order_id: order.id })));

  if (itemsError) {
    return jsonResponse(500, { success: false, error: 'order_items_insert_failed' });
  }

  const itemsText = orderItems
    .map((i) => `• ${i.product_name_ua} × ${i.quantity} — ${(i.unit_price * i.quantity).toFixed(0)} ₴`)
    .join('\n');

  const notificationText = [
    `🛍 <b>Нове замовлення #${order.order_number}</b>`,
    `${customer.name}, ${customer.phone}`,
    customer.email ? `Email: ${customer.email}` : null,
    `Доставка: ${DELIVERY_LABELS[customer.deliveryMethod]}`,
    customer.city ? `Місто: ${customer.city}` : null,
    customer.address ? `Адреса: ${customer.address}` : null,
    customer.comment ? `Коментар: ${customer.comment}` : null,
    '',
    itemsText,
    '',
    `Разом: ${total.toFixed(0)} ₴`,
    unavailable.length ? `\n⚠️ Недоступні позиції (пропущено): ${unavailable.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const notified = await sendTelegramNotification(notificationText);
  if (notified) {
    await supabase.from('orders').update({ telegram_notified: true }).eq('id', order.id);
  }

  if (customer.email) {
    const emailLang = customer.lang === 'ru' ? 'ru' : 'ua';
    await sendConfirmationEmail({
      to: customer.email,
      lang: emailLang,
      customerName: customer.name.trim(),
      orderNumber: order.order_number,
      items: orderItems.map((i) => ({
        name: emailLang === 'ua' ? i.product_name_ua : i.product_name_ru,
        quantity: i.quantity,
        lineTotal: i.unit_price * i.quantity,
      })),
      total,
      deliveryLabel: DELIVERY_LABELS[customer.deliveryMethod],
      address: customer.address?.trim() || undefined,
    });
  }

  return jsonResponse(200, {
    success: true,
    orderNumber: order.order_number,
    unavailable: unavailable.length ? unavailable : undefined,
  });
};
