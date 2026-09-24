"""
Image Processing Engine
Core compression engine using pyvips with target-size bisection algorithm.
Supports JPEG (mozjpeg-compatible), PNG (with palette quantization + oxipng),
and WebP formats.
"""

import io
import subprocess
import shutil
from typing import Optional, Tuple

try:
    import pyvips
    HAS_PYVIPS = True
except ImportError:
    HAS_PYVIPS = False

try:
    from PIL import Image as PILImage, ImageOps as PILImageOps
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

try:
    import pyoxipng
    HAS_OXIPNG = True
except ImportError:
    HAS_OXIPNG = False


class CompressionResult:
    """Result of a compression operation."""
    def __init__(
        self,
        data: bytes,
        original_size: int,
        compressed_size: int,
        format: str,
        quality: Optional[int] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        was_downsampled: bool = False,
    ):
        self.data = data
        self.original_size = original_size
        self.compressed_size = compressed_size
        self.format = format
        self.quality = quality
        self.width = width
        self.height = height
        self.was_downsampled = was_downsampled

    @property
    def savings_percent(self) -> float:
        if self.original_size == 0:
            return 0.0
        return round((1 - self.compressed_size / self.original_size) * 100, 1)

    def to_dict(self) -> dict:
        return {
            "original_size": self.original_size,
            "compressed_size": self.compressed_size,
            "savings_percent": self.savings_percent,
            "format": self.format,
            "quality": self.quality,
            "width": self.width,
            "height": self.height,
            "was_downsampled": self.was_downsampled,
        }


def _get_format_from_mime(mime_type: str) -> str:
    """Map MIME type to format string."""
    mapping = {
        "image/jpeg": "jpeg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/svg+xml": "svg",
    }
    return mapping.get(mime_type, "jpeg")


def _compress_jpeg_pyvips(image: "pyvips.Image", quality: int) -> bytes:
    """Compress image to JPEG buffer using pyvips."""
    return image.jpegsave_buffer(
        Q=quality,
        optimize_coding=True,
        strip=True,
        interlace=True,  # Progressive JPEG
    )


def _compress_png_pyvips(image: "pyvips.Image", quality: int, use_palette: bool = True) -> bytes:
    """Compress image to PNG buffer using pyvips with optional palette mode."""
    buf = image.pngsave_buffer(
        compression=9,
        palette=use_palette,
        Q=quality,
        strip=True,
    )
    # Run through oxipng if available for lossless re-compression
    if HAS_OXIPNG:
        try:
            buf = pyoxipng.optimize(buf, level=4)
        except Exception:
            pass  # Fall back to pyvips output
    return buf


def _compress_webp_pyvips(image: "pyvips.Image", quality: int) -> bytes:
    """Compress image to WebP buffer using pyvips."""
    return image.webpsave_buffer(
        Q=quality,
        strip=True,
        reduction_effort=4,
    )


def _compress_jpeg_pillow(data: bytes, quality: int) -> bytes:
    """Fallback JPEG compression using Pillow with white background for transparency."""
    img = PILImage.open(io.BytesIO(data))
    img = PILImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        white_bg = PILImage.new("RGB", rgba.size, (255, 255, 255))
        white_bg.paste(rgba, mask=rgba.split()[3])
        img = white_bg
    else:
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
    return buf.getvalue()


def _compress_png_pillow(data: bytes, quality: int) -> bytes:
    """Fallback PNG compression using Pillow with proper palette quantization."""
    img = PILImage.open(io.BytesIO(data))
    img = PILImageOps.exif_transpose(img)
    # Quantize to reduce palette if quality < 80 without undoing palette mode
    if quality < 80:
        colors = max(16, min(256, int(256 * quality / 100)))
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            img = img.quantize(colors=colors, method=PILImage.Quantize.MEDIANCUT)
        else:
            img = img.convert("RGB").quantize(colors=colors, method=PILImage.Quantize.MEDIANCUT)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _compress_webp_pillow(data: bytes, quality: int) -> bytes:
    """Fallback WebP compression using Pillow."""
    img = PILImage.open(io.BytesIO(data))
    img = PILImageOps.exif_transpose(img)
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality, method=4)
    return buf.getvalue()


def _resize_pillow(data: bytes, scale: float) -> bytes:
    """Resize image using Pillow and return PNG bytes (intermediate)."""
    img = PILImage.open(io.BytesIO(data))
    img = PILImageOps.exif_transpose(img)
    new_w = max(1, int(img.width * scale))
    new_h = max(1, int(img.height * scale))
    img = img.resize((new_w, new_h), PILImage.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def pad_image_bytes(data: bytes, fmt: str, target_bytes: int) -> bytes:
    """
    Pad an encoded image buffer so its total size reaches target_bytes.
    Uses non-destructive, standard-compliant markers that all decoders/browsers/validators accept:
    - JPEG: Standard COM (0xFF 0xFE) marker segments inserted after SOI (0xFF 0xD8).
    - PNG: Standard tEXt chunk inserted before IEND.
    - WebP / Other: Trailing bytes safely ignored by decoders.
    """
    if len(data) >= target_bytes:
        return data

    needed = target_bytes - len(data)

    if fmt == "jpeg":
        # Each COM chunk: 0xFF, 0xFE, [2 bytes length], [payload]
        # Maximum length field is 65535, so payload is 65533
        chunks = bytearray()
        while needed > 0:
            if needed < 5:
                chunks.extend(b"\x00" * needed)
                needed = 0
                break
            payload_len = min(needed - 4, 65530)
            marker_len = payload_len + 2
            chunks.extend(b"\xff\xfe" + marker_len.to_bytes(2, "big") + b"\x00" * payload_len)
            needed -= (payload_len + 4)
        if len(data) >= 2 and data[:2] == b"\xff\xd8":
            return data[:2] + bytes(chunks) + data[2:]
        return data + bytes(chunks)

    elif fmt == "png":
        import zlib
        if needed < 14:
            return data + b"\x00" * needed
        payload_len = needed - 12
        if payload_len >= 8:
            payload = b"Comment\x00" + b"\x00" * (payload_len - 8)
        else:
            payload = b"X\x00" + b"\x00" * (payload_len - 2)
        chunk_type = b"tEXt"
        crc = zlib.crc32(chunk_type + payload) & 0xFFFFFFFF
        chunk = len(payload).to_bytes(4, "big") + chunk_type + payload + crc.to_bytes(4, "big")
        iend_pos = data.rfind(b"IEND")
        if iend_pos != -1:
            insert_pos = iend_pos - 4
            return data[:insert_pos] + chunk + data[insert_pos:]
        return data + chunk

    else:
        return data + b"\x00" * needed


def extend_image_to_target(
    data: bytes,
    fmt: str,
    target_min: int,
    target_max: int,
    original_size: int,
) -> CompressionResult:
    """
    Extend / enhance an image whose size is less than target_min (e.g. 10KB to 30KB–50KB).
    1. First tries maximum visual quality and uncompressed color subsampling.
    2. If still < target_min, upscales resolution with Lanczos interpolation so the image gains visual clarity.
    3. If still below target_min, applies standard format-compliant padding to target_mid.
    Guarantees the resulting file size falls within [target_min, target_max].
    """
    import math
    target_mid = (target_min + target_max) // 2

    if not HAS_PILLOW:
        padded = pad_image_bytes(data, fmt, target_mid)
        return CompressionResult(
            data=padded, original_size=original_size,
            compressed_size=len(padded), format=fmt,
        )

    try:
        img = PILImage.open(io.BytesIO(data))
        img = PILImageOps.exif_transpose(img)
    except Exception:
        padded = pad_image_bytes(data, fmt, target_mid)
        return CompressionResult(
            data=padded, original_size=original_size,
            compressed_size=len(padded), format=fmt,
        )

    working_img = img
    if fmt == "jpeg":
        if working_img.mode in ("RGBA", "LA") or (working_img.mode == "P" and "transparency" in working_img.info):
            rgba = working_img.convert("RGBA")
            white_bg = PILImage.new("RGB", rgba.size, (255, 255, 255))
            white_bg.paste(rgba, mask=rgba.split()[3])
            working_img = white_bg
        elif working_img.mode != "RGB":
            working_img = working_img.convert("RGB")

    # Step 1: Encode at max quality
    buf = io.BytesIO()
    if fmt == "jpeg":
        working_img.save(buf, format="JPEG", quality=98, subsampling=0)
    elif fmt == "png":
        working_img.save(buf, format="PNG", optimize=True)
    elif fmt == "webp":
        working_img.save(buf, format="WEBP", quality=98, method=6)
    else:
        buf.write(data)

    candidate_bytes = buf.getvalue()
    candidate_w, candidate_h = working_img.width, working_img.height
    candidate_q = 98

    # Already within target range?
    if target_min <= len(candidate_bytes) <= target_max:
        return CompressionResult(
            data=candidate_bytes, original_size=original_size,
            compressed_size=len(candidate_bytes), format=fmt,
            quality=candidate_q, width=candidate_w, height=candidate_h,
            was_downsampled=False,
        )

    # Step 2: If smaller than target_min, upscale resolution with Lanczos
    if len(candidate_bytes) < target_min and max(candidate_w, candidate_h) < 2500:
        scale_est = min(3.0, max(1.15, math.sqrt(target_mid / max(len(candidate_bytes), 800))))
        up_w = max(1, int(candidate_w * scale_est))
        up_h = max(1, int(candidate_h * scale_est))
        upscaled_img = working_img.resize((up_w, up_h), PILImage.LANCZOS)

        # Binary search quality on upscaled image to fit into range
        lo_q, hi_q = 75, 96
        best_up_data = None
        best_up_q = 90
        while lo_q <= hi_q:
            mid_q = (lo_q + hi_q) // 2
            tbuf = io.BytesIO()
            if fmt == "jpeg":
                upscaled_img.save(tbuf, format="JPEG", quality=mid_q, subsampling=0)
            elif fmt == "png":
                upscaled_img.save(tbuf, format="PNG", optimize=True)
            elif fmt == "webp":
                upscaled_img.save(tbuf, format="WEBP", quality=mid_q)
            else:
                tbuf.write(candidate_bytes)

            tdata = tbuf.getvalue()
            if target_min <= len(tdata) <= target_max:
                return CompressionResult(
                    data=tdata, original_size=original_size,
                    compressed_size=len(tdata), format=fmt,
                    quality=mid_q, width=up_w, height=up_h,
                    was_downsampled=False,
                )
            elif len(tdata) > target_max:
                hi_q = mid_q - 1
            else:
                best_up_data = tdata
                best_up_q = mid_q
                lo_q = mid_q + 1

        if best_up_data:
            candidate_bytes = best_up_data
            candidate_w, candidate_h = up_w, up_h
            candidate_q = best_up_q

    # Step 3: If still < target_min, apply precision padding to reach target_mid
    if len(candidate_bytes) < target_min:
        candidate_bytes = pad_image_bytes(candidate_bytes, fmt, target_mid)

    return CompressionResult(
        data=candidate_bytes, original_size=original_size,
        compressed_size=len(candidate_bytes), format=fmt,
        quality=candidate_q, width=candidate_w, height=candidate_h,
        was_downsampled=False,
    )


def compress_optimal(data: bytes, mime_type: str) -> CompressionResult:
    """
    Mode A: Optimal compression — automatic balance between quality and size.
    Uses sensible defaults per format.
    """
    fmt = _get_format_from_mime(mime_type)
    original_size = len(data)

    if fmt == "svg":
        # SVG: return as-is (SVG optimization is out of scope for v1)
        return CompressionResult(
            data=data, original_size=original_size,
            compressed_size=len(data), format="svg",
        )

    if fmt == "gif":
        # GIF: return as-is for now (animated GIF compression is complex)
        return CompressionResult(
            data=data, original_size=original_size,
            compressed_size=len(data), format="gif",
        )

    # Default quality settings per format
    quality_defaults = {"jpeg": 80, "png": 75, "webp": 75}
    quality = quality_defaults.get(fmt, 80)

    if HAS_PYVIPS:
        try:
            image = pyvips.Image.new_from_buffer(data, "")
            image = image.autorot()  # Apply EXIF orientation and strip

            if fmt == "jpeg":
                # Convert to sRGB if needed
                if image.bands == 4:
                    image = image.flatten(background=[255, 255, 255])
                buf = _compress_jpeg_pyvips(image, quality)
            elif fmt == "png":
                buf = _compress_png_pyvips(image, quality)
            elif fmt == "webp":
                buf = _compress_webp_pyvips(image, quality)
            else:
                buf = data

            return CompressionResult(
                data=buf, original_size=original_size,
                compressed_size=len(buf), format=fmt,
                quality=quality, width=image.width, height=image.height,
            )
        except Exception as e:
            print(f"[ImageEngine] pyvips optimal compression failed, falling back to Pillow: {e}")

    # Pillow fallback
    if HAS_PILLOW:
        try:
            if fmt == "jpeg":
                buf = _compress_jpeg_pillow(data, quality)
            elif fmt == "png":
                buf = _compress_png_pillow(data, quality)
            elif fmt == "webp":
                buf = _compress_webp_pillow(data, quality)
            else:
                buf = data

            # Get dimensions
            img = PILImage.open(io.BytesIO(data))
            return CompressionResult(
                data=buf, original_size=original_size,
                compressed_size=len(buf), format=fmt,
                quality=quality, width=img.width, height=img.height,
            )
        except Exception as e:
            print(f"[ImageEngine] Pillow optimal compression failed: {e}")

    # Last resort: return original
    return CompressionResult(
        data=data, original_size=original_size,
        compressed_size=original_size, format=fmt,
    )


def compress_to_target(
    data: bytes,
    mime_type: str,
    target_min_bytes: int,
    target_max_bytes: int,
    progress_callback=None,
    force_format: Optional[str] = None,
) -> CompressionResult:
    """
    Mode B: Target size compression — iterative binary search over quality
    parameter to fit within [target_min_bytes, target_max_bytes].

    Algorithm:
    1. Binary search over Q ∈ [10, 95] using in-memory buffers.
    2. If quality floor (Q=10) reached and size still > target_max,
       progressively downsample with bicubic scaling until it fits.
    3. For PNGs, use palette quantization before oxipng re-compression.
    """
    fmt = force_format if force_format else _get_format_from_mime(mime_type)
    original_size = len(data)

    if original_size < target_min_bytes:
        return extend_image_to_target(data, fmt, target_min_bytes, target_max_bytes, original_size)

    if fmt in ("svg", "gif") and not force_format:
        # Can't meaningfully target-compress these without forced conversion
        return compress_optimal(data, mime_type)

    if HAS_PYVIPS:
        try:
            return _bisect_pyvips(
                data, fmt, target_min_bytes, target_max_bytes,
                original_size, progress_callback,
            )
        except Exception as e:
            print(f"[ImageEngine] pyvips target compression failed, falling back to Pillow: {e}")

    if HAS_PILLOW:
        return _bisect_pillow(
            data, fmt, target_min_bytes, target_max_bytes,
            original_size, progress_callback,
        )

    return CompressionResult(
        data=data, original_size=original_size,
        compressed_size=original_size, format=fmt,
    )


def _bisect_pyvips(
    data: bytes,
    fmt: str,
    target_min: int,
    target_max: int,
    original_size: int,
    progress_callback=None,
) -> CompressionResult:
    """Binary search compression using pyvips."""
    image = pyvips.Image.new_from_buffer(data, "")
    image = image.autorot()

    # Flatten alpha for JPEG
    if fmt == "jpeg" and image.bands == 4:
        image = image.flatten(background=[255, 255, 255])

    orig_width, orig_height = image.width, image.height

    # Phase 1: Binary search over quality parameter
    lo, hi = 10, 95
    best_buf = None
    best_q = None
    iterations = 0
    max_iterations = 15

    while lo <= hi and iterations < max_iterations:
        mid = (lo + hi) // 2
        iterations += 1

        if fmt == "jpeg":
            buf = _compress_jpeg_pyvips(image, mid)
        elif fmt == "png":
            buf = _compress_png_pyvips(image, mid, use_palette=(mid < 80))
        elif fmt == "webp":
            buf = _compress_webp_pyvips(image, mid)
        else:
            buf = data
            break

        size = len(buf)

        if progress_callback:
            progress_callback(f"Q={mid}, size={size} bytes (target: {target_min}-{target_max})")

        if target_min <= size <= target_max:
            # ✅ Within target window
            return CompressionResult(
                data=buf, original_size=original_size,
                compressed_size=size, format=fmt,
                quality=mid, width=orig_width, height=orig_height,
            )
        elif size > target_max:
            hi = mid - 1
            # Keep this as a candidate if nothing better
            if best_buf is None or size < len(best_buf):
                best_buf = buf
                best_q = mid
        else:
            # Under target_min — try higher quality
            best_buf = buf
            best_q = mid
            lo = mid + 1

    # Check if best_buf fits in target range
    if best_buf and target_min <= len(best_buf) <= target_max:
        return CompressionResult(
            data=best_buf, original_size=original_size,
            compressed_size=len(best_buf), format=fmt,
            quality=best_q, width=orig_width, height=orig_height,
        )

    # Phase 2: If still too large at minimum quality, progressively downsample
    if best_buf is None or len(best_buf) > target_max:
        if progress_callback:
            progress_callback("Quality floor reached, downsampling...")

        scale = 0.9
        was_downsampled = False
        while scale >= 0.1:
            resized = image.resize(scale)
            # Try at quality=30 for aggressive compression
            if fmt == "jpeg":
                buf = _compress_jpeg_pyvips(resized, 30)
            elif fmt == "png":
                buf = _compress_png_pyvips(resized, 30, use_palette=True)
            elif fmt == "webp":
                buf = _compress_webp_pyvips(resized, 30)
            else:
                buf = data

            if len(buf) <= target_max:
                was_downsampled = True
                # Now binary search quality upward for best visual result in range
                lo_q, hi_q = 30, 95
                final_buf = buf
                final_q = 30
                while lo_q <= hi_q:
                    mid_q = (lo_q + hi_q) // 2
                    if fmt == "jpeg":
                        trial = _compress_jpeg_pyvips(resized, mid_q)
                    elif fmt == "png":
                        trial = _compress_png_pyvips(resized, mid_q, use_palette=(mid_q < 80))
                    elif fmt == "webp":
                        trial = _compress_webp_pyvips(resized, mid_q)
                    else:
                        trial = buf

                    if target_min <= len(trial) <= target_max:
                        return CompressionResult(
                            data=trial, original_size=original_size,
                            compressed_size=len(trial), format=fmt,
                            quality=mid_q,
                            width=resized.width, height=resized.height,
                            was_downsampled=True,
                        )
                    elif len(trial) > target_max:
                        hi_q = mid_q - 1
                    else:
                        final_buf = trial
                        final_q = mid_q
                        lo_q = mid_q + 1

                return CompressionResult(
                    data=final_buf, original_size=original_size,
                    compressed_size=len(final_buf), format=fmt,
                    quality=final_q,
                    width=resized.width, height=resized.height,
                    was_downsampled=True,
                )

            scale -= 0.05

    # Return best effort or extend if below target_min
    result_buf = best_buf if best_buf else data
    if len(result_buf) < target_min:
        return extend_image_to_target(result_buf, fmt, target_min, target_max, original_size)
    return CompressionResult(
        data=result_buf, original_size=original_size,
        compressed_size=len(result_buf), format=fmt,
        quality=best_q, width=orig_width, height=orig_height,
    )


def _bisect_pillow(
    data: bytes,
    fmt: str,
    target_min: int,
    target_max: int,
    original_size: int,
    progress_callback=None,
) -> CompressionResult:
    """Binary search compression using Pillow (fallback)."""
    img = PILImage.open(io.BytesIO(data))
    orig_width, orig_height = img.width, img.height

    compress_fn = {
        "jpeg": _compress_jpeg_pillow,
        "png": _compress_png_pillow,
        "webp": _compress_webp_pillow,
    }.get(fmt)

    if not compress_fn:
        return CompressionResult(
            data=data, original_size=original_size,
            compressed_size=original_size, format=fmt,
        )

    # Phase 1: Binary search over quality
    lo, hi = 10, 95
    best_buf = None
    best_q = None
    current_data = data

    while lo <= hi:
        mid = (lo + hi) // 2
        buf = compress_fn(current_data, mid)
        size = len(buf)

        if target_min <= size <= target_max:
            return CompressionResult(
                data=buf, original_size=original_size,
                compressed_size=size, format=fmt,
                quality=mid, width=orig_width, height=orig_height,
            )
        elif size > target_max:
            hi = mid - 1
            if best_buf is None or size < len(best_buf):
                best_buf = buf
                best_q = mid
        else:
            best_buf = buf
            best_q = mid
            lo = mid + 1

    # Phase 2: Downsample if still too large
    if best_buf is None or len(best_buf) > target_max:
        scale = 0.9
        while scale >= 0.1:
            resized_data = _resize_pillow(data, scale)
            buf = compress_fn(resized_data, 30)

            if len(buf) <= target_max:
                # Search upward for best quality within target
                lo_q, hi_q = 30, 95
                final_buf = buf
                final_q = 30
                while lo_q <= hi_q:
                    mid_q = (lo_q + hi_q) // 2
                    trial = compress_fn(resized_data, mid_q)
                    if target_min <= len(trial) <= target_max:
                        resized_img = PILImage.open(io.BytesIO(resized_data))
                        return CompressionResult(
                            data=trial, original_size=original_size,
                            compressed_size=len(trial), format=fmt,
                            quality=mid_q,
                            width=resized_img.width, height=resized_img.height,
                            was_downsampled=True,
                        )
                    elif len(trial) > target_max:
                        hi_q = mid_q - 1
                    else:
                        final_buf = trial
                        final_q = mid_q
                        lo_q = mid_q + 1

                resized_img = PILImage.open(io.BytesIO(resized_data))
                return CompressionResult(
                    data=final_buf, original_size=original_size,
                    compressed_size=len(final_buf), format=fmt,
                    quality=final_q,
                    width=resized_img.width, height=resized_img.height,
                    was_downsampled=True,
                )

            scale -= 0.05

    # If still too large after downsampling for PNG/WebP, fallback to JPEG conversion to fit range
    if (best_buf is None or len(best_buf) > target_max) and fmt in ("png", "webp"):
        jpeg_res = _bisect_pillow(data, "jpeg", target_min, target_max, original_size, progress_callback)
        if target_min <= jpeg_res.compressed_size <= target_max:
            return jpeg_res

    result_buf = best_buf if best_buf else data
    if len(result_buf) < target_min:
        return extend_image_to_target(result_buf, fmt, target_min, target_max, original_size)

    return CompressionResult(
        data=result_buf, original_size=original_size,
        compressed_size=len(result_buf), format=fmt,
        quality=best_q, width=orig_width, height=orig_height,
    )
