import type { Locale } from '@/i18n/config';

export function formatPrice(amount: number, lang: Locale): string {
  return new Intl.NumberFormat(lang === 'ua' ? 'uk-UA' : 'en-US', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(amount);
}
