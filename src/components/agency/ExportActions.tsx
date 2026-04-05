import Link from "next/link";

import { VenusButton } from "@/components/ui/VenusButton";

export interface ExportActionsProps {
  csvHref: string;
  jsonHref: string;
}

export function ExportActions({ csvHref, jsonHref }: ExportActionsProps) {
  return (
    <>
      <Link href={csvHref}>
        <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
          CSV
        </VenusButton>
      </Link>
      <Link href={jsonHref}>
        <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
          JSON
        </VenusButton>
      </Link>
    </>
  );
}
