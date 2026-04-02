import * as React from "react";
import { cn } from "@/lib/utils";
import { Text } from "./Text";

export function PaletteChip({ hex, name, className }: { hex: string, name: string, className?: string }) {
  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      <div 
        className="w-16 h-16 rounded-full border border-white/20 shadow-[0_4px_15px_rgba(0,0,0,0.5)] flex items-center justify-center shrink-0"
        style={{ backgroundColor: hex }}
      >
        <div className="w-full h-full rounded-full opacity-0 hover:opacity-10 transition-opacity bg-white cursor-pointer" />
      </div>
      <Text className="text-[10px] uppercase font-mono text-white/50 tracking-wider text-center">{name}</Text>
    </div>
  );
}
