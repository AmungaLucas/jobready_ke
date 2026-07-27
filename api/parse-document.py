"""
/api/parse-document.py
Python serverless function — uses Microsoft MarkItDown to convert any
uploaded document (PDF, DOCX, PPTX, XLSX, HTML, TXT, MD, JSON, CSV, RTF,
images w/ OCR, etc.) into clean markdown text.

This replaces the entire Node.js parsing pipeline (pdfjs-dist + mammoth
+ custom RTF/MD/JSON strippers) with one production-grade library.

Architecture:
  Client → Next.js /api/cv/upload or /api/jobs/extract
        → HTTP POST (multipart/form-data) → this Python function
        → returns { text, metadata }
        → Next.js continues with LLM extraction + DB save

Vercel config: see vercel.json (Python runtime, 60s maxDuration)
"""

import io
import logging
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Quiet down Werkzeug request logging (Vercel captures stderr anyway)
logging.getLogger("werkzeug").setLevel(logging.WARNING)
logger = logging.getLogger("markitdown-parser")

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB — matches Node.js parser
MIN_TEXT_LENGTH = 20               # matches Node.js parser

# Lazily-instantiated MarkItDown converter (one per cold start)
_md = None


def get_markitdown():
    """Lazy-load MarkItDown."""
    from markitdown import MarkItDown
    return MarkItDown()


def markitdown():
    global _md
    if _md is None:
        _md = get_markitdown()
    return _md


def get_extension(filename: str) -> str:
    if not filename or "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


@app.route("/api/parse-document", methods=["POST"])
def parse_document():
    # ── 1. Pull the file from the request ───────────────────────────────
    if "file" not in request.files:
        return jsonify({"error": "No file provided. Expected multipart field 'file'."}), 400

    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"error": "Empty file upload."}), 400

    filename = secure_filename(file.filename) or "document"
    ext = get_extension(filename)

    # ── 2. Read + size check ────────────────────────────────────────────
    raw = file.read()
    size = len(raw)
    if size == 0:
        return jsonify({"error": "File is empty (0 bytes)."}), 400
    if size > MAX_FILE_SIZE:
        mb = size / (1024 * 1024)
        return jsonify({
            "error": f"File too large ({mb:.1f} MB). Maximum is 10 MB."
        }), 413

    # ── 3. Convert with MarkItDown ──────────────────────────────────────
    try:
        from markitdown import StreamInfo
        stream = io.BytesIO(raw)
        # Provide explicit file info so MarkItDown doesn't need to run
        # its `magika` ML-based type detector (slow on cold starts).
        stream_info = StreamInfo(extension=f".{ext}") if ext else None
        result = markitdown().convert_stream(stream, stream_info=stream_info)
        text = result.text_content or ""
    except Exception as e:
        logger.exception("MarkItDown conversion failed for %s", filename)
        return jsonify({
            "error": f"Failed to parse .{ext} file: {type(e).__name__}: {str(e)}"
        }), 500

    # ── 4. Validate extracted text ──────────────────────────────────────
    text = text.strip()
    if len(text) < MIN_TEXT_LENGTH:
        return jsonify({
            "error": (
                f"Could not extract enough text from the {ext.upper()} file. "
                "The document may be image-based (scanned PDF) or empty."
            )
        }), 422

    # ── 5. Return structured response ───────────────────────────────────
    return jsonify({
        "text": text,
        "metadata": {
            "format": ext.upper(),
            "fileName": filename,
            "fileSize": size,
        }
    }), 200


@app.route("/api/parse-document/health", methods=["GET"])
def health():
    """Lightweight health check — verifies markitdown imports cleanly."""
    try:
        from markitdown import MarkItDown  # noqa: F401
        return jsonify({"status": "ok", "parser": "markitdown"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# Vercel Python runtime expects a top-level `app` variable (Flask WSGI).
