"use client";

import * as React from "react";
import { Camera, RefreshCw, Check } from "lucide-react";
import { VenusButton } from "@/components/ui/VenusButton";

interface SimulatedCameraProps {
  instruction: string;
  overlayType: "face" | "body";
  onCaptured: (photoData: string) => void;
  showTimerOptions?: boolean;
}

export function SimulatedCamera({ instruction, overlayType, onCaptured, showTimerOptions = false }: SimulatedCameraProps) {
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const [timer, setTimer] = React.useState<number | null>(null);
  const [isCapturing, setIsCapturing] = React.useState(false);

  const capturePhoto = (delaySecs: number) => {
    if (delaySecs > 0) {
      setIsCapturing(true);
      setTimer(delaySecs);
      let t = delaySecs;
      const interval = setInterval(() => {
        t -= 1;
        setTimer(t);
        if (t <= 0) {
          clearInterval(interval);
          snap();
        }
      }, 1000);
    } else {
      snap();
    }
  };

  const snap = () => {
    setTimer(null);
    setIsCapturing(false);
    // Dummy base64 placeholder simulanting a photo
    const fakeImage = "simulated_base64_string_" + Date.now();
    setCapturedImage(fakeImage);
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleConfirm = () => {
    if (capturedImage) onCaptured(capturedImage);
  };

  return (
    <div className="relative w-full h-[70vh] bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
      {/* 1. Camera Viewfinder (Simulated via neutral color to simulate raw feed) */}
      <div className="flex-1 relative bg-[#1c1c1e] flex items-center justify-center">
        {capturedImage ? (
          <div className="absolute inset-0 bg-[#2C2C2E] flex items-center justify-center">
            {/* Visual indication of captured photo */}
            <span className="text-white/50 text-sm italic">Foto Capturada</span>
          </div>
        ) : (
          <>
            {/* Overlays */}
            {overlayType === "face" && (
              <div className="w-56 h-72 border-2 border-[#D4AF37] rounded-[100px] shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] z-10 transition-all duration-300 pointer-events-none" />
            )}
            {overlayType === "body" && (
              <div className="w-full h-full flex flex-col justify-between absolute inset-0 py-8 px-4 z-10 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] pointer-events-none">
                <div className="w-full border-t-2 border-dashed border-[#D4AF37]/70 text-center"><span className="text-xs text-[#D4AF37] bg-black/50 px-2 rounded-full absolute -top-2 left-1/2 -translate-x-1/2">Topo</span></div>
                <div className="w-full border-t-2 border-dashed border-[#D4AF37]/70 text-center relative"><span className="text-xs text-[#D4AF37] bg-black/50 px-2 rounded-full absolute -top-2 left-1/2 -translate-x-1/2">Base</span></div>
              </div>
            )}

            {/* Timer Indication */}
            {timer !== null && timer > 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm">
                <div className="text-8xl font-serif text-white drop-shadow-[0_0_20px_rgba(255,255,255,1)] animate-pulse">
                  {timer}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 2. Controls Area */}
      <div className="h-32 bg-[#121212] px-6 py-4 flex flex-col items-center justify-between border-t border-white/5 relative z-20">
        {!capturedImage && (
          <p className="text-white/70 text-sm mb-2">{instruction}</p>
        )}
        
        {capturedImage ? (
          <div className="flex w-full justify-between items-center px-4">
            <button onClick={handleRetake} className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"><RefreshCw className="w-5 h-5"/></div>
              <span className="text-xs">Refazer</span>
            </button>

            <button onClick={handleConfirm} className="flex flex-col items-center gap-1 text-[#D4AF37] hover:text-[#D4AF37]/80 transition-colors">
              <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 border-2 border-[#D4AF37] flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.4)]">
                <Check className="w-8 h-8"/>
              </div>
              <span className="text-xs font-bold font-serif">Perfeito</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            {showTimerOptions ? (
              <>
                <button 
                  onClick={() => capturePhoto(3)}
                  disabled={isCapturing}
                  className="w-12 h-12 flex flex-col items-center justify-center rounded-full bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="text-sm font-medium">3s</span>
                </button>
                <button 
                  onClick={() => capturePhoto(0)} 
                  disabled={isCapturing}
                  className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 active:scale-95 transition-transform"
                >
                  <div className="w-14 h-14 border-2 border-black rounded-full" />
                </button>
                <button 
                  onClick={() => capturePhoto(10)}
                  disabled={isCapturing}
                  className="w-12 h-12 flex flex-col items-center justify-center rounded-full bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="text-sm font-medium">10s</span>
                </button>
              </>
            ) : (
              <button 
                onClick={() => capturePhoto(0)}
                disabled={isCapturing} 
                className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 active:scale-95 transition-transform"
              >
                <div className="w-14 h-14 border-2 border-black rounded-full" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
