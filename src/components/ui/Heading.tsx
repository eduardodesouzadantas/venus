import * as React from "react"
import { cn } from "@/lib/utils"

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
}

export function Heading({ className, as: Component = "h2", ...props }: HeadingProps) {
  return (
    <Component
      className={cn(
        "font-serif font-medium tracking-[-0.03em] text-white text-balance",
        Component === "h1" && "text-[2.35rem] leading-[0.96] sm:text-5xl lg:text-6xl",
        Component === "h2" && "text-[1.95rem] leading-[1.02] sm:text-4xl lg:text-[2.85rem]",
        Component === "h3" && "text-[1.45rem] leading-[1.08] sm:text-3xl",
        Component === "h4" && "text-[1.08rem] leading-[1.1] sm:text-xl",
        className
      )}
      {...props}
    />
  )
}
