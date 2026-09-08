// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://klarwerk-fenster.de',
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    // Lokale Assets sind Standard; *.supabase.co für spätere CMS-Bilder freigegeben
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
});
