import ua from './ua.json';
import ru from './ru.json';

export const locales = ['ua', 'ru'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ua';

const dictionaries = { ua, ru } as const;

/** Повертає словник інтерфейсу для мови. Товари/блог — окремо, з бази (двомовні поля). */
export function getDictionary(lang: Locale) {
  return dictionaries[lang];
}

/**
 * Будує шлях для іншої мови на основі "мовно-нейтрального" шляху.
 * localizedPath('ua', '/catalog')  -> '/catalog'
 * localizedPath('ru', '/catalog')  -> '/ru/catalog'
 * localizedPath('ru', '/')         -> '/ru'
 */
export function localizedPath(lang: Locale, path: string): string {
  const clean = path === '/' ? '' : path;
  return lang === defaultLocale ? clean || '/' : `/ru${clean}`;
}

/**
 * Визначає мову і "мовно-нейтральний" шлях із поточного URL.pathname.
 * '/ru/catalog' -> { lang: 'ru', path: '/catalog' }
 * '/catalog'    -> { lang: 'ua', path: '/catalog' }
 */
export function parseLocalizedUrl(pathname: string): { lang: Locale; path: string } {
  if (pathname === '/ru' || pathname.startsWith('/ru/')) {
    const path = pathname.replace(/^\/ru/, '') || '/';
    return { lang: 'ru', path };
  }
  return { lang: defaultLocale, path: pathname || '/' };
}
