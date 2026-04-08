from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Process

router = APIRouter(prefix="/projects/{project_id}/bpmn", tags=["bpmn"])


@router.get("/{process_id}/download")
async def download_bpmn(project_id: int, process_id: int, db: AsyncSession = Depends(get_db)):
    """Download the BPMN XML file for a process."""
    result = await db.execute(
        select(Process).where(
            Process.id == process_id,
            Process.project_id == project_id
        )
    )
    process = result.scalar_one_or_none()
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if not process.bpmn_xml:
        raise HTTPException(status_code=404, detail="BPMN not yet generated")

    filename = f"{process.process_name.replace(' ', '_')}_v{process.version}.bpmn"
    return Response(
        content=process.bpmn_xml,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/{process_id}/xml")
async def get_bpmn_xml(project_id: int, process_id: int, db: AsyncSession = Depends(get_db)):
    """Get BPMN XML for rendering in the viewer."""
    result = await db.execute(
        select(Process).where(
            Process.id == process_id,
            Process.project_id == project_id
        )
    )
    process = result.scalar_one_or_none()
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    return {
        "process_id": process.id,
        "process_name": process.process_name,
        "bpmn_xml": process.bpmn_xml,
        "analysis_json": process.analysis_json,
    }
