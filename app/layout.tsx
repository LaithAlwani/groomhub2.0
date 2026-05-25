import { Suspense } from "react";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { RegisterServiceWorker } from "@/components/app/RegisterServiceWorker";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GroomHub",
  description: "Booking, clients and pet records for grooming salons.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "GroomHub",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/logo_wide.webp",
    apple: "/logo_wide.webp",
  },
};

export const viewport = {
  themeColor: "#00273c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <ConvexClientProvider>
            <QueryProvider>
              <Suspense fallback={null}>{children}</Suspense>
            </QueryProvider>
          </ConvexClientProvider>
          <RegisterServiceWorker />
        </body>
      </html>
    </ClerkProvider>
  );
}
