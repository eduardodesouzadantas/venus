import { createBrowserClient } from "@supabase/ssr";
import { getWhatsAppAccessToken } from "@/lib/whatsapp/tenant-session";

let whatsappClient: any | null = null;

export function createWhatsAppClient() {
  if (whatsappClient) return whatsappClient;

  whatsappClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: getWhatsAppAccessToken,
    }
  );

  return whatsappClient;
}

