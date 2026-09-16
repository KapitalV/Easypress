"use client";

import React, { useState } from "react";
import Image from "next/image";
import HeroDropzone from "@/components/HeroDropzone";
import EnrollmentCompress from "@/components/EnrollmentCompress";
import ImageGrid, { StagedFile } from "@/components/ImageGrid";
import CompressionSettings, {
  CompressionOptions,
} from "@/components/CompressionSettings";
import MobileBottomSheet from "@/components/MobileBottomSheet";
import ProcessingScreen from "@/components/ProcessingScreen";
import DownloadSummary from "@/components/DownloadSummary";
import CompareSlider from "@/components/CompareSlider";
import {
  uploadImages,
  FileInfo,
  JobResponse,
} from "@/lib/api";
import { ArrowLeft, Plus, SlidersHorizontal } from "lucide-react";

type Stage = "upload" | "staging" | "processing" | "download";
type AppTab = "general" | "enrollment";

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>("general");
  const [stage, setStage] = useState<Stage>("upload");
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [compressionOptions, setCompressionOptions] = useState<CompressionOptions>({
    mode: "optimal",
    targetMinKb: 20,
    targetMaxKb: 50,
  });

  // Active Job State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobFiles, setJobFiles] = useState<FileInfo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compare Modal File
  const [comparingFile, setComparingFile] = useState<FileInfo | null>(null);

  // Handle files selected from Hero Dropzone
  const handleFilesSelected = (files: File[]) => {
    const newItems: StagedFile[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      rotation: 0,
    }));

    setStagedFiles((prev) => [...prev, ...newItems]);
    setStage("staging");
    setErrorMessage(null);
  };

  // Stage 2 Actions
  const handleRemoveStagedFile = (id: string) => {
    setStagedFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== id);
      if (filtered.length === 0) {
        setStage("upload");
      }
      return filtered;
    });
  };

  const handleRotateStagedFile = (id: string) => {
    setStagedFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, rotation: (f.rotation + 90) % 360 } : f
      )
    );
  };

  const handleAddMoreFiles = (files: File[]) => {
    handleFilesSelected(files);
  };

  const handleClearAll = () => {
    stagedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setStagedFiles([]);
    setStage("upload");
  };

  // Launch compression job
  const handleStartCompression = async () => {
    if (stagedFiles.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const rawFiles = stagedFiles.map((s) => s.file);
      const res: JobResponse = await uploadImages(
        rawFiles,
        compressionOptions.mode,
        compressionOptions.targetMinKb,
        compressionOptions.targetMaxKb
      );

      setActiveJobId(res.job_id);
      setJobFiles(res.files);
      setStage("processing");
    } catch (err: any) {
      console.error("Compression initiation failed:", err);
      setErrorMessage(
        err.message ||
          "Failed to connect to compression engine. Ensure the backend server is running."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stage 3 -> Stage 4 completion
  const handleProcessingComplete = (completedFiles: FileInfo[]) => {
    setJobFiles(completedFiles);
    setStage("download");
  };

  // Reset to initial state
  const handleReset = () => {
    stagedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setStagedFiles([]);
    setActiveJobId(null);
    setJobFiles([]);
    setStage("upload");
    setErrorMessage(null);
  };

  return (
    <div className="w-full max-w-6xl xl:max-w-7xl min-h-screen flex flex-col justify-between p-4 sm:p-6 mx-auto">
      {/* 1. TOP HEADER (iOS Status & Nav style) */}
      <header className="w-full flex items-center justify-between py-2 px-1 mb-4">
        {/* Left: Quick Reset or Brand Icon */}
        <div
          onClick={() => {
            setActiveTab("general");
            handleReset();
          }}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="relative w-8 h-8 rounded-xl overflow-hidden shadow-sm">
            <Image
              src="/easypress_logo.png"
              alt="EasyPress Logo"
              fill
              className="object-cover"
              priority
            />
          </div>
          <span className="text-lg font-black tracking-tight text-white flex items-center">
            Easy<span className="text-[#0080ff]">Press</span>
          </span>
        </div>

        {/* Center: iOS Pill Mode Switcher */}
        <div className="flex items-center p-1 bg-[#1c1c20] rounded-full border border-white/10 text-xs font-semibold">
          <button
            onClick={() => {
              setActiveTab("general");
              handleReset();
            }}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              activeTab === "general"
                ? "bg-white text-black shadow-xs font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            General
          </button>

          <button
            onClick={() => setActiveTab("enrollment")}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              activeTab === "enrollment"
                ? "bg-[#0062ff] text-white shadow-xs font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Enrollment
          </button>
        </div>

        {/* Right: Quick Action icon */}
        <button
          onClick={() => {
            setActiveTab("general");
            handleReset();
          }}
          title="New Upload"
          className="w-9 h-9 rounded-full bg-[#1c1c20] hover:bg-zinc-800 text-zinc-300 flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>
      </header>

      {/* Global Error Notice */}
      {errorMessage && (
        <div className="w-full mb-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. MAIN BODY (Driven by Mode & Stages) */}
      <main className="flex-1 w-full flex flex-col justify-start">
        {/* MODE A: ENROLLMENT COMPRESS */}
        {activeTab === "enrollment" ? (
          <EnrollmentCompress />
        ) : (
          /* MODE B: GENERAL COMPRESSOR 4-STAGE FLOW */
          <>
            {/* Stage 1: Hero Dropzone */}
            {stage === "upload" && (
              <HeroDropzone
                onFilesSelected={handleFilesSelected}
                onSwitchToEnrollment={() => setActiveTab("enrollment")}
              />
            )}

            {/* Stage 2: Staging & Settings */}
            {stage === "staging" && (
              <div className="w-full flex flex-col gap-4">
                <button
                  onClick={() => setStage("upload")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors w-fit cursor-pointer mb-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Dropzone</span>
                </button>

                <ImageGrid
                  files={stagedFiles}
                  onRemoveFile={handleRemoveStagedFile}
                  onRotateFile={handleRotateStagedFile}
                  onAddFiles={handleAddMoreFiles}
                  onClearAll={handleClearAll}
                />

                <CompressionSettings
                  options={compressionOptions}
                  onChange={setCompressionOptions}
                  onCompress={handleStartCompression}
                  fileCount={stagedFiles.length}
                  isSubmitting={isSubmitting}
                />
              </div>
            )}

            {/* Stage 3: Real-Time SSE Processing */}
            {stage === "processing" && activeJobId && (
              <ProcessingScreen
                jobId={activeJobId}
                initialFiles={jobFiles}
                onCompleted={handleProcessingComplete}
                onCancel={() => setStage("staging")}
              />
            )}

            {/* Stage 4: Results & Download */}
            {stage === "download" && activeJobId && (
              <DownloadSummary
                jobId={activeJobId}
                files={jobFiles}
                onCompareFile={(file) => setComparingFile(file)}
                onReset={handleReset}
              />
            )}
          </>
        )}
      </main>

      {/* Compare Modal Slider */}
      {comparingFile && activeJobId && (
        <CompareSlider
          jobId={activeJobId}
          file={comparingFile}
          onClose={() => setComparingFile(null)}
        />
      )}

      {/* 3. MINIMALIST FOOTER (iOS Card Style with Developer Attribution) */}
      <footer className="w-full mt-8 pt-4 pb-2 flex flex-col items-center gap-2 text-center">
        <div className="py-2.5 px-6 rounded-2xl bg-[#1c1c20]/90 backdrop-blur-md border border-white/5 text-zinc-300 text-xs sm:text-sm font-medium w-full max-w-2xl flex items-center justify-center text-center shadow-sm">
          <span>Developed by <strong className="text-white font-semibold">Vishal Sahu</strong>, CSE Student at Govt. Polytechnic Madhogarh.</span>
        </div>
      </footer>

      {/* Floating Social Links Widget in Right Bottom Corner */}
      <aside aria-label="Social links" className="fixed bottom-5 right-5 z-50 flex items-center gap-2">
        {/* LinkedIn Link */}
        <a
          href="https://www.linkedin.com/in/vishalsahu2002/"
          target="_blank"
          rel="noopener noreferrer"
          title="Connect on LinkedIn"
          className="group flex items-center gap-2 py-2 px-3.5 rounded-full bg-[#1b1b20]/95 hover:bg-[#25252c] backdrop-blur-xl border border-white/15 text-white shadow-2xl hover:shadow-blue-500/25 hover:scale-105 transition-all duration-200 cursor-pointer"
        >
          <div className="w-5 h-5 rounded-md bg-[#0a66c2] flex items-center justify-center text-white shadow-xs">
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
            </svg>
          </div>
          <span className="text-xs font-bold tracking-tight">LinkedIn</span>
        </a>

        {/* Instagram Link */}
        <a
          href="https://instagram.com/dash_vishalsahu"
          target="_blank"
          rel="noopener noreferrer"
          title="Follow on Instagram"
          className="group flex items-center gap-2 py-2 px-3.5 rounded-full bg-[#1b1b20]/95 hover:bg-[#25252c] backdrop-blur-xl border border-white/15 text-white shadow-2xl hover:shadow-pink-500/25 hover:scale-105 transition-all duration-200 cursor-pointer"
        >
          <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-xs">
            <svg
              className="w-3 h-3 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </div>
          <span className="text-xs font-bold tracking-tight">Instagram</span>
        </a>
      </aside>
    </div>
  );
}
