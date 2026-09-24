"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  Check,
  Download,
  FileArchive,
  RefreshCw,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  User,
  PenTool,
  SlidersHorizontal,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  formatBytes,
  uploadEnrollment,
  EnrollmentResponse,
  getDownloadUrl,
} from "@/lib/api";

type RangePreset = "standard" | "ssc_upsc" | "banking" | "jee_neet" | "custom";

export default function EnrollmentCompress() {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [signFile, setSignFile] = useState<File | null>(null);
  const [signPreview, setSignPreview] = useState<string | null>(null);

  const [prefix, setPrefix] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<EnrollmentResponse | null>(null);

  // Range System Controls
  const [preset, setPreset] = useState<RangePreset>("standard");
  const [photoMinKb, setPhotoMinKb] = useState<number>(30);
  const [photoMaxKb, setPhotoMaxKb] = useState<number>(50);
  const [signMinKb, setSignMinKb] = useState<number>(10);
  const [signMaxKb, setSignMaxKb] = useState<number>(30);
  const [showCustomRange, setShowCustomRange] = useState<boolean>(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const signInputRef = useRef<HTMLInputElement>(null);

  const cleanPrefix = prefix.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const samplePrefix = cleanPrefix || "ravi";

  const handleApplyPreset = (key: RangePreset) => {
    setPreset(key);
    if (key === "standard") {
      setPhotoMinKb(30);
      setPhotoMaxKb(50);
      setSignMinKb(10);
      setSignMaxKb(30);
      setShowCustomRange(false);
    } else if (key === "ssc_upsc") {
      setPhotoMinKb(20);
      setPhotoMaxKb(50);
      setSignMinKb(10);
      setSignMaxKb(20);
      setShowCustomRange(false);
    } else if (key === "banking") {
      setPhotoMinKb(20);
      setPhotoMaxKb(50);
      setSignMinKb(10);
      setSignMaxKb(20);
      setShowCustomRange(false);
    } else if (key === "jee_neet") {
      setPhotoMinKb(10);
      setPhotoMaxKb(200);
      setSignMinKb(4);
      setSignMaxKb(30);
      setShowCustomRange(false);
    } else if (key === "custom") {
      setShowCustomRange(true);
    }
  };

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

    if (photoMinKb >= photoMaxKb) {
      setErrorMessage("Photo Minimum KB must be strictly less than Maximum KB.");
      return;
    }
    if (signMinKb >= signMaxKb) {
      setErrorMessage("Signature Minimum KB must be strictly less than Maximum KB.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const data = await uploadEnrollment(
        photoFile,
        signFile,
        cleanPrefix,
        photoMinKb,
        photoMaxKb,
        signMinKb,
        signMaxKb
      );
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
        accept="image/jpeg,image/png,image/webp,image/gif,image/*"
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
        accept="image/jpeg,image/png,image/webp,image/gif,image/*"
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
            Process Candidate Photo and Signature with bidirectional smart sizing (compress or extend)
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1c1c20] border border-white/10 text-xs font-semibold text-blue-400 self-start sm:self-auto">
          <FileCheck className="w-3.5 h-3.5" />
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
          {/* RANGE SYSTEM CONTROL BAR */}
          <div className="widget-dark rounded-[24px] p-5 flex flex-col gap-3.5 border border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold text-white">Target Range System</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono font-semibold border border-blue-500/20">
                  Bidirectional (Compress & Extend)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomRange(!showCustomRange)}
                className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors self-start sm:self-auto"
              >
                <span>{showCustomRange ? "Hide Custom Sizing" : "Customize Range"}</span>
                {showCustomRange ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Quick Preset Selector Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset("standard")}
                className={`px-3 py-2 rounded-xl text-left transition-all border cursor-pointer ${
                  preset === "standard" && !showCustomRange
                    ? "bg-[#0062ff] text-white border-blue-400 shadow-sm"
                    : "bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <div className="text-xs font-bold truncate">Standard Exam (Default)</div>
                <div className="text-[10px] opacity-80 font-mono mt-0.5">Photo: 30-50K | Sign: 10-30K</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset("ssc_upsc")}
                className={`px-3 py-2 rounded-xl text-left transition-all border cursor-pointer ${
                  preset === "ssc_upsc" && !showCustomRange
                    ? "bg-[#0062ff] text-white border-blue-400 shadow-sm"
                    : "bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <div className="text-xs font-bold truncate">SSC / UPSC / State</div>
                <div className="text-[10px] opacity-80 font-mono mt-0.5">Photo: 20-50K | Sign: 10-20K</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset("banking")}
                className={`px-3 py-2 rounded-xl text-left transition-all border cursor-pointer ${
                  preset === "banking" && !showCustomRange
                    ? "bg-[#0062ff] text-white border-blue-400 shadow-sm"
                    : "bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <div className="text-xs font-bold truncate">IBPS / Bank / SBI</div>
                <div className="text-[10px] opacity-80 font-mono mt-0.5">Photo: 20-50K | Sign: 10-20K</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset("jee_neet")}
                className={`px-3 py-2 rounded-xl text-left transition-all border cursor-pointer ${
                  preset === "jee_neet" && !showCustomRange
                    ? "bg-[#0062ff] text-white border-blue-400 shadow-sm"
                    : "bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <div className="text-xs font-bold truncate">NTA / JEE / NEET</div>
                <div className="text-[10px] opacity-80 font-mono mt-0.5">Photo: 10-200K | Sign: 4-30K</div>
              </button>
            </div>

            {/* Custom Range Sliders / Inputs (Collapsible or when Custom is active) */}
            {showCustomRange && (
              <div className="pt-3 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-150">
                {/* Photo Range Input */}
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">Photo Target (KB)</span>
                    <span className="text-xs font-mono font-bold text-blue-400">
                      {photoMinKb} KB – {photoMaxKb} KB
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Min KB</label>
                      <input
                        type="number"
                        min={5}
                        max={photoMaxKb - 1}
                        value={photoMinKb}
                        onChange={(e) => {
                          const val = Math.max(5, parseInt(e.target.value) || 5);
                          setPhotoMinKb(Math.min(val, photoMaxKb - 1));
                          setPreset("custom");
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Max KB</label>
                      <input
                        type="number"
                        min={photoMinKb + 1}
                        max={500}
                        value={photoMaxKb}
                        onChange={(e) => {
                          const val = Math.max(photoMinKb + 1, parseInt(e.target.value) || 50);
                          setPhotoMaxKb(Math.min(500, val));
                          setPreset("custom");
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Signature Range Input */}
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">Signature Target (KB)</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {signMinKb} KB – {signMaxKb} KB
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Min KB</label>
                      <input
                        type="number"
                        min={2}
                        max={signMaxKb - 1}
                        value={signMinKb}
                        onChange={(e) => {
                          const val = Math.max(2, parseInt(e.target.value) || 2);
                          setSignMinKb(Math.min(val, signMaxKb - 1));
                          setPreset("custom");
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Max KB</label>
                      <input
                        type="number"
                        min={signMinKb + 1}
                        max={300}
                        value={signMaxKb}
                        onChange={(e) => {
                          const val = Math.max(signMinKb + 1, parseInt(e.target.value) || 30);
                          setSignMaxKb(Math.min(300, val));
                          setPreset("custom");
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>
                <strong>Smart Bidirectional Guarantee:</strong> Files larger than target will be compressed down; small or lower-quality files (e.g. 10KB) are enhanced & extended up to safely fit within range.
              </span>
            </div>
          </div>

          {/* RESPONSIVE DUAL UPLOAD SLOTS (Side-by-side on desktop, stacked on mobile) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
            {/* 1. PHOTO WIDGET CARD (White Card) */}
            <div
              onClick={() => photoInputRef.current?.click()}
              className="widget-white rounded-[32px] p-6 sm:p-7 flex flex-col justify-between min-h-[290px] cursor-pointer hover:shadow-xl transition-all border border-zinc-100"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Step 1 • Portrait
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-bold border border-blue-200">
                      Target: {photoMinKb}–{photoMaxKb} KB
                    </span>
                  </div>
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
                <div className="flex flex-col gap-2 my-2">
                  <div className="flex items-center gap-4 p-3 bg-zinc-50 rounded-2xl border border-zinc-200/60">
                    <div className="w-20 h-24 rounded-xl overflow-hidden bg-zinc-200 border border-zinc-300 shrink-0">
                      <img src={photoPreview} alt="Photo" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-black truncate">{photoFile?.name}</p>
                      <p className="text-xs text-zinc-500 font-mono mt-0.5">{photoFile ? formatBytes(photoFile.size) : ""}</p>
                      <span className="text-xs text-blue-600 font-bold mt-1.5 inline-block">Tap to replace</span>
                    </div>
                  </div>

                  {photoFile && photoFile.size < photoMinKb * 1024 && (
                    <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-1.5 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Small image ({formatBytes(photoFile.size)}) — will be enhanced & extended to {photoMinKb}–{photoMaxKb} KB</span>
                    </div>
                  )}

                  {photoFile && photoFile.size > photoMaxKb * 1024 && (
                    <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-1.5 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Image ({formatBytes(photoFile.size)}) — will be compressed down to {photoMinKb}–{photoMaxKb} KB</span>
                    </div>
                  )}
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
              className="widget-blue rounded-[32px] p-6 sm:p-7 flex flex-col justify-between min-h-[290px] cursor-pointer hover:opacity-95 transition-all shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-85">
                      Step 2 • Ink
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-mono font-bold">
                      Target: {signMinKb}–{signMaxKb} KB
                    </span>
                  </div>
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
                <div className="flex flex-col gap-2 my-2">
                  <div className="flex items-center gap-4 p-3 bg-white/15 rounded-2xl border border-white/20">
                    <div className="w-28 h-20 rounded-xl overflow-hidden bg-white p-2 shrink-0 flex items-center justify-center shadow-inner">
                      <img src={signPreview} alt="Signature" className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="min-w-0 text-white">
                      <p className="text-sm font-bold truncate">{signFile?.name}</p>
                      <p className="text-xs opacity-85 font-mono mt-0.5">{signFile ? formatBytes(signFile.size) : ""}</p>
                      <span className="text-xs text-white underline font-bold mt-1.5 inline-block">Tap to replace</span>
                    </div>
                  </div>

                  {signFile && signFile.size < signMinKb * 1024 && (
                    <div className="px-3 py-1.5 rounded-xl bg-white/20 text-white text-xs flex items-center gap-1.5 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-white shrink-0" />
                      <span>Small scan ({formatBytes(signFile.size)}) — will be enhanced & extended to {signMinKb}–{signMaxKb} KB</span>
                    </div>
                  )}

                  {signFile && signFile.size > signMaxKb * 1024 && (
                    <div className="px-3 py-1.5 rounded-xl bg-white/20 text-white text-xs flex items-center gap-1.5 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-white shrink-0" />
                      <span>Scan ({formatBytes(signFile.size)}) — will be compressed down to {signMinKb}–{signMaxKb} KB</span>
                    </div>
                  )}
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

          {/* 3. MANDATORY CANDIDATE RENAME WIDGET CARD */}
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
                <span className="text-zinc-500">({photoMinKb}–{photoMaxKb} KB)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Sign will save as:</span>
                <strong className="text-emerald-400 font-bold">{samplePrefix}_sign.jpg</strong>
                <span className="text-zinc-500">({signMinKb}–{signMaxKb} KB)</span>
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
                <span>Processing & Sizing Files ({photoMinKb}–{photoMaxKb} KB / {signMinKb}–{signMaxKb} KB)...</span>
              </>
            ) : (
              <>
                <span>Process Photo & Signature (Standard JPG)</span>
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
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Ready for Portal Submission</span>
            </div>
            <h2 className="text-3xl font-black text-black">Files Prepared!</h2>
            <p className="text-sm text-zinc-500 mt-1">Both files have been converted to standard .JPG and strictly sized to your target ranges.</p>
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
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-zinc-700 font-mono font-bold">
                      {formatBytes(result.photo.compressed_size)}
                    </span>
                    {result.photo.compressed_size > result.photo.original_size ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                        Extended to Target
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                        -{Math.round(result.photo.savings_percent)}%
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono block mt-1">
                    Target: {result.photo.target_range}
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
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono font-bold text-white">
                      {formatBytes(result.signature.compressed_size)}
                    </span>
                    {result.signature.compressed_size > result.signature.original_size ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/25 text-white font-bold">
                        Extended to Target
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/20 text-white font-bold">
                        -{Math.round(result.signature.savings_percent)}%
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] opacity-75 font-mono block mt-1">
                    Target: {result.signature.target_range}
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
