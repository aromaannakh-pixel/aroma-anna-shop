import type { APIRoute } from 'astro';
import { locales, localizedPath, type Locale } from '@/i18n/config';
import { fetchCatalogData } from '@/lib/catalog';
import { fetchPublishedPosts } from '@/lib/blog';

// Будується один раз під час `astro build` (сайт статичний) і перегенеровується
// при кожному новому деплої — нові товари/статті потраплять сюди автоматично.
export const prerender = true;

const STATIC_PATHS = [
  '/',
  '/catalog',
  '/blog',
  '/contacts',
  '/delivery',
  '/oferta',
  '/privacy',
  '/returns',
];

function urlEntry(loc: string, priority: string): string {
  return `  <url>\n    <loc>${loc}</loc>\n    <priority>${priority}</priority>\n  </url>`;
}

export const GET: APIRoute = async ({ site }) => {
  const base = site?.href.replace(/\/$/, '') ?? '';
  const entries: string[] = [];

  const addPath = (path: string, priority = '0.7') => {
    for (const lang of locales as readonly Locale[]) {
      entries.push(urlEntry(`${base}${localizedPath(lang, path)}`, priority));
    }
  };

  STATIC_PATHS.forEach((p) => addPath(p, p === '/' ? '1.0' : '0.8'));

  const { products } = await fetchCatalogData();
  products.forEach((p) => addPath(`/product/${p.slug}`, '0.6'));

  const posts = await fetchPublishedPosts();
  posts.forEach((post) => addPath(`/blog/${post.slug}`, '0.5'));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
