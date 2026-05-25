import type { MetadataRoute } from "next";

/**
 * PWA manifest — served at `/manifest.webmanifest` automatically by Next.
 * `display: "standalone"` is what makes installed PWAs open without the
 * browser chrome (no URL bar, no tabs). `start_url` points at the dashboard
 * so opening from the home screen drops the groomer straight into work.
 *
 * Icons currently reference our brand webp at 512px (any/maskable). Before
 * public launch we should ship dedicated 192px + maskable variants:
 *   - public/icons/icon-192.png        — Android home-screen
 *   - public/icons/icon-512.png        — splash / install prompt
 *   - public/icons/maskable-512.png    — Android adaptive-icon safe zone
 *
 * webp is fine for Chrome / Edge / modern Safari install prompts; iOS may
 * fall back to its default add-to-home behaviour without a proper PNG.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GroomHub",
    short_name: "GroomHub",
    description:
      "Booking, clients and pet records for grooming salons. Works offline.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#00273c",
    icons: [
      {
        src: "/logo_wide.webp",
        sizes: "512x512",
        type: "image/webp",
        purpose: "any",
      },
      {
        src: "/logo_wide.webp",
        sizes: "512x512",
        type: "image/webp",
        purpose: "maskable",
      },
    ],
  };
}
