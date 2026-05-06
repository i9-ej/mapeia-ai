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
    const provider = getProvider();
    const apiKey = getActiveKey();
    const model = getActiveModel();

    if (!apiKey) throw new Error("AI_KEY_MISSING");

    const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            provider,
            prompt,
            systemInstruction,
            apiKey,
            model
        }),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
    }

    return data.text || "";
}

