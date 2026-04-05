"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

export function SavedProfileToast() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 w-full bg-[#D4AF37] text-black text-xs font-bold py-2 text-center z-[100] animate-in fade-in slide-in-from-top-4 duration-500 flex items-center justify-center gap-2">
      <CheckCircle2 className="w-4 h-4" /> 
      Perfil Visual Salvo com Sucesso! 
    </div>
  );
}
