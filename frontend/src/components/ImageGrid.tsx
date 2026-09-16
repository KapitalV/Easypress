"use client";

import React, { useRef } from "react";
import { Trash2, RotateCw, Plus } from "lucide-react";
import { formatBytes } from "@/lib/api";

export interface StagedFile {
  id: string;
  file: File;
  previewUrl: string;
  rotation: number;
}

interface ImageGridProps {
  files: StagedFile[];
  onRemoveFile: (id: string) => void;
  onRotateFile: (id: string) => void;
  onAddFiles: (files: File[]) => void;
  onClearAll: () => void;
}

export default function ImageGrid({
  files,
  onRemoveFile,
  onRotateFile,
  onAddFiles,
  onClearAll,
}: ImageGridProps) {
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((acc, curr) => acc + curr.file.size, 0);

  const handleAddMoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  const getFormatBadge = (filename: string, mime: string) => {
    if (mime.includes("png") || filename.endsWith(".png")) return "PNG";
    if (mime.includes("jpeg") || filename.match(/\.jpe?g$/i)) return "JPG";
    if (mime.includes("webp") || filename.endsWith(".webp")) return "WEBP";
    if (mime.includes("gif") || filename.endsWith(".gif")) return "GIF";
    if (mime.includes("svg") || filename.endsWith(".svg")) return "SVG";
    return "IMG";
  };

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>Staged Images</span>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
              {files.length} {files.length === 1 ? "image" : "images"}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Total size: <span className="text-slate-900 font-semibold">{formatBytes(totalSize)}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {files.map((item) => {
          const badge = getFormatBadge(item.file.name, item.file.type);
          return (
            <div
              key={item.id}
              className="group relative rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1"
            >
              {/* Image Preview Box */}
              <div className="relative w-full h-40 bg-slate-50 flex items-center justify-center overflow-hidden p-2">
                {/* Format badge */}
                <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-md text-[10px] font-bold text-slate-700 uppercase tracking-wider border border-slate-200 shadow-xs">
                  {badge}
                </div>

                {/* Quick overlay buttons */}
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onRotateFile(item.id)}
                    title="Rotate 90°"
                    className="w-8 h-8 rounded-lg bg-white/90 hover:bg-indigo-600 hover:text-white text-slate-700 flex items-center justify-center backdrop-blur-md border border-slate-200 shadow-sm transition-colors cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRemoveFile(item.id)}
                    title="Remove"
                    className="w-8 h-8 rounded-lg bg-white/90 hover:bg-rose-600 hover:text-white text-slate-700 flex items-center justify-center backdrop-blur-md border border-slate-200 shadow-sm transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* The actual image preview with rotation */}
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  style={{
                    transform: `rotate(${item.rotation}deg)`,
                    transition: "transform 0.25s ease-in-out",
                  }}
                  className="max-h-full max-w-full object-contain pointer-events-none"
                />
              </div>

              {/* Card Meta details */}
              <div className="p-3 flex flex-col bg-white border-t border-slate-100">
                <span
                  className="text-xs font-semibold text-slate-800 truncate"
                  title={item.file.name}
                >
                  {item.file.name}
                </span>
                <div className="flex items-center justify-between mt-1 text-[11px] text-slate-600">
                  <span>{formatBytes(item.file.size)}</span>
                  {item.rotation !== 0 && (
                    <span className="text-indigo-600 font-mono text-[10px] font-semibold">
                      {item.rotation}°
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add More Images Card */}
        <div
          onClick={() => addMoreInputRef.current?.click()}
          className="h-56 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all duration-200 group"
        >
          <input
            ref={addMoreInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            onChange={handleAddMoreChange}
            className="hidden"
          />
          <div className="w-12 h-12 rounded-xl bg-white group-hover:bg-indigo-600 text-slate-700 group-hover:text-white border border-slate-200 flex items-center justify-center mb-3 shadow-xs transition-colors">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-600">
            Add More Images
          </span>
          <span className="text-xs text-slate-600 mt-1">or drag files here</span>
        </div>
      </div>
    </div>
  );
}
