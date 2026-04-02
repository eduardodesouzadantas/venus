"use client";

import * as React from "react"
import { cn } from "@/lib/utils"

interface EmotionalSliderProps {
  value: number;
  onChange: (value: number) => void;
  labelMap?: Record<number, string>;
}

export function EmotionalSlider({ value, onChange, labelMap }: EmotionalSliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onChange(val);
    if (navigator.vibrate) navigator.vibrate(10); // Haptic feedback se suportado
  };

  const percent = value * 10;

  return (
    <div className="w-full relative py-6">
      <div 
        className="absolute -top-4 w-full flex justify-center items-center transition-all duration-300"
      >
        <span className="bg-[#D4AF37] text-black px-4 py-1 rounded-full text-xs font-bold shadow-[0_0_10px_rgba(212,175,55,0.5)]">
          {labelMap?.[value] || value}
        </span>
      </div>
      
      <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
        <div 
          className="absolute h-full bg-white transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={handleChange}
        className="absolute top-6 left-0 w-full h-2 opacity-0 cursor-pointer"
      />
    </div>
  );
}
