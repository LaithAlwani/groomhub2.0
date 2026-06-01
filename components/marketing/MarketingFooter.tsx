import Image from "next/image";
import Link from "next/link";
import { landingPage } from "@/lib/landingPage";
import { marketingHref } from "@/lib/urls";

export function MarketingFooter() {
  const { footer, brand } = landingPage;

  return (
    <footer className="bg-[#00273c] py-12 text-zinc-200">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src={brand.logoSrc}
              alt={brand.name}
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <span className="text-lg font-semibold tracking-tight text-white">
              {brand.name}
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-400">
            {footer.tagline}
          </p>
        </div>

        {footer.columns.map((column) => (
          <div key={column.heading}>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              {column.heading}
            </h4>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {column.links.map((link) => (
                <li key={`${column.heading}-${link.label}`}>
                  <Link
                    href={marketingHref(link.href)}
                    className="text-zinc-400 transition-colors hover:text-orange-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 w-full max-w-6xl border-t border-white/10 px-6 pt-6 text-center text-xs text-zinc-500">
        {footer.copyright}
      </div>
    </footer>
  );
}
