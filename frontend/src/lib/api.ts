// API client for ClinicFlow Architect backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json", ...options?.headers },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Request failed");
    }
    return res.json();
}

// Projects
export const projectsApi = {
    list: () => request<Project[]>("/projects/"),
    get: (id: number) => request<Project>(`/projects/${id}`),
    create: (data: ProjectCreate) =>
        request<{ id: number; name: string; status: string }>("/projects/", {
            method: "POST",
            body: JSON.stringify(data),
        }),
    update: (id: number, data: Partial<Project>) =>
        request<{ status: string }>(`/projects/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),
    delete: (id: number) =>
        request<{ status: string }>(`/projects/${id}`, { method: "DELETE" }),
};

// Documents
export const documentsApi = {
    list: (projectId: number) =>
        request<DocumentMeta[]>(`/projects/${projectId}/documents/`),
    upload: async (projectId: number, file: File) => {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${API_BASE}/projects/${projectId}/documents/`, {
            method: "POST",
            body: form,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || "Upload failed");
        }
        return res.json();
    },
    delete: (projectId: number, docId: number) =>
        request<{ status: string }>(`/projects/${projectId}/documents/${docId}`, {
            method: "DELETE",
        }),
    preview: (projectId: number, docId: number) =>
        request<{ filename: string; content_preview: string; total_chars: number }>(
            `/projects/${projectId}/documents/${docId}/preview`
        ),
};

// Analysis
export const analysisApi = {
    start: (projectId: number) =>
        request<AnalysisResult>(`/projects/${projectId}/analysis/start`, {
            method: "POST",
        }),
    clarify: (projectId: number, sessionId: number, answers: ClarificationAnswer[]) =>
        request<FinalAnalysis>(`/projects/${projectId}/analysis/clarify`, {
            method: "POST",
            body: JSON.stringify({ session_id: sessionId, answers }),
        }),
    generateBpmn: (projectId: number, sessionId: number) =>
        request<BpmnResult>(`/projects/${projectId}/analysis/generate-bpmn?session_id=${sessionId}`, {
            method: "POST",
        }),
    listProcesses: (projectId: number) =>
        request<ProcessMeta[]>(`/projects/${projectId}/analysis/processes`),
};

// BPMN
export const bpmnApi = {
    getXml: (projectId: number, processId: number) =>
        request<BpmnXml>(`/projects/${projectId}/bpmn/${processId}/xml`),
    downloadUrl: (projectId: number, processId: number) =>
        `${API_BASE}/projects/${projectId}/bpmn/${processId}/download`,
};

// Reports
export const reportsApi = {
    list: (projectId: number) =>
        request<ReportMeta[]>(`/projects/${projectId}/reports/`),
    get: (projectId: number, reportId: number) =>
        request<Report>(`/projects/${projectId}/reports/${reportId}`),
    generateImprovements: (projectId: number, processId: number) =>
        request<ReportContent>(`/projects/${projectId}/reports/improvements?process_id=${processId}`, {
            method: "POST",
        }),
    generateN8n: (projectId: number, processId: number) =>
        request<ReportContent>(`/projects/${projectId}/reports/n8n-automation?process_id=${processId}`, {
            method: "POST",
        }),
};

// Types
export interface Project {
    id: number;
    name: string;
    clinic_name: string;
    sector: string;
    objectives?: string;
    status: "draft" | "complete";
    created_at: string;
    updated_at?: string;
}

export interface ProjectCreate {
    name: string;
    clinic_name: string;
    sector: string;
    objectives?: string;
}

export interface DocumentMeta {
    id: number;
    filename: string;
    file_type: string;
    file_size?: number;
    created_at: string;
    has_content: boolean;
}

export interface AnalysisResult {
    session_id: number;
    analysis: ProcessAnalysis;
    requires_clarification: boolean;
    clarification_questions: string[];
}

export interface ProcessAnalysis {
    process_name: string;
    summary: string;
    actors: string[];
    steps: ProcessStep[];
    pain_points: string[];
    bottlenecks: string[];
    clarification_questions: string[];
    confidence_score: number;
}

export interface ProcessStep {
    id: string;
    name: string;
    actor: string;
    description: string;
    type: "task" | "decision" | "start" | "end";
    next: string[];
}

export interface ClarificationAnswer {
    question: string;
    answer: string;
}

export interface FinalAnalysis {
    final_analysis: ProcessAnalysis;
    validated: boolean;
}

export interface BpmnResult {
    process_id: number;
    process_name: string;
    bpmn_xml: string;
}

export interface BpmnXml {
    process_id: number;
    process_name: string;
    bpmn_xml: string;
    analysis_json: ProcessAnalysis;
}

export interface ProcessMeta {
    id: number;
    process_name: string;
    process_type: string;
    version: number;
    created_at: string;
    has_bpmn: boolean;
}

export interface Report {
    id: number;
    report_type: string;
    content_md: string;
    metadata?: Record<string, unknown>;
    created_at: string;
}

export interface ReportMeta {
    id: number;
    report_type: string;
    created_at: string;
    metadata?: Record<string, unknown>;
}

export interface ReportContent {
    report_id: number;
    content_md: string;
}
