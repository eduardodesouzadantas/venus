import * as React from "react"
import { cn } from "@/lib/utils"

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
    <div className="flex flex-wrap gap-3">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            onClick={() => toggle(option)}
            className={cn(
              "px-5 py-3 rounded-full text-sm font-medium transition-all duration-300 active:scale-95",
              isSelected 
                ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.4)]" 
                : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
