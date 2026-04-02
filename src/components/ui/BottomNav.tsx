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
    <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black via-black/90 to-transparent pb-8">
      <div className="max-w-md mx-auto flex items-center justify-between gap-4">
        {showBack && backHref ? (
          <Link href={backHref} className="flex-shrink-0">
            <VenusButton variant="glass" className="w-14 h-14 p-0 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </VenusButton>
          </Link>
        ) : (
          <div className="w-14" /> // Placeholder
        )}
        
        <Link 
          href={nextDisabled ? "#" : nextHref} 
          onClick={(e) => {
            if (nextDisabled) e.preventDefault();
            if (!nextDisabled && onNext) onNext();
          }}
          className="flex-1"
        >
          <VenusButton 
            variant="solid" 
            className="w-full flex items-center gap-2 justify-center"
            disabled={nextDisabled}
          >
            Avançar <ArrowRight className="w-4 h-4" />
          </VenusButton>
        </Link>
      </div>
    </div>
  );
}
