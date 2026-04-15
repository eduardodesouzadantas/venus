export default function Loading() {
  return (
    <div className="min-h-screen bg-black px-8 py-12 text-white">
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <div className="h-8 w-64 rounded bg-white/10" />
        <div className="h-4 w-96 rounded bg-white/5" />
        <div className="grid gap-4 md:grid-cols-4">
          <div className="h-24 rounded-3xl bg-white/5" />
          <div className="h-24 rounded-3xl bg-white/5" />
          <div className="h-24 rounded-3xl bg-white/5" />
          <div className="h-24 rounded-3xl bg-white/5" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="h-96 rounded-[34px] bg-white/5" />
            <div className="h-80 rounded-[34px] bg-white/5" />
          </div>
          <div className="space-y-6">
            <div className="h-72 rounded-[34px] bg-white/5" />
            <div className="h-72 rounded-[34px] bg-white/5" />
            <div className="h-72 rounded-[34px] bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
