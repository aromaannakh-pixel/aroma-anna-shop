// Кошик зберігається в localStorage — читається і на сторінці товару (додавання),
// і в CartDrawer (перегляд/зміна кількості). Ціна фіксується в момент додавання лише
// для відображення в кошику; фінальну ціну для замовлення завжди перевіряє
// Netlify Function за даними з бази (клієнту не довіряємо).

export interface CartItem {
  productId: string;
  slug: string;
  nameUa: string;
  nameRu: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
}

const STORAGE_KEY = 'aroma-anna-cart';
export const CART_UPDATED_EVENT = 'cart:updated';

function readCart(): CartItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
