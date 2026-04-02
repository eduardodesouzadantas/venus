import * as React from "react"
import { cn } from "@/lib/utils"

export interface VenusButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "glass" | "ghost"
}

export const VenusButton = React.forwardRef<HTMLButtonElement, VenusButtonProps>(
  ({ className, variant = "solid", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-full px-8 py-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4AF37] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          variant === "solid" && "bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.1)]",
          variant === "glass" && "bg-white/5 backdrop-blur-md border border-white/10 text-white hover:bg-white/10",
          variant === "ghost" && "bg-transparent text-white/70 hover:text-white underline-offset-4 hover:underline",
          className
        )}
        {...props}
      />
    )
  }
)
VenusButton.displayName = "VenusButton"
