import { getEntry } from 'astro:content';
import type { HomeContent, KontaktContent } from '../content.config';

export async function getSite() {
  const entry = await getEntry('site', 'site');
  if (!entry) throw new Error('site.json nicht gefunden');
  return entry.data;
}

export async function getPage(id: 'kontakt'): Promise<KontaktContent>;
export async function getPage(id: 'home'): Promise<HomeContent>;
export async function getPage(id: 'home' | 'kontakt'): Promise<HomeContent | KontaktContent> {
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`Seite "${id}" nicht gefunden`);
  return entry.data as HomeContent | KontaktContent;
}
