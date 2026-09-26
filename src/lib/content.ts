import { getEntry } from 'astro:content';
import type { HomeContent, KontaktContent, ImpressumContent, DatenschutzContent } from '../content.config';

export async function getSite() {
  const entry = await getEntry('site', 'site');
  if (!entry) throw new Error('site.json nicht gefunden');
  return entry.data;
}

export async function getPage(id: 'kontakt'): Promise<KontaktContent>;
export async function getPage(id: 'home'): Promise<HomeContent>;
export async function getPage(id: 'impressum'): Promise<ImpressumContent>;
export async function getPage(id: 'datenschutz'): Promise<DatenschutzContent>;
export async function getPage(
  id: 'home' | 'kontakt' | 'impressum' | 'datenschutz',
): Promise<HomeContent | KontaktContent | ImpressumContent | DatenschutzContent> {
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`Seite "${id}" nicht gefunden`);
  return entry.data as HomeContent | KontaktContent | ImpressumContent | DatenschutzContent;
}
