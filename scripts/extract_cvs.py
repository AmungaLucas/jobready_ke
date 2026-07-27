"""Extract text from all uploaded CVs for analysis."""
import os
import sys

UPLOAD_DIR = "/home/z/my-project/upload"
OUTPUT_DIR = "/home/z/my-project/upload/extracted"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def extract_docx(filepath):
    from docx import Document
    doc = Document(filepath)
    return "\n".join(p.text for p in doc.paragraphs)

def extract_pdf(filepath):
    import subprocess
    # Use pdftotext
    result = subprocess.run(
        ["pdftotext", "-layout", filepath, "-"],
        capture_output=True, text=True
    )
    return result.stdout if result.stdout else ""

def extract_doc(filepath):
    # Try antiword first, then fallback to catdoc
    import subprocess
    result = subprocess.run(
        ["antiword", filepath],
        capture_output=True, text=True
    )
    if result.stdout:
        return result.stdout
    result = subprocess.run(
        ["catdoc", filepath],
        capture_output=True, text=True
    )
    return result.stdout if result.stdout else ""

files = [
    "abdigani adan CURRICULUM  VITAE (1).docx",
    "CV- Hannah (1).docx",
    "VIRGINIA WANJIRU WANJIKU CV 2026.docx",
    "JOHN ODHIAMBO CURV (1) (1).pdf",
    "Dennis Twijukye Kahima's CV.docx",
    "Abdullahi Derow CV (2) (1).doc",
    "JOHN ODHIAMBO CURV (1).pdf",
    "abdigani adan CURRICULUM  VITAE.docx",
    "DOC-20260429-WA0013..pdf",
    "Florence Chepngeno Birir CV.docx",
]

for fname in files:
    fpath = os.path.join(UPLOAD_DIR, fname)
    if not os.path.exists(fpath):
        print(f"SKIP (not found): {fname}")
        continue

    ext = fname.lower().split(".")[-1]
    try:
        if ext == "docx":
            text = extract_docx(fpath)
        elif ext == "pdf":
            text = extract_pdf(fpath)
        elif ext == "doc":
            text = extract_doc(fpath)
        else:
            print(f"SKIP (unknown ext): {fname}")
            continue

        # Save extracted text
        safe_name = fname.replace(" ", "_").replace("..", "_").replace("(", "").replace(")", "").replace("'", "")
        out_path = os.path.join(OUTPUT_DIR, safe_name + ".txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(text)

        lines = text.strip().split("\n")
        print(f"OK: {fname} -> {len(text)} chars, {len(lines)} lines")
        # Print first 5 lines as preview
        for line in lines[:5]:
            if line.strip():
                print(f"  > {line.strip()[:100]}")
    except Exception as e:
        print(f"ERROR: {fname} -> {e}")

print("\n--- All extractions complete ---")
