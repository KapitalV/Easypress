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
    from PIL import Image as PILImage
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
    """Fallback PNG compression using Pillow."""
    img = PILImage.open(io.BytesIO(data))
    # Quantize to reduce palette if quality < 80
    if quality < 80:
        img = img.quantize(colors=max(16, int(256 * quality / 100)))
        img = img.convert("RGBA") if img.mode == "P" else img
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _compress_webp_pillow(data: bytes, quality: int) -> bytes:
    """Fallback WebP compression using Pillow."""
    img = PILImage.open(io.BytesIO(data))
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality, method=4)
    return buf.getvalue()


def _resize_pillow(data: bytes, scale: float) -> bytes:
    """Resize image using Pillow and return PNG bytes (intermediate)."""
    img = PILImage.open(io.BytesIO(data))
    new_w = max(1, int(img.width * scale))
    new_h = max(1, int(img.height * scale))
    img = img.resize((new_w, new_h), PILImage.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


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

    # Return best effort
    result_buf = best_buf if best_buf else data
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

    result_buf = best_buf if best_buf else data
    return CompressionResult(
        data=result_buf, original_size=original_size,
        compressed_size=len(result_buf), format=fmt,
        quality=best_q, width=orig_width, height=orig_height,
    )
