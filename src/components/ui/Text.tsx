import * as React from "react"
import { cn } from "@/lib/utils"

export type TextProps = React.HTMLAttributes<HTMLParagraphElement>;

export function Text({ className, ...props }: TextProps) {
  return (
    <p
      className={cn("font-sans text-[15px] leading-7 text-white/70 sm:text-base", className)}
      {...props}
    />
  )
}
