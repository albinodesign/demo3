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
    name: z.string().max(60),
    shortName: z.string().max(30),
    tagline: z.string().max(60),
    legalForm: z.string(),
    owner: z.string().max(60),
    ownerTitle: z.string().max(40),
    address: z.object({
      street: z.string().max(80),
      zip: z.string().max(10),
      city: z.string().max(40),
    }),
    phone: z.string(),
    phoneHref: z.string(),
    email: z.string().email(),
    hours: z.object({
      monThu: z.string(),
      fri: z.string(),
      schema: z.array(z.string()).min(1),
    }),
    banner: z.object({
      enabled: z.boolean(),
      variant: z.enum(['vacation', 'emergency', 'info']),
      text: z.string().max(160),
    }),
    nav: z.object({
      services: z.string().max(30),
      why: z.string().max(30),
      testimonials: z.string().max(30),
      kontakt: z.string().max(30),
      blog: z.string().max(30),
    }),
    footer: z.object({
      description: z.string().max(160),
      kontaktHeading: z.string().max(30),
      legalHeading: z.string().max(30),
      linkImpressum: z.string().max(40),
      linkDatenschutz: z.string().max(40),
      linkKontakt: z.string().max(40),
      linkBlog: z.string().max(40),
      copyrightNote: z.string().max(30),
    }),
    cookie: z.object({
      title: z.string().max(60),
      textPre: z.string().max(400),
      linkLabel: z.string().max(40),
      textPost: z.string().max(40),
      necessaryLabel: z.string().max(30),
      necessaryNote: z.string().max(80),
      optionalLabel: z.string().max(40),
      optionalNote: z.string().max(100),
      acceptLabel: z.string().max(30),
      declineLabel: z.string().max(30),
      customizeLabel: z.string().max(30),
      saveLabel: z.string().max(30),
    }),
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
    status: z.string().max(40),
    deliveryTitle: z.string().max(20),
    deliveryText: z.string().max(40),
    secureTitle: z.string().max(20),
    secureText: z.string().max(40),
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
    privacyLinkLabel: z.string().max(40),
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

const impressumSchema = z.object({
  title: z.string().max(60),
  companyHeading: z.string().max(80),
  ownerHeading: z.string().max(80),
  contactHeading: z.string().max(80),
  hoursHeading: z.string().max(80),
  phoneLabel: z.string().max(20),
  emailLabel: z.string().max(20),
  dispute: z.object({
    heading: z.string().max(80),
    text: z.string().max(2000),
  }),
  liability: z.object({
    heading: z.string().max(60),
    text: z.string().max(2000),
  }),
  copyright: z.object({
    heading: z.string().max(60),
    text: z.string().max(2000),
  }),
});

const datenschutzSchema = z.object({
  title: z.string().max(60),
  controllerHeading: z.string().max(60),
  controllerIntro: z.string().max(200),
  ownerLabel: z.string().max(20),
  phoneLabel: z.string().max(20),
  emailLabel: z.string().max(20),
  sections: z
    .array(
      z.object({
        heading: z.string().max(80),
        text: z.string().max(2000),
      }),
    )
    .length(6),
  closing: z.string().max(300),
});

export type ImpressumContent = z.infer<typeof impressumSchema>;
export type DatenschutzContent = z.infer<typeof datenschutzSchema>;

const blogPageSchema = z.object({
  title: z.string().max(60),
  subtitle: z.string().max(200),
  readMoreLabel: z.string().max(30),
  backLabel: z.string().max(40),
  emptyTitle: z.string().max(60),
  emptyText: z.string().max(200),
});

export type BlogPageContent = z.infer<typeof blogPageSchema>;

const pages = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/pages' }),
  schema: homeSchema
    .partial()
    .merge(kontaktSchema.partial())
    .merge(impressumSchema.partial())
    .merge(datenschutzSchema.partial())
    .merge(blogPageSchema.partial()),
});

// Blog-Artikel (CMS-REFERENCE.md Abschnitt 5): Frontmatter-Schlüssel exakt einhalten.
// date ist optional (leer = heute), draft fehlend = nicht öffentlich.
const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().max(200),
    slug: z
      .string()
      .max(80)
      .regex(/^[a-z0-9-]+$/, 'Slug nur Kleinbuchstaben, Ziffern und Bindestrich'),
    date: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum JJJJ-MM-TT')]).optional(),
    coverImage: z.string().max(2000),
    coverImageAlt: z.string().max(200),
    excerpt: z.string().max(500),
    // CMS-REFERENCE §5/§10: `draft` wird tolerant gelesen — **fehlend = nicht öffentlich**.
    // Deshalb kein `.default(false)`: ein fehlendes Flag darf keinen Artikel veröffentlichen.
    draft: z.boolean().optional(),
  }),
});

export const collections = { site, pages, blog };
