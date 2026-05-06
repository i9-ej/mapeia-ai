const fs = require('fs');
const path = 'frontend/src/app/projects/[id]/page.tsx';
let f = fs.readFileSync(path, 'utf8');
let lines = f.split(/\r?\n/);

// ======== FEATURE 4: DOCUMENT PREVIEW MODAL ========
// Find where DocumentsTab return starts and add preview state + modal
const docTabIdx = lines.findIndex(l => l.includes('function DocumentsTab'));
const docReturnIdx = lines.findIndex((l, i) => i > docTabIdx && l.trim() === 'return (');

// Add preview state before the return
const previewState = `
    const [previewDoc, setPreviewDoc] = useState<(DocumentMeta & { text_content?: string }) | null>(null);
`;
lines.splice(docReturnIdx, 0, previewState);

// Now find the document list item and make it clickable
// Find the doc.map line
f = lines.join('\n');
f = f.replace(
    /\{docs\.map\(doc => \(\s*<div key=\{doc\.id\} className="glass" style=\{\{/,
    `{docs.map(doc => (
                    <div key={doc.id} className="glass" onClick={() => setPreviewDoc(doc as DocumentMeta & { text_content?: string })} style={{ cursor: "pointer",`
);

// Add preview modal before the closing of DocumentsTab return
const previewModal = `
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
                                    {previewDoc.file_type.toUpperCase()} · {previewDoc.file_size ? \`\${(previewDoc.file_size / 1024).toFixed(0)} KB\` : "—"} · {new Date(previewDoc.created_at).toLocaleDateString("pt-BR")}
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
            )}`;

// Insert before the last </div> of the DocumentsTab return
f = f.replace(
    /(\s*<\/div>\s*\);\s*\n\}\n\n\/\/ ---- REPORTS TAB ----)/,
    `${previewModal}
        </div>
    );
}

// ---- REPORTS TAB ----`
);

// ======== FEATURE 2: PROGRESS BAR ========
// Replace the loading state and add progress tracking
f = f.replace(
    'const [loading, setLoading] = useState<string | null>(null);',
    `const [loading, setLoading] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState("");
    const [elapsed, setElapsed] = useState(0);
    const [phase, setPhase] = useState<"idle" | "asking" | "answering" | "generating">("idle");
    const [clarifyQuestions, setClarifyQuestions] = useState<string[]>([]);
    const [clarifyAnswers, setClarifyAnswers] = useState<Record<number, string>>({});`
);

// ======== FEATURE 3: INLINE CLARIFICATION + PROGRESS ========
// Replace the generateReport function completely
const genReportStart = f.indexOf('    async function generateReport(type: "improvements" | "n8n") {');
const genReportEnd = f.indexOf('    function downloadReport(type: string) {');

const newGenerateReport = `    async function generateReport(type: "improvements" | "n8n") {
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
            \`Clínica: \${project.clinic_name}\`,
            \`Setor: \${project.sector}\`,
            \`Projeto: \${project.name}\`,
            project.objectives ? \`Objetivos e Respostas do Questionário:\\n\${project.objectives}\` : "",
            docs.length > 0 ? \`Documentos anexados: \${docs.map(d => d.filename).join(", ")}\` : "Sem documentos enviados",
            docsTextContent ? \`\\nCONTEÚDO DOS DOCUMENTOS ENVIADOS:\${docsTextContent}\` : "",
            bpmnSteps ? \`\\nEtapas do processo mapeado:\\n\${bpmnSteps}\` : "",
            chatContext ? \`\\nInformações coletadas na clarificação:\\n\${chatContext}\` : "",
        ].filter(Boolean).join("\\n");

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
            const clarifyPrompt = \`Com base no contexto abaixo de uma clínica médica, você precisa gerar um relatório de \${type === "improvements" ? "melhorias de processo" : "automação n8n"}. Antes de gerar, avalie se o contexto é suficiente.

\${projectInfo}

INSTRUÇÕES: Se o contexto acima é suficiente para gerar um relatório detalhado e específico, responda APENAS: CONTEXTO_SUFICIENTE

Se NÃO é suficiente, liste de 3 a 5 perguntas objetivas que você precisa saber para gerar um relatório melhor. Responda APENAS com as perguntas numeradas (1. 2. 3. etc), sem introdução.\`;

            const clarifyResult = await Promise.race([
                callAI(clarifyPrompt),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 30_000))
            ]);

            if (!clarifyResult.includes("CONTEXTO_SUFICIENTE")) {
                // Parse questions
                const questions = clarifyResult.split("\\n")
                    .map(l => l.replace(/^\\d+\\.\\s*/, "").trim())
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
                : \`Erro ao gerar relatório: \${msg}\`;
            setError(friendlyMsg);
            setLoading(null);
            setPhase("idle");
        }
    }

    async function submitClarifyAnswers(type: "improvements" | "n8n") {
        const { docs, chatContext, bpmnSteps, docsTextContent } = getProjectContext();
        const projectInfo = [
            \`Clínica: \${project.clinic_name}\`,
            \`Setor: \${project.sector}\`,
            \`Projeto: \${project.name}\`,
            project.objectives ? \`Objetivos e Respostas do Questionário:\\n\${project.objectives}\` : "",
            docs.length > 0 ? \`Documentos anexados: \${docs.map(d => d.filename).join(", ")}\` : "Sem documentos enviados",
            docsTextContent ? \`\\nCONTEÚDO DOS DOCUMENTOS ENVIADOS:\${docsTextContent}\` : "",
            bpmnSteps ? \`\\nEtapas do processo mapeado:\\n\${bpmnSteps}\` : "",
            chatContext ? \`\\nInformações coletadas na clarificação:\\n\${chatContext}\` : "",
        ].filter(Boolean).join("\\n");

        const answersText = clarifyQuestions
            .map((q, i) => \`P: \${q}\\nR: \${clarifyAnswers[i] || "Não respondido"}\`)
            .join("\\n\\n");

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
            setError(\`Erro ao gerar relatório: \${msg}\`);
            setLoading(null);
            setPhase("idle");
        }
    }

    async function generateFinalReport(type: "improvements" | "n8n", projectInfo: string, extraContext: string, timer: ReturnType<typeof setInterval>) {
        setPhase("generating");
        setProgressLabel("Gerando relatório completo...");

        const extraBlock = extraContext ? \`\\nRESPOSTAS ADICIONAIS DO CLIENTE:\\n\${extraContext}\` : "";

`;

// Now add the prompts back
const improvementsPromptStart = f.indexOf("        const improvementsPrompt = `");
const n8nPromptEnd = f.indexOf('        const prompt = type === "improvements" ? improvementsPrompt : n8nPrompt;');
const promptsBlock = f.substring(improvementsPromptStart, n8nPromptEnd);

// Modify prompts to include extraBlock in projectInfo
const modifiedPrompts = promptsBlock
    .replace('${projectInfo}', '${projectInfo}${extraBlock}')
    .replace(/\$\{projectInfo\}/g, '${projectInfo}${extraBlock}');

const newTryCatch = `
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
            try { localStorage.setItem(\`clinicflow_reports_\${project.id}\`, JSON.stringify(newReports)); } catch {}
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

`;

// Build the replacement
const fullReplacement = newGenerateReport + modifiedPrompts + newTryCatch;

// Replace from generateReport to downloadReport
f = f.substring(0, genReportStart) + fullReplacement + f.substring(genReportEnd);

// ======== UPDATE REPORT UI ========
// Replace the loading spinner in report cards with progress bar
const oldLoadingUI = `{loading === r.type ? (
                                    <><span className="animate-spin" style={{ display: "inline-block" }}>⚙</span> Gerando...</>
                                ) : reports[r.type] ? "👁 Ver Relatório" : "✨ Gerar"}`;

const newLoadingUI = `{loading === r.type && phase !== "answering" ? (
                                    <><span className="animate-spin" style={{ display: "inline-block" }}>⚙</span> Gerando...</>
                                ) : reports[r.type] ? "👁 Ver Relatório" : "✨ Gerar"}`;

f = f.replace(oldLoadingUI, newLoadingUI);

// Add progress bar and clarification UI before the report viewer section
const reportViewerMarker = '{/* Report Viewer */}';
const progressBarAndClarify = `{/* Progress Bar */}
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
                            width: \`\${progress}%\`,
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

            `;

f = f.replace(reportViewerMarker, progressBarAndClarify + reportViewerMarker);

fs.writeFileSync(path, f);
console.log('Done! All features applied.');
console.log('Lines:', f.split('\n').length);
