"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { X, SlidersHorizontal, Download } from "lucide-react";
import { FileInfo, formatBytes, getDownloadUrl, getOriginalUrl } from "@/lib/api";

interface CompareSliderProps {
  jobId: string;
  file: FileInfo;
  onClose: () => void;
}

export default function CompareSlider({ jobId, file, onClose }: CompareSliderProps) {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const originalSrc = getOriginalUrl(jobId, file.file_id);
  const compressedSrc = getDownloadUrl(jobId, file.file_id);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(5, Math.min(95, (x / rect.width) * 100));
      setSliderPos(pct);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    } else {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:px-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <SlidersHorizontal className="w-5 h-5 text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {file.original_filename}
              </h3>
              <p className="text-xs text-slate-400">
                Drag the divider left or right to inspect compression fidelity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={compressedSrc}
              download={file.original_filename}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Comparison Display Area */}
        <div className="flex-1 p-4 sm:p-6 flex flex-col items-center justify-center overflow-hidden bg-slate-950">
          <div
            ref={containerRef}
            className="relative w-full h-[55vh] max-h-[500px] select-none rounded-2xl overflow-hidden bg-slate-900/60 border border-slate-800 flex items-center justify-center cursor-ew-resize"
            onPointerDown={(e) => {
              setIsDragging(true);
              if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left;
                setSliderPos(Math.max(5, Math.min(95, (x / rect.width) * 100)));
              }
            }}
          >
            {/* Compressed (Underneath / Right side full canvas) */}
            <img
              src={compressedSrc}
              alt="Compressed"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />

            {/* Original (Clipped on Left side) */}
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ width: `${sliderPos}%` }}
            >
              <img
                src={originalSrc}
                alt="Original"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                style={{
                  width: containerRef.current
                    ? `${containerRef.current.clientWidth}px`
                    : "100%",
                  maxWidth: "none",
                }}
              />
            </div>

            {/* Draggable Divider Line */}
            <div
              className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-lg pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            >
              {/* Divider Handle Knob */}
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-indigo-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-[10px] font-bold">
                ⬌
              </div>
            </div>

            {/* Left Label badge (Original) */}
            <div className="absolute bottom-3 left-3 z-30 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-xs font-mono text-slate-200 pointer-events-none">
              <span className="text-slate-400">Original: </span>
              <span className="font-bold">{formatBytes(file.original_size)}</span>
            </div>

            {/* Right Label badge (Compressed) */}
            <div className="absolute bottom-3 right-3 z-30 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-emerald-500/30 text-xs font-mono text-emerald-300 pointer-events-none">
              <span className="text-slate-400">Compressed: </span>
              <span className="font-bold text-emerald-400">
                {formatBytes(file.compressed_size || file.original_size)}
              </span>
              {file.savings_percent ? (
                <span className="ml-1 text-emerald-400">
                  (-{Math.round(file.savings_percent)}%)
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="p-3.5 px-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Divider: {Math.round(sliderPos)}%</span>
          <span>
            {file.was_downsampled
              ? `Downsampled to ${file.output_width}×${file.output_height}`
              : "100% Native Resolution"}
          </span>
        </div>
      </div>
    </div>
  );
}
