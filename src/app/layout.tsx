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

import { DemoTour } from "@/components/ui/DemoTour";
import { Suspense } from "react";

import { UserImageProvider } from "@/lib/onboarding/UserImageContext";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { WhatsAppProvider } from "@/lib/whatsapp/WhatsAppContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen bg-black text-white antialiased relative isolate" suppressHydrationWarning>
        <UserImageProvider>
          <AuthProvider>
            <OnboardingProvider>
              <WhatsAppProvider>
                <main className="min-h-screen bg-black relative z-10 overflow-x-hidden antialiased">
                  {children}
                  <Suspense fallback={null}>
                    <DemoTour />
                  </Suspense>
                </main>
              </WhatsAppProvider>
            </OnboardingProvider>
          </AuthProvider>
        </UserImageProvider>
      </body>
    </html>
  );
}


