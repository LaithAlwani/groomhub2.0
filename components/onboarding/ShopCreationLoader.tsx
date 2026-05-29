import { BrandedLoader } from "@/components/ui/BrandedLoader";

/**
 * Shown while a new shop is being created — the gap between "Create shop"
 * and the `/dashboard` redirect firing (logo upload + createOrganization
 * + seedFromClerk + setActive + redirect).
 */
export function ShopCreationLoader() {
  return <BrandedLoader message="Setting up your shop…" progress />;
}
