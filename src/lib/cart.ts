// Кошик зберігається в localStorage — читається і на сторінці товару (додавання),
// і в CartDrawer (перегляд/зміна кількості). Ціна фіксується в момент додавання лише
// для відображення в кошику; фінальну ціну для замовлення завжди перевіряє
// Netlify Function за даними з бази (клієнту не довіряємо).
//
// Кошик прив'язаний до користувача: ключ у localStorage включає user.id з Supabase
// auth, тож у різних акаунтів (і в гостя) — окремі кошики в одному браузері.

import { supabase } from './supabase';

export interface CartItem {
  productId: string;
  slug: string;
  nameUa: string;
  nameRu: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
}

const STORAGE_PREFIX = 'aroma-anna-cart';
export const CART_UPDATED_EVENT = 'cart:updated';

let activeKey = `${STORAGE_PREFIX}:guest`;

function setActiveKey(userId: string | null | undefined) {
  const newKey = `${STORAGE_PREFIX}:${userId ?? 'guest'}`;
  if (newKey !== activeKey) {
    activeKey = newKey;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
    }
  }
}

let resolveReady: () => void = () => {};
const readyPromise = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

// Дочекатись, поки визначиться, який кошик (гостя чи конкретного user.id) активний —
// щоб уникнути стану, коли сторінка встигає прочитати кошик до того, як Supabase
// віддасть поточну сесію (тоді читається порожній "гостьовий" кошик).
export function cartReady(): Promise<void> {
  return readyPromise;
}

if (typeof window !== 'undefined') {
  supabase.auth.getSession().then(({ data }) => {
    setActiveKey(data.session?.user?.id);
    resolveReady();
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    setActiveKey(session?.user?.id);
  });
} else {
  resolveReady();
}

function readCart(): CartItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(activeKey);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]): void {
  localStorage.setItem(activeKey, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: { items } }));
}

export function getCart(): CartItem[] {
  return readCart();
}

export function getCartCount(): number {
  return readCart().reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartTotal(): number {
  return readCart().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

export function addToCart(item: Omit<CartItem, 'quantity'>, quantity = 1): void {
  const items = readCart();
  const existing = items.find((i) => i.productId === item.productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ ...item, quantity });
  }
  writeCart(items);
}

export function updateQuantity(productId: string, quantity: number): void {
  let items = readCart();
  if (quantity <= 0) {
    items = items.filter((i) => i.productId !== productId);
  } else {
    const existing = items.find((i) => i.productId === productId);
    if (existing) existing.quantity = quantity;
  }
  writeCart(items);
}

export function removeFromCart(productId: string): void {
  const items = readCart().filter((i) => i.productId !== productId);
  writeCart(items);
}

export function clearCart(): void {
  writeCart([]);
}
