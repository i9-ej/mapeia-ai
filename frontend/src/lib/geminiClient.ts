// geminiClient.ts — kept for backward compatibility
// All logic is now in aiClient.ts

export {
    getGeminiKey as getApiKey,
    saveGeminiKey as saveApiKey,
    callAI as callGemini,
} from "./aiClient";

export interface GeminiMessage {
    role: "user" | "model";
    parts: { text: string }[];
}
