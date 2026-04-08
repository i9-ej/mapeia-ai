"use client";

import { useState, use, useEffect } from "react";
import Link from "next/link";
import { callAI, generateProcessModel, modelToBpmnXml, getActiveKey, saveGeminiKey, getProviderLabel, type ProcessModel } from "@/lib/aiClient";
import {
    MOCK_PROJECTS,
    MOCK_DOCUMENTS,
    MOCK_PROCESS,
    MOCK_BPMN_XML,
    MOCK_IMPROVEMENTS_REPORT,
    MOCK_N8N_REPORT,
} from "@/lib/mockData";
import { Project, DocumentMeta } from "@/lib/api";

const TABS = [
    { key: "overview", label: "Visão Geral", icon: "📊" },
    { key: "documents", label: "Documentos", icon: "📁" },
    { key: "clarification", label: "Chat de Clarificação", icon: "💬" },
    { key: "bpmn", label: "BPMN", icon: "🔀" },
    { key: "reports", label: "Relatórios", icon: "📈" },
];

const STATUS_LABELS: Record<string, string> = {
    draft: "Rascunho",
    analysis: "Em Análise",
    bpmn_ready: "BPMN Pronto",
    complete: "Concluído",
};

// ---- OVERVIEW TAB ----
function OverviewTab({ project }: { project: Project }) {
    return (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                    { label: "Clínica", value: project.clinic_name, icon: "🏥" },
                    { label: "Setor", value: project.sector, icon: "📁" },
                    { label: "Status", value: STATUS_LABELS[project.status], icon: "🔄" },
                    { label: "Criado em", value: new Date(project.created_at).toLocaleDateString("pt-BR"), icon: "📅" },
                ].map(item => (
                    <div key={item.label} className="glass" style={{ borderRadius: 12, padding: "16px 20px" }}>
                        <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                            {item.icon} {item.label}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{item.value}</div>
                    </div>
                ))}
            </div>
            {project.objectives && (
                <div className="glass" style={{ borderRadius: 12, padding: "20px" }}>
                    <div style={{ fontSize: 12, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                        🎯 Objetivos do Projeto
                    </div>
                    <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>{project.objectives}</p>
                </div>
            )}
            <div className="glass" style={{ borderRadius: 12, padding: "20px" }}>
                <div style={{ fontSize: 12, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 16 }}>
                    📍 Progresso do Projeto
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                        { label: "Documentos carregados", done: project.status !== "draft", step: 1 },
                        { label: "Análise AS-IS gerada", done: ["analysis", "bpmn_ready", "complete"].includes(project.status), step: 2 },
                        { label: "Clarificação validada", done: ["bpmn_ready", "complete"].includes(project.status), step: 3 },
                        { label: "BPMN gerado", done: ["bpmn_ready", "complete"].includes(project.status), step: 4 },
                        { label: "Relatórios gerados", done: project.status === "complete", step: 5 },
                    ].map(step => (
                        <div key={step.step} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{
                                width: 24, height: 24, borderRadius: "50%",
                                background: step.done ? "rgba(34,197,94,0.2)" : "var(--surface-3)",
                                border: `2px solid ${step.done ? "#22c55e" : "var(--surface-border)"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, fontWeight: 700,
                                color: step.done ? "#22c55e" : "#475569",
                                flexShrink: 0
                            }}>
                                {step.done ? "✓" : step.step}
                            </div>
                            <span style={{ fontSize: 13, color: step.done ? "#e2e8f0" : "#475569", fontWeight: step.done ? 500 : 400 }}>
                                {step.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ---- DOCUMENTS TAB ----
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

    function updateDocs(newDocs: DocumentMeta[]) {
        setDocs(newDocs);
        try { localStorage.setItem(storageKey, JSON.stringify(newDocs)); } catch { }
        if (newDocs.length > 0) onStatusChange("analysis");
    }

    const FILE_TYPES: Record<string, string> = { txt: "📄", pdf: "📕", docx: "📝", xlsx: "📊", csv: "📋", xls: "📊" };

    function simulateUpload(files: FileList) {
        setUploading(true);
        const TEXT_TYPES = ["txt", "csv", "md", "json", "xml"];
        const fileArray = Array.from(files);

        Promise.all(fileArray.map(async (f, i) => {
            const ext = f.name.split(".").pop()?.toLowerCase() || "txt";
            let textContent: string | undefined;
            if (TEXT_TYPES.includes(ext) && f.size < 500_000) {
                try { textContent = await f.text(); } catch { }
            }
            return {
                id: Date.now() + i,
                filename: f.name,
                file_type: ext,
                file_size: f.size,
                created_at: new Date().toISOString(),
                has_content: true,
                text_content: textContent,
            } as DocumentMeta & { text_content?: string };
        })).then(newDocs => {
            updateDocs([...newDocs, ...docs]);
            setUploading(false);
        });
    }

    return (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Upload Zone */}
            <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) simulateUpload(e.dataTransfer.files); }}
                style={{
                    border: `2px dashed ${isDragging ? "var(--brand-500)" : "var(--surface-border)"}`,
                    borderRadius: 16, padding: "40px 24px", textAlign: "center",
                    background: isDragging ? "rgba(97,114,243,0.08)" : "var(--surface-2)",
                    transition: "all 0.2s", cursor: "pointer"
                }}
                onClick={() => document.getElementById("file-input")?.click()}
            >
                <input id="file-input" type="file" multiple accept=".txt,.pdf,.docx,.xlsx,.csv,.xls"
                    style={{ display: "none" }} onChange={e => e.target.files && simulateUpload(e.target.files)} />
                {uploading ? (
                    <div>
                        <div className="animate-spin" style={{ fontSize: 32, display: "inline-block", marginBottom: 12 }}>⚙️</div>
                        <div style={{ fontSize: 14, color: "#818cf8" }}>Processando documentos...</div>
                    </div>
                ) : (
                    <>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📤</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 6 }}>
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
                    <div key={doc.id} className="glass" style={{
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
                                <div style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0" }}>{doc.filename}</div>
                                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                                    {doc.file_type.toUpperCase()} · {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : "—"} · {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {doc.has_content && (
                                <span style={{ fontSize: 11, background: "rgba(34,197,94,0.12)", color: "#22c55e", padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>
                                    ✓ Indexado
                                </span>
                            )}
                            <button className="btn-ghost" style={{ padding: "6px 10px" }}
                                onClick={() => updateDocs(docs.filter(d => d.id !== doc.id))}>🗑</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---- CLARIFICATION CHAT TAB ----
interface Message {
    role: "system" | "user" | "ai" | "question";
    content: string;
    timestamp: Date;
}

// Banco de perguntas por setor
const SECTOR_QUESTIONS: Record<string, string[]> = {
    Financeiro: [
        "Qual sistema é utilizado atualmente para faturamento e emissão de NF (iClinic, MV, Tasy, outro)?",
        "A submissão de guias aos convênios é feita manualmente ou via integração/API (TISS)?",
        "Existe um processo definido para tratar glosas? Qual o prazo médio de contestação?",
        "Como são realizadas as cobranças para pacientes particulares (WhatsApp, e-mail, boleto físico)?",
        "Qual o tempo médio entre a realização do atendimento e o recebimento do pagamento?",
    ],
    Atendimento: [
        "Como é feito o agendamento de consultas atualmente (telefone, WhatsApp, app, sistema)?",
        "Existe triagem antes da consulta? Como ela é realizada (presencial, online)?",
        "Qual o tempo médio de espera do paciente entre o agendamento e a consulta?",
        "Como é feito o check-in do paciente na chegada à clínica?",
        "Existe algum processo de confirmação de consulta (lembrete de agenda)?",
    ],
    RH: [
        "Como são elaboradas as escalas de médicos e funcionários (Excel, sistema, manual)?",
        "Existe um processo formal de onboarding para novos colaboradores?",
        "Como são registrados os pontos e horas trabalhadas dos funcionários?",
        "Quais são os principais gargalos no processo de contratação?",
        "Como são gerenciadas as férias e folgas da equipe?",
    ],
    TI: [
        "Quais sistemas de saúde estão integrados atualmente (prontuário, faturamento, agenda)?",
        "Como é feita a gestão de acessos e permissões dos usuários nos sistemas?",
        "Existe backup automatizado dos dados da clínica? Com qual frequência?",
        "Quais são os principais sistemas legados que precisam ser mantidos ou substituídos?",
        "Existe suporte técnico interno ou é terceirizado?",
    ],
    Operacional: [
        "Como é feito o controle de estoque de materiais e medicamentos?",
        "Quais são os processos de compras e quem são os fornecedores principais?",
        "Como é realizada a limpeza e manutenção das instalações e equipamentos?",
        "Existe um processo de gestão de resíduos médicos (PGRSS)?",
        "Como são gerenciados os equipamentos médicos (calibração, manutenção preventiva)?",
    ],
    Faturamento: [
        "Qual o volume médio de atendimentos por mês (convênio vs. particular)?",
        "Quais convênios a clínica trabalha e qual o percentual de cada um no faturamento?",
        "Como é feita a auditoria das guias antes do envio ao convênio?",
        "Qual a taxa média de glosa? Quais são as glosas mais frequentes?",
        "Existe régua de cobrança para pacientes inadimplentes?",
    ],
    Compras: [
        "Como é feito o processo de solicitação e aprovação de compras?",
        "Existe um sistema de cotação com múltiplos fornecedores?",
        "Qual o prazo médio entre a solicitação e o recebimento dos itens?",
        "Como é feita a conferência de notas fiscais e o recebimento de mercadorias?",
        "Existe integração entre o setor de compras e o financeiro?",
    ],
};

const DEFAULT_QUESTIONS = [
    "Quais são as principais etapas do processo que você quer mapear?",
    "Quem são os atores/responsáveis envolvidos nesse processo?",
    "Quais sistemas ou ferramentas são utilizados nesse processo?",
    "Quais são os principais gargalos ou problemas que você identifica no processo atual?",
    "Existe algum prazo ou SLA definido para etapas críticas do processo?",
];

function ClarificationTab({ project }: { project: Project }) {
    const storageKey = `clinicflow_chat_${project.id}`;
    const [phase, setPhase] = useState<"idle" | "loading" | "questions" | "validated">(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved).phase || "idle";
        } catch { }
        return "idle";
    });
    const [messages, setMessages] = useState<Message[]>(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                return JSON.parse(saved).messages?.map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) })) || [];
            }
        } catch { }
        return [];
    });
    const [questions, setQuestions] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved).questions || [];
        } catch { }
        return [];
    });
    const [answers, setAnswers] = useState<Record<number, string>>({});

    function saveState(newPhase: string, newMessages: Message[], newQuestions: string[]) {
        try {
            localStorage.setItem(storageKey, JSON.stringify({ phase: newPhase, messages: newMessages, questions: newQuestions }));
        } catch { }
    }

    function getRealDocs(): DocumentMeta[] {
        try {
            const saved = localStorage.getItem(`clinicflow_docs_${project.id}`);
            if (saved) return JSON.parse(saved);
        } catch { }
        return [];
    }

    function getContextQuestions(): string[] {
        return SECTOR_QUESTIONS[project.sector] || DEFAULT_QUESTIONS;
    }

    function startAnalysis() {
        const realDocs = getRealDocs();
        const docCount = realDocs.length;
        const docNames = realDocs.map(d => `**${d.filename}**`).join(", ") || "nenhum documento";
        const sectorQuestions = getContextQuestions();

        setPhase("loading");
        const loadingMsgs: Message[] = [{
            role: "ai",
            content: docCount > 0
                ? `Analisando ${docCount} documento${docCount > 1 ? "s" : ""}: ${docNames}...\n\nIdentificando o processo de **${project.sector}** na **${project.clinic_name}**.`
                : `Nenhum documento enviado ainda. Farei perguntas baseadas no setor **${project.sector}** para construir o mapeamento.`,
            timestamp: new Date()
        }];
        setMessages(loadingMsgs);

        setTimeout(() => {
            const newPhase = "questions";
            const analysisMsg: Message = {
                role: "ai",
                content: docCount > 0
                    ? `Concluí a leitura dos ${docCount} arquivo${docCount > 1 ? "s" : ""} (${realDocs.map(d => d.filename).join(", ")}).\n\nIdentifiquei estrutura de processo de **${project.sector}** com múltiplas etapas. Para completar o modelo AS-IS com precisão, preciso de clarificações sobre pontos que os documentos não cobrem por completo:`
                    : `Pronto para iniciar o mapeamento do processo de **${project.sector}** — **${project.clinic_name}**. Responda às perguntas abaixo para construirmos o modelo AS-IS:`,
                timestamp: new Date()
            };
            const finalMessages = [...loadingMsgs, analysisMsg];
            setMessages(finalMessages);
            setQuestions(sectorQuestions);
            setPhase(newPhase);
            saveState(newPhase, finalMessages, sectorQuestions);
        }, 2500);
    }

    function submitAnswers() {
        const allAnswered = questions.every((_, i) => answers[i]?.trim());
        if (!allAnswered) return;

        const userMsg: Message = {
            role: "user",
            content: questions.map((q, i) => `**P:** ${q}\n**R:** ${answers[i]}`).join("\n\n"),
            timestamp: new Date()
        };
        const withUser = [...messages, userMsg];
        setMessages(withUser);
        setPhase("loading");

        setTimeout(() => {
            const realDocs = getRealDocs();
            const objectives = project.objectives ? `\n\nObjetivo declarado: "${project.objectives}"` : "";
            const finalMsg: Message = {
                role: "ai",
                content: `✅ **Modelo AS-IS validado com sucesso!**\n\nCom base ${realDocs.length > 0 ? `nos ${realDocs.length} documento(s) analisados e n` : "n"}as suas ${questions.length} respostas, o processo de **${project.sector}** da **${project.clinic_name}** foi mapeado.${objectives}\n\nO modelo identificou:\n• **Setor:** ${project.sector}\n• **Atores mapeados** a partir das suas respostas\n• **Gargalos identificados** nas etapas descritas\n• **Pontos de decisão** e fluxos alternativos\n\nAgora você pode gerar o **BPMN** e os **Relatórios de Melhoria** com base neste contexto real. 🎯`,
                timestamp: new Date()
            };
            const finalMessages = [...withUser, finalMsg];
            setMessages(finalMessages);
            setPhase("validated");
            saveState("validated", finalMessages, questions);
        }, 2000);
    }

    function resetChat() {
        setPhase("idle");
        setMessages([]);
        setQuestions([]);
        setAnswers({});
        try { localStorage.removeItem(storageKey); } catch { }
    }

    return (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", height: 560 }}>
            {/* Chat messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 0", display: "flex", flexDirection: "column", gap: 14 }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: "center", padding: "60px 0", color: "#334155" }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
                            Agente de Clarificação Pronto
                        </div>
                        <p style={{ fontSize: 13, color: "#475569", maxWidth: 380, margin: "0 auto", lineHeight: 1.6 }}>
                            O agente vai analisar os documentos que você enviou na aba <strong>Documentos</strong> e gerar perguntas específicas para o setor <strong>{project.sector}</strong>.
                        </p>
                        <button className="btn-primary" style={{ marginTop: 24 }} onClick={startAnalysis}>
                            🚀 Iniciar Análise
                        </button>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className="animate-slide-in" style={{
                        display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row",
                        alignItems: "flex-end", gap: 10
                    }}>
                        {msg.role !== "user" && (
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #6172f3, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                                ⚕
                            </div>
                        )}
                        <div className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}>
                            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-line" }}>
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}

                {phase === "loading" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #6172f3, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚕</div>
                        <div className="chat-bubble-ai" style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {[0, 0.2, 0.4].map((delay, i) => (
                                <div key={i} className="animate-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", animationDelay: `${delay}s` }} />
                            ))}
                        </div>
                    </div>
                )}

                {phase === "questions" && (
                    <div className="animate-fade-in" style={{ background: "var(--surface-2)", border: "1px solid rgba(97,114,243,0.2)", borderRadius: 16, padding: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#818cf8", marginBottom: 16 }}>
                            💡 Perguntas de Clarificação — {project.sector} ({questions.length})
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            {questions.map((q, i) => (
                                <div key={i}>
                                    <label style={{ fontSize: 13, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                                        <span style={{ fontWeight: 700, color: "#818cf8" }}>{i + 1}. </span>{q}
                                    </label>
                                    <textarea
                                        className="input"
                                        style={{ minHeight: 60 }}
                                        placeholder="Sua resposta..."
                                        value={answers[i] || ""}
                                        onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                                    />
                                </div>
                            ))}
                            <button
                                className="btn-primary"
                                style={{ alignSelf: "flex-end" }}
                                onClick={submitAnswers}
                                disabled={!questions.every((_, i) => answers[i]?.trim())}
                            >
                                ✅ Validar e Finalizar Modelo
                            </button>
                        </div>
                    </div>
                )}

                {phase === "validated" && (
                    <div style={{ textAlign: "center", padding: "12px 0" }}>
                        <button className="btn-ghost" onClick={resetChat} style={{ fontSize: 12 }}>
                            🔄 Reiniciar análise
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}


// ---- BPMN DIAGRAM RENDERER ----
function BpmnDiagram({ model }: { model: ProcessModel }) {
    const stepW = 130, stepH = 56, gapX = 60, gapY = 70;
    const steps = model.steps;
    const flows = model.flows;

    // Layout: place steps in rows of 4
    const perRow = 4;
    const positions: Record<string, { x: number; y: number }> = {};
    steps.forEach((s, i) => {
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        positions[s.id] = { x: 60 + col * (stepW + gapX), y: 60 + row * (stepH + gapY) };
    });

    const totalRows = Math.ceil(steps.length / perRow);
    const svgW = 60 + perRow * (stepW + gapX);
    const svgH = 60 + totalRows * (stepH + gapY) + 40;

    const COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
        start: { fill: "#dcfce7", stroke: "#22c55e", text: "#14532d" },
        end: { fill: "#fee2e2", stroke: "#ef4444", text: "#7f1d1d" },
        task: { fill: "#e0eaff", stroke: "#6172f3", text: "#1e1b4b" },
        gateway: { fill: "#fef9c3", stroke: "#eab308", text: "#713f12" },
    };

    return (
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "100%", minHeight: 340 }}>
            <defs>
                <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
                </marker>
            </defs>
            {/* Flows */}
            {flows.map((f, i) => {
                const from = positions[f.from];
                const to = positions[f.to];
                if (!from || !to) return null;
                const x1 = from.x + stepW / 2, y1 = from.y + stepH / 2;
                const x2 = to.x + stepW / 2, y2 = to.y + stepH / 2;
                return (
                    <g key={i}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arr)" />
                        {f.label && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} fill="#64748b" fontSize="8" textAnchor="middle">{f.label}</text>}
                    </g>
                );
            })}
            {/* Steps */}
            {steps.map(s => {
                const pos = positions[s.id];
                if (!pos) return null;
                const c = COLORS[s.type] || COLORS.task;
                const name1 = s.name.length > 14 ? s.name.slice(0, 14) : s.name;
                const name2 = s.name.length > 14 ? s.name.slice(14, 28) : "";
                if (s.type === "gateway") {
                    const cx = pos.x + stepW / 2, cy = pos.y + stepH / 2;
                    const r = 24;
                    return (
                        <g key={s.id}>
                            <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} fill={c.fill} stroke={c.stroke} strokeWidth="2" />
                            <text x={cx} y={cy + 3} fill={c.text} fontSize="8" textAnchor="middle" fontWeight="600">{name1}</text>
                            {s.actor && <text x={cx} y={pos.y + stepH + 12} fill="#64748b" fontSize="7" textAnchor="middle">{s.actor}</text>}
                        </g>
                    );
                }
                return (
                    <g key={s.id}>
                        <rect x={pos.x} y={pos.y} width={stepW} height={stepH} rx="8" fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
                        <text x={pos.x + stepW / 2} y={pos.y + (name2 ? 22 : 30)} fill={c.text} fontSize="9" textAnchor="middle" fontWeight="600">{name1}</text>
                        {name2 && <text x={pos.x + stepW / 2} y={pos.y + 34} fill={c.text} fontSize="9" textAnchor="middle">{name2}</text>}
                        {s.actor && <text x={pos.x + stepW / 2} y={pos.y + stepH + 12} fill="#64748b" fontSize="7" textAnchor="middle">{s.actor}</text>}
                    </g>
                );
            })}
        </svg>
    );
}

// ---- BPMN TAB ----
function BpmnTab({ projectId, project, onStatusChange }: { projectId: number; project: { name: string; clinic_name: string; sector: string; objectives?: string }; onStatusChange: (s: string) => void }) {
    const bpmnKey = `clinicflow_bpmn_${projectId}`;
    const [model, setModel] = useState<ProcessModel | null>(() => {
        try {
            const s = localStorage.getItem(bpmnKey);
            if (s) return JSON.parse(s);
        } catch { }
        return null;
    });
    const [phase, setPhase] = useState<"idle" | "thinking" | "followup" | "generating" | "done">(model ? "done" : "idle");
    const [apiKey, setApiKey] = useState(getActiveKey);
    const [apiKeyInput, setApiKeyInput] = useState("");
    const [error, setError] = useState("");
    const [followUpQ, setFollowUpQ] = useState<string[]>([]);
    const [followUpA, setFollowUpA] = useState<Record<number, string>>({});
    const [thinkingMsg, setThinkingMsg] = useState("");

    function getStoredDocs() {
        try {
            const s = localStorage.getItem(`clinicflow_docs_${projectId}`);
            return s ? JSON.parse(s) : [];
        } catch { return []; }
    }

    function getChatQAs(): { question: string; answer: string }[] {
        try {
            const s = localStorage.getItem(`clinicflow_chat_${projectId}`);
            if (!s) return [];
            const data = JSON.parse(s);
            const messages: { role: string; content: string }[] = data.messages || [];
            const questions: string[] = data.questions || [];
            const userMsgs = messages.filter(m => m.role === "user");
            if (userMsgs.length === 0 || questions.length === 0) return [];
            // Last user message has the answers
            const lastUserMsg = userMsgs[userMsgs.length - 1].content;
            // It was stored as "**P:** q\n**R:** a\n\n..."
            const pairs = lastUserMsg.split(/\n\n/).filter(Boolean);
            return questions.map((q, i) => {
                const pair = pairs[i] || "";
                const answerMatch = pair.match(/\*\*R:\*\*\s*([\s\S]+)/);
                return { question: q, answer: answerMatch ? answerMatch[1].trim() : "" };
            }).filter(qa => qa.answer);
        } catch { return []; }
    }

    function isChatValidated(): boolean {
        try {
            const s = localStorage.getItem(`clinicflow_chat_${projectId}`);
            if (!s) return false;
            return JSON.parse(s).phase === "validated";
        } catch { return false; }
    }

    async function startGeneration(extraAnswers?: Record<number, string>) {
        if (!apiKey) { setError("Configure sua API Key em ⚙️ Configurações para gerar o BPMN com IA."); return; }
        setError("");
        setPhase("thinking");
        setThinkingMsg("🧠 Analisando documentos e respostas de clarificação...");

        const docs = getStoredDocs();
        const chatQAs = getChatQAs();

        // Build extra instructions from follow-up answers
        let extraInstructions = "";
        if (extraAnswers && followUpQ.length > 0) {
            extraInstructions = followUpQ.map((q, i) =>
                `${q}: ${extraAnswers[i] || "não informado"}`
            ).join(" | ");
        }

        try {
            // Step 1: Ask AI if it needs more info
            if (!extraAnswers) {
                setThinkingMsg("🔍 Verificando se há lacunas no contexto...");
                const gapCheckPrompt = `Dado este contexto de projeto de mapeamento de processo:
Setor: ${project.sector} | Clínica: ${project.clinic_name}
Respostas de clarificação (${chatQAs.length}): ${chatQAs.map(qa => qa.answer).join(" | ")}
Docs enviados: ${docs.map((d: { filename: string }) => d.filename).join(", ") || "nenhum"}

Você consegue gerar um BPMN AS-IS completo e assertivo com estas informações?
Se SIM, responda apenas: SUFICIENTE
Se NÃO, liste EXATAMENTE 2 perguntas críticas que faltam (sem enumeração, uma por linha).`;
                const gapResp = await callAI(gapCheckPrompt);
                const trimmed = gapResp.trim();

                if (!trimmed.toUpperCase().startsWith("SUF")) {
                    const lines = trimmed.split("\n").filter(l => l.trim().length > 10).slice(0, 2);
                    if (lines.length > 0) {
                        setFollowUpQ(lines);
                        setPhase("followup");
                        return;
                    }
                }
            }

            // Step 2: Generate the process model
            setThinkingMsg(`⚙️ Gerando modelo AS-IS com ${getProviderLabel()}...`);
            const { model: newModel } = await generateProcessModel(
                project, docs, chatQAs, extraInstructions
            );

            localStorage.setItem(bpmnKey, JSON.stringify(newModel));
            setModel(newModel);
            setPhase("done");
            onStatusChange("bpmn_ready");
            setFollowUpQ([]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg === "AI_KEY_MISSING") {
                setError("API Key não configurada. Vá em ⚙️ Configurações para adicionar sua chave.");
            } else {
                setError(`Erro: ${msg}`);
            }
            setPhase("idle");
        }
    }

    function handleApiKeySave() {
        saveGeminiKey(apiKeyInput);
        setApiKey(apiKeyInput);
        setError("");
    }

    function downloadBpmn() {
        if (!model) return;
        const xml = modelToBpmnXml(model);
        const blob = new Blob([xml], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${project.sector}_as_is.bpmn`; a.click();
        URL.revokeObjectURL(url);
    }

    function regenerate() {
        setModel(null);
        setPhase("idle");
        setFollowUpQ([]);
        setFollowUpA({});
        try { localStorage.removeItem(bpmnKey); } catch { }
    }

    function printBpmnAsPdf() {
        if (!model) return;
        const container = document.getElementById("bpmn-diagram-container");
        const svgContent = container?.innerHTML || "";
        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${model.title}</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#1a202c}
h1{font-size:18px;font-weight:700;color:#1a202c;margin-bottom:4px}.meta{font-size:12px;color:#718096;margin-bottom:20px}
svg{width:100%;height:auto;background:#f8faff;border:1px solid #e2e8f0;border-radius:8px;padding:8px}
table{width:100%;border-collapse:collapse;margin-top:24px;font-size:13px}td{border:1px solid #e2e8f0;padding:8px 12px}
tr:nth-child(even){background:#f7fafc}.tbl-title{font-size:14px;font-weight:700;color:#2d3748;margin:24px 0 8px}
@media print{body{padding:20px}svg{max-height:none}}
</style></head><body>
<h1>${model.title}</h1>
<div class="meta">${model.clinic} · ${model.sector} · ${model.steps.length} etapas · Gerado em ${new Date(model.generated_at).toLocaleDateString("pt-BR")}</div>
${svgContent}
<div class="tbl-title">Etapas do Processo</div>
<table><tr style="background:#f7fafc"><td><strong>#</strong></td><td><strong>Etapa</strong></td><td><strong>Ator</strong></td><td><strong>Tipo</strong></td></tr>
${model.steps.map((s, i) => `<tr><td>${i + 1}</td><td>${s.name}${s.description ? `<br><span style="color:#718096;font-size:12px">${s.description}</span>` : ""}</td><td>${s.actor || "—"}</td><td>${s.type}</td></tr>`).join("")}
</table></body></html>`;
        const win = window.open("", "_blank", "width=1000,height=700");
        if (win) { win.document.write(html); win.document.close(); win.addEventListener("load", () => setTimeout(() => win.print(), 300)); }
    }

    const chatValidated = isChatValidated();

    return (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>
                        {model ? model.title : `BPMN AS-IS — ${project.sector}`}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                        {model
                            ? `Gerado em ${new Date(model.generated_at).toLocaleDateString("pt-BR")} · ${model.steps.length} etapas · ${model.clinic}`
                            : chatValidated ? "✅ Clarificação validada — pronto para gerar" : "⚠️ Complete o Chat de Clarificação antes de gerar"}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    {model && <button className="btn-secondary" onClick={downloadBpmn}>⬇ Download .bpmn</button>}
                    {model && <button className="btn-secondary" onClick={printBpmnAsPdf} style={{ fontSize: 12 }}>📄 PDF</button>}
                    {model && <button className="btn-ghost" onClick={regenerate} style={{ fontSize: 12 }}>🔄 Regenerar</button>}
                </div>
            </div>

            {/* API Key setup (if not configured) */}
            {!apiKey && (
                <div className="glass" style={{ borderRadius: 14, padding: 20, border: "1px solid rgba(251,191,36,0.3)" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#fbbf24", marginBottom: 8 }}>🔑 API Key não configurada</div>
                    <p style={{ fontSize: 13, color: "#475569", marginBottom: 12 }}>
                        Para gerar o BPMN com IA, configure sua chave em{" "}
                        <a href="/settings" style={{ color: "#818cf8" }}>⚙️ Configurações</a>.
                        Você pode usar Gemini (gratuito) ou Claude.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input className="input" type="password" placeholder="Cole sua API Key aqui (Gemini ou Claude)..." value={apiKeyInput}
                            onChange={e => setApiKeyInput(e.target.value)} style={{ flex: 1 }} />
                        <button className="btn-primary" onClick={handleApiKeySave} disabled={!apiKeyInput.trim()}>
                            Salvar
                        </button>
                    </div>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#fca5a5" }}>
                    ⚠️ {error}
                </div>
            )}

            {/* IDLE STATE — Generate button */}
            {phase === "idle" && !model && (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 8 }}>
                        Gerar BPMN AS-IS com IA
                    </div>
                    <p style={{ fontSize: 13, color: "#475569", maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.6 }}>
                        A IA vai analisar seus documentos e respostas de clarificação para gerar um processo completo e assertivo. Se precisar de mais informações, vai perguntar antes de gerar.
                    </p>
                    {!chatValidated && (
                        <p style={{ fontSize: 12, color: "#f59e0b", marginBottom: 16 }}>
                            ⚠️ Recomendado: complete o <strong>Chat de Clarificação</strong> primeiro para um BPMN mais preciso.
                        </p>
                    )}
                    <button className="btn-primary" onClick={() => startGeneration()} disabled={!apiKey}
                        style={{ padding: "12px 32px", fontSize: 15 }}>
                        🧠 Gerar BPMN com IA
                    </button>
                </div>
            )}

            {/* THINKING STATE */}
            {(phase === "thinking" || phase === "generating") && (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                    <div className="animate-spin" style={{ fontSize: 40, display: "inline-block", marginBottom: 16 }}>⚙️</div>
                    <div style={{ fontSize: 14, color: "#818cf8", fontWeight: 500 }}>{thinkingMsg}</div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>Isso pode levar 10–20 segundos...</div>
                </div>
            )}

            {/* FOLLOW-UP QUESTIONS STATE */}
            {phase === "followup" && followUpQ.length > 0 && (
                <div className="animate-fade-in glass" style={{ borderRadius: 16, padding: 24, border: "1px solid rgba(97,114,243,0.3)" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#818cf8", marginBottom: 6 }}>
                        🔍 A IA precisa de mais informações
                    </div>
                    <p style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>
                        Para gerar um BPMN mais assertivo, responda as perguntas abaixo:
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {followUpQ.map((q, i) => (
                            <div key={i}>
                                <label style={{ fontSize: 13, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                                    <span style={{ fontWeight: 700, color: "#818cf8" }}>{i + 1}. </span>{q}
                                </label>
                                <textarea className="input" style={{ minHeight: 70 }} placeholder="Sua resposta..."
                                    value={followUpA[i] || ""}
                                    onChange={e => setFollowUpA(prev => ({ ...prev, [i]: e.target.value }))} />
                            </div>
                        ))}
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button className="btn-ghost" onClick={() => startGeneration()}>
                                Pular e gerar assim mesmo
                            </button>
                            <button className="btn-primary"
                                onClick={() => startGeneration(followUpA)}
                                disabled={!followUpQ.every((_, i) => followUpA[i]?.trim())}>
                                ✅ Gerar com estas respostas
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DONE STATE — Show diagram */}
            {phase === "done" && model && (
                <>
                    <div id="bpmn-diagram-container" style={{ background: "#f8faff", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0", padding: 16 }}>
                        <BpmnDiagram model={model} />
                    </div>

                    {/* Steps table */}
                    <div className="glass" style={{ borderRadius: 14, padding: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#818cf8", marginBottom: 14 }}>
                            📋 Etapas do Processo ({model.steps.length})
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {model.steps.map((s, i) => (
                                <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", minWidth: 20 }}>{i + 1}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{s.name}</div>
                                        {s.description && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{s.description}</div>}
                                    </div>
                                    {s.actor && <span style={{ fontSize: 11, color: "#818cf8", background: "rgba(97,114,243,0.1)", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{s.actor}</span>}
                                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: s.type === "gateway" ? "rgba(245,158,11,0.15)" : "rgba(97,114,243,0.1)", color: s.type === "gateway" ? "#f59e0b" : "#6172f3" }}>
                                        {s.type}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Legend */}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {[
                            { color: "#22c55e", label: "Evento de Início" },
                            { color: "#6172f3", label: "Tarefa" },
                            { color: "#f59e0b", label: "Gateway (Decisão)" },
                            { color: "#ef4444", label: "Evento de Fim" },
                        ].map(item => (
                            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 12, height: 12, borderRadius: 2, background: item.color }} />
                                <span style={{ fontSize: 12, color: "#475569" }}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ---- REPORTS TAB ----
function ReportsTab({ project, onStatusChange }: { project: Project; onStatusChange: (s: string) => void }) {
    const [activeReport, setActiveReport] = useState<"improvements" | "n8n" | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [reports, setReports] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem(`clinicflow_reports_${project.id}`);
            if (saved) return JSON.parse(saved);
        } catch {}
        return {};
    });

    function getProjectContext() {
        let docs: DocumentMeta[] = [];
        try {
            const s = localStorage.getItem(`clinicflow_docs_${project.id}`);
            if (s) docs = JSON.parse(s);
        } catch {}

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

        return { docs, chatContext, bpmnSteps };
    }

    async function generateReport(type: "improvements" | "n8n") {
        const apiKey = getActiveKey();
        if (!apiKey) {
            setError("Configure sua API Key em ⚙️ Configurações para gerar relatórios com IA.");
            return;
        }
        setLoading(type);
        setError("");

        const { docs, chatContext, bpmnSteps } = getProjectContext();
        const projectInfo = `Clínica: ${project.clinic_name}
Setor: ${project.sector}
Projeto: ${project.name}
${project.objectives ? `Objetivos: ${project.objectives}` : ""}
${docs.length > 0 ? `Documentos anexados: ${docs.map(d => d.filename).join(", ")}` : "Sem documentos enviados"}
${bpmnSteps ? `\nEtapas do processo mapeado:\n${bpmnSteps}` : ""}
${chatContext ? `\nInformações coletadas na clarificação:\n${chatContext}` : ""}`;

        const prompt = type === "improvements"
            ? `Você é um consultor especialista em processos clínicos. Com base nas informações do projeto abaixo, gere um relatório detalhado de melhorias de processo em Português Brasileiro.

${projectInfo}

Gere um relatório estruturado em Markdown com:
# Relatório de Melhorias de Processo

## 1. Diagnóstico do Processo Atual
## 2. Principais Gargalos
## 3. Atores e Responsabilidades
## 4. Plano de Ação Priorizado
## 5. KPIs de Monitoramento
## 6. Próximos Passos

Use os dados específicos deste projeto (clínica, setor, etapas). Seja concreto e acionável. Responda APENAS o relatório em Markdown.`
            : `Você é um especialista em automação de processos clínicos com n8n. Com base nas informações do projeto abaixo, gere um relatório de automação em Português Brasileiro.

${projectInfo}

Gere um relatório estruturado em Markdown com:
# Relatório de Automação n8n & APIs

## 1. Visão Geral das Automações
## 2. APIs e Integrações Disponíveis
## 3. Fluxos de Automação Sugeridos
## 4. Implementação no n8n
## 5. Roadmap de Implementação
## 6. ROI Estimado

Use os dados específicos deste projeto (clínica, setor, etapas). Seja técnico e prático. Responda APENAS o relatório em Markdown.`;

        try {
            const result = await callAI(prompt);
            const newReports = { ...reports, [type]: result };
            setReports(newReports);
            try { localStorage.setItem(`clinicflow_reports_${project.id}`, JSON.stringify(newReports)); } catch {}
            setActiveReport(type);
            onStatusChange("complete");
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(`Erro ao gerar relatório: ${msg}`);
        } finally {
            setLoading(null);
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
        // Tables: process line by line
        const lines = h.split('\n');
        const out: string[] = [];
        let tableRows: string[] = [];
        for (const line of lines) {
            if (/^\|[-: |]+\|$/.test(line)) continue; // skip separator rows
            const m = line.match(/^\|(.+)\|$/);
            if (m) {
                const cells = m[1].split('|').map(c => `<td style="padding:6px 10px;border:1px solid rgba(97,114,243,0.2);color:#94a3b8;font-size:13px">${c.trim()}</td>`).join('');
                tableRows.push(`<tr>${cells}</tr>`);
            } else {
                if (tableRows.length) {
                    out.push(`<table style="width:100%;border-collapse:collapse;margin:12px 0">${tableRows.join('')}</table>`);
                    tableRows = [];
                }
                out.push(line);
            }
        }
        if (tableRows.length) out.push(`<table style="width:100%;border-collapse:collapse;margin:12px 0">${tableRows.join('')}</table>`);
        h = out.join('\n');
        // Lists
        h = h.replace(/^[-*•] (.+)$/gm, '<li style="margin:3px 0;color:#94a3b8">$1</li>');
        h = h.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin:3px 0;color:#94a3b8">$1</li>');
        h = h.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, m => `<ul style="padding-left:20px;margin:10px 0">${m}</ul>`);
        // Headers
        h = h.replace(/^### (.+)$/gm, '<h3 style="font-size:13px;font-weight:700;color:#c7d2fe;margin:16px 0 6px;text-transform:uppercase;letter-spacing:0.4px">$1</h3>');
        h = h.replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;color:#e2e8f0;margin:22px 0 10px;padding-bottom:6px;border-bottom:1px solid rgba(97,114,243,0.25)">$1</h2>');
        h = h.replace(/^# (.+)$/gm, '<h1 style="font-size:21px;font-weight:800;color:#f1f5f9;margin:0 0 18px">$1</h1>');
        // Inline formatting
        h = h.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e2e8f0;font-weight:700">$1</strong>');
        h = h.replace(/`([^`\n]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:1px 6px;border-radius:4px;font-size:12px;color:#a5b4fc">$1</code>');
        // Paragraphs
        h = h.split(/\n{2,}/).map(block => {
            block = block.trim();
            if (!block) return '';
            if (/^<(h[1-6]|ul|table|pre|\x00CB)/.test(block)) return block;
            if (block.split('\n').some(l => /^<(h[1-6]|ul|table)/.test(l.trim()))) {
                return block.split('\n').filter(Boolean).join('\n');
            }
            return `<p style="margin:10px 0;color:#94a3b8;line-height:1.7;font-size:14px">${block.replace(/\n/g, '<br>')}</p>`;
        }).filter(Boolean).join('\n');
        // Restore code blocks
        h = h.replace(/\x00CB(\d+)\x00/g, (_, i) =>
            `<pre style="background:rgba(0,0,0,0.3);padding:14px;border-radius:8px;font-size:12px;overflow-x:auto;border:1px solid rgba(97,114,243,0.2);margin:12px 0;color:#a5b4fc;white-space:pre-wrap"><code>${codeBlocks[parseInt(i)]}</code></pre>`);
        return h;
    }

    function printAsPdf(type: string) {
        const content = reports[type];
        if (!content) return;
        const titles: Record<string, string> = { improvements: "Relatório de Melhorias de Processo", n8n: "Relatório n8n & Automação" };
        const title = titles[type] || "Relatório";
        // Light-mode markdown renderer for print
        function md(text: string): string {
            const cbs: string[] = [];
            let h = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => { const i = cbs.length; cbs.push(code.trim()); return `\x00C${i}\x00`; });
            const ls = h.split('\n'); const o: string[] = []; let tr: string[] = [];
            for (const line of ls) {
                if (/^\|[-: |]+\|$/.test(line)) continue;
                const m = line.match(/^\|(.+)\|$/);
                if (m) { tr.push(`<tr>${m[1].split('|').map(c => `<td>${c.trim()}</td>`).join('')}</tr>`); }
                else { if (tr.length) { o.push(`<table>${tr.join('')}</table>`); tr = []; } o.push(line); }
            }
            if (tr.length) o.push(`<table>${tr.join('')}</table>`);
            h = o.join('\n')
                .replace(/^[-*•] (.+)$/gm, '<li>$1</li>').replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
                .replace(/((?:<li>.*?<\/li>\n?)+)/g, m => `<ul>${m}</ul>`)
                .replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
            h = h.split(/\n{2,}/).map(b => { b = b.trim(); if (!b) return ''; if (/^<(h[1-6]|ul|table|pre|\x00C)/.test(b)) return b; return `<p>${b.replace(/\n/g, '<br>')}</p>`; }).filter(Boolean).join('\n');
            h = h.replace(/\x00C(\d+)\x00/g, (_, i) => `<pre><code>${cbs[parseInt(i)]}</code></pre>`);
            return h;
        }
        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${title}</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1a202c;font-size:14px;line-height:1.6}
h1{font-size:22px;font-weight:800;color:#1a202c;margin-bottom:6px}h2{font-size:17px;font-weight:700;color:#2d3748;margin:24px 0 10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}h3{font-size:14px;font-weight:700;color:#4a5568;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.5px}
p{color:#4a5568;margin:8px 0}ul,ol{padding-left:20px;margin:8px 0}li{color:#4a5568;margin:4px 0}strong{color:#2d3748;font-weight:700}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}td,th{border:1px solid #e2e8f0;padding:8px 12px}tr:nth-child(even){background:#f7fafc}
pre{background:#f7fafc;border:1px solid #e2e8f0;padding:14px;border-radius:6px;font-size:12px;overflow:auto;margin:12px 0;white-space:pre-wrap}code{background:#f7fafc;padding:1px 5px;border-radius:3px;font-size:12px}
.hdr{border-bottom:2px solid #6172f3;padding-bottom:16px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-end}.meta{font-size:12px;color:#718096}
@media print{body{padding:20px;max-width:100%}h2{page-break-after:avoid}table{page-break-inside:avoid}}
</style></head><body>
<div class="hdr"><div><div class="meta">ClinicFlow Architect · ${project.clinic_name} · ${project.sector}</div><h1>${title}</h1></div><div class="meta">${new Date().toLocaleDateString('pt-BR')}</div></div>
${md(content)}</body></html>`;
        const win = window.open('', '_blank', 'width=900,height=700');
        if (win) { win.document.write(html); win.document.close(); win.addEventListener('load', () => setTimeout(() => win.print(), 300)); }
    }

    return (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#fca5a5" }}>
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
                        color: "#6172f3"
                    },
                    {
                        type: "n8n" as const,
                        title: "Relatório n8n & Automação",
                        desc: "APIs disponíveis, fluxos de automação e roadmap de implementação",
                        icon: "⚡",
                        color: "#f59e0b"
                    },
                ].map(r => (
                    <div key={r.type} className="glass" style={{ borderRadius: 14, padding: 20 }}>
                        <div style={{ fontSize: 28, marginBottom: 10 }}>{r.icon}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 6 }}>{r.title}</div>
                        <p style={{ fontSize: 12, color: "#475569", marginBottom: 16, lineHeight: 1.5 }}>{r.desc}</p>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                className="btn-primary"
                                style={{ fontSize: 12, padding: "8px 14px", flex: 1, justifyContent: "center" }}
                                onClick={() => reports[r.type] ? setActiveReport(r.type) : generateReport(r.type)}
                                disabled={loading === r.type}
                            >
                                {loading === r.type ? (
                                    <><span className="animate-spin" style={{ display: "inline-block" }}>⚙</span> Gerando...</>
                                ) : reports[r.type] ? "👁 Ver Relatório" : "✨ Gerar"}
                            </button>
                            {reports[r.type] && (
                                <>
                                    <button className="btn-secondary" style={{ fontSize: 12, padding: "8px 14px" }} title="Baixar .md"
                                        onClick={() => downloadReport(r.type)}>⬇ .md</button>
                                    <button className="btn-secondary" style={{ fontSize: 12, padding: "8px 14px" }} title="Exportar PDF"
                                        onClick={() => printAsPdf(r.type)}>📄 PDF</button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Report Viewer */}
            {activeReport && reports[activeReport] && (
                <div className="animate-fade-in glass" style={{ borderRadius: 16, padding: "24px 28px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#818cf8" }}>
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
    const [activeTab, setActiveTab] = useState("overview");
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.3px" }}>
                            {project.name}
                        </h1>
                        <span className={`badge badge-${project.status}`}>{STATUS_LABELS[project.status]}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#475569" }}>
                        🏥 {project.clinic_name} · 📁 {project.sector}
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
                            borderBottom: activeTab === tab.key ? "2px solid #6172f3" : "2px solid transparent",
                            color: activeTab === tab.key ? "#818cf8" : "#475569",
                            cursor: "pointer", fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                            display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                            marginBottom: "-1px"
                        }}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === "overview" && <OverviewTab project={project} />}
            {activeTab === "documents" && <DocumentsTab projectId={projectId} onStatusChange={updateProjectStatus} />}
            {activeTab === "clarification" && <ClarificationTab project={project} />}
            {activeTab === "bpmn" && <BpmnTab projectId={projectId} project={project} onStatusChange={updateProjectStatus} />}
            {activeTab === "reports" && <ReportsTab project={project} onStatusChange={updateProjectStatus} />}
        </div>
    );
}
