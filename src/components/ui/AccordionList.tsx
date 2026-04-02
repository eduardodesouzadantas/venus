"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccordionList({ items }: { items: string[] }) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  const toggle = (i: number) => setOpenIndex(i === openIndex ? null : i);

  return (
    <div className="w-full space-y-2 mt-4">
      {items.map((item, i) => (
        <div key={i} className="border border-red-900/40 rounded-xl overflow-hidden bg-red-950/10">
          <button 
            type="button" 
            onClick={() => toggle(i)}
            className="w-full px-4 py-4 flex items-center justify-between text-left focus:outline-none"
          >
            <span className="text-sm font-medium text-red-100">{item}</span>
            <ChevronDown className={cn("w-4 h-4 text-red-500 transition-transform", openIndex === i && "rotate-180")} />
          </button>
          
          <div 
            className={cn(
              "overflow-hidden transition-all duration-300 px-4",
              openIndex === i ? "max-h-40 pb-4 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <p className="text-xs text-red-200/60 leading-relaxed">
               Este bloqueio de estilo foi identificado pelas inteligências Vênus cruzando seu objetivo e métricas. Fique distante dessa direção de modelagem e estética.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
