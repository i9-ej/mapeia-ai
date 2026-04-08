from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

try:
    from sentence_transformers import SentenceTransformer
    _model = SentenceTransformer("all-MiniLM-L6-v2")
    HAS_EMBEDDINGS = True
except Exception:
    HAS_EMBEDDINGS = False
    _model = None

from models import DocumentChunk, KnowledgeItem, Feedback


def embed_text(text: str) -> Optional[list[float]]:
    """Generate embedding for a text string."""
    if not HAS_EMBEDDINGS or _model is None:
        return None
    emb = _model.encode(text, convert_to_numpy=True)
    return emb.tolist()


async def store_chunks(
    db: AsyncSession,
    document_id: int,
    project_id: int,
    chunks: list[str]
) -> None:
    """Store document chunks with embeddings in the database."""
    for i, chunk in enumerate(chunks):
        embedding = embed_text(chunk)
        db_chunk = DocumentChunk(
            document_id=document_id,
            project_id=project_id,
            chunk_text=chunk,
            embedding=embedding,
            chunk_index=i
        )
        db.add(db_chunk)
    await db.commit()


async def semantic_search(
    db: AsyncSession,
    project_id: int,
    query: str,
    top_k: int = 5
) -> list[str]:
    """Retrieve top-k semantically similar chunks for a project."""
    if not HAS_EMBEDDINGS:
        # Fallback: return all chunks concatenated (keyword mode)
        result = await db.execute(
            select(DocumentChunk.chunk_text)
            .where(DocumentChunk.project_id == project_id)
            .limit(top_k * 2)
        )
        return [row[0] for row in result.fetchall()]

    query_embedding = embed_text(query)
    if query_embedding is None:
        result = await db.execute(
            select(DocumentChunk.chunk_text)
            .where(DocumentChunk.project_id == project_id)
            .limit(top_k)
        )
        return [row[0] for row in result.fetchall()]

    # pgvector cosine similarity search
    result = await db.execute(
        text("""
            SELECT chunk_text
            FROM document_chunks
            WHERE project_id = :project_id
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT :top_k
        """),
        {"project_id": project_id, "embedding": str(query_embedding), "top_k": top_k}
    )
    return [row[0] for row in result.fetchall()]


async def store_knowledge_item(
    db: AsyncSession,
    category: str,
    content: str,
    source: Optional[str] = None
) -> KnowledgeItem:
    """Store a knowledge item in the vector knowledge base."""
    embedding = embed_text(content)
    item = KnowledgeItem(
        category=category,
        content=content,
        embedding=embedding,
        source=source
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def search_knowledge(
    db: AsyncSession,
    query: str,
    category: Optional[str] = None,
    top_k: int = 3
) -> list[str]:
    """Search the knowledge base for relevant items."""
    if not HAS_EMBEDDINGS:
        stmt = select(KnowledgeItem.content)
        if category:
            stmt = stmt.where(KnowledgeItem.category == category)
        stmt = stmt.limit(top_k)
        result = await db.execute(stmt)
        return [row[0] for row in result.fetchall()]

    query_embedding = embed_text(query)
    cat_filter = "AND category = :category" if category else ""
    result = await db.execute(
        text(f"""
            SELECT content FROM knowledge_items
            WHERE 1=1 {cat_filter}
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT :top_k
        """),
        {"embedding": str(query_embedding), "top_k": top_k, "category": category or ""}
    )
    return [row[0] for row in result.fetchall()]


async def store_feedback(
    db: AsyncSession,
    project_id: int,
    feedback_text: str,
    process_id: Optional[int] = None
) -> Feedback:
    """Store consultant feedback in the learning loop."""
    embedding = embed_text(feedback_text)
    fb = Feedback(
        project_id=project_id,
        process_id=process_id,
        feedback_text=feedback_text,
        embedding=embedding
    )
    db.add(fb)
    await db.commit()
    await db.refresh(fb)
    return fb
