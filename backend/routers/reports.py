import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import Project, Process, Report
from services.gemini_service import generate_improvements_report, generate_n8n_report
from services.rag_service import search_knowledge

router = APIRouter(prefix="/projects/{project_id}/reports", tags=["reports"])

HEALTH_SOFTWARES = ["MV", "Pixeon", "iClinic", "Tasy", "Soul MV", "Netsaude", "Whatsapp Business", "Google Agenda"]


async def search_software_api(software_name: str) -> str:
    """Simple web search simulation for software API discovery."""
    known_apis = {
        "mv": "MV Sistemas possui API REST disponível para módulos HIS. Documentação disponível via portal do parceiro. Suporta HL7 FHIR.",
        "pixeon": "Pixeon Smart PACS e RIS possuem APIs REST. Documentação disponível em developer.pixeon.com.br.",
        "iclinic": "iClinic possui API pública REST documentada em api.iclinic.com.br. Webhooks disponíveis para agendamentos e prontuários.",
        "tasy": "Tasy (Philips) possui API FHIR R4 para interoperabilidade. Acesso via programa de parceiros Philips.",
        "soul mv": "Soul MV tem integração via API SOAP e REST. Módulos de agendamento e faturamento suportam integração.",
        "netsaude": "Netsaúde possui API REST para telemedicina e prontuários. Documentação disponível no portal dev.",
        "whatsapp business": "WhatsApp Business API disponível via Meta. n8n possui node nativo para WhatsApp Business Cloud API.",
        "google agenda": "Google Calendar API totalmente disponível. n8n possui integração nativa (Google Calendar node).",
    }
    return known_apis.get(software_name.lower(), f"{software_name}: API não catalogada. Verificar documentação oficial do fornecedor.")


@router.post("/improvements")
async def generate_improvements(project_id: int, process_id: int, db: AsyncSession = Depends(get_db)):
    """Generate the improvements report for a project."""
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    proc_result = await db.execute(
        select(Process).where(Process.id == process_id, Process.project_id == project_id)
    )
    process = proc_result.scalar_one_or_none()
    if not process or not process.analysis_json:
        raise HTTPException(status_code=404, detail="Process analysis not found")

    project_info = {"clinic_name": project.clinic_name, "sector": project.sector}
    knowledge_ctx = "\n".join(await search_knowledge(db, f"melhoria processo {project.sector}", top_k=3))

    report_md = await generate_improvements_report(
        process.analysis_json,
        project_info,
        knowledge_ctx
    )

    report = Report(
        project_id=project_id,
        report_type="improvements",
        content_md=report_md,
        metadata={"process_id": process_id}
    )
    db.add(report)
    project.status = "complete"
    await db.commit()
    await db.refresh(report)

    return {"report_id": report.id, "content_md": report_md}


@router.post("/n8n-automation")
async def generate_n8n(project_id: int, process_id: int, db: AsyncSession = Depends(get_db)):
    """Generate n8n automation report with API discovery."""
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    proc_result = await db.execute(
        select(Process).where(Process.id == process_id, Process.project_id == project_id)
    )
    process = proc_result.scalar_one_or_none()
    if not process or not process.analysis_json:
        raise HTTPException(status_code=404, detail="Process analysis not found")

    # Discover software APIs mentioned in process
    analysis = process.analysis_json
    mentioned_softwares = []
    context_text = str(analysis).lower()
    for sw in HEALTH_SOFTWARES:
        if sw.lower() in context_text:
            mentioned_softwares.append(sw)

    if not mentioned_softwares:
        mentioned_softwares = ["iClinic", "WhatsApp Business", "Google Agenda"]

    api_results = []
    for sw in mentioned_softwares:
        info = await search_software_api(sw)
        api_results.append(f"**{sw}**: {info}")
    software_api_info = "\n".join(api_results)

    project_info = {"clinic_name": project.clinic_name, "sector": project.sector}
    report_md = await generate_n8n_report(analysis, project_info, software_api_info)

    report = Report(
        project_id=project_id,
        report_type="n8n_automation",
        content_md=report_md,
        metadata={"process_id": process_id, "softwares_analyzed": mentioned_softwares}
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    return {
        "report_id": report.id,
        "content_md": report_md,
        "softwares_analyzed": mentioned_softwares
    }


@router.get("/")
async def list_reports(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Report).where(Report.project_id == project_id).order_by(Report.created_at.desc())
    )
    reports = result.scalars().all()
    return [
        {
            "id": r.id,
            "report_type": r.report_type,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "metadata": r.extra_metadata,
        }
        for r in reports
    ]


@router.get("/{report_id}")
async def get_report(project_id: int, report_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.project_id == project_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "id": report.id,
        "report_type": report.report_type,
        "content_md": report.content_md,
        "metadata": report.extra_metadata,
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }
