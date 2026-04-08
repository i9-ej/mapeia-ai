from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import Project, Document, ClarificationSession, Process
from services.rag_service import semantic_search, search_knowledge
from services.gemini_service import (
    analyze_process_as_is,
    generate_clarification_response,
)
from services.bpmn_generator import build_bpmn_xml

router = APIRouter(prefix="/projects/{project_id}/analysis", tags=["analysis"])


class ClarificationAnswer(BaseModel):
    question: str
    answer: str


class ClarificationSubmit(BaseModel):
    session_id: int
    answers: list[ClarificationAnswer]


@router.post("/start")
async def start_analysis(project_id: int, db: AsyncSession = Depends(get_db)):
    """Start AS-IS analysis: retrieve context from RAG and call Gemini."""
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get document count
    docs_result = await db.execute(
        select(Document).where(Document.project_id == project_id)
    )
    docs = docs_result.scalars().all()
    if not docs:
        raise HTTPException(status_code=400, detail="No documents uploaded yet")

    # Build context via RAG
    context_query = f"{project.sector} {project.objectives or ''} processo fluxo"
    chunks = await semantic_search(db, project_id, context_query, top_k=8)
    context_text = "\n\n---\n\n".join(chunks)

    project_info = {
        "clinic_name": project.clinic_name,
        "sector": project.sector,
        "objectives": project.objectives,
    }

    analysis = await analyze_process_as_is(context_text, project_info)

    # Store session
    session = ClarificationSession(
        project_id=project_id,
        messages=[{"role": "analysis", "content": analysis}],
        status="active" if analysis.get("clarification_questions") else "validated"
    )
    db.add(session)

    # Update project status
    project.status = "analysis"
    await db.commit()
    await db.refresh(session)

    return {
        "session_id": session.id,
        "analysis": analysis,
        "requires_clarification": bool(analysis.get("clarification_questions")),
        "clarification_questions": analysis.get("clarification_questions", []),
    }


@router.post("/clarify")
async def submit_clarification(
    project_id: int,
    data: ClarificationSubmit,
    db: AsyncSession = Depends(get_db)
):
    """Submit consultant answers to clarification questions."""
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    session_result = await db.execute(
        select(ClarificationSession).where(
            ClarificationSession.id == data.session_id,
            ClarificationSession.project_id == project_id
        )
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = session.messages or []
    previous_analysis = next((m["content"] for m in messages if m["role"] == "analysis"), {})

    chunks = await semantic_search(db, project_id, "processo etapas", top_k=5)
    context_text = "\n\n".join(chunks)

    project_info = {
        "clinic_name": project.clinic_name,
        "sector": project.sector,
        "objectives": project.objectives,
    }

    final_analysis = await generate_clarification_response(
        context_text,
        project_info,
        previous_analysis,
        [a.model_dump() for a in data.answers]
    )

    messages.append({"role": "clarification", "qa": [a.model_dump() for a in data.answers]})
    messages.append({"role": "final_analysis", "content": final_analysis})
    session.messages = messages
    session.status = "validated"
    project.status = "analysis"
    await db.commit()

    return {
        "final_analysis": final_analysis,
        "validated": True,
    }


@router.post("/generate-bpmn")
async def generate_bpmn(project_id: int, session_id: int, db: AsyncSession = Depends(get_db)):
    """Generate BPMN XML from validated analysis."""
    session_result = await db.execute(
        select(ClarificationSession).where(
            ClarificationSession.id == session_id,
            ClarificationSession.project_id == project_id
        )
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "validated":
        raise HTTPException(status_code=400, detail="Clarification must be validated before generating BPMN")

    messages = session.messages or []
    analysis = next(
        (m["content"] for m in reversed(messages) if m["role"] in ("final_analysis", "analysis")),
        {}
    )

    bpmn_xml = build_bpmn_xml(analysis)

    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()

    process = Process(
        project_id=project_id,
        process_name=analysis.get("process_name", "Processo AS-IS"),
        process_type="as_is",
        bpmn_xml=bpmn_xml,
        analysis_json=analysis,
        version=1
    )
    db.add(process)
    if project:
        project.status = "bpmn_ready"
    await db.commit()
    await db.refresh(process)

    return {
        "process_id": process.id,
        "process_name": process.process_name,
        "bpmn_xml": bpmn_xml,
    }


@router.get("/processes")
async def list_processes(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Process).where(Process.project_id == project_id).order_by(Process.created_at.desc())
    )
    processes = result.scalars().all()
    return [
        {
            "id": p.id,
            "process_name": p.process_name,
            "process_type": p.process_type,
            "version": p.version,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "has_bpmn": bool(p.bpmn_xml),
        }
        for p in processes
    ]
