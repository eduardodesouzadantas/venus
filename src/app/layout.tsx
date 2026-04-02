import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { OnboardingProvider } from "@/lib/onboarding/OnboardingContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "Venus Engine",
  description: "Sua inteligência pessoal de estilo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen bg-black text-white antialiased">
        <OnboardingProvider>
          <main className="mx-auto w-full max-w-md min-h-screen bg-[#121212] relative shadow-2xl overflow-x-hidden">
            {children}
          </main>
        </OnboardingProvider>
      </body>
    </html>
  );
}
