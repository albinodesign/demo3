// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://klarwerk-fenster.de',
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    // CMS-REFERENCE §9.4: den KONKRETEN Supabase-Projekt-Host eintragen, keine Wildcard.
    // Ohne diesen Eintrag schlägt der Build fehl, sobald das erste CMS-Bild hochgeladen wird.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'kolmzvevdvprhvfedswf.supabase.co',
      },
    ],
  },
});
