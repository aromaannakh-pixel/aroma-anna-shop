import { defineConfig } from 'astro/config';

// Статичний сайт: дані з Supabase тягнуться на клієнті (publishable key, RLS дозволяє
// лише читання published-товарів/категорій/блогу). Checkout і все, що потребує
// service_role/секретів (Telegram-бот), живе окремо в netlify/functions.
export default defineConfig({
  output: 'static',
  site: 'https://aroma-anna.netlify.app', // заміниш на реальний домен, коли буде
});
