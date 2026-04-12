"use client";

import { useEffect } from "react";

export default function OnboardingChatError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("[CHAT_RENDER_CRASH]", error);
  }, [error]);

  return <div className="min-h-screen bg-[#0a0a0a] text-white">Erro ao renderizar</div>;
}
