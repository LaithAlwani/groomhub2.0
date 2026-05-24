/**
 * Marketing landing page content.
 *
 * All copy, pricing, feature blurbs and footer links live here so a
 * non-engineer can edit the homepage without touching JSX. The page
 * components in `components/marketing/` are intentionally thin wrappers
 * that render whatever this file describes.
 */

export type NavLink = { label: string; href: string };

export type Feature = {
  title: string;
  description: string;
  // Lucide icon name — must match an export from `lucide-react`.
  icon:
    | "CalendarDays"
    | "BellRing"
    | "PawPrint"
    | "WifiOff"
    | "ShieldCheck"
    | "Users";
  // Optional Tailwind classes that scope the bento card's accent color.
  accentClassName?: string;
};

export type PricingTier = {
  name: string;
  priceMonthly: number;
  priceSuffix: string;
  tagline: string;
  features: ReadonlyArray<string>;
  ctaLabel: string;
  ctaHref: string;
  recommended?: boolean;
};

export const landingPage = {
  brand: {
    name: "GroomHub",
    logoSrc: "/logo_new.webp",
  },

  nav: {
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Contact", href: "#contact" },
    ] as ReadonlyArray<NavLink>,
    signInLabel: "Log in",
    signInHref: "/sign-in",
    primaryCtaLabel: "Get started",
    primaryCtaHref: "/sign-up",
  },

  hero: {
    eyebrow: "Built for grooming salons",
    title: "Run your grooming shop without the chaos.",
    subtitle:
      "Bookings, pet records and staff schedules — in one place. GroomHub fills your chair, cuts no-shows, and keeps every detail on the dog (and the owner) at your fingertips.",
    primaryCtaLabel: "Start free",
    primaryCtaHref: "/sign-up",
    secondaryCtaLabel: "See pricing",
    secondaryCtaHref: "#pricing",
    socialProof:
      "Trusted by independent salons and multi-groomer shops alike.",
  },

  features: {
    eyebrow: "Everything you need",
    title: "Less admin. More tails wagging.",
    subtitle:
      "Replace the paper diary, the group chat, and the spreadsheet. Everything your team needs to book, prep, and finish an appointment lives in GroomHub.",
    items: [
      {
        title: "Smart calendar",
        description:
          "Drag-and-drop scheduling with day, 3-day and week views. Block-off times, lunches and PTO are respected at booking time — no more double bookings.",
        icon: "CalendarDays",
        accentClassName: "bg-orange-50 text-orange-700",
      },
      {
        title: "Zero no-shows",
        description:
          "Automatic booking confirmations and a 24-hour reminder land in your client's inbox — branded with your shop's name and reply-to.",
        icon: "BellRing",
        accentClassName: "bg-sky-50 text-sky-700",
      },
      {
        title: "Pet & client CRM",
        description:
          "Every pet gets a profile: coat type, vaccinations, photo, and full grooming history across every groomer who has touched them.",
        icon: "PawPrint",
        accentClassName: "bg-emerald-50 text-emerald-700",
      },
      {
        title: "Staff schedules & roles",
        description:
          "Each groomer manages their own weekly availability. Admins see the whole shop; staff only see their own bookings. Privacy out of the box.",
        icon: "Users",
        accentClassName: "bg-violet-50 text-violet-700",
      },
      {
        title: "Works offline",
        description:
          "A PWA you can install on any phone or iPad. Flaky Wi-Fi in the back room won't cost you an appointment — bookings sync the moment you reconnect.",
        icon: "WifiOff",
        accentClassName: "bg-amber-50 text-amber-700",
      },
      {
        title: "Built-in approvals",
        description:
          "When an admin books for a groomer the appointment waits for the groomer's OK. Decline routes back to admins so nothing slips through.",
        icon: "ShieldCheck",
        accentClassName: "bg-rose-50 text-rose-700",
      },
    ] as ReadonlyArray<Feature>,
  },

  pricing: {
    eyebrow: "Simple pricing",
    title: "One price per shop. No per-groomer surprises.",
    subtitle:
      "Try GroomHub free for 14 days. No credit card required. Cancel any time.",
    tiers: [
      {
        name: "Solo",
        priceMonthly: 29,
        priceSuffix: "/mo",
        tagline: "Perfect for a single groomer just getting set up.",
        features: [
          "1 groomer",
          "Unlimited clients & pets",
          "Booking calendar & reminders",
          "Email support",
        ],
        ctaLabel: "Start free trial",
        ctaHref: "/sign-up",
      },
      {
        name: "Growth",
        priceMonthly: 79,
        priceSuffix: "/mo",
        tagline: "Most popular for shops with 2–6 groomers.",
        features: [
          "Up to 6 groomers",
          "Roles & per-staff schedules",
          "Booking approvals workflow",
          "Branded confirmation emails",
          "Priority email support",
        ],
        ctaLabel: "Start free trial",
        ctaHref: "/sign-up",
        recommended: true,
      },
      {
        name: "Pro",
        priceMonthly: 149,
        priceSuffix: "/mo",
        tagline: "For multi-location and high-volume salons.",
        features: [
          "Unlimited groomers",
          "Multi-location ready",
          "Custom branding (logo, reply-to)",
          "Priority chat support",
          "Onboarding call",
        ],
        ctaLabel: "Talk to us",
        ctaHref: "#contact",
      },
    ] as ReadonlyArray<PricingTier>,
  },

  contact: {
    eyebrow: "Get in touch",
    title: "Questions? We're real people.",
    subtitle:
      "Tell us about your shop and what you're juggling. We usually reply within a day.",
    email: "hello@groomhub.ca",
    formNamePlaceholder: "Your name",
    formEmailPlaceholder: "you@example.com",
    formMessagePlaceholder: "Tell us about your shop…",
    submitLabel: "Send message",
  },

  footer: {
    tagline: "Built by groomers, for groomers.",
    columns: [
      {
        heading: "Product",
        links: [
          { label: "Features", href: "#features" },
          { label: "Pricing", href: "#pricing" },
          { label: "Sign in", href: "/sign-in" },
        ],
      },
      {
        heading: "Company",
        links: [
          { label: "Contact", href: "#contact" },
          { label: "Privacy", href: "#" },
          { label: "Terms", href: "#" },
        ],
      },
    ],
    copyright: `© ${new Date().getFullYear()} GroomHub. All rights reserved.`,
  },
} as const;

export type LandingPageContent = typeof landingPage;
