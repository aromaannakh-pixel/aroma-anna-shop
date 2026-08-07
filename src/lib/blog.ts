import { createClient } from '@supabase/supabase-js';

export interface BlogPostRow {
  id: string;
  slug: string;
  title_ua: string;
  title_ru: string;
  excerpt_ua: string | null;
  excerpt_ru: string | null;
  content_ua: string | null;
  content_ru: string | null;
  seo_title_ua: string | null;
  seo_title_ru: string | null;
  seo_description_ua: string | null;
  seo_description_ru: string | null;
  cover_image: string | null;
  author_id: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

function buildTimeClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return createClient(url, key);
}

/** Опубліковані пости для build-time генерації публічного блогу. */
export async function fetchPublishedPosts(): Promise<BlogPostRow[]> {
  const supabase = buildTimeClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[blog] fetch error:', error.message);
    return [];
  }

  return data ?? [];
}
