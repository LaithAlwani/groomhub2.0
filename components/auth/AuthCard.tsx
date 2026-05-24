import Image from "next/image";
import { landingPage } from "@/lib/landingPage";

/**
 * White glass-style card used by sign-in, sign-up, verify and "complete
 * profile" pages. Centers the brand logo above the heading. Pages render
 * their form / steps as `children`.
 */
export function AuthCard({
  title,
  subtitle,
  policyText,
  children,
}: {
  title: string;
  subtitle: string;
  policyText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-12 md:py-16">
      <div className="rounded-2xl border border-zinc-200/60 bg-white p-8 shadow-lg md:p-12 dark:border-zinc-800/60 dark:bg-zinc-900">
        <div className="mb-8 text-center">
          <Image
            src={landingPage.brand.logoSrc}
            alt={landingPage.brand.name}
            width={64}
            height={64}
            priority
            className="mx-auto mb-6 h-16 w-16 object-contain"
          />
          <h1 className="text-3xl font-semibold tracking-tight text-[#00273c] dark:text-zinc-50">
            {title}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {subtitle}
          </p>
        </div>
        {children}
      </div>
      {policyText && (
        <p className="mx-auto mt-6 max-w-sm text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
          {policyText}
        </p>
      )}
    </div>
  );
}
