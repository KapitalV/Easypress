import {
  compressEnrollmentClient,
  compressBatchClient,
  getRegisteredBlobUrl,
} from "./clientCompressor";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface FileInfo {
  file_id: string;
  original_filename: string;
  mime_type: string;
  original_size: number;
  width?: number;
  height?: number;
  status: string;
  progress: number;
  compressed_size?: number;
  savings_percent?: number;
  quality?: number;
  was_downsampled?: boolean;
  output_width?: number;
  output_height?: number;
  error?: string;
}

export interface JobResponse {
  job_id: string;
  status: string;
  file_count: number;
  files: FileInfo[];
  total_original_size: number;
}

export interface JobStatus {
  job_id: string;
  status: string;
  files: FileInfo[];
  total_original_size: number;
  total_compressed_size: number;
  total_savings_percent: number;
}

export interface SSEEvent {
  type: string;
  file_id?: string;
  status?: string;
  progress?: number;
  compressed_size?: number;
  savings_percent?: number;
  batch_progress?: number;
  error?: string;
  total_original_size?: number;
  total_compressed_size?: number;
  total_savings_percent?: number;
}

/**
 * Determine whether client-side processing should be used.
 * Automatically enables when on an HTTPS production site (like Vercel) where
 * the local/remote backend is unreachable or blocked by Mixed Content.
 */
function shouldUseClientEngine(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.protocol === "https:" && API_BASE.includes("localhost")) {
    return true;
  }
  return false;
}

/**
 * Upload images and create a compression job.
 */
export async function uploadImages(
  files: File[],
  mode: "optimal" | "target",
  targetMinKb?: number,
  targetMaxKb?: number
): Promise<JobResponse> {
  if (shouldUseClientEngine()) {
    return compressBatchClient(files, mode, targetMinKb, targetMaxKb);
  }

  try {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("mode", mode);
    if (mode === "target" && targetMinKb !== undefined) {
      formData.append("target_min_kb", targetMinKb.toString());
    }
    if (mode === "target" && targetMaxKb !== undefined) {
      formData.append("target_max_kb", targetMaxKb.toString());
    }

    const res = await fetch(`${API_BASE}/api/v1/jobs`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(
        typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)
      );
    }

    return res.json();
  } catch (err: any) {
    // If backend connection fails (e.g. Mixed Content or offline), fall back to client-side engine
    if (typeof window !== "undefined") {
      console.warn("Backend unavailable, falling back to client-side engine:", err);
      return compressBatchClient(files, mode, targetMinKb, targetMaxKb);
    }
    throw err;
  }
}

/**
 * Get current job status (polling fallback).
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  if (jobId.startsWith("client-")) {
    return {
      job_id: jobId,
      status: "completed",
      files: [],
      total_original_size: 0,
      total_compressed_size: 0,
      total_savings_percent: 0,
    };
  }

  const res = await fetch(`${API_BASE}/api/v1/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Job not found: ${jobId}`);
  return res.json();
}

/**
 * Subscribe to SSE progress events for a job.
 */
export function subscribeToProgress(
  jobId: string,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: Event) => void,
  onComplete?: () => void
): () => void {
  // If client-side job, fire instant completion event
  if (jobId.startsWith("client-")) {
    const timer = setTimeout(() => {
      onEvent({
        type: "job_complete",
        status: "completed",
        batch_progress: 100,
      });
      onComplete?.();
    }, 150);
    return () => clearTimeout(timer);
  }

  const eventSource = new EventSource(`${API_BASE}/api/v1/jobs/${jobId}/events`);

  eventSource.addEventListener("init", () => {
    // Initial state
  });

  eventSource.addEventListener("file_progress", (e) => {
    const data: SSEEvent = JSON.parse(e.data);
    onEvent(data);
  });

  eventSource.addEventListener("file_complete", (e) => {
    const data: SSEEvent = JSON.parse(e.data);
    onEvent(data);
  });

  eventSource.addEventListener("file_error", (e) => {
    const data: SSEEvent = JSON.parse(e.data);
    onEvent(data);
  });

  eventSource.addEventListener("job_complete", (e) => {
    const data: SSEEvent = JSON.parse(e.data);
    data.type = "job_complete";
    onEvent(data);
    eventSource.close();
    onComplete?.();
  });

  eventSource.addEventListener("ping", () => {
    // Keepalive
  });

  eventSource.onerror = (e) => {
    onError?.(e);
    eventSource.close();
  };

  return () => eventSource.close();
}

/**
 * Get download URL for a job (all files or single file).
 */
export function getDownloadUrl(jobId: string, fileId?: string): string {
  // Check client-side in-memory registry first
  const registeredUrl = getRegisteredBlobUrl(jobId, fileId);
  if (registeredUrl) {
    return registeredUrl;
  }

  if (fileId) {
    return `${API_BASE}/api/v1/download/${jobId}/${fileId}`;
  }
  return `${API_BASE}/api/v1/download/${jobId}`;
}

/**
 * Get original file URL (for comparison).
 */
export function getOriginalUrl(jobId: string, fileId: string): string {
  const registeredUrl = getRegisteredBlobUrl(jobId, fileId);
  if (registeredUrl) {
    return registeredUrl;
  }
  return `${API_BASE}/api/v1/download/${jobId}/${fileId}/original`;
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export interface EnrollmentFileInfo {
  file_id: string;
  original_filename: string;
  output_filename: string;
  mime_type: string;
  original_size: number;
  compressed_size: number;
  savings_percent: number;
  status: string;
  quality?: number;
  width?: number;
  height?: number;
  target_range: string;
}

export interface EnrollmentResponse {
  job_id: string;
  status: string;
  prefix: string;
  photo: EnrollmentFileInfo;
  signature: EnrollmentFileInfo;
  photo_download_url: string;
  sign_download_url: string;
  zip_download_url: string;
}

/**
 * Upload candidate photo and signature for enrollment compression.
 */
export async function uploadEnrollment(
  photo: File,
  signature: File,
  prefix: string
): Promise<EnrollmentResponse> {
  // If on HTTPS live site with localhost backend, run client-side engine directly
  if (shouldUseClientEngine()) {
    return compressEnrollmentClient(photo, signature, prefix);
  }

  try {
    const formData = new FormData();
    formData.append("photo", photo);
    formData.append("signature", signature);
    formData.append("prefix", prefix || "candidate");

    const res = await fetch(`${API_BASE}/api/v1/jobs/enrollment`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(
        typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)
      );
    }

    return res.json();
  } catch (err: any) {
    // If backend is unreachable or throws "Failed to fetch", seamlessly fall back to client-side engine
    if (typeof window !== "undefined") {
      console.warn(
        "Backend server unreachable, falling back to client-side engine:",
        err
      );
      return compressEnrollmentClient(photo, signature, prefix);
    }
    throw err;
  }
}
