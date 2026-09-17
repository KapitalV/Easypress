"use client";

import React from "react";
import { Sliders, Zap, Target, ArrowRight, Info, CheckCircle2 } from "lucide-react";

export interface CompressionOptions {
  mode: "optimal" | "target";
  targetMinKb: number;
  targetMaxKb: number;
}

interface CompressionSettingsProps {
  options: CompressionOptions;
  onChange: (options: CompressionOptions) => void;
  onCompress: () => void;
  fileCount: number;
  isSubmitting?: boolean;
}

export default function CompressionSettings({
  options,
  onChange,
  onCompress,
  fileCount,
  isSubmitting = false,
}: CompressionSettingsProps) {
  const setMode = (mode: "optimal" | "target") => {
    onChange({ ...options, mode });
  };

  const setTargetRange = (min: number, max: number) => {
    onChange({ ...options, mode: "target", targetMinKb: min, targetMaxKb: max });
  };

  return (
    <div className="w-full rounded-3xl glass-panel p-6 sm:p-7 flex flex-col gap-6 border border-slate-200 shadow-lg bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
          <Sliders className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Compression Settings</h3>
          <p className="text-xs text-slate-600">Configure optimization parameters</p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          Compression Mode
        </label>
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setMode("optimal")}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              options.mode === "optimal"
                ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Optimal</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("target")}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              options.mode === "target"
                ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Target Size</span>
          </button>
        </div>
      </div>

      {/* Optimal Mode Explanation */}
      {options.mode === "optimal" ? (
        <div className="rounded-2xl bg-indigo-50/60 border border-indigo-200 p-4.5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Automatic Visual Optimization</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            Intelligently balances compression ratio and perceptual image quality.
            Preserves crisp details, strips bloated metadata, and optimizes color palettes.
          </p>
          <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-slate-600 font-mono">
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
              WebP / JPEG: Q80
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
              PNG: OxiPNG 6
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
              EXIF: Auto-stripped
            </span>
          </div>
        </div>
      ) : (
        /* Target Size Mode Controls */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Exact Size Target (KB)
            </span>
            <span className="text-xs font-bold text-indigo-700 font-mono">
              {options.targetMinKb} KB – {options.targetMaxKb} KB
            </span>
          </div>

          {/* Quick Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setTargetRange(10, 20)}
              className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                options.targetMinKb === 10 && options.targetMaxKb === 20
                  ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <span className="text-[11px] font-bold">Govt / Passport</span>
              <span className="text-[10px] text-slate-600 font-mono">10 – 20 KB</span>
            </button>

            <button
              type="button"
              onClick={() => setTargetRange(20, 50)}
              className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                options.targetMinKb === 20 && options.targetMaxKb === 50
                  ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <span className="text-[11px] font-bold">Web Asset</span>
              <span className="text-[10px] text-slate-600 font-mono">20 – 50 KB</span>
            </button>

            <button
              type="button"
              onClick={() => setTargetRange(50, 100)}
              className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                options.targetMinKb === 50 && options.targetMaxKb === 100
                  ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <span className="text-[11px] font-bold">Standard Web</span>
              <span className="text-[10px] text-slate-600 font-mono">50 – 100 KB</span>
            </button>
          </div>

          {/* Numeric inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-slate-600 font-semibold">
                Minimum Size (KB)
              </label>
              <input
                type="number"
                min={5}
                max={options.targetMaxKb - 1}
                value={options.targetMinKb}
                onChange={(e) => {
                  const val = Math.max(5, parseInt(e.target.value) || 5);
                  onChange({
                    ...options,
                    targetMinKb: Math.min(val, options.targetMaxKb - 1),
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-slate-600 font-semibold">
                Maximum Size (KB)
              </label>
              <input
                type="number"
                min={options.targetMinKb + 1}
                max={500}
                value={options.targetMaxKb}
                onChange={(e) => {
                  const val = Math.max(options.targetMinKb + 1, parseInt(e.target.value) || 20);
                  onChange({
                    ...options,
                    targetMaxKb: Math.min(500, val),
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Range Slider for visual interaction */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>10 KB</span>
              <span>50 KB</span>
              <span>100 KB</span>
              <span>200 KB</span>
            </div>
            <input
              type="range"
              min={10}
              max={150}
              step={5}
              value={options.targetMaxKb}
              onChange={(e) => {
                const max = parseInt(e.target.value);
                const min = Math.max(5, Math.floor(max * 0.4));
                onChange({ ...options, targetMinKb: min, targetMaxKb: max });
              }}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Info footnote */}
          <div className="flex items-start gap-2 text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              If image cannot fit within target size using quality scaling alone, it will be automatically downsampled in gentle 5% increments.
            </span>
          </div>
        </div>
      )}

      {/* Compress CTA Button */}
      <button
        type="button"
        disabled={fileCount === 0 || isSubmitting}
        onClick={onCompress}
        className="w-full py-4.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-base sm:text-lg flex items-center justify-center gap-3 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
      >
        {isSubmitting ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Starting Compression...</span>
          </>
        ) : (
          <>
            <span>Compress {fileCount} {fileCount === 1 ? "Image" : "Images"}</span>
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );
}
