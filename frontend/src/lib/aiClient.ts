// Unified AI client — supports Google Gemini and Anthropic Claude
// Provider and keys are stored in localStorage

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const CLAUDE_BASE = "https://api.anthropic.com/v1/messages";

export type AIProvider = "gemini" | "claude";

// ---- Provider ----
export function getProvider(): AIProvider {
    try { return (localStorage.getItem("clinicflow_ai_provider") as AIProvider) || "gemini"; }
    catch { return "gemini"; }
}
export function saveProvider(provider: AIProvider) {
    try { localStorage.setItem("clinicflow_ai_provider", provider); } catch { }
}

// ---- Gemini ----
export function getGeminiKey(): string {
    try {
        const stored = localStorage.getItem("clinicflow_gemini_key");
        if (stored) return stored;
    } catch { }
    return process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
}
export function saveGeminiKey(key: string) {
    try { localStorage.setItem("clinicflow_gemini_key", key); } catch { }
}
export function getGeminiModel(): string {
    try { return localStorage.getItem("clinicflow_gemini_model") || "gemini-2.0-flash"; }
    catch { return "gemini-2.0-flash"; }
}
export function saveGeminiModel(model: string) {
    try { localStorage.setItem("clinicflow_gemini_model", model); } catch { }
}

// ---- Claude ----
export function getClaudeKey(): string {
    try {
        const stored = localStorage.getItem("clinicflow_claude_key");
        if (stored) return stored;
    } catch { }
    return "";
}
export function saveClaudeKey(key: string) {
    try { localStorage.setItem("clinicflow_claude_key", key); } catch { }
}
export function getClaudeModel(): string {
    try { return localStorage.getItem("clinicflow_claude_model") || "claude-sonnet-4-6"; }
    catch { return "claude-sonnet-4-6"; }
}
export function saveClaudeModel(model: string) {
    try { localStorage.setItem("clinicflow_claude_model", model); } catch { }
}

// ---- Active provider helpers ----
export function getActiveKey(): string {
    return getProvider() === "claude" ? getClaudeKey() : getGeminiKey();
}
export function getActiveModel(): string {
    return getProvider() === "claude" ? getClaudeModel() : getGeminiModel();
}
export function getProviderLabel(): string {
    return getProvider() === "claude" ? "Claude (Anthropic)" : "Gemini (Google)";
}

// ---- Unified call ----
export async function callAI(prompt: string, systemInstruction?: string): Promise<string> {
    if (getProvider() === "claude") {
        return _callClaude(prompt, systemInstruction);
    }
    return _callGemini(prompt, systemInstruction);
}

async function _callGemini(prompt: string, systemInstruction?: string): Promise<string> {
    const apiKey = getGeminiKey();
    if (!apiKey) throw new Error("AI_KEY_MISSING");
    const model = getGeminiModel();

    const body: Record<string, unknown> = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    };
    if (systemInstruction) {
        body.system_instruction = { parts: [{ text: systemInstruction }] };
    }

    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function _callClaude(prompt: string, systemInstruction?: string): Promise<string> {
    const apiKey = getClaudeKey();
    if (!apiKey) throw new Error("AI_KEY_MISSING");
    const model = getClaudeModel();

    const body: Record<string, unknown> = {
        model,
        max_tokens: 8096,
        messages: [{ role: "user", content: prompt }],
    };
    if (systemInstruction) {
        body.system = systemInstruction;
    }

    const res = await fetch(CLAUDE_BASE, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data?.content?.[0]?.text || "";
}

// ---- Process Model Types ----
export interface ProcessStep {
    id: string;
    name: string;
    type: "start" | "end" | "task" | "gateway";
    actor?: string;
    description?: string;
}

export interface ProcessFlow {
    from: string;
    to: string;
    label?: string;
}

export interface ProcessModel {
    title: string;
    sector: string;
    clinic: string;
    steps: ProcessStep[];
    flows: ProcessFlow[];
    generated_at: string;
}

// ---- BPMN Generation ----
export async function generateProcessModel(
    project: { name: string; clinic_name: string; sector: string; objectives?: string },
    documents: { filename: string; content?: string }[],
    chatQAs: { question: string; answer: string }[],
    extraInstructions?: string
): Promise<{ model: ProcessModel; rawText: string }> {
    const docsContext = documents.length > 0
        ? `\n\nDocumentos analisados (${documents.length}):\n` +
        documents.map(d =>
            d.content
                ? `--- ${d.filename} ---\n${d.content.slice(0, 2000)}\n`
                : `- ${d.filename} (conteúdo não extraível via browser — use o nome como referência)`
        ).join("\n")
        : "\n\nNenhum documento enviado — baseie-se nas respostas de clarificação.";

    const qaContext = chatQAs.length > 0
        ? `\n\nRespostas de clarificação do consultor:\n` +
        chatQAs.map((qa, i) => `P${i + 1}: ${qa.question}\nR${i + 1}: ${qa.answer}`).join("\n\n")
        : "";

    const extra = extraInstructions ? `\n\nInstruções adicionais do consultor: ${extraInstructions}` : "";

    const prompt = `Você é um especialista em mapeamento de processos de clínicas médicas brasileiras (metodologia AS-IS).

Analise o contexto abaixo e gere um modelo de processo AS-IS completo, complexo e assertivo.

PROJETO: ${project.name}
CLÍNICA: ${project.clinic_name}
SETOR: ${project.sector}
OBJETIVOS: ${project.objectives || "Mapear o processo atual"}
${docsContext}
${qaContext}
${extra}

INSTRUÇÃO: Gere um JSON válido (apenas o JSON, sem markdown) representando o processo AS-IS com EXATAMENTE este formato:
{
  "title": "Nome do processo mapeado",
  "steps": [
    {"id": "s1", "name": "Nome da Etapa", "type": "start|task|gateway|end", "actor": "Quem executa", "description": "O que acontece"},
    ...
  ],
  "flows": [
    {"from": "s1", "to": "s2", "label": "condição opcional"},
    ...
  ]
}

REGRAS:
- Use exatamente 1 step com type "start" e 1 com type "end"
- Gateways (decisões) devem ter pelo menos 2 flows saindo deles
- Inclua TODOS os atores mencionados nas respostas
- Mínimo de 8 steps, máximo de 15
- Nomes de steps com máximo 20 caracteres (para caber no BPMN)
- Actors com máximo 15 caracteres
- Reflita ESPECIFICAMENTE o que foi dito nas respostas de clarificação, não use dados genéricos
- Os IDs devem ser sequenciais: s1, s2, s3...`;

    const rawText = await callAI(prompt);

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("A IA não retornou JSON válido. Tente novamente.");

    const parsed = JSON.parse(jsonMatch[0]);

    const model: ProcessModel = {
        title: parsed.title || `Processo de ${project.sector} — AS-IS`,
        sector: project.sector,
        clinic: project.clinic_name,
        steps: parsed.steps || [],
        flows: parsed.flows || [],
        generated_at: new Date().toISOString(),
    };

    return { model, rawText };
}

// ---- BPMN XML Generator ----
export function modelToBpmnXml(model: ProcessModel): string {
    const ns = 'xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI"';

    const tasks = model.steps.map(step => {
        if (step.type === "start") return `<startEvent id="${step.id}" name="${step.name}"/>`;
        if (step.type === "end") return `<endEvent id="${step.id}" name="${step.name}"/>`;
        if (step.type === "gateway") return `<exclusiveGateway id="${step.id}" name="${step.name}"/>`;
        return `<task id="${step.id}" name="${step.name}"/>`;
    }).join("\n    ");

    const flows = model.flows.map((f, i) =>
        `<sequenceFlow id="f${i + 1}" sourceRef="${f.from}" targetRef="${f.to}"${f.label ? ` name="${f.label}"` : ""}/>`
    ).join("\n    ");

    return `<?xml version="1.0" encoding="UTF-8"?>
<definitions ${ns} id="clinicflow_${Date.now()}" targetNamespace="http://clinicflow.io/bpmn">
  <process id="process_1" name="${model.title}" isExecutable="false">
    ${tasks}
    ${flows}
  </process>
</definitions>`;
}
