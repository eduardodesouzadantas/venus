import * as React from "react"
import { cn } from "@/lib/utils"

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
}

export function Heading({ className, as: Component = "h2", ...props }: HeadingProps) {
  return (
    <Component
      className={cn(
        "font-serif font-medium tracking-tight text-white",
        Component === "h1" && "text-4xl lg:text-5xl",
        Component === "h2" && "text-3xl lg:text-4xl",
        Component === "h3" && "text-2xl lg:text-3xl",
        Component === "h4" && "text-xl lg:text-2xl",
        className
      )}
      {...props}
    />
  )
}
