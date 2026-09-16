"""
File Validation Service
Security gatekeeper: magic byte verification, pixel limit enforcement,
and MIME type whitelist.
"""

import struct
from typing import Tuple, Optional


# Maximum allowed pixels (width × height) — 100 million
MAX_IMAGE_PIXELS = 100_000_000

# Maximum upload size per file — 25MB
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

# Allowed MIME types
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
}

# Magic byte signatures for image formats
MAGIC_SIGNATURES = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"RIFF": "image/webp",  # WebP starts with RIFF....WEBP
    b"GIF87a": "image/gif",
    b"GIF89a": "image/gif",
}


class ValidationError(Exception):
    """Raised when file validation fails."""
    def __init__(self, message: str, code: str = "VALIDATION_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)


def detect_mime_type(data: bytes) -> Optional[str]:
    """
    Detect MIME type from magic bytes (first 16 bytes).
    Falls back to None if no known signature matches.
    """
    # Check SVG (text-based, look for XML/SVG markers)
    header_text = data[:512].strip()
    if header_text.startswith(b"<?xml") or header_text.startswith(b"<svg") or b"<svg" in data[:1024]:
        return "image/svg+xml"

    # Check binary signatures
    for signature, mime in MAGIC_SIGNATURES.items():
        if data[:len(signature)] == signature:
            # Extra check for WebP: must have WEBP marker at offset 8
            if mime == "image/webp":
                if len(data) >= 12 and data[8:12] == b"WEBP":
                    return mime
                continue
            return mime

    return None


def get_image_dimensions_from_header(data: bytes, mime_type: str) -> Optional[Tuple[int, int]]:
    """
    Extract image dimensions from file header without fully decoding.
    Returns (width, height) or None if unable to parse.
    """
    try:
        if mime_type == "image/png":
            # PNG: width at offset 16 (4 bytes BE), height at offset 20 (4 bytes BE)
            if len(data) >= 24:
                width = struct.unpack(">I", data[16:20])[0]
                height = struct.unpack(">I", data[20:24])[0]
                return (width, height)

        elif mime_type == "image/jpeg":
            # JPEG: scan for SOF0/SOF2 markers
            i = 2
            while i < len(data) - 9:
                if data[i] == 0xFF:
                    marker = data[i + 1]
                    if marker in (0xC0, 0xC1, 0xC2):
                        height = struct.unpack(">H", data[i + 5:i + 7])[0]
                        width = struct.unpack(">H", data[i + 7:i + 9])[0]
                        return (width, height)
                    elif marker == 0xD9:  # EOI
                        break
                    elif marker in (0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0x01):
                        i += 2
                    else:
                        if i + 3 < len(data):
                            seg_len = struct.unpack(">H", data[i + 2:i + 4])[0]
                            i += 2 + seg_len
                        else:
                            break
                else:
                    i += 1

        elif mime_type == "image/gif":
            # GIF: width at offset 6 (2 bytes LE), height at offset 8 (2 bytes LE)
            if len(data) >= 10:
                width = struct.unpack("<H", data[6:8])[0]
                height = struct.unpack("<H", data[8:10])[0]
                return (width, height)

        elif mime_type == "image/webp":
            # WebP VP8: simplified — read from chunk header
            if len(data) >= 30:
                if data[12:16] == b"VP8 ":
                    # Lossy VP8
                    width = struct.unpack("<H", data[26:28])[0] & 0x3FFF
                    height = struct.unpack("<H", data[28:30])[0] & 0x3FFF
                    return (width, height)
                elif data[12:16] == b"VP8L":
                    # Lossless VP8L
                    if len(data) >= 25:
                        bits = struct.unpack("<I", data[21:25])[0]
                        width = (bits & 0x3FFF) + 1
                        height = ((bits >> 14) & 0x3FFF) + 1
                        return (width, height)

    except (struct.error, IndexError):
        pass

    return None


def validate_file(data: bytes, filename: str) -> dict:
    """
    Validate an uploaded image file.

    Returns a dict with:
        - mime_type: str
        - width: int (if detectable)
        - height: int (if detectable)
        - size_bytes: int

    Raises ValidationError on failure.
    """
    size_bytes = len(data)

    # 1. Check file size
    if size_bytes == 0:
        raise ValidationError("File is empty", "EMPTY_FILE")

    if size_bytes > MAX_UPLOAD_BYTES:
        raise ValidationError(
            f"File exceeds maximum upload size of {MAX_UPLOAD_BYTES // (1024*1024)}MB",
            "FILE_TOO_LARGE",
        )

    # 2. Detect and verify MIME type from magic bytes
    mime_type = detect_mime_type(data)
    if mime_type is None:
        raise ValidationError(
            f"Unable to detect image format for '{filename}'. Supported formats: JPG, PNG, WebP, GIF, SVG.",
            "UNKNOWN_FORMAT",
        )

    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValidationError(
            f"File type '{mime_type}' is not supported. Supported: JPG, PNG, WebP, GIF, SVG.",
            "UNSUPPORTED_FORMAT",
        )

    # 3. Check extension matches MIME (optional safety layer)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    extension_map = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "gif": "image/gif",
        "svg": "image/svg+xml",
    }
    expected_mime = extension_map.get(ext)
    if expected_mime and expected_mime != mime_type:
        raise ValidationError(
            f"File extension '.{ext}' does not match detected content type '{mime_type}'",
            "EXTENSION_MISMATCH",
        )

    # 4. Check image dimensions (decompression bomb protection)
    width, height = None, None
    if mime_type != "image/svg+xml":
        dims = get_image_dimensions_from_header(data, mime_type)
        if dims:
            width, height = dims
            pixel_count = width * height
            if pixel_count > MAX_IMAGE_PIXELS:
                raise ValidationError(
                    f"Image dimensions ({width}×{height} = {pixel_count:,} pixels) exceed the "
                    f"maximum of {MAX_IMAGE_PIXELS:,} pixels. Please resize the image first.",
                    "DECOMPRESSION_BOMB",
                )

    return {
        "mime_type": mime_type,
        "width": width,
        "height": height,
        "size_bytes": size_bytes,
        "filename": filename,
    }
