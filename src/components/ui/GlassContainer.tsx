import * as React from "react"
import { cn } from "@/lib/utils"

export interface GlassContainerProps extends React.HTMLAttributes<HTMLDivElement> {}

export const GlassContainer = React.forwardRef<HTMLDivElement, GlassContainerProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-3xl border border-white/10 bg-white/5 py-6 px-6 backdrop-blur-[30px] shadow-2xl",
          className
        )}
        {...props}
      />
    )
  }
)
GlassContainer.displayName = "GlassContainer"
