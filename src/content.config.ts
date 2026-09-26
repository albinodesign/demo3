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
    shortName: z.string().max(30),
    tagline: z.string().max(60),
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
    banner: z
      .object({
        enabled: z.boolean(),
        variant: z.enum(['vacation', 'emergency', 'info']),
        text: z.string().max(160),
      })
      .optional(),
  }),
});

const homeSchema = z.object({
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
    ctaLabel: z.string().max(40),
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
  emergency: z.object({
    badge: z.string().max(60),
    title: z.string().max(90),
    subtitle: z.string().max(200),
    cardTitle: z.string().max(40),
    cardText: z.string().max(200),
    phoneCta: z.string().max(60),
    note: z.string().max(160),
    points: z
      .array(
        z.object({
          title: z.string().max(60),
          text: z.string().max(160),
        }),
      )
      .length(3),
  }),
});

const kontaktSchema = z.object({
  intro: z.object({
    title: z.string().max(90),
    subtitle: z.string().max(200),
  }),
  contactLabels: z.object({
    phone: z.string().max(30),
    email: z.string().max(30),
    address: z.string().max(30),
    hours: z.string().max(30),
  }),
  form: z.object({
    labelName: z.string().max(40),
    labelEmail: z.string().max(40),
    labelPhone: z.string().max(40),
    labelTopic: z.string().max(40),
    optionOther: z.string().max(40),
    labelMessage: z.string().max(40),
    privacyTextPre: z.string().max(60),
    privacyTextPost: z.string().max(220),
    submitLabel: z.string().max(40),
    submitSending: z.string().max(40),
    requiredNotePre: z.string().max(60),
    requiredNotePost: z.string().max(120),
  }),
  messages: z.object({
    name: z.string().max(120),
    email: z.string().max(120),
    message: z.string().max(120),
    privacy: z.string().max(120),
    honeypotSuccess: z.string().max(160),
    success: z.string().max(160),
    notConfigured: z.string().max(160),
    error: z.string().max(160),
    offline: z.string().max(160),
  }),
});

export type HomeContent = z.infer<typeof homeSchema>;
export type KontaktContent = z.infer<typeof kontaktSchema>;

const pages = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/pages' }),
  schema: homeSchema.partial().merge(kontaktSchema.partial()),
});

export const collections = { site, pages };
