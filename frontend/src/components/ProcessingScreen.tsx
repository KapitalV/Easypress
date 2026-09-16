"use client";

import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle, AlertCircle, Zap, ArrowRight } from "lucide-react";
import { FileInfo, formatBytes, subscribeToProgress, SSEEvent } from "@/lib/api";

interface ProcessingScreenProps {
  jobId: string;
  initialFiles: FileInfo[];
  onCompleted: (files: FileInfo[]) => void;
  onCancel: () => void;
}

export default function ProcessingScreen({
  jobId,
  initialFiles,
  onCompleted,
  onCancel,
}: ProcessingScreenProps) {
  const [files, setFiles] = useState<FileInfo[]>(initialFiles);
  const [batchProgress, setBatchProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Compressing images with multi-threaded engine...");

  useEffect(() => {
    const unsubscribe = subscribeToProgress(
      jobId,
      (event: SSEEvent) => {
        if (event.type === "job_complete") {
          setBatchProgress(100);
          setStatusMessage("All images compressed successfully!");
          setTimeout(() => {
            setFiles((currFiles) => {
              onCompleted(currFiles);
              return currFiles;
            });
          }, 800);
          return;
        }

        if (event.batch_progress !== undefined) {
          setBatchProgress(event.batch_progress);
        }

        if (event.file_id) {
          setFiles((prev) =>
            prev.map((f) => {
              if (f.file_id === event.file_id) {
                return {
                  ...f,
                  status: event.status || f.status,
                  progress: event.progress !== undefined ? event.progress : f.progress,
                  compressed_size: event.compressed_size !== undefined ? event.compressed_size : f.compressed_size,
                  savings_percent: event.savings_percent !== undefined ? event.savings_percent : f.savings_percent,
                  error: event.error || f.error,
                };
              }
              return f;
            })
          );
        }
      },
      (error) => {
        console.warn("SSE connection interrupted, fallback polling will keep it active", error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [jobId, onCompleted]);

  const computedProgress = Math.max(
    batchProgress,
    files.length > 0
      ? Math.round(
          files.reduce((acc, f) => acc + (f.status === "completed" ? 100 : f.progress || 0), 0) /
            files.length
        )
      : 0
  );

  const completedCount = files.filter((f) => f.status === "completed").length;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 flex flex-col items-center">
      {/* Central Progress Card */}
      <div className="w-full rounded-3xl glass-panel p-6 sm:p-10 flex flex-col items-center shadow-xl border border-slate-200 bg-white">
        {/* Animated Icon */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Zap className="w-10 h-10 animate-pulse" />
          </div>
          <div className="absolute -inset-2 rounded-2xl border border-indigo-200 animate-ping opacity-30" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 text-center mb-2">
          Optimizing Your Images
        </h2>
        <p className="text-sm text-slate-600 text-center max-w-md mb-8">
          {statusMessage}
        </p>

        {/* Big Overall Progress Bar */}
        <div className="w-full flex flex-col gap-2 mb-8">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>
              Processing {completedCount} of {files.length} images
            </span>
            <span className="font-mono text-indigo-600 text-sm">
              {computedProgress}%
            </span>
          </div>

          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${computedProgress}%` }}
            />
          </div>
        </div>

        {/* Per-File Progress List */}
        <div className="w-full flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
          {files.map((file) => {
            const isDone = file.status === "completed";
            const isError = file.status === "failed";
            const inProgress = !isDone && !isError;

            return (
              <div
                key={file.file_id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isDone ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : isError ? (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {file.original_filename}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] shrink-0">
                    <span className="text-slate-600 font-mono">
                      {formatBytes(file.original_size)}
                    </span>
                    {file.compressed_size ? (
                      <>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-emerald-700 font-bold font-mono">
                          {formatBytes(file.compressed_size)}
                        </span>
                        {file.savings_percent !== undefined && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                            -{Math.round(file.savings_percent)}%
                          </span>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Progress bar per file */}
                {inProgress && (
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-200"
                      style={{ width: `${file.progress || 35}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Cancel Button */}
        <div className="mt-8 flex justify-center w-full">
          <button
            onClick={onCancel}
            className="text-xs text-slate-600 hover:text-slate-800 underline transition-colors cursor-pointer"
          >
            Cancel and Return to Staging
          </button>
        </div>
      </div>
    </div>
  );
}
