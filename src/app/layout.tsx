import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JobMatch Kenya — Find work that fits your story",
  description:
    "A Kenyan job matching platform that ranks but never disqualifies. Upload your CV once and let jobs come to you.",
  keywords: ["Kenya jobs", "job matching", "Nairobi jobs", "M-Pesa", "CV upload", "career"],
  authors: [{ name: "JobMatch Kenya" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <Providers>
          {children}
          <Toaster />
          <SonnerToaster richColors closeButton position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
