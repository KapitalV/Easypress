"use client";

import React, { useState } from "react";
import { Sliders, X, ChevronUp } from "lucide-react";
import CompressionSettings, { CompressionOptions } from "./CompressionSettings";

interface MobileBottomSheetProps {
  options: CompressionOptions;
  onChange: (options: CompressionOptions) => void;
  onCompress: () => void;
  fileCount: number;
  isSubmitting?: boolean;
}

export default function MobileBottomSheet({
  options,
  onChange,
  onCompress,
  fileCount,
  isSubmitting,
}: MobileBottomSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Peek Bar pinned at bottom of viewport on mobile (< md) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 p-4 bg-white/95 backdrop-blur-xl border-t border-slate-200 flex items-center justify-between gap-3 shadow-2xl">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold"
        >
          <Sliders className="w-4 h-4 text-indigo-600" />
          <span>
            {options.mode === "optimal"
              ? "Optimal"
              : `${options.targetMinKb}–${options.targetMaxKb}KB`}
          </span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
        </button>

        <button
          onClick={onCompress}
          disabled={fileCount === 0 || isSubmitting}
          className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-sm shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span>Compress ({fileCount})</span>
          )}
        </button>
      </div>

      {/* Drawer Overlay Modal */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs">
          <div className="flex-1" onClick={() => setIsOpen(false)} />

          <div className="w-full max-h-[85vh] overflow-y-auto bg-white border-t border-slate-200 rounded-t-3xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
              <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto" />
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <CompressionSettings
              options={options}
              onChange={onChange}
              onCompress={() => {
                setIsOpen(false);
                onCompress();
              }}
              fileCount={fileCount}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}
    </>
  );
}
