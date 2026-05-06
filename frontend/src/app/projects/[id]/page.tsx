"use client";

import { useState, use, useEffect } from "react";
import Link from "next/link";
import { callAI, getActiveKey, saveGeminiKey, getProviderLabel } from "@/lib/aiClient";
import {
    MOCK_PROJECTS,
    MOCK_DOCUMENTS,
    MOCK_IMPROVEMENTS_REPORT,
    MOCK_N8N_REPORT,
} from "@/lib/mockData";
import { Project, DocumentMeta } from "@/lib/api";

const TABS = [
    { key: "documents", label: "Documentos", icon: "📁" },
    { key: "reports", label: "Relatórios", icon: "📈" },
];

const STATUS_LABELS: Record<string, string> = {
    draft: "Rascunho",
    analysis: "Em Análise",
    complete: "Concluído",
};


// ---- DOCUMENTS TAB ----
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function DocumentsTab({ projectId, onStatusChange }: { projectId: number; onStatusChange: (s: string) => void }) {
    const storageKey = `clinicflow_docs_${projectId}`;
    const [docs, setDocs] = useState<DocumentMeta[]>(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved);
        } catch { }
        // First time: load mock docs only for the 4 original mock projects
        return projectId <= 4 ? MOCK_DOCUMENTS : [];
    });
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");

    function updateDocs(newDocs: DocumentMeta[]) {
        setDocs(newDocs);
        try { localStorage.setItem(storageKey, JSON.stringify(newDocs)); } catch { }
        if (newDocs.length > 0) onStatusChange("analysis");
    }

    const FILE_TYPES: Record<string, string> = { txt: "📄", pdf: "📕", docx: "📝", xlsx: "📊", csv: "📋", xls: "📊" };

    async function extractTextClientSide(file: File, ext: string): Promise<string | undefined> {
        const TEXT_TYPES = ["txt", "csv", "md", "json", "xml"];
        if (TEXT_TYPES.includes(ext) && file.size < 500_000) {
            try { return await file.text(); } catch { return undefined; }
        }
        // PDF extraction via pdf.js
        if (ext === "pdf" && file.size < 10_000_000) {
            try {
                const pdfjsLib = (window as unknown as { pdfjsLib?: { getDocument: (d: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str: string }[] }> }> }> } } })?.pdfjsLib;
                if (!pdfjsLib) {
                    // Load pdf.js from CDN dynamically
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement("script");
                        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error("Failed to load pdf.js"));
                        document.head.appendChild(script);
                    });
                }
                const lib = (window as unknown as { pdfjsLib: { GlobalWorkerOptions: { workerSrc: string }; getDocument: (d: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str: string }[] }> }> }> } } }).pdfjsLib;
                lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
                let fullText = "";
                for (let p = 1; p <= Math.min(pdf.numPages, 50); p++) {
                    const page = await pdf.getPage(p);
                    const content = await page.getTextContent();
                    fullText += content.items.map((item: { str: string }) => item.str).join(" ") + "\n";
                }
                return fullText.trim() || undefined;
            } catch (e) {
                console.warn("[DocumentsTab] PDF extraction failed:", e);
                return undefined;
            }
        }
        // DOCX extraction via mammoth.js
        if (ext === "docx" && file.size < 10_000_000) {
            try {
                const mammothLib = (window as unknown as { mammoth?: { extractRawText: (d: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> } })?.mammoth;
                if (!mammothLib) {
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement("script");
                        script.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error("Failed to load mammoth.js"));
                        document.head.appendChild(script);
                    });
                }
                const lib = (window as unknown as { mammoth: { extractRawText: (d: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> } }).mammoth;
                const arrayBuffer = await file.arrayBuffer();
                const result = await lib.extractRawText({ arrayBuffer });
                return result.value.trim() || undefined;
            } catch (e) {
                console.warn("[DocumentsTab] DOCX extraction failed:", e);
                return undefined;
            }
        }
        return undefined;
    }

    async function uploadFiles(files: FileList) {
        setUploading(true);
        setUploadError("");
        const fileArray = Array.from(files);
        const newDocs: (DocumentMeta & { text_content?: string })[] = [];

        for (let i = 0; i < fileArray.length; i++) {
            const f = fileArray[i];
            const ext = f.name.split(".").pop()?.toLowerCase() || "txt";
            try {
                // Try real backend upload first
                const formData = new FormData();
                formData.append("file", f);
                const res = await fetch(`${BACKEND_URL}/projects/${projectId}/documents/`, {
                    method: "POST",
                    body: formData,
                });
                if (res.ok) {
                    const data = await res.json();
                    let textContent: string | undefined;
                    try {
                        const previewRes = await fetch(`${BACKEND_URL}/projects/${projectId}/documents/${data.id}/preview`);
                        if (previewRes.ok) {
                            const preview = await previewRes.json();
                            textContent = preview.content_preview || undefined;
                        }
                    } catch { }
                    newDocs.push({
                        id: data.id, filename: data.filename, file_type: data.file_type,
                        file_size: data.file_size, created_at: new Date().toISOString(),
                        has_content: true, text_content: textContent,
                    });
                } else {
                    // Backend unavailable — client-side extraction (PDF, DOCX, TXT, etc.)
                    const textContent = await extractTextClientSide(f, ext);
                    newDocs.push({
                        id: Date.now() + i, filename: f.name, file_type: ext,
                        file_size: f.size, created_at: new Date().toISOString(),
                        has_content: !!textContent, text_content: textContent,
                    });
                }
            } catch {
                // Network error — client-side extraction
                const textContent = await extractTextClientSide(f, ext);
                newDocs.push({
                    id: Date.now() + i, filename: f.name, file_type: ext,
                    file_size: f.size, created_at: new Date().toISOString(),
                    has_content: !!textContent, text_content: textContent,
                });
            }
        }

        updateDocs([...newDocs, ...docs]);
        setUploading(false);
    }


    const [previewDoc, setPreviewDoc] = useState<(DocumentMeta & { text_content?: string }) | null>(null);

    return (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {uploadError && (
                <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
                    ⚠️ {uploadError}
                </div>
            )}
            {/* Upload Zone */}
            <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files); }}
                style={{
                    border: `2px dashed ${isDragging ? "var(--brand-500)" : "var(--surface-border)"}`,
                    borderRadius: 16, padding: "40px 24px", textAlign: "center",
                    background: isDragging ? "rgba(97,114,243,0.08)" : "var(--surface-2)",
                    transition: "all 0.2s", cursor: "pointer"
                }}
                onClick={() => document.getElementById("file-input")?.click()}
            >
                <input id="file-input" type="file" multiple accept=".txt,.pdf,.docx,.xlsx,.csv,.xls"
                    style={{ display: "none" }} onChange={e => e.target.files && uploadFiles(e.target.files)} />
                {uploading ? (
                    <div>
                        <div className="animate-spin" style={{ fontSize: 32, display: "inline-block", marginBottom: 12 }}>⚙️</div>
                        <div style={{ fontSize: 14, color: "var(--brand-500)" }}>Processando documentos...</div>
                    </div>
                ) : (
                    <>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📤</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#1a202c", marginBottom: 6 }}>
                            Arraste arquivos aqui ou clique para selecionar
                        </div>
                        <div style={{ fontSize: 12, color: "#475569" }}>
                            Suporte: .txt, .pdf, .docx, .xlsx, .csv · Transcrições de reuniões bem-vindas
                        </div>
                    </>
                )}
            </div>

            {/* Document List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {docs.map(doc => (
                    <div key={doc.id} className="glass" onClick={() => setPreviewDoc(doc as DocumentMeta & { text_content?: string })} style={{ cursor: "pointer",
                        borderRadius: 12, padding: "14px 18px",
                        display: "flex", alignItems: "center", justifyContent: "space-between"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: "var(--surface-3)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 20, flexShrink: 0
                            }}>
                                {FILE_TYPES[doc.file_type] || "📄"}
                            </div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 500, color: "#1a202c" }}>{doc.filename}</div>
                                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                                    {doc.file_type.toUpperCase()} · {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : "—"} · {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {(doc as { text_content?: string }).text_content ? (
                                <span style={{ fontSize: 11, background: "rgba(34,197,94,0.12)", color: "#16a34a", padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>
                                    ✓ Texto extraído
                                </span>
                            ) : doc.has_content ? (
                                <span style={{ fontSize: 11, background: "rgba(245,158,11,0.12)", color: "#d97706", padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>
                                    ⚠ Sem texto
                                </span>
                            ) : null}
                            <button className="btn-ghost" style={{ padding: "6px 10px" }}
                                onClick={() => updateDocs(docs.filter(d => d.id !== doc.id))}>🗑</button>
                        </div>
                    </div>
                ))}
            </div>
            {/* Document Preview Modal */}
            {previewDoc && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
                    zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center"
                }} onClick={() => setPreviewDoc(null)}>
                    <div onClick={e => e.stopPropagation()} className="animate-fade-in" style={{
                        background: "#ffffff", border: "1px solid var(--surface-border)",
                        borderRadius: 16, padding: 0, width: "100%", maxWidth: 700, maxHeight: "80vh",
                        boxShadow: "0 24px 48px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column",
                        overflow: "hidden"
                    }}>
                        <div style={{
                            padding: "16px 20px", borderBottom: "1px solid var(--surface-border)",
                            display: "flex", justifyContent: "space-between", alignItems: "center"
                        }}>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: "#1a202c" }}>{previewDoc.filename}</div>
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                    {previewDoc.file_type.toUpperCase()} · {previewDoc.file_size ? `${(previewDoc.file_size / 1024).toFixed(0)} KB` : "—"} · {new Date(previewDoc.created_at).toLocaleDateString("pt-BR")}
                                </div>
                            </div>
                            <button className="btn-ghost" onClick={() => setPreviewDoc(null)} style={{ fontSize: 16, padding: "4px 8px" }}>✕</button>
                        </div>
                        <div style={{
                            padding: "20px", flex: 1, overflowY: "auto",
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            fontSize: 12.5, lineHeight: 1.7, color: "#334155",
                            whiteSpace: "pre-wrap", wordBreak: "break-word",
                            background: "#f8fafc"
                        }}>
                            {previewDoc.text_content
                                ? previewDoc.text_content
                                : <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
                                    <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
                                    <div style={{ fontSize: 14 }}>Não foi possível extrair o texto deste documento.</div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>Formatos suportados: .txt, .pdf, .docx, .csv, .md</div>
                                  </div>
                            }
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---- REPORTS TAB ----
function ReportsTab({ project, onStatusChange }: { project: Project; onStatusChange: (s: string) => void }) {
    const [activeReport, setActiveReport] = useState<"improvements" | "n8n" | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState("");
    const [elapsed, setElapsed] = useState(0);
    const [phase, setPhase] = useState<"idle" | "asking" | "answering" | "generating">("idle");
    const [clarifyQuestions, setClarifyQuestions] = useState<string[]>([]);
    const [clarifyAnswers, setClarifyAnswers] = useState<Record<number, string>>({});
    const [error, setError] = useState("");
    const [reports, setReports] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem(`clinicflow_reports_${project.id}`);
            if (saved) return JSON.parse(saved);
        } catch {}
        return {};
    });

    function getProjectContext() {
        let docs: (DocumentMeta & { text_content?: string })[] = [];
        try {
            const s = localStorage.getItem(`clinicflow_docs_${project.id}`);
            if (s) docs = JSON.parse(s);
        } catch {}

        // Extract text content from uploaded documents
        let docsTextContent = "";
        docs.forEach(doc => {
            if ((doc as { text_content?: string }).text_content) {
                docsTextContent += `\n\n--- Conteúdo do arquivo: ${doc.filename} ---\n${(doc as { text_content?: string }).text_content}`;
            }
        });

        let chatContext = "";
        try {
            const s = localStorage.getItem(`clinicflow_chat_${project.id}`);
            if (s) {
                const data = JSON.parse(s);
                const userMsgs: { role: string; content: string }[] = (data.messages || []).filter((m: { role: string }) => m.role === "user");
                if (userMsgs.length > 0) chatContext = userMsgs.map(m => m.content).join("\n\n");
            }
        } catch {}

        let bpmnSteps = "";
        try {
            const s = localStorage.getItem(`clinicflow_bpmn_${project.id}`);
            if (s) {
                const bpmnModel = JSON.parse(s);
                if (bpmnModel.steps) {
                    bpmnSteps = bpmnModel.steps.map((step: { name: string; actor?: string; description?: string }) =>
                        `- ${step.name}${step.actor ? ` (${step.actor})` : ""}${step.description ? `: ${step.description}` : ""}`
                    ).join("\n");
                }
            }
        } catch {}

        return { docs, chatContext, bpmnSteps, docsTextContent };
    }

    async function generateReport(type: "improvements" | "n8n") {
        const apiKey = getActiveKey();
        if (!apiKey) {
            setError("Configure sua API Key em Configurações para gerar relatórios com IA.");
            return;
        }
        setLoading(type);
        setError("");
        setProgress(0);
        setElapsed(0);
        setPhase("asking");
        setProgressLabel("Analisando contexto...");

        const { docs, chatContext, bpmnSteps, docsTextContent } = getProjectContext();

        const projectInfo = [
            `Clínica: ${project.clinic_name}`,
            `Setor: ${project.sector}`,
            `Projeto: ${project.name}`,
            project.objectives ? `Objetivos e Respostas do Questionário:\n${project.objectives}` : "",
            docs.length > 0 ? `Documentos anexados: ${docs.map(d => d.filename).join(", ")}` : "Sem documentos enviados",
            docsTextContent ? `\nCONTEÚDO DOS DOCUMENTOS ENVIADOS:${docsTextContent}` : "",
            bpmnSteps ? `\nEtapas do processo mapeado:\n${bpmnSteps}` : "",
            chatContext ? `\nInformações coletadas na clarificação:\n${chatContext}` : "",
        ].filter(Boolean).join("\n");

        // Start elapsed timer
        const timerStart = Date.now();
        const timer = setInterval(() => {
            const s = Math.floor((Date.now() - timerStart) / 1000);
            setElapsed(s);
            if (s < 3) { setProgress(15); setProgressLabel("Analisando documentos..."); }
            else if (s < 8) { setProgress(30); setProgressLabel("Identificando processos..."); }
            else if (s < 15) { setProgress(50); setProgressLabel("Gerando análise..."); }
            else if (s < 25) { setProgress(70); setProgressLabel("Estruturando relatório..."); }
            else { setProgress(85); setProgressLabel("Finalizando..."); }
        }, 500);

        try {
            // Phase 1: Ask AI if it needs clarification
            const clarifyPrompt = `Com base no contexto abaixo de uma clínica médica, você precisa gerar um relatório de ${type === "improvements" ? "melhorias de processo" : "automação n8n"}. Antes de gerar, avalie se o contexto é suficiente.

${projectInfo}

INSTRUÇÕES: Se o contexto acima é suficiente para gerar um relatório detalhado e específico, responda APENAS: CONTEXTO_SUFICIENTE

Se NÃO é suficiente, liste de 3 a 5 perguntas objetivas que você precisa saber para gerar um relatório melhor. Responda APENAS com as perguntas numeradas (1. 2. 3. etc), sem introdução.`;

            const clarifyResult = await Promise.race([
                callAI(clarifyPrompt),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 30_000))
            ]);

            if (!clarifyResult.includes("CONTEXTO_SUFICIENTE")) {
                // Parse questions
                const questions = clarifyResult.split("\n")
                    .map(l => l.replace(/^\d+\.\s*/, "").trim())
                    .filter(l => l.length > 10);

                if (questions.length > 0) {
                    clearInterval(timer);
                    setProgress(25);
                    setProgressLabel("Aguardando suas respostas...");
                    setClarifyQuestions(questions);
                    setClarifyAnswers({});
                    setPhase("answering");
                    return; // Wait for user to answer
                }
            }

            // Phase 2: Generate report directly
            await generateFinalReport(type, projectInfo, "", timer);

        } catch (e: unknown) {
            clearInterval(timer);
            const msg = e instanceof Error ? e.message : String(e);
            const friendlyMsg = msg.includes("AI_KEY_MISSING")
                ? "Chave de API não configurada. Adicione sua API Key em Configurações."
                : msg.includes("429") || msg.toLowerCase().includes("quota")
                ? "Limite de uso da API atingido. Aguarde alguns minutos."
                : msg.includes("Timeout")
                ? "Timeout — a IA demorou demais. Tente novamente."
                : `Erro ao gerar relatório: ${msg}`;
            setError(friendlyMsg);
            setLoading(null);
            setPhase("idle");
        }
    }

    async function submitClarifyAnswers(type: "improvements" | "n8n") {
        const { docs, chatContext, bpmnSteps, docsTextContent } = getProjectContext();
        const projectInfo = [
            `Clínica: ${project.clinic_name}`,
            `Setor: ${project.sector}`,
            `Projeto: ${project.name}`,
            project.objectives ? `Objetivos e Respostas do Questionário:\n${project.objectives}` : "",
            docs.length > 0 ? `Documentos anexados: ${docs.map(d => d.filename).join(", ")}` : "Sem documentos enviados",
            docsTextContent ? `\nCONTEÚDO DOS DOCUMENTOS ENVIADOS:${docsTextContent}` : "",
            bpmnSteps ? `\nEtapas do processo mapeado:\n${bpmnSteps}` : "",
            chatContext ? `\nInformações coletadas na clarificação:\n${chatContext}` : "",
        ].filter(Boolean).join("\n");

        const answersText = clarifyQuestions
            .map((q, i) => `P: ${q}\nR: ${clarifyAnswers[i] || "Não respondido"}`)
            .join("\n\n");

        setPhase("generating");
        setProgress(30);
        setElapsed(0);

        const timerStart = Date.now();
        const timer = setInterval(() => {
            const s = Math.floor((Date.now() - timerStart) / 1000);
            setElapsed(s);
            if (s < 5) { setProgress(40); setProgressLabel("Processando respostas..."); }
            else if (s < 12) { setProgress(55); setProgressLabel("Gerando análise..."); }
            else if (s < 20) { setProgress(70); setProgressLabel("Estruturando relatório..."); }
            else { setProgress(85); setProgressLabel("Finalizando..."); }
        }, 500);

        try {
            await generateFinalReport(type, projectInfo, answersText, timer);
        } catch (e: unknown) {
            clearInterval(timer);
            const msg = e instanceof Error ? e.message : String(e);
            setError(`Erro ao gerar relatório: ${msg}`);
            setLoading(null);
            setPhase("idle");
        }
    }

    async function generateFinalReport(type: "improvements" | "n8n", projectInfo: string, extraContext: string, timer: ReturnType<typeof setInterval>) {
        setPhase("generating");
        setProgressLabel("Gerando relatório completo...");

        const extraBlock = extraContext ? `\nRESPOSTAS ADICIONAIS DO CLIENTE:\n${extraContext}` : "";

        const improvementsPrompt = `Você é um Consultor Sênior e Analista Investigativo da i9 Consultoria, especializado em clínicas médicas.

${projectInfo}${extraBlock}${extraBlock}

INSTRUÇÕES CRÍTICAS DE ANÁLISE:
1. Analise friamente os documentos. Identifique se há transcrições de reuniões. Se houver, não seja um mero repetidor do que foi dito: leia nas entrelinhas, encontre dores ocultas, processos manuais enraizados e ineficiências que o cliente nem percebeu que tem.
2. Suas sugestões devem ir ALÉM do óbvio. Traga melhorias criativas, altamente personalizadas para o cenário desta clínica, e que não foram explicitamente pedidas.
3. Seja direto e profissional (sem frases motivacionais ou emojis decorativos), mas detalhe BEM a execução das ações.
4. Responda somente com Markdown válido.

# Relatório de Melhorias — ${project.clinic_name}

## Contexto

Máximo 3 frases: o que foi analisado, as dores reais identificadas (explícitas e ocultas) e a motivação.

## Diagnóstico Rápido

| Indicador | Situação Atual | Meta |
|-----------|---------------|------|
(3 a 5 linhas com KPIs mensuráveis do processo analisado)

## Oportunidades e Melhorias Identificadas

Para cada melhoria (mínimo 4, máximo 5), use EXATAMENTE esta estrutura. Traga detalhes do que deve ser feito na prática:

### [Título objetivo da melhoria]

| | |
|---|---|
| **Prioridade** | 🔴 Alta ou 🟡 Média ou 🟢 Baixa |
| **A Dor / Problema** | Descreva o problema atual ou a ineficiência oculta que você identificou na operação. |
| **O que fazer (Ação Detalhada)** | Detalhe exatamente o que precisa ser feito na prática (pode usar 2 a 3 frases claras). Como resolver de forma personalizada. |
| **Resultado** | O benefício quantificado ou impacto direto na operação. |
| **Responsável** | Quem executa |

---

## Plano de Implementação

| Semana | Foco | Entregas | Critério de sucesso |
|--------|------|----------|---------------------|
| 1-2 | | | |
| 3-4 | | | |
| 5-6 | | | |

## Ferramentas Recomendadas

Para cada ferramenta (2 ou 3), use:

### [Nome da Ferramenta]
- **Função:** uma frase
- **Exemplo prático:** modelo de mensagem, script ou template adaptado à clínica

Regras finais:
1. Sem saudações. Comece direto pelo título.
2. Cada frase deve ter conteúdo útil. Zero preenchimento.
3. Use as tabelas com os badges de prioridade exatamente como indicado.`;

        const n8nPrompt = `Você é Engenheiro de Automação e Analista de Processos Sênior da i9 Consultoria, com domínio avançado em n8n e APIs para clínicas.

${projectInfo}${extraBlock}

INSTRUÇÕES CRÍTICAS DE ANÁLISE:
1. Identifique transcrições de reuniões nos documentos e analise-as friamente. Encontre processos manuais repetitivos, "copia e cola" invisíveis e oportunidades ocultas de automação que o cliente não mencionou ou não percebeu.
2. Suas propostas de automação devem ir ALÉM do óbvio. Use a criatividade tecnológica para desenhar fluxos altamente personalizados que resolvam dores nas entrelinhas da operação.
3. Sem emojis decorativos ou parágrafos prolixos. Seja direto, mas detalhe claramente como a solução vai funcionar na prática.
4. Responda somente com Markdown válido.

# Relatório de Automações — ${project.clinic_name}

## Resumo de Impacto

| Métrica | Estimativa |
|---------|-----------|
| Tempo economizado | X horas/mês |
| Processos automatizáveis | N |
| Redução de retrabalho | X% |
| ROI estimado (6 meses) | R$ X |

## Softwares e APIs Mapeados

| Software | Função | API Disponível? | Tipo de integração |
|----------|--------|-----------------|-------------------|
(Liste os softwares citados e sugira as ferramentas necessárias)

## Automações Estratégicas Propostas

Para cada automação (mínimo 3, máximo 5), use EXATAMENTE esta estrutura. Seja detalhista na Solução:

### [Nome da Automação]

| | |
|---|---|
| **Prioridade** | 🔴 Alta ou 🟡 Média ou 🟢 Baixa |
| **A Dor / Processo Manual** | A dor explícita ou o processo invisível identificado analisando friamente a operação. |
| **Solução e Detalhamento** | Como a automação vai funcionar na prática? Detalhe o que será construído de forma personalizada (use 2 a 3 frases claras). |
| **Fluxo Técnico** | Gatilho → Passo 1 → Passo 2 → Resultado |
| **Nodes n8n** | Lista dos nodes exatos que o desenvolvedor usará |
| **Economia Estimada** | X horas/semana ou X min/processo |

---

## Roadmap

| Fase | Semana | Entrega | Pré-requisitos |
|------|--------|---------|---------------|
| 1 | 1-2 | | |
| 2 | 3-4 | | |
| 3 | 5-6 | | |

Regras finais:
1. Sem saudações. Comece direto pelo título.
2. Use os badges de prioridade nas tabelas.
3. Cada frase deve ter conteúdo útil. Zero preenchimento.`;


        const prompt = type === "improvements" ? improvementsPrompt : n8nPrompt;

        try {
            setProgress(60);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Timeout: a IA demorou demais (>120s).")), 120_000)
            );
            const result = await Promise.race([callAI(prompt), timeoutPromise]);
            if (!result || result.trim().length === 0) {
                throw new Error("A IA retornou uma resposta vazia.");
            }
            clearInterval(timer);
            setProgress(100);
            setProgressLabel("Concluído!");
            await new Promise(r => setTimeout(r, 500));
            const newReports = { ...reports, [type]: result };
            setReports(newReports);
            try { localStorage.setItem(`clinicflow_reports_${project.id}`, JSON.stringify(newReports)); } catch {}
            setActiveReport(type);
            onStatusChange("complete");
        } catch (e: unknown) {
            clearInterval(timer);
            throw e;
        } finally {
            setLoading(null);
            setPhase("idle");
            setClarifyQuestions([]);
        }
    }

    function downloadReport(type: string) {
        const content = reports[type];
        if (!content) return;
        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `relatorio_${type}.md`; a.click();
        URL.revokeObjectURL(url);
    }

    function renderMarkdown(text: string): string {
        const codeBlocks: string[] = [];
        let h = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
            const idx = codeBlocks.length;
            codeBlocks.push(code.trim());
            return `\x00CB${idx}\x00`;
        });
        // Priority badges
        h = h.replace(/🔴\s*(Alta)/g, '<span style="background:#fef2f2;color:#dc2626;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;border:1px solid #fecaca">🔴 Alta</span>');
        h = h.replace(/🟡\s*(M[eé]dia)/g, '<span style="background:#fffbeb;color:#d97706;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;border:1px solid #fde68a">🟡 Média</span>');
        h = h.replace(/🟢\s*(Baixa)/g, '<span style="background:#f0fdf4;color:#16a34a;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;border:1px solid #bbf7d0">🟢 Baixa</span>');
        // Tables with better styling
        const lines = h.split('\n');
        const out: string[] = [];
        let tableRows: string[] = [];
        let isFirstRow = true;
        for (const line of lines) {
            if (/^\|[-: |]+\|$/.test(line)) continue;
            const m = line.match(/^\|(.+)\|$/);
            if (m) {
                const cells = m[1].split('|').map(c => {
                    const content = c.trim();
                    const isBoldLabel = /^\*\*.*\*\*$/.test(content);
                    const style = isFirstRow && tableRows.length === 0
                        ? 'padding:10px 14px;background:#E87A2A;color:white;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.3px'
                        : isBoldLabel
                        ? 'padding:8px 12px;border:1px solid rgba(0,0,0,0.06);color:#64748b;font-size:12px;font-weight:600;background:#f8fafc;width:140px'
                        : 'padding:8px 12px;border:1px solid rgba(0,0,0,0.06);color:#334155;font-size:13px';
                    return `<td style="${style}">${content}</td>`;
                }).join('');
                tableRows.push(`<tr style="${tableRows.length % 2 === 1 ? 'background:rgba(232,122,42,0.03)' : ''}">${cells}</tr>`);
            } else {
                if (tableRows.length) {
                    out.push(`<table style="width:100%;border-collapse:collapse;margin:14px 0;border-radius:10px;overflow:hidden;border:1px solid rgba(0,0,0,0.08)">${tableRows.join('')}</table>`);
                    tableRows = [];
                    isFirstRow = true;
                }
                out.push(line);
            }
        }
        if (tableRows.length) out.push(`<table style="width:100%;border-collapse:collapse;margin:14px 0;border-radius:10px;overflow:hidden;border:1px solid rgba(0,0,0,0.08)">${tableRows.join('')}</table>`);
        h = out.join('\n');
        // Horizontal rules as styled dividers
        h = h.replace(/^---$/gm, '<div style="border:none;border-top:2px solid rgba(232,122,42,0.15);margin:24px 0"></div>');
        // Lists
        h = h.replace(/^[-*•] (.+)$/gm, '<li style="margin:3px 0;color:#334155">$1</li>');
        h = h.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin:3px 0;color:#334155">$1</li>');
        h = h.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, m => `<ul style="padding-left:20px;margin:10px 0">${m}</ul>`);
        // Headers
        h = h.replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:18px 0 8px;padding-left:12px;border-left:3px solid #E87A2A">$1</h3>');
        h = h.replace(/^## (.+)$/gm, '<h2 style="font-size:15px;font-weight:700;color:#D06B22;margin:24px 0 10px;padding-bottom:6px;border-bottom:1px solid rgba(0,0,0,0.08);text-transform:uppercase;letter-spacing:0.3px">$1</h2>');
        h = h.replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:800;color:#1a202c;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #E87A2A">$1</h1>');
        // Inline formatting
        h = h.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1a202c;font-weight:700">$1</strong>');
        h = h.replace(/`([^`\n]+)`/g, '<code style="background:#f1f5f9;padding:1px 6px;border-radius:4px;font-size:12px;color:#D06B22">$1</code>');
        // Paragraphs
        h = h.split(/\n{2,}/).map(block => {
            block = block.trim();
            if (!block) return '';
            if (/^<(h[1-6]|ul|table|pre|div|\x00CB)/.test(block)) return block;
            if (block.split('\n').some(l => /^<(h[1-6]|ul|table|div)/.test(l.trim()))) {
                return block.split('\n').filter(Boolean).join('\n');
            }
            return `<p style="margin:10px 0;color:#334155;line-height:1.75;font-size:14px">${block.replace(/\n/g, '<br>')}</p>`;
        }).filter(Boolean).join('\n');
        // Restore code blocks
        h = h.replace(/\x00CB(\d+)\x00/g, (_, i) =>
            `<pre style="background:#f8fafc;padding:14px;border-radius:8px;font-size:12px;overflow-x:auto;border:1px solid rgba(0,0,0,0.08);margin:12px 0;color:#334155;white-space:pre-wrap;border-left:3px solid #E87A2A"><code>${codeBlocks[parseInt(i)]}</code></pre>`);
        return h;
    }

    function printAsPdf(type: string) {
        const content = reports[type];
        if (!content) return;
        const titles: Record<string, string> = { improvements: "Relatório de Melhorias", n8n: "Relatório de Automações" };
        const title = titles[type] || "Relatório";
        function md(text: string): string {
            const cbs: string[] = [];
            let h = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => { const i = cbs.length; cbs.push(code.trim()); return `\x00C${i}\x00`; });
            // Priority badges for PDF
            h = h.replace(/🔴\s*Alta/g, '<span class="badge-alta">🔴 Alta</span>');
            h = h.replace(/🟡\s*M[eé]dia/g, '<span class="badge-media">🟡 Média</span>');
            h = h.replace(/🟢\s*Baixa/g, '<span class="badge-baixa">🟢 Baixa</span>');
            
            const ls = h.split('\n'); const o: string[] = []; let tr: string[] = []; let isFirst = true;
            for (const line of ls) {
                if (/^\|[-: |]+\|$/.test(line)) continue;
                const m = line.match(/^\|(.+)\|$/);
                if (m) {
                    const cells = m[1].split('|').map(c => {
                        const ct = c.trim();
                        const bold = /^\*\*.*\*\*$/.test(ct);
                        return bold ? `<td class="td-label">${ct}</td>` : `<td>${ct}</td>`;
                    }).join('');
                    tr.push(`<tr>${cells}</tr>`);
                    isFirst = false;
                } else { if (tr.length) { o.push(`<table>${tr.join('')}</table>`); tr = []; isFirst = true; } o.push(line); }
            }
            if (tr.length) o.push(`<table>${tr.join('')}</table>`);
            h = o.join('\n');
            
            // Fix hr parsing
            h = h.replace(/^---$/gm, '<hr>');
            
            h = h.replace(/^[-*•] (.+)$/gm, '<li>$1</li>').replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
                .replace(/((?:<li>.*?<\/li>\n?)+)/g, m => `<ul>${m}</ul>`)
                .replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
            h = h.split(/\n{2,}/).map(b => { b = b.trim(); if (!b) return ''; if (/^<(h[1-6]|ul|table|pre|hr|\x00C)/.test(b)) return b; return `<p>${b.replace(/\n/g, '<br>')}</p>`; }).filter(Boolean).join('\n');
            h = h.replace(/\x00C(\d+)\x00/g, (_, i) => `<pre><code>${cbs[parseInt(i)]}</code></pre>`);
            return h;
        }
        
        const coverHtml = `
            <div class="cover">
                <div class="cover-logo">
                    <img src="data:image/png;base64,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" style="height: 100px; width: auto; margin: 0 auto; display: block;" />
                </div>
                <h1 class="cover-title">${title}</h1>
                <h2 class="cover-subtitle">${project.clinic_name}</h2>
                <div class="cover-date">${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}</div>
            </div>
        `;

        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${title}</title><style>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800;900&display=swap');
* { margin:0; padding:0; box-sizing:border-box }
body { 
    font-family: 'Segoe UI', Arial, sans-serif; 
    max-width: 900px; margin: 0 auto; padding: 0; color: #333; font-size: 13px; line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
}
.content-wrapper { padding: 40px; }
h1 { font-size: 22px; font-weight: 800; color: #E87A2A; margin-bottom: 8px }
h2 { font-size: 16px; font-weight: 700; color: #2d3748; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #E87A2A; text-transform: uppercase; letter-spacing: 0.3px }
h3 { font-size: 14px; font-weight: 700; color: #4a5568; margin: 18px 0 6px; padding-left: 10px; border-left: 3px solid #E87A2A }
p { margin: 8px 0 }
ul, ol { padding-left: 24px; margin: 8px 0 }
li { margin: 4px 0 }
strong { color: #000; font-weight: 700 }
hr { border: none; border-top: 2px solid rgba(232,122,42,0.15); margin: 20px 0 }
table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; page-break-inside: auto; }
tr { page-break-inside: avoid; page-break-after: auto; }
td { border: 1px solid #e2e8f0; padding: 8px 12px; }
td.td-label { background: #f8fafc; color: #000; font-weight: 700; width: 130px; }
tr:nth-child(even) { background: #fefaf6 }
pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 6px; font-size: 12px; overflow: auto; margin: 12px 0; white-space: pre-wrap; border-left: 4px solid #E87A2A }
code { font-family: Consolas, monospace; font-weight: 700; color: #d97706; }
.badge-alta { color: #dc2626; font-weight: 700; }
.badge-media { color: #d97706; font-weight: 700; }
.badge-baixa { color: #16a34a; font-weight: 700; }
.footer { margin-top: 50px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #718096; text-align: center }

/* Cover styles */
.cover { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; text-align: center; position: relative; padding: 40px; font-family: 'Montserrat', sans-serif; }
.cover-logo { margin-bottom: 40px; }
.cover-title { font-size: 26px; font-weight: 800; color: #000; margin-bottom: 12px; font-family: 'Montserrat', sans-serif; border: none; padding: 0; }
.cover-subtitle { font-size: 20px; font-weight: 400; color: #333; border: none; text-transform: none; padding: 0; margin: 0; font-family: 'Montserrat', sans-serif; }
.cover-date { position: absolute; bottom: 60px; font-size: 14px; color: #333; font-family: 'Montserrat', sans-serif; }

@media print{
    body{ max-width:100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cover { page-break-after: always; }
    h2, h3 { page-break-after: avoid; }
}
</style></head><body>
${coverHtml}
<div class="content-wrapper">
${md(content)}
</div>
</body></html>`;
        const win = window.open('', '_blank', 'width=900,height=700');
        if (win) { win.document.write(html); win.document.close(); win.addEventListener('load', () => setTimeout(() => win.print(), 300)); }
    }

    return (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {error && (
                <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#dc2626" }}>
                    ⚠️ {error}
                </div>
            )}
            {/* Report Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                    {
                        type: "improvements" as const,
                        title: "Relatório de Melhorias",
                        desc: "Gargalos, atores, plano de ação priorizado e KPIs de monitoramento",
                        icon: "📊",
                        color: "#E87A2A"
                    },
                    {
                        type: "n8n" as const,
                        title: "Relatório n8n & Automação",
                        desc: "APIs disponíveis, fluxos de automação e roadmap de implementação",
                        icon: "⚡",
                        color: "#f59e0b"
                    },
                ].map(r => (
                    <div key={r.type} className="card" style={{ borderRadius: 14, padding: 20, borderTop: `3px solid ${r.color}` }}>
                        <div style={{ fontSize: 28, marginBottom: 10 }}>{r.icon}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#1a202c", marginBottom: 6 }}>{r.title}</div>
                        <p style={{ fontSize: 12, color: "#475569", marginBottom: 16, lineHeight: 1.5 }}>{r.desc}</p>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                className="btn-primary"
                                style={{ fontSize: 12, padding: "8px 14px", flex: 1, justifyContent: "center" }}
                                onClick={() => reports[r.type] ? setActiveReport(r.type) : generateReport(r.type)}
                                disabled={loading === r.type}
                            >
                                {loading === r.type && phase !== "answering" ? (
                                    <><span className="animate-spin" style={{ display: "inline-block" }}>⚙</span> Gerando...</>
                                ) : reports[r.type] ? "👁 Ver Relatório" : "✨ Gerar"}
                            </button>
                            {reports[r.type] && (
                                <>
                                    <button className="btn-secondary" style={{ fontSize: 12, padding: "8px 10px", color: "#E87A2A", backgroundColor: "rgba(232,122,42,0.05)", borderColor: "rgba(232,122,42,0.2)" }} title="Regerar relatório usando a IA"
                                        onClick={() => {
                                            if (window.confirm("Deseja regerar este relatório? A versão atual será substituída pela nova.")) {
                                                generateReport(r.type);
                                            }
                                        }} disabled={loading === r.type}>🔄 Regerar</button>
                                    <button className="btn-secondary" style={{ fontSize: 12, padding: "8px 12px" }} title="Exportar PDF"
                                        onClick={() => printAsPdf(r.type)}>📄 PDF</button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Progress Bar */}
            {loading && phase !== "answering" && (
                <div className="animate-fade-in card" style={{ borderRadius: 14, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{progressLabel}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{elapsed}s</span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: "var(--surface-3)", borderRadius: 8, overflow: "hidden" }}>
                        <div style={{
                            height: "100%", borderRadius: 8,
                            background: "linear-gradient(90deg, #E87A2A, #f59e0b)",
                            width: `${progress}%`,
                            transition: "width 0.5s ease",
                        }} />
                    </div>
                </div>
            )}

            {/* Inline Clarification Questions */}
            {phase === "answering" && clarifyQuestions.length > 0 && (
                <div className="animate-fade-in card" style={{ borderRadius: 14, padding: 24, borderTop: "3px solid #E87A2A" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1a202c", marginBottom: 4 }}>
                        🤖 A IA precisa de mais informações
                    </div>
                    <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16, lineHeight: 1.5 }}>
                        Responda as perguntas abaixo para um relatório mais preciso, ou clique "Pular" para gerar com o contexto atual.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {clarifyQuestions.map((q, i) => (
                            <div key={i}>
                                <label style={{ fontSize: 13, color: "#334155", display: "block", marginBottom: 6, fontWeight: 500 }}>
                                    <span style={{ color: "#E87A2A", fontWeight: 700 }}>{i + 1}. </span>{q}
                                </label>
                                <textarea
                                    className="input"
                                    style={{ minHeight: 50 }}
                                    placeholder="Sua resposta..."
                                    value={clarifyAnswers[i] || ""}
                                    onChange={e => setClarifyAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                                />
                            </div>
                        ))}
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                            <button className="btn-ghost" style={{ fontSize: 12 }}
                                onClick={() => { setClarifyQuestions([]); setPhase("generating"); submitClarifyAnswers(loading as "improvements" | "n8n"); }}>
                                Pular →
                            </button>
                            <button className="btn-primary" style={{ fontSize: 12, padding: "8px 18px" }}
                                onClick={() => submitClarifyAnswers(loading as "improvements" | "n8n")}>
                                ✅ Enviar e Gerar Relatório
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Viewer */}
            {activeReport && reports[activeReport] && (
                <div className="animate-fade-in glass" style={{ borderRadius: 16, padding: "24px 28px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--brand-600)" }}>
                            {activeReport === "improvements" ? "📊 Relatório de Melhorias" : "⚡ Relatório n8n & Automação"}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }}
                                onClick={() => printAsPdf(activeReport)}>📄 Exportar PDF</button>
                            <button className="btn-ghost" onClick={() => setActiveReport(null)}>✕ Fechar</button>
                        </div>
                    </div>
                    <div className="prose-dark" dangerouslySetInnerHTML={{ __html: renderMarkdown(reports[activeReport]) }} />
                </div>
            )}
        </div>
    );
}

// ---- MAIN PROJECT PAGE ----
export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const projectId = parseInt(id);
    const [activeTab, setActiveTab] = useState("documents");
    const [project, setProject] = useState(() => MOCK_PROJECTS.find(p => p.id === projectId) || MOCK_PROJECTS[0]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem("clinicflow_projects");
            if (saved) {
                const all = JSON.parse(saved);
                const found = all.find((p: { id: number }) => p.id === projectId);
                if (found) setProject(found);
            }
        } catch { }
    }, [projectId]);

    const STATUS_RANK: Record<string, number> = { draft: 0, analysis: 1, bpmn_ready: 2, complete: 3 };
    function updateProjectStatus(newStatus: string) {
        setProject(prev => {
            if ((STATUS_RANK[newStatus] ?? 0) <= (STATUS_RANK[prev.status] ?? 0)) return prev;
            const updated = { ...prev, status: newStatus as Project["status"] };
            try {
                const saved = localStorage.getItem("clinicflow_projects");
                const all: Project[] = saved ? JSON.parse(saved) : [];
                const idx = all.findIndex(p => p.id === projectId);
                if (idx >= 0) all[idx] = updated; else all.push(updated);
                localStorage.setItem("clinicflow_projects", JSON.stringify(all));
            } catch {}
            return updated;
        });
    }

    return (
        <div style={{ padding: "28px 40px", maxWidth: 1200 }}>
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 13, color: "#475569" }}>
                <Link href="/" style={{ color: "#475569", textDecoration: "none" }}>Dashboard</Link>
                <span>›</span>
                <span style={{ color: "#94a3b8" }}>{project.name}</span>
            </div>

            {/* Page Header */}
            <div className="card" style={{ borderRadius: 14, padding: "18px 24px", marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a202c", letterSpacing: "-0.3px" }}>
                                {project.name}
                            </h1>
                            <span className={`badge badge-${project.status}`}>{STATUS_LABELS[project.status]}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", display: "flex", gap: 16 }}>
                            <span>🏥 {project.clinic_name}</span>
                            <span>📁 {project.sector}</span>
                            <span>📅 {new Date(project.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                    </div>
                    {/* Progress Steps */}
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {[
                            { label: "Docs", done: project.status !== "draft" },
                            
                            { label: "Relatórios", done: project.status === "complete" },
                        ].map((step, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <div style={{
                                    width: 22, height: 22, borderRadius: "50%",
                                    background: step.done ? "#16a34a" : "var(--surface-3)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 10, fontWeight: 700, color: step.done ? "white" : "#94a3b8",
                                }}>
                                    {step.done ? "✓" : i + 1}
                                </div>
                                <span style={{ fontSize: 11, color: step.done ? "#16a34a" : "#94a3b8", fontWeight: 500 }}>
                                    {step.label}
                                </span>
                                {i < 2 && <span style={{ color: "#cbd5e1", margin: "0 2px", fontSize: 10 }}>→</span>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: "flex", gap: 2, marginBottom: 28, borderBottom: "1px solid var(--surface-border)", paddingBottom: 0 }}>
                {TABS.map(tab => (
                    <button key={tab.key}
                        id={`tab-${tab.key}`}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: "10px 18px", background: "transparent", border: "none",
                            borderBottom: activeTab === tab.key ? "2px solid #E87A2A" : "2px solid transparent",
                            color: activeTab === tab.key ? "#D06B22" : "#475569",
                            cursor: "pointer", fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                            display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                            marginBottom: "-1px"
                        }}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}

            {activeTab === "documents" && <DocumentsTab projectId={projectId} onStatusChange={updateProjectStatus} />}            {activeTab === "reports" && <ReportsTab project={project} onStatusChange={updateProjectStatus} />}
        </div>
    );
}
