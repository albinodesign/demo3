import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const iconName = z.enum([
  'window',
  'door',
  'shield',
  'wrench',
  'award',
  'industry',
  'calendar-day',
  'tag',
]);

const site = defineCollection({
  loader: glob({ pattern: 'site.json', base: './src/content' }),
  schema: z.object({
    name: z.string(),
    legalForm: z.string(),
    owner: z.string(),
    ownerTitle: z.string(),
    address: z.object({
      street: z.string(),
      zip: z.string(),
      city: z.string(),
    }),
    phone: z.string(),
    phoneHref: z.string(),
    email: z.string().email(),
    hours: z.object({
      monThu: z.string(),
      fri: z.string(),
      schema: z.array(z.string()).min(1),
    }),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/pages' }),
  schema: z.object({
    hero: z.object({
      badge: z.string().max(60),
      title: z.string().max(90),
      subtitle: z.string().max(200),
      ctaPrimary: z.string().max(40),
      ctaSecondary: z.string().max(40),
      image: z.string(),
      imageAlt: z.string().max(120),
    }),
    trust: z.object({
      items: z
        .array(
          z.object({
            value: z.string().max(10),
            suffix: z.string().max(10),
            label: z.string().max(60),
          }),
        )
        .length(4),
    }),
    services: z.object({
      title: z.string().max(60),
      subtitle: z.string().max(160),
      items: z
        .array(
          z.object({
            icon: iconName,
            title: z.string().max(60),
            description: z.string().max(220),
          }),
        )
        .length(4),
    }),
    why: z.object({
      title: z.string().max(60),
      subtitle: z.string().max(160),
      features: z
        .array(
          z.object({
            icon: iconName,
            title: z.string().max(60),
            text: z.string().max(160),
          }),
        )
        .length(4),
    }),
    testimonials: z.object({
      title: z.string().max(60),
      subtitle: z.string().max(160),
      items: z
        .array(
          z.object({
            quote: z.string().max(280),
            author: z.string().max(40),
            location: z.string().max(60),
            rating: z.number().int().min(1).max(5),
          }),
        )
        .length(3),
    }),
    finalCta: z.object({
      title: z.string().max(90),
      subtitle: z.string().max(200),
      ctaPrimary: z.string().max(40),
      ctaSecondary: z.string().max(60),
    }),
  }),
});

export const collections = { site, pages };
