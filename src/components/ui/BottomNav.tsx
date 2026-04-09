import Link from "next/link";
import { VenusButton } from "@/components/ui/VenusButton";
import { ArrowRight, ArrowLeft } from "lucide-react";

interface BottomNavProps {
  nextHref: string;
  nextDisabled?: boolean;
  onNext?: () => void;
  backHref?: string;
  showBack?: boolean;
}

export function BottomNav({ nextHref, nextDisabled = false, onNext, backHref, showBack = true }: BottomNavProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-black/95 backdrop-blur-sm px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3 border-t border-white/5">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        {showBack && backHref ? (
          <Link href={backHref} className="flex-shrink-0">
            <VenusButton variant="glass" className="h-11 w-11 rounded-full p-0 sm:h-12 sm:w-12">
              <ArrowLeft className="h-5 w-5" />
            </VenusButton>
          </Link>
        ) : (
          <div className="w-11 sm:w-12" />
        )}

        <Link
          href={nextDisabled ? "#" : nextHref}
          onClick={(e) => {
            if (nextDisabled) e.preventDefault();
            if (!nextDisabled && onNext) onNext();
          }}
          className="flex-1"
        >
          <VenusButton variant="solid" className="flex w-full items-center justify-center gap-2" disabled={nextDisabled}>
            Continuar <ArrowRight className="h-4 w-4" />
          </VenusButton>
        </Link>
      </div>
    </div>
  );
}
