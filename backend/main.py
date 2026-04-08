from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from routers import projects, documents, analysis, bpmn, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="ClinicFlow Architect API",
    version="1.0.0",
    description="Backend for ClinicFlow Architect - Process mapping and optimization for medical clinics",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(analysis.router)
app.include_router(bpmn.router)
app.include_router(reports.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "clinicflow-backend"}


@app.get("/")
async def root():
    return {"message": "ClinicFlow Architect API", "docs": "/docs"}
