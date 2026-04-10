import { createBrowserClient } from "@supabase/ssr";
import { getWhatsAppAccessToken } from "@/lib/whatsapp/tenant-session";

let whatsappClient: any | null = null;

export function createWhatsAppClient() {
  if (whatsappClient) return whatsappClient;

  whatsappClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Keep this client isolated from the main auth browser client.
      // @supabase/ssr caches browser clients by default, and this WhatsApp
      // client uses accessToken, which would poison signInWithPassword for
      // the login flow if it became the shared singleton.
      isSingleton: false,
      accessToken: getWhatsAppAccessToken,
    }
  );

  return whatsappClient;
}
