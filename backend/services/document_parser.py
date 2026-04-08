import os
import re
import io
from pathlib import Path

import chardet

try:
    import PyPDF2
    HAS_PDF = True
except ImportError:
    HAS_PDF = False

try:
    from docx import Document as DocxDocument
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False


CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


def parse_document(filename: str, content: bytes) -> str:
    """Extract text from uploaded file bytes based on extension."""
    ext = Path(filename).suffix.lower()

    if ext == ".txt":
        detected = chardet.detect(content)
        encoding = detected.get("encoding", "utf-8") or "utf-8"
        return content.decode(encoding, errors="replace")

    elif ext == ".pdf":
        if not HAS_PDF:
            return "[PDF parsing unavailable - install PyPDF2]"
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        texts = []
        for page in reader.pages:
            texts.append(page.extract_text() or "")
        return "\n".join(texts)

    elif ext == ".docx":
        if not HAS_DOCX:
            return "[DOCX parsing unavailable - install python-docx]"
        doc = DocxDocument(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs)

    elif ext == ".csv":
        if not HAS_PANDAS:
            return content.decode("utf-8", errors="replace")
        df = pd.read_csv(io.BytesIO(content))
        return df.to_string(index=False)

    elif ext in (".xlsx", ".xls"):
        if not HAS_PANDAS:
            return "[Excel parsing unavailable - install openpyxl]"
        df = pd.read_excel(io.BytesIO(content))
        return df.to_string(index=False)

    else:
        # Attempt text decode
        return content.decode("utf-8", errors="replace")


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks for RAG indexing."""
    text = re.sub(r"\n{3,}", "\n\n", text.strip())
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += chunk_size - overlap
    return chunks
