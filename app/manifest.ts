import type { MetadataRoute } from "next";

/**
 * PWA manifest — served at `/manifest.webmanifest` automatically by Next.
 * `display: "standalone"` is what makes installed PWAs open without the
 * browser chrome (no URL bar, no tabs). `start_url` points at the dashboard
 * so opening from the home screen drops the groomer straight into work.
 *
 * Icons are dedicated PNGs in `public/icons/` (generated from the brand logo):
 * a 192 + 512 for the home-screen / install prompt, plus a padded 512 maskable
 * for Android adaptive icons. Declared sizes must match the files exactly —
 * Chrome refuses to offer install when they don't.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GroomHub",
    short_name: "GroomHub",
    description:
      "Booking, clients and pet records for grooming salons.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#00273c",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
