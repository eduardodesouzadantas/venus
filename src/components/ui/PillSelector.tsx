import * as React from "react";
import { cn } from "@/lib/utils";

interface PillSelectorProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multiple?: boolean;
}

export function PillSelector({ options, selected, onChange, multiple = false }: PillSelectorProps) {
  const toggle = (option: string) => {
    if (multiple) {
      if (selected.includes(option)) {
        onChange(selected.filter((o) => o !== option));
      } else {
        onChange([...selected, option]);
      }
    } else {
      onChange([option]);
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isSelected}
            onClick={() => toggle(option)}
            className={cn(
              "min-h-11 rounded-full px-4 py-2.5 text-center text-[13px] leading-snug font-medium transition-all duration-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b] sm:min-h-12 sm:px-5 sm:py-3 sm:text-sm",
              isSelected
                ? "border border-[#C9A84C]/30 bg-[linear-gradient(180deg,#F5E3A2_0%,#D4AF37_100%)] text-[#0A0A0A] shadow-[0_14px_28px_rgba(212,175,55,0.18)]"
                : "border border-white/10 bg-white/[0.04] text-white/68 hover:bg-white/[0.08]"
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
