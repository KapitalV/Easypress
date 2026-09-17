"use client";

import React, { useRef, useState } from "react";
import {
  Upload,
  Camera,
  ArrowUpRight,
  FileCheck,
  SlidersHorizontal,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface HeroDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  onSwitchToEnrollment: () => void;
}

export default function HeroDropzone({
  onFilesSelected,
  onSwitchToEnrollment,
}: HeroDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = filterImageFiles(Array.from(e.dataTransfer.files));
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = filterImageFiles(Array.from(e.target.files));
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
    e.target.value = "";
  };

  const filterImageFiles = (files: File[]) => {
    const validExtensions = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    return files.filter(
      (f) =>
        validExtensions.includes(f.type) ||
        /\.(jpe?g|png|webp|gif|svg)$/i.test(f.name)
    );
  };

  return (
    <div className="w-full mx-auto pt-2">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        onChange={handleFileInputChange}
        className="hidden"
        id="file-upload-input"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
        id="camera-upload-input"
      />

      {/* RESPONSIVE BENTO GRID (Single-column on mobile, 12-column Bento Dashboard on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* 1. LEFT MAIN HERO WIDGET (White Card — 7 cols on desktop) */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`lg:col-span-7 widget-white rounded-[32px] p-6 sm:p-9 flex flex-col justify-between min-h-[320px] lg:min-h-[460px] cursor-pointer transition-all duration-200 border ${
            isDragging ? "ring-4 ring-blue-500 bg-blue-50/50" : "hover:shadow-lg"
          }`}
        >
          {/* Widget Header */}
          <div className="flex items-start justify-between">
            <div>
              <span className="text-4xl sm:text-6xl font-black tracking-tight text-black block leading-none">
                Compress
              </span>
              <div className="flex items-center gap-2 mt-3">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-zinc-500">
                  Ready for single or batch images
                </span>
              </div>
            </div>

            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-800 hover:bg-zinc-200 transition-colors">
              <Upload className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
          </div>

          {/* Central CTA and Drag Area */}
          <div className="my-6 lg:my-8 flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-zinc-50/80 border-2 border-dashed border-zinc-200 hover:border-blue-400 hover:bg-blue-50/20 transition-all">
            <div className="px-8 py-4 rounded-2xl bg-black text-white font-bold text-base sm:text-lg flex items-center gap-2.5 shadow-md hover:bg-zinc-800 transition-colors">
              <Upload className="w-5 h-5" />
              <span>Select Images</span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-3">
              or drop your images anywhere inside
            </p>
          </div>

          {/* Bottom format specs with arrow */}
          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between text-xs sm:text-sm font-medium text-zinc-500">
            <span>Supports JPG • PNG • WebP • SVG • GIF (up to 25MB)</span>
            <div className="flex items-center gap-1 text-black font-semibold">
              <span>Upload</span>
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* 2. RIGHT BENTO COLUMN (5 cols on desktop) */}
        <div className="lg:col-span-5 flex flex-col gap-5 justify-between">
          {/* Dual Bento widgets */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left Widget: Enrollment Compress (Electric Blue) */}
            <div
              onClick={onSwitchToEnrollment}
              className="widget-blue rounded-[28px] p-5 sm:p-6 flex flex-col justify-between min-h-[190px] lg:min-h-[220px] cursor-pointer hover:opacity-95 transition-all shadow-md group"
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold tracking-wide uppercase opacity-85">
                  Exam & Govt
                </span>
                <ArrowUpRight className="w-4 h-4 opacity-85 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>

              <div>
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight block leading-tight">
                  Enrollment
                </span>
                <span className="text-xs opacity-90 block mt-1.5 leading-relaxed">
                  Photo (30–50KB) & Sign (10–30KB)
                </span>
              </div>

              <div className="pt-2 flex items-center gap-1.5 text-[11px] font-semibold opacity-95">
                <FileCheck className="w-3.5 h-3.5" />
                <span>Auto JPG Conversion</span>
              </div>
            </div>

            {/* Right Widget: Mobile Camera Capture (Soft Slate) */}
            <div
              onClick={() => cameraInputRef.current?.click()}
              className="widget-soft rounded-[28px] p-5 sm:p-6 flex flex-col justify-between min-h-[190px] lg:min-h-[220px] cursor-pointer hover:bg-[#d0deee] transition-all shadow-sm group"
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold tracking-wide uppercase text-slate-500">
                  Camera
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>

              <div>
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 block leading-tight">
                  Snap
                </span>
                <span className="text-xs text-slate-600 block mt-1.5 leading-relaxed">
                  Direct mobile camera & scan capture
                </span>
              </div>

              <div className="pt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                <Camera className="w-3.5 h-3.5" />
                <span>Instant Snap</span>
              </div>
            </div>
          </div>

          {/* 3. BOTTOM LIST WIDGET (Dark card with minimalist rows) */}
          <div className="widget-dark rounded-[28px] p-6 flex flex-col justify-center flex-1">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="py-3.5 flex items-center justify-between border-b border-zinc-800/80 cursor-pointer hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-zinc-300 group-hover:text-white">
                  Exact Target Size Engine (10–50KB)
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="py-3.5 flex items-center justify-between border-b border-zinc-800/80 cursor-pointer hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-zinc-300 group-hover:text-white">
                  Lossless & Perceptual Compression
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
            </div>

            <div className="pt-3.5 flex items-center justify-between text-zinc-400">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-zinc-400">
                  Privacy First: Auto TTL purge in 60 minutes
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
