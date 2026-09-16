"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  Check,
  Download,
  FileArchive,
  RefreshCw,
  Sparkles,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  User,
  PenTool,
} from "lucide-react";
import {
  formatBytes,
  uploadEnrollment,
  EnrollmentResponse,
  getDownloadUrl,
} from "@/lib/api";

export default function EnrollmentCompress() {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [signFile, setSignFile] = useState<File | null>(null);
  const [signPreview, setSignPreview] = useState<string | null>(null);

  const [prefix, setPrefix] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<EnrollmentResponse | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const signInputRef = useRef<HTMLInputElement>(null);

  const cleanPrefix = prefix.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const samplePrefix = cleanPrefix || "ravi";

  const handlePhotoSelect = (file: File) => {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  const handleSignSelect = (file: File) => {
    setSignFile(file);
    setSignPreview(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  const handleCompress = async () => {
    if (!photoFile) {
      setErrorMessage("Please select or capture the Candidate Photo.");
      return;
    }
    if (!signFile) {
      setErrorMessage("Please select or capture the Signature.");
      return;
    }
    if (!cleanPrefix) {
      setErrorMessage("Please enter the candidate name / file prefix (e.g. 'ravi').");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const data = await uploadEnrollment(photoFile, signFile, cleanPrefix);
      setResult(data);
    } catch (err: any) {
      console.error("Enrollment compression failed:", err);
      setErrorMessage(
        err.message || "Compression failed. Please make sure the backend server is running."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (signPreview) URL.revokeObjectURL(signPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setSignFile(null);
    setSignPreview(null);
    setPrefix("");
    setResult(null);
    setErrorMessage(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-5 pt-2">
      {/* Hidden file inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handlePhotoSelect(e.target.files[0]);
          }
        }}
        className="hidden"
      />
      <input
        ref={signInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleSignSelect(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Enrollment Compress
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Simultaneously process Candidate Photo and Signature for exam/job portals
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1c1c20] border border-white/10 text-xs font-semibold text-blue-400 self-start sm:self-auto">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Auto-formatted to .JPG</span>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-200"
          >
            ✕
          </button>
        </div>
      )}

      {!result ? (
        <>
          {/* RESPONSIVE DUAL UPLOAD SLOTS (Side-by-side on desktop, stacked on mobile) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
            {/* 1. PHOTO WIDGET CARD (White Card) */}
            <div
              onClick={() => photoInputRef.current?.click()}
              className="widget-white rounded-[32px] p-6 sm:p-7 flex flex-col justify-between min-h-[260px] sm:min-h-[290px] cursor-pointer hover:shadow-xl transition-all border border-zinc-100"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Step 1 • Portrait
                  </span>
                  <span className="text-3xl sm:text-4xl font-extrabold text-black block mt-1">
                    Photo
                  </span>
                  <span className="text-xs text-zinc-500 block mt-0.5">
                    Passport size portrait
                  </span>
                </div>
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700">
                  {photoFile ? <Check className="w-5 h-5 text-emerald-600" /> : <User className="w-5 h-5" />}
                </div>
              </div>

              {photoPreview ? (
                <div className="flex items-center gap-4 my-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-200/60">
                  <div className="w-20 h-24 rounded-xl overflow-hidden bg-zinc-200 border border-zinc-300 shrink-0">
                    <img src={photoPreview} alt="Photo" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-black truncate">{photoFile?.name}</p>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">{photoFile ? formatBytes(photoFile.size) : ""}</p>
                    <span className="text-xs text-blue-600 font-bold mt-1.5 inline-block">Tap to replace</span>
                  </div>
                </div>
              ) : (
                <div className="my-4 py-5 px-4 rounded-2xl bg-zinc-50/90 border-2 border-dashed border-zinc-200 text-center hover:bg-zinc-100/80 transition-colors">
                  <Upload className="w-6 h-6 text-zinc-400 mx-auto mb-1.5" />
                  <span className="text-xs sm:text-sm font-bold text-zinc-700 block">Tap to upload candidate photo</span>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">JPG, PNG, WebP supported</span>
                </div>
              )}

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500 font-medium">
                <span>Auto-formatted to standard JPG</span>
                <ArrowUpRight className="w-4 h-4 text-zinc-400" />
              </div>
            </div>

            {/* 2. SIGNATURE WIDGET CARD (Electric Blue Card) */}
            <div
              onClick={() => signInputRef.current?.click()}
              className="widget-blue rounded-[32px] p-6 sm:p-7 flex flex-col justify-between min-h-[260px] sm:min-h-[290px] cursor-pointer hover:opacity-95 transition-all shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider opacity-85">
                    Step 2 • Ink
                  </span>
                  <span className="text-3xl sm:text-4xl font-extrabold text-white block mt-1">
                    Signature
                  </span>
                  <span className="text-xs text-white/80 block mt-0.5">
                    White sheet signature scan
                  </span>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white">
                  {signFile ? <Check className="w-5 h-5" /> : <PenTool className="w-5 h-5" />}
                </div>
              </div>

              {signPreview ? (
                <div className="flex items-center gap-4 my-3 p-3 bg-white/15 rounded-2xl border border-white/20">
                  <div className="w-28 h-20 rounded-xl overflow-hidden bg-white p-2 shrink-0 flex items-center justify-center shadow-inner">
                    <img src={signPreview} alt="Signature" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="min-w-0 text-white">
                    <p className="text-sm font-bold truncate">{signFile?.name}</p>
                    <p className="text-xs opacity-85 font-mono mt-0.5">{signFile ? formatBytes(signFile.size) : ""}</p>
                    <span className="text-xs text-white underline font-bold mt-1.5 inline-block">Tap to replace</span>
                  </div>
                </div>
              ) : (
                <div className="my-4 py-5 px-4 rounded-2xl bg-white/10 border-2 border-dashed border-white/25 text-center hover:bg-white/15 transition-colors">
                  <Upload className="w-6 h-6 text-white/80 mx-auto mb-1.5" />
                  <span className="text-xs sm:text-sm font-bold text-white block">Tap to upload candidate signature</span>
                  <span className="text-[11px] text-white/80 block mt-0.5">Scan or phone photo</span>
                </div>
              )}

              <div className="pt-3 border-t border-white/15 flex items-center justify-between text-xs text-white/80 font-medium">
                <span>Auto-formatted to standard JPG</span>
                <ArrowUpRight className="w-4 h-4 text-white/80" />
              </div>
            </div>
          </div>

          {/* 3. MANDATORY CANDIDATE RENAME WIDGET CARD (Full width on desktop) */}
          <div className="widget-dark rounded-[28px] p-6 flex flex-col gap-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-sm font-bold text-zinc-300">
                Candidate Name / File Rename Prefix *
              </span>
              <span className="text-xs font-semibold text-blue-400">
                Mandatory for automatic file labeling
              </span>
            </div>

            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="e.g. ravi"
              className="w-full px-4 py-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-700 text-white font-semibold text-base focus:outline-none focus:border-blue-500 placeholder:text-zinc-600 shadow-inner"
            />

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs font-mono text-zinc-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Photo will save as:</span>
                <strong className="text-blue-400 font-bold">{samplePrefix}_image.jpg</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Sign will save as:</span>
                <strong className="text-emerald-400 font-bold">{samplePrefix}_sign.jpg</strong>
              </div>
            </div>
          </div>

          {/* 4. COMPRESS ACTION BUTTON */}
          <button
            type="button"
            onClick={handleCompress}
            disabled={isSubmitting || !photoFile || !signFile || !prefix.trim()}
            className="w-full py-5 px-8 rounded-2xl bg-[#0062ff] hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-lg flex items-center justify-center gap-2.5 shadow-xl shadow-blue-500/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing & Compressing Files...</span>
              </>
            ) : (
              <>
                <span>Compress Photo & Signature (JPG)</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </>
      ) : (
        /* RESULTS STAGE (Responsive Bento Widget Cards) */
        <div className="flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
          {/* Top Celebration Card */}
          <div className="widget-white rounded-[32px] p-7 text-center border border-zinc-100 shadow-md">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-3">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Ready for Portal Submission</span>
            </div>
            <h2 className="text-3xl font-black text-black">Files Prepared!</h2>
            <p className="text-sm text-zinc-500 mt-1">Both files have been converted to standard .JPG and sized according to exam portal requirements.</p>
          </div>

          {/* Side-by-side Result Cards on Desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
            {/* Photo Result Widget */}
            <div className="widget-white rounded-[28px] p-6 border border-zinc-100 flex items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 h-20 rounded-2xl overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200">
                  {photoPreview && <img src={photoPreview} alt="Photo" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-bold text-black truncate block">{result.photo.output_filename}</span>
                  <span className="text-xs text-zinc-500 font-mono mt-1 block">
                    {formatBytes(result.photo.compressed_size)} (-{Math.round(result.photo.savings_percent)}%)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold inline-block mt-2">
                    Standard JPG
                  </span>
                </div>
              </div>

              <a
                href={getDownloadUrl(result.job_id, result.photo.file_id)}
                download={result.photo.output_filename}
                className="px-5 py-3 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-2 shrink-0 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </a>
            </div>

            {/* Signature Result Widget */}
            <div className="widget-blue rounded-[28px] p-6 flex items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-24 h-16 rounded-2xl overflow-hidden bg-white p-1.5 shrink-0 flex items-center justify-center shadow-inner">
                  {signPreview && <img src={signPreview} alt="Sign" className="max-h-full max-w-full object-contain" />}
                </div>
                <div className="min-w-0 text-white">
                  <span className="text-sm font-bold truncate block">{result.signature.output_filename}</span>
                  <span className="text-xs opacity-85 font-mono mt-1 block">
                    {formatBytes(result.signature.compressed_size)} (-{Math.round(result.signature.savings_percent)}%)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/20 text-white font-bold inline-block mt-2">
                    Standard JPG
                  </span>
                </div>
              </div>

              <a
                href={getDownloadUrl(result.job_id, result.signature.file_id)}
                download={result.signature.output_filename}
                className="px-5 py-3 rounded-xl bg-white hover:bg-zinc-100 text-blue-600 text-xs font-bold flex items-center gap-2 shrink-0 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </a>
            </div>
          </div>

          {/* Action Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <a
              href={getDownloadUrl(result.job_id)}
              download={`${result.prefix}_enrollment_files.zip`}
              className="py-4 px-6 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold flex items-center justify-center gap-2.5 transition-colors text-center shadow-sm"
            >
              <FileArchive className="w-4 h-4" />
              <span>Download Both as ZIP</span>
            </a>

            <button
              onClick={handleReset}
              className="py-4 px-6 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-bold flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Compress Another Candidate</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
