export function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-1 w-full bg-white/10">
      <div 
        className="h-full bg-[#D4AF37] transition-all duration-500 ease-in-out" 
        style={{ width: `${progress}%` }} 
      />
    </div>
  );
}
