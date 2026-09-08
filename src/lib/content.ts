import { getEntry } from 'astro:content';

export async function getSite() {
  const entry = await getEntry('site', 'site');
  if (!entry) throw new Error('site.json nicht gefunden');
  return entry.data;
}

export async function getPage(id: 'home') {
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`Seite "${id}" nicht gefunden`);
  return entry.data;
}
