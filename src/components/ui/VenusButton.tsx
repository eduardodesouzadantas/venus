import * as React from "react"
import { cn } from "@/lib/utils"

export interface VenusButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "glass" | "ghost" | "outline"
}

export const VenusButton = React.forwardRef<HTMLButtonElement, VenusButtonProps>(
  ({ className, variant = "solid", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3.5 text-[12px] font-semibold uppercase tracking-[0.18em] transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4AF37] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] sm:px-8 sm:py-4",
          variant === "solid" && "bg-[linear-gradient(180deg,#F1D77A_0%,#D4AF37_100%)] text-[#0A0A0A] shadow-[0_18px_40px_rgba(212,175,55,0.18)] hover:brightness-[1.03]",
          variant === "glass" && "luxury-panel-soft text-white hover:bg-white/[0.08]",
          variant === "ghost" && "bg-transparent text-white/65 hover:text-white underline-offset-4 hover:underline",
          variant === "outline" && "bg-transparent border border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37]/6 hover:border-[#D4AF37]/55",
          className
        )}
        {...props}
      />
    )
  }
)
VenusButton.displayName = "VenusButton"
