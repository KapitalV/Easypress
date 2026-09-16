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
 * Upload images and create a compression job.
 */
export async function uploadImages(
  files: File[],
  mode: "optimal" | "target",
  targetMinKb?: number,
  targetMaxKb?: number
): Promise<JobResponse> {
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
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }

  return res.json();
}

/**
 * Get current job status (polling fallback).
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
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
  const eventSource = new EventSource(`${API_BASE}/api/v1/jobs/${jobId}/events`);

  eventSource.addEventListener("init", (e) => {
    // Initial state - can be used to set up UI
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
    // Keepalive — ignore
  });

  eventSource.onerror = (e) => {
    onError?.(e);
    eventSource.close();
  };

  // Return unsubscribe function
  return () => eventSource.close();
}

/**
 * Get download URL for a job (all files or single file).
 */
export function getDownloadUrl(jobId: string, fileId?: string): string {
  if (fileId) {
    return `${API_BASE}/api/v1/download/${jobId}/${fileId}`;
  }
  return `${API_BASE}/api/v1/download/${jobId}`;
}

/**
 * Get original file URL (for comparison).
 */
export function getOriginalUrl(jobId: string, fileId: string): string {
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
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }

  return res.json();
}
