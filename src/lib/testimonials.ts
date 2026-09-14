import { createClient } from '@supabase/supabase-js';

export interface TestimonialRow {
  id: string;
  author_name: string;
  text_ua: string;
  text_ru: string;
  rating: number;
  sort_order: number;
  published: boolean;
  created_at: string;
}

function buildTimeClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return createClient(url, key);
}

/** Опубліковані відгуки для показу на головній (build-time). */
export async function fetchPublishedTestimonials(): Promise<TestimonialRow[]> {
  const supabase = buildTimeClient();
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[testimonials] fetch error:', error.message);
    return [];
  }

  return data ?? [];
}
