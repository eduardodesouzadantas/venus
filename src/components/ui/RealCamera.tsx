"use client";

import * as React from "react";
import { RefreshCw, Check, SwitchCamera, AlertCircle } from "lucide-react";

interface RealCameraProps {
  instruction: string;
  overlayType: "face" | "body";
  onCaptured: (photoData: string) => void;
  showTimerOptions?: boolean;
}

export function RealCamera({ instruction, overlayType, onCaptured, showTimerOptions = false }: RealCameraProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [facingMode, setFacingMode] = React.useState<"user" | "environment">("user");
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const [timer, setTimer] = React.useState<number | null>(null);
  const [isCapturing, setIsCapturing] = React.useState(false);

  React.useEffect(() => {
    let currentStream: MediaStream | null = null;

    async function startCamera() {
      try {
        setError(null);
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const constraints = {
            video: {
              facingMode,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          };

          currentStream = await navigator.mediaDevices.getUserMedia(constraints);
          setStream(currentStream);

          if (videoRef.current) {
            videoRef.current.srcObject = currentStream;
          }
        } else {
          setError("Câmera não suportada neste navegador.");
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setError("Permissão da câmera negada ou dispositivo indisponível.");
      }
    }

    startCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

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

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      const maxWidth = 480;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (facingMode === "user") {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.5);
        setCapturedImage(imageDataUrl);
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleConfirm = () => {
    if (capturedImage) onCaptured(capturedImage);
  };

  return (
    <div className="relative flex h-[72dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-2xl sm:h-[70vh] sm:rounded-3xl">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#1c1c1e]">
        {error && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black px-6 text-center">
            <AlertCircle className="mb-4 h-10 w-10 text-red-500 sm:h-12 sm:w-12" />
            <p className="text-sm font-medium text-white/80">{error}</p>
            <p className="mt-2 text-xs text-white/50">Libere o acesso nas configurações do navegador e recarregue a página.</p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${facingMode === "user" && !capturedImage ? "scale-x-[-1]" : ""} ${capturedImage ? "hidden" : "block"}`}
        />

        <canvas ref={canvasRef} className="hidden" />

        {capturedImage && (
          <img
            src={capturedImage}
            alt="Captura"
            className={`absolute inset-0 h-full w-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
          />
        )}

        {!capturedImage && !error && (
          <>
            {overlayType === "face" && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div className="relative h-[15.5rem] w-[11rem] rounded-[88px] border-2 border-[#D4AF37] shadow-[0_0_0_9999px_rgba(0,0,0,0.62)] transition-all duration-300 sm:h-[18rem] sm:w-[13rem]">
                  <div className="absolute left-1/2 top-3 h-4 w-4 -translate-x-1/2 rounded-full border border-[#D4AF37]/60 bg-[#D4AF37]/10" />
                  <div className="absolute inset-x-4 bottom-4 rounded-[72px] border border-dashed border-[#D4AF37]/25" />
                  <div className="absolute -left-0.5 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full bg-[#D4AF37]/20" />
                  <div className="absolute -right-0.5 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full bg-[#D4AF37]/20" />
                </div>
              </div>
            )}
            {overlayType === "body" && (
              <div className="pointer-events-none absolute inset-0 z-10 flex h-full w-full flex-col justify-between px-3 py-6 shadow-[inset_0_0_100px_rgba(0,0,0,0.6)] sm:px-4 sm:py-8">
                <div className="w-full border-t-2 border-dashed border-[#D4AF37]/90 text-center">
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 text-xs text-[#D4AF37]">
                    Topo / Cabeça
                  </span>
                </div>
                <div className="relative w-full border-t-2 border-dashed border-[#D4AF37]/90 text-center">
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 text-xs text-[#D4AF37]">
                    Base / Pés
                  </span>
                </div>
              </div>
            )}

            {timer !== null && timer > 0 && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <div className="animate-ping font-serif text-7xl text-white drop-shadow-[0_0_20px_rgba(255,255,255,1)] sm:text-8xl">
                  {timer}
                </div>
              </div>
            )}

            {!isCapturing && (
              <button
                onClick={toggleCamera}
                className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/80 backdrop-blur-md transition-all hover:bg-white/20 sm:right-4 sm:top-4 sm:h-10 sm:w-10"
              >
                <SwitchCamera className="h-5 w-5" />
              </button>
            )}
          </>
        )}
      </div>

      <div className="relative z-20 flex min-h-[7.75rem] flex-col items-center justify-between border-t border-white/5 bg-[#121212] px-4 py-4 sm:h-32 sm:px-6">
        {!capturedImage && <p className="mb-3 text-center text-[13px] leading-relaxed text-white/70 sm:mb-2 sm:text-sm">{instruction}</p>}

        {capturedImage ? (
          <div className="flex w-full items-center justify-between px-2 sm:px-4">
            <button onClick={handleRetake} className="flex flex-col items-center gap-1 text-white/60 transition-colors hover:text-white">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 sm:h-12 sm:w-12">
                <RefreshCw className="h-5 w-5" />
              </div>
              <span className="text-xs">Refazer</span>
            </button>

            <button onClick={handleConfirm} className="flex flex-col items-center gap-1 text-[#D4AF37] transition-colors hover:text-[#D4AF37]/80">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#D4AF37] bg-[#D4AF37]/20 shadow-[0_0_15px_rgba(212,175,55,0.4)] sm:h-16 sm:w-16">
                <Check className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <span className="font-serif text-xs font-bold">Usar captura</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 sm:gap-6">
            {showTimerOptions ? (
              <>
                <button
                  onClick={() => capturePhoto(3)}
                  disabled={isCapturing || !!error}
                  className="flex h-11 w-11 flex-col items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 disabled:opacity-50 hover:bg-white/10 sm:h-12 sm:w-12"
                >
                  <span className="text-sm font-medium">3s</span>
                </button>
                <button
                  onClick={() => capturePhoto(0)}
                  disabled={isCapturing || !!error}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-transform active:scale-95 disabled:opacity-50 sm:h-16 sm:w-16"
                >
                  <div className="h-12 w-12 rounded-full border-2 border-black sm:h-14 sm:w-14" />
                </button>
                <button
                  onClick={() => capturePhoto(10)}
                  disabled={isCapturing || !!error}
                  className="flex h-11 w-11 flex-col items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 disabled:opacity-50 hover:bg-white/10 sm:h-12 sm:w-12"
                >
                  <span className="text-sm font-medium">10s</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => capturePhoto(0)}
                disabled={isCapturing || !!error}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-transform active:scale-95 disabled:opacity-50 sm:h-16 sm:w-16"
              >
                <div className="h-12 w-12 rounded-full border-2 border-black sm:h-14 sm:w-14" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
