import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { OnboardingProvider } from "@/lib/onboarding/OnboardingContext";
import "./globals.css";
import { VenusLoadingScreen } from "@/components/ui/VenusLoadingScreen";

const inter = { variable: "--font-inter" };
const playfair = { variable: "--font-playfair" };
const fontVars: CSSProperties & Record<string, string> = {
  ["--font-inter"]: "Inter, ui-sans-serif, system-ui, sans-serif",
  ["--font-playfair"]: '"Playfair Display", ui-serif, Georgia, serif',
};

export const metadata: Metadata = {
  title: "Venus Engine",
  description: "Sua inteligência pessoal de estilo.",
};

import { DemoTour } from "@/components/ui/DemoTour";
import { Suspense } from "react";

import { UserImageProvider } from "@/lib/onboarding/UserImageContext";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { WhatsAppProvider } from "@/lib/whatsapp/WhatsAppContext";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable} dark`} style={fontVars} suppressHydrationWarning>
      <body className="min-h-screen bg-black text-white antialiased relative isolate font-sans" suppressHydrationWarning>
        <UserImageProvider>
          <AuthProvider>
            <Suspense fallback={<VenusLoadingScreen title="A Venus está preparando sua experiência" subtitle="Carregando a consultoria premium da sua loja." />}>
              <OnboardingProvider>
                <WhatsAppProvider>
                  <main className="min-h-screen bg-black relative z-10 overflow-x-hidden antialiased">
                    {children}
                    <Suspense fallback={<VenusLoadingScreen compact title="A Venus segue online" subtitle="Preparando a próxima camada da experiência." />}>
                      <DemoTour />
                    </Suspense>
                  </main>
                </WhatsAppProvider>
              </OnboardingProvider>
            </Suspense>
          </AuthProvider>
        </UserImageProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}


