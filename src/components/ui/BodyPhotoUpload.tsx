"use client";

import * as React from "react";
import { Upload, Check, RefreshCw, Camera, X } from "lucide-react";
import { VenusButton } from "./VenusButton";

interface BodyPhotoUploadProps {
  onPhotoSelected: (photoData: string) => void;
  onUseCamera: () => void;
}

export function BodyPhotoUpload({ onPhotoSelected, onUseCamera }: BodyPhotoUploadProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSelectedImage(result);
      setIsPreviewMode(true);
    };
    reader.onerror = () => {
      setError("Não consegui ler essa foto. Tente outra imagem ou use a câmera.");
      setSelectedImage(null);
      setIsPreviewMode(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (selectedImage) {
      onPhotoSelected(selectedImage);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRetake = () => {
    setSelectedImage(null);
    setIsPreviewMode(false);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  if (isPreviewMode && selectedImage) {
    return (
      <div className="relative flex h-[72dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-2xl sm:h-[70vh] sm:rounded-3xl">
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#1c1c1e]">
          <img
            src={selectedImage}
            alt="Preview"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          <button
            onClick={handleRetake}
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/80 backdrop-blur-md transition-all hover:bg-white/20 sm:right-4 sm:top-4 sm:h-10 sm:w-10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative z-20 flex min-h-[7.75rem] flex-col items-center justify-between border-t border-white/5 bg-[#121212] px-4 py-4 sm:h-32 sm:px-6">
          <p className="mb-3 text-center text-[13px] leading-relaxed text-white/70 sm:mb-2 sm:text-sm">
            Essa foto está no ponto? Confirme para seguir.
          </p>

          <div className="flex w-full items-center justify-between px-2 sm:px-4">
            <button
              onClick={handleRetake}
              className="flex flex-col items-center gap-1 text-white/60 transition-colors hover:text-white"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 sm:h-12 sm:w-12">
                <RefreshCw className="h-5 w-5" />
              </div>
              <span className="text-xs">Trocar</span>
            </button>

            <button
              onClick={handleConfirm}
              className="flex flex-col items-center gap-1 text-[#D4AF37] transition-colors hover:text-[#D4AF37]/80"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#D4AF37] bg-[#D4AF37]/20 shadow-[0_0_15px_rgba(212,175,55,0.4)] sm:h-16 sm:w-16">
                <Check className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <span className="font-serif text-xs font-bold">Usar foto</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[72dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-2xl sm:h-[70vh] sm:rounded-3xl">
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-[#1c1c1e] p-6">
        <div className="absolute inset-0 bg-gradient-to-b from-[#D4AF37]/5 via-transparent to-transparent" />
        
        <div className="relative z-10 flex flex-col items-center text-center space-y-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Upload className="h-8 w-8 text-white/60" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Envie uma foto de corpo inteiro</h3>
            <p className="text-sm text-white/60 max-w-[280px]">
              A Venus lê melhor quando a silhueta está inteira, em pé e com luz frontal.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          <VenusButton
            type="button"
            onClick={triggerFileSelect}
            className="w-full max-w-[240px]"
          >
            <span className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Escolher foto
            </span>
          </VenusButton>

          <div className="flex items-center gap-2">
            <div className="h-px w-12 bg-white/20" />
            <span className="text-xs text-white/40">ou</span>
            <div className="h-px w-12 bg-white/20" />
          </div>

          <button
            onClick={onUseCamera}
            className="flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
          >
            <Camera className="h-4 w-4" />
            Abrir câmera
          </button>

          {error ? <p className="text-center text-xs text-[#ffb6a8]">{error}</p> : null}
        </div>
      </div>

      <div className="relative z-20 flex min-h-[4rem] items-center justify-center border-t border-white/5 bg-[#121212] px-4 py-3 sm:px-6">
        <p className="text-[11px] text-white/40">
          JPG, PNG ou WebP funcionam bem.
        </p>
      </div>
    </div>
  );
}
