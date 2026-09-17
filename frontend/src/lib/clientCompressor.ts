/**
 * Client-side Image Compression Engine for EasyPress
 *
 * Implements high-precision bisection quality search and adaptive resolution
 * downsampling directly in the browser via HTML5 Canvas.
 *
 * Enables 100% standalone operation on Vercel without requiring an external backend.
 */

import JSZip from "jszip";
import { EnrollmentResponse, JobResponse, FileInfo, SSEEvent } from "./api";

// Registry of in-memory Object URLs for client-side jobs
const clientBlobRegistry = new Map<string, string>();

export function registerBlobUrl(jobId: string, fileId: string | undefined, url: string) {
  const key = fileId ? `${jobId}:${fileId}` : `${jobId}:zip`;
  clientBlobRegistry.set(key, url);
}

export function getRegisteredBlobUrl(jobId: string, fileId?: string): string | undefined {
  const key = fileId ? `${jobId}:${fileId}` : `${jobId}:zip`;
  return clientBlobRegistry.get(key);
}

interface CompressCanvasResult {
  blob: Blob;
  quality: number;
  width: number;
  height: number;
  wasDownsampled: boolean;
}

/**
 * Load a File into an HTMLImageElement
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Render image to canvas with white background for transparency handling
 */
function renderToCanvas(
  img: HTMLImageElement,
  scale: number = 1.0
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: false })!;
  // Fill white background to support transparent PNG signatures converted to JPEG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  return { canvas, ctx };
}

/**
 * Convert canvas to Blob with quality parameter
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas to Blob failed"));
      },
      mime,
      quality
    );
  });
}

/**
 * Binary search compression to fit target size [minBytes, maxBytes]
 */
export async function compressToTargetClient(
  file: File | Blob,
  targetMinBytes: number,
  targetMaxBytes: number,
  outputMime: string = "image/jpeg"
): Promise<CompressCanvasResult> {
  const img = await loadImage(file);
  let scale = 1.0;
  let wasDownsampled = false;

  // Phase 1: Try at full resolution, binary searching quality Q ∈ [0.05, 0.95]
  let lo = 0.05;
  let hi = 0.95;
  let bestBlob: Blob | null = null;
  let bestQ = 0.8;
  let iterations = 0;

  const { canvas } = renderToCanvas(img, scale);

  while (lo <= hi && iterations < 12) {
    const mid = Math.round(((lo + hi) / 2) * 100) / 100;
    iterations++;
    const blob = await canvasToBlob(canvas, outputMime, mid);

    if (targetMinBytes <= blob.size && blob.size <= targetMaxBytes) {
      return {
        blob,
        quality: Math.round(mid * 100),
        width: canvas.width,
        height: canvas.height,
        wasDownsampled,
      };
    }

    if (blob.size > targetMaxBytes) {
      hi = mid - 0.05;
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestQ = mid;
      }
    } else {
      lo = mid + 0.05;
      bestBlob = blob;
      bestQ = mid;
    }
  }

  // Phase 2: If image is still larger than targetMaxBytes at low quality, downsample
  if (!bestBlob || bestBlob.size > targetMaxBytes) {
    scale = 0.85;
    wasDownsampled = true;

    while (scale >= 0.15) {
      const { canvas: resizedCanvas } = renderToCanvas(img, scale);
      // Try at Q=0.4
      const testBlob = await canvasToBlob(resizedCanvas, outputMime, 0.4);

      if (testBlob.size <= targetMaxBytes) {
        // Search upward for best quality within range
        let loQ = 0.3;
        let hiQ = 0.92;
        let finalBlob = testBlob;
        let finalQ = 0.4;

        while (loQ <= hiQ) {
          const midQ = Math.round(((loQ + hiQ) / 2) * 100) / 100;
          const trial = await canvasToBlob(resizedCanvas, outputMime, midQ);

          if (targetMinBytes <= trial.size && trial.size <= targetMaxBytes) {
            return {
              blob: trial,
              quality: Math.round(midQ * 100),
              width: resizedCanvas.width,
              height: resizedCanvas.height,
              wasDownsampled: true,
            };
          } else if (trial.size > targetMaxBytes) {
            hiQ = midQ - 0.05;
          } else {
            finalBlob = trial;
            finalQ = midQ;
            loQ = midQ + 0.05;
          }
        }

        return {
          blob: finalBlob,
          quality: Math.round(finalQ * 100),
          width: resizedCanvas.width,
          height: resizedCanvas.height,
          wasDownsampled: true,
        };
      }

      scale -= 0.08;
    }
  }

  // Fallback: return best effort blob
  const finalBlob = bestBlob || (await canvasToBlob(canvas, outputMime, 0.75));
  return {
    blob: finalBlob,
    quality: Math.round(bestQ * 100),
    width: canvas.width,
    height: canvas.height,
    wasDownsampled,
  };
}

/**
 * Optimal compression (Mode A): balance visual fidelity with modern compression
 */
export async function compressOptimalClient(
  file: File | Blob
): Promise<CompressCanvasResult> {
  const img = await loadImage(file);
  const { canvas } = renderToCanvas(img, 1.0);
  const quality = 0.8;
  const blob = await canvasToBlob(canvas, "image/jpeg", quality);

  return {
    blob,
    quality: 80,
    width: canvas.width,
    height: canvas.height,
    wasDownsampled: false,
  };
}

/**
 * Execute client-side Dual Photo & Signature Enrollment Compression
 */
export async function compressEnrollmentClient(
  photo: File,
  signature: File,
  prefix: string
): Promise<EnrollmentResponse> {
  const cleanPrefix =
    prefix.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") || "candidate";

  // Target ranges: Photo 30KB–50KB, Signature 10KB–30KB
  const photoMin = 30 * 1024;
  const photoMax = 50 * 1024;
  const signMin = 10 * 1024;
  const signMax = 30 * 1024;

  const [photoRes, signRes] = await Promise.all([
    compressToTargetClient(photo, photoMin, photoMax, "image/jpeg"),
    compressToTargetClient(signature, signMin, signMax, "image/jpeg"),
  ]);

  const jobId = "client-" + Math.random().toString(36).substring(2, 10);
  const photoFileId = `${cleanPrefix}_image`;
  const signFileId = `${cleanPrefix}_sign`;

  const photoFilename = `${cleanPrefix}_image.jpg`;
  const signFilename = `${cleanPrefix}_sign.jpg`;

  const photoUrl = URL.createObjectURL(photoRes.blob);
  const signUrl = URL.createObjectURL(signRes.blob);

  // Generate multi-file ZIP archive in memory
  const zip = new JSZip();
  zip.file(photoFilename, photoRes.blob);
  zip.file(signFilename, signRes.blob);
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipUrl = URL.createObjectURL(zipBlob);

  // Register URLs for download retrieval
  registerBlobUrl(jobId, photoFileId, photoUrl);
  registerBlobUrl(jobId, signFileId, signUrl);
  registerBlobUrl(jobId, undefined, zipUrl);

  const photoSavings = Math.max(
    0,
    Math.round((1 - photoRes.blob.size / photo.size) * 1000) / 10
  );
  const signSavings = Math.max(
    0,
    Math.round((1 - signRes.blob.size / signature.size) * 1000) / 10
  );

  return {
    job_id: jobId,
    status: "completed",
    prefix: cleanPrefix,
    photo: {
      file_id: photoFileId,
      original_filename: photo.name || "photo.jpg",
      output_filename: photoFilename,
      mime_type: "image/jpeg",
      original_size: photo.size,
      compressed_size: photoRes.blob.size,
      savings_percent: photoSavings,
      status: "completed",
      quality: photoRes.quality,
      width: photoRes.width,
      height: photoRes.height,
      target_range: "30KB - 50KB",
    },
    signature: {
      file_id: signFileId,
      original_filename: signature.name || "signature.jpg",
      output_filename: signFilename,
      mime_type: "image/jpeg",
      original_size: signature.size,
      compressed_size: signRes.blob.size,
      savings_percent: signSavings,
      status: "completed",
      quality: signRes.quality,
      width: signRes.width,
      height: signRes.height,
      target_range: "10KB - 30KB",
    },
    photo_download_url: photoUrl,
    sign_download_url: signUrl,
    zip_download_url: zipUrl,
  };
}

/**
 * Execute client-side General Batch Compression
 */
export async function compressBatchClient(
  files: File[],
  mode: "optimal" | "target",
  targetMinKb?: number,
  targetMaxKb?: number
): Promise<JobResponse> {
  const jobId = "client-" + Math.random().toString(36).substring(2, 10);
  const zip = new JSZip();
  const fileInfos: FileInfo[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileId = "f-" + Math.random().toString(36).substring(2, 8);

    let res: CompressCanvasResult;
    if (mode === "target" && targetMinKb && targetMaxKb) {
      res = await compressToTargetClient(
        file,
        targetMinKb * 1024,
        targetMaxKb * 1024,
        "image/jpeg"
      );
    } else {
      res = await compressOptimalClient(file);
    }

    const stem = file.name.replace(/\.[^/.]+$/, "");
    const outFilename = `${stem}_compressed.jpg`;
    const url = URL.createObjectURL(res.blob);

    registerBlobUrl(jobId, fileId, url);
    zip.file(outFilename, res.blob);

    const savings = Math.max(
      0,
      Math.round((1 - res.blob.size / file.size) * 1000) / 10
    );

    fileInfos.push({
      file_id: fileId,
      original_filename: file.name,
      mime_type: "image/jpeg",
      original_size: file.size,
      status: "completed",
      progress: 100,
      compressed_size: res.blob.size,
      savings_percent: savings,
      quality: res.quality,
      output_width: res.width,
      output_height: res.height,
      was_downsampled: res.wasDownsampled,
    });
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipUrl = URL.createObjectURL(zipBlob);
  registerBlobUrl(jobId, undefined, zipUrl);

  return {
    job_id: jobId,
    status: "completed",
    file_count: files.length,
    files: fileInfos,
    total_original_size: files.reduce((acc, f) => acc + f.size, 0),
  };
}
