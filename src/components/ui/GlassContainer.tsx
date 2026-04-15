import * as React from "react"
import { cn } from "@/lib/utils"

export type GlassContainerProps = React.HTMLAttributes<HTMLDivElement>;

export const GlassContainer = React.forwardRef<HTMLDivElement, GlassContainerProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "luxury-panel rounded-[28px] px-4 py-5 sm:px-6 sm:py-6",
          className
        )}
        {...props}
      />
    )
  }
)
GlassContainer.displayName = "GlassContainer"
