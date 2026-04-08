import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Document, DocumentChunk, Project
from services.document_parser import parse_document, chunk_text
from services.rag_service import store_chunks

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx", ".csv", ".xlsx", ".xls"}

router = APIRouter(prefix="/projects/{project_id}/documents", tags=["documents"])


@router.get("/")
async def list_documents(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Document).where(Document.project_id == project_id).order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "file_type": d.file_type,
            "file_size": d.file_size,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "has_content": bool(d.content_text),
        }
        for d in docs
    ]


@router.post("/", status_code=201)
async def upload_document(
    project_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    # Validate project exists
    proj = await db.execute(select(Project).where(Project.id == project_id))
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate file type
    import pathlib
    ext = pathlib.Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type {ext} not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    content = await file.read()
    text_content = parse_document(file.filename or "file", content)

    doc = Document(
        project_id=project_id,
        filename=file.filename or "unnamed",
        file_type=ext.lstrip("."),
        content_text=text_content,
        file_size=len(content)
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Chunk and store embeddings asynchronously
    chunks = chunk_text(text_content)
    await store_chunks(db, doc.id, project_id, chunks)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "chunks_stored": len(chunks),
    }


@router.delete("/{document_id}")
async def delete_document(project_id: int, document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.project_id == project_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    await db.commit()
    return {"status": "deleted"}


@router.get("/{document_id}/preview")
async def preview_document(project_id: int, document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.project_id == project_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "filename": doc.filename,
        "content_preview": (doc.content_text or "")[:2000],
        "total_chars": len(doc.content_text or ""),
    }
