import * as React from "react"
import { GlassContainer } from "./GlassContainer";
import { Heading } from "./Heading";
import { Text } from "./Text";

export function BentoGridBlock({ title, description, icon }: { title: string, description: string, icon?: React.ReactNode }) {
  return (
    <GlassContainer className="p-5 flex flex-col h-full hover:bg-white/10 transition-colors cursor-pointer">
      {icon && <div className="mb-3 text-[#D4AF37] opacity-80">{icon}</div>}
      <Heading as="h5" className="text-lg font-sans font-bold leading-tight mb-2">{title}</Heading>
      <Text className="text-xs text-white/60 flex-1">{description}</Text>
    </GlassContainer>
  )
}
