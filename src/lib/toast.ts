// Легке спливаюче повідомлення (наприклад, "Товар додано в кошик") —
// один спільний DOM-елемент на всю сторінку, стилі в src/styles/global.css
// (бо елемент створюється динамічно через JS, Astro scoped CSS сюди не дістане).

let hideTimeout: number | undefined;

export function showToast(message: string): void {
  if (typeof document === 'undefined') return;

  let el = document.getElementById('site-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'site-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }

  el.textContent = message;
  el.classList.add('show');

  window.clearTimeout(hideTimeout);
  hideTimeout = window.setTimeout(() => {
    el?.classList.remove('show');
  }, 2200);
}
