"use client";

import React, { useEffect, useState } from "react";
import {
  Download,
  Sparkles,
  RefreshCw,
  Eye,
  Pause,
  Play,
  FileArchive,
} from "lucide-react";
import { FileInfo, formatBytes, getDownloadUrl } from "@/lib/api";

interface DownloadSummaryProps {
  jobId: string;
  files: FileInfo[];
  onCompareFile: (file: FileInfo) => void;
  onReset: () => void;
}

export default function DownloadSummary({
  jobId,
  files,
  onCompareFile,
  onReset,
}: DownloadSummaryProps) {
  const [countdown, setCountdown] = useState(3);
  const [isAutoDownloadPaused, setIsAutoDownloadPaused] = useState(false);
  const [hasTriggeredDownload, setHasTriggeredDownload] = useState(false);

  const totalOriginal = files.reduce((acc, f) => acc + (f.original_size || 0), 0);
  const totalCompressed = files.reduce(
    (acc, f) => acc + (f.compressed_size || f.original_size || 0),
    0
  );
  const totalSavedBytes = Math.max(0, totalOriginal - totalCompressed);
  const overallSavingsPercent =
    totalOriginal > 0 ? Math.round((totalSavedBytes / totalOriginal) * 100) : 0;

  useEffect(() => {
    if (isAutoDownloadPaused || hasTriggeredDownload || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerDownload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, isAutoDownloadPaused, hasTriggeredDownload]);

  const triggerDownload = () => {
    setHasTriggeredDownload(true);
    const downloadUrl = getDownloadUrl(jobId);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", files.length === 1 ? files[0].original_filename : "compressed-images.zip");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center gap-8">
      {/* Celebration Header Card */}
      <div className="w-full rounded-3xl glass-panel p-8 sm:p-10 flex flex-col items-center text-center shadow-xl border border-slate-200 bg-white relative overflow-hidden">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-4">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>Optimization Complete</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-3">
          Your images are now{" "}
          <span className="text-emerald-700">
            {overallSavingsPercent}% smaller!
          </span>
        </h1>

        {/* Size comparison pill */}
        <div className="flex items-center gap-4 text-sm sm:text-base font-mono mt-2 mb-8 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-200">
          <span className="text-slate-600 line-through">
            {formatBytes(totalOriginal)}
          </span>
          <span className="text-emerald-600 font-bold text-lg">→</span>
          <span className="text-emerald-700 font-extrabold text-lg">
            {formatBytes(totalCompressed)}
          </span>
          <span className="text-xs text-slate-600 font-sans hidden sm:inline">
            (Saved {formatBytes(totalSavedBytes)})
          </span>
        </div>

        {/* Big Download Button */}
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <button
            onClick={triggerDownload}
            className="w-full py-5 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-lg sm:text-xl flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/25 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {files.length > 1 ? (
              <FileArchive className="w-6 h-6" />
            ) : (
              <Download className="w-6 h-6" />
            )}
            <span>
              {files.length > 1 ? "Download All (.ZIP)" : "Download Compressed Image"}
            </span>
          </button>

          {/* Auto-download countdown notice */}
          {!hasTriggeredDownload && countdown > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>Auto-download starting in {countdown}s</span>
              <button
                onClick={() => setIsAutoDownloadPaused(!isAutoDownloadPaused)}
                className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 cursor-pointer font-medium"
              >
                {isAutoDownloadPaused ? (
                  <>
                    <Play className="w-3 h-3" /> Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-3 h-3" /> Pause
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Per-Image Results Grid */}
      <div className="w-full flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold text-slate-900">Processed Files</h3>
          <span className="text-xs text-slate-600 font-medium">
            {files.length} {files.length === 1 ? "file" : "files"} ready
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {files.map((file) => {
            const singleSavings = file.savings_percent || 0;
            const singleDownloadUrl = getDownloadUrl(jobId, file.file_id);

            return (
              <div
                key={file.file_id}
                className="glass-panel p-4 rounded-2xl flex items-center justify-between gap-3 border border-slate-200 bg-white shadow-xs"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className="text-sm font-bold text-slate-800 truncate"
                    title={file.original_filename}
                  >
                    {file.original_filename}
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-xs font-mono">
                    <span className="text-slate-600 line-through text-[11px]">
                      {formatBytes(file.original_size)}
                    </span>
                    <span className="text-emerald-700 font-bold">
                      {formatBytes(file.compressed_size || file.original_size)}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                      -{Math.round(singleSavings)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Compare Button */}
                  <button
                    onClick={() => onCompareFile(file)}
                    title="Compare before and after"
                    className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold border border-slate-200 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="hidden sm:inline">Compare</span>
                  </button>

                  {/* Single Download Link */}
                  <a
                    href={singleDownloadUrl}
                    download={file.original_filename}
                    className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
                    title="Download single file"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset / Compress More button */}
      <div className="pt-4 flex justify-center">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm border border-slate-300 shadow-xs transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Compress More Images</span>
        </button>
      </div>
    </div>
  );
}
