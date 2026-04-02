"use client";

import * as React from "react";
import { LookData } from "@/types/result";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { VenusButton } from "./VenusButton";

export function LookCardSwipeable({ look }: { look: LookData }) {
  return (
    <div className="flex-shrink-0 w-[85vw] max-w-[340px] snap-center rounded-[32px] overflow-hidden border border-white/10 bg-[#1A1A1A] mr-4 relative flex flex-col pb-6">
      
      {/* Imagem Massiva Container */}
      <div className="relative w-full aspect-[3/4] bg-[#2C2C2E] flex flex-col justify-end p-4">
        {/* Placeholder for Photo */}
        <div className="absolute inset-0 flex items-center justify-center text-white/10 font-bold text-4xl italic">
          Look #{look.id}
        </div>
        
        {/* Gradients to support text overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

        <div className="relative z-10 space-y-1">
          <span className="text-[10px] font-mono tracking-widest text-[#D4AF37] uppercase">{look.type}</span>
          <Heading as="h4">{look.name}</Heading>
          <Text className="text-white/80 text-sm line-clamp-2 leading-snug">{look.intention}</Text>
        </div>
      </div>

      {/* Rationale Section */}
      <div className="px-6 py-4 space-y-4 flex-1">
        <div>
          <Text className="text-xs uppercase font-bold text-white/40 mb-2">Composição & Acessórios</Text>
          <ul className="text-sm text-white/80 space-y-1 ml-4 list-disc marker:text-[#D4AF37]">
            {look.items.map(item => (
              <li key={item.id}><span className="font-bold text-white/90">{item.brand}:</span> {item.name}</li>
            ))}
            {look.accessories.map((acc, i) => (
              <li key={`acc-${i}`} className="italic text-[#D4AF37]/80">{acc}</li>
            ))}
          </ul>
        </div>
        <div>
           <Text className="text-[10px] text-white/50">{look.explanation}</Text>
        </div>
      </div>

      {/* CTA Interno do Look */}
      <div className="px-6 mt-auto">
        <VenusButton variant="solid" className="w-full py-3 h-auto text-xs font-bold uppercase tracking-widest">
           Ver Peças B2B
        </VenusButton>
      </div>

    </div>
  );
}
