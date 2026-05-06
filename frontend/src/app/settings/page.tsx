"use client";

import { useState, useEffect } from "react";
import {
    getProvider, saveProvider, type AIProvider,
    getGeminiKey, saveGeminiKey, saveGeminiModel,
    getClaudeKey, saveClaudeKey, saveClaudeModel,
} from "@/lib/aiClient";

function maskKey(key: string) {
    if (!key) return null;
    return key.slice(0, 6) + "••••••••••" + key.slice(-4);
}

export default function SettingsPage() {
    const [provider, setProvider] = useState<AIProvider>("gemini");
    const [geminiKey, setGeminiKey] = useState("");
    const [geminiSavedKey, setGeminiSavedKey] = useState("");
    const [claudeKey, setClaudeKey] = useState("");
    const [claudeSavedKey, setClaudeSavedKey] = useState("");
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

    useEffect(() => {
        setProvider(getProvider());
        setGeminiSavedKey(getGeminiKey());
        setClaudeSavedKey(getClaudeKey());
    }, []);

    function handleSave() {
        saveProvider(provider);
        if (provider === "gemini") {
            const trimmed = geminiKey.trim();
            if (trimmed) { saveGeminiKey(trimmed); setGeminiSavedKey(trimmed); setGeminiKey(""); }
            saveGeminiModel("gemini-2.0-flash");
        } else {
            const trimmed = claudeKey.trim();
            if (trimmed) { saveClaudeKey(trimmed); setClaudeSavedKey(trimmed); setClaudeKey(""); }
            saveClaudeModel("claude-sonnet-4-6");
        }
        setSaved(true);
        setTestResult(null);
        setTimeout(() => setSaved(false), 2500);
    }

    function handleClearKey() {
        if (provider === "gemini") {
            try { localStorage.removeItem("clinicflow_gemini_key"); } catch { }
            setGeminiSavedKey(""); setGeminiKey("");
        } else {
            try { localStorage.removeItem("clinicflow_claude_key"); } catch { }
            setClaudeSavedKey(""); setClaudeKey("");
        }
        setTestResult(null);
    }

    async function handleTestKey() {
        const key = provider === "gemini"
            ? (geminiKey.trim() || geminiSavedKey)
            : (claudeKey.trim() || claudeSavedKey);
        if (!key) { setTestResult({ ok: false, message: "Nenhuma API Key configurada." }); return; }
        setTesting(true);
        setTestResult(null);
        try {
            if (provider === "gemini") {
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
                    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Diga apenas: OK" }] }] }) }
                );
                if (res.ok) {
                    const data = await res.json();
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                    setTestResult({ ok: true, message: `✅ Conexão OK! Resposta: "${text.trim()}"` });
                } else {
                    const err = await res.json().catch(() => ({}));
                    setTestResult({ ok: false, message: `❌ Erro ${res.status}: ${err?.error?.message || "Verifique sua chave."}` });
                }
            } else {
                const res = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
                    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 20, messages: [{ role: "user", content: "Diga apenas: OK" }] }),
                });
                if (res.ok) {
                    const data = await res.json();
                    const text = data?.content?.[0]?.text || "";
                    setTestResult({ ok: true, message: `✅ Conexão OK! Resposta: "${text.trim()}"` });
                } else {
                    const err = await res.json().catch(() => ({}));
                    setTestResult({ ok: false, message: `❌ Erro ${res.status}: ${err?.error?.message || "Verifique sua chave."}` });
                }
            }
        } catch (e: unknown) {
            setTestResult({ ok: false, message: `❌ Falha de rede: ${e instanceof Error ? e.message : String(e)}` });
        }
        setTesting(false);
    }

    const currentSavedKey = provider === "gemini" ? geminiSavedKey : claudeSavedKey;
    const currentInputKey = provider === "gemini" ? geminiKey : claudeKey;
    const canSave = !!currentInputKey.trim() || !!currentSavedKey;
    const canTest = !!currentInputKey.trim() || !!currentSavedKey;

    return (
        <div style={{ padding: "32px 40px", maxWidth: 600 }}>
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a202c", letterSpacing: "-0.3px" }}>
                    Configurações de IA
                </h1>
                <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                    Configure a chave de API para gerar relatórios
                </p>
            </div>

            {/* Provider Toggle */}
            <div className="card" style={{ borderRadius: 14, padding: 24, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 14 }}>Provedor de IA</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {([
                        { id: "gemini" as AIProvider, name: "Google Gemini", desc: "Gemini 2.0 Flash · Gratuito", color: "#4285f4" },
                        { id: "claude" as AIProvider, name: "Anthropic Claude", desc: "Claude Sonnet 4.6 · Pago", color: "#d97706" },
                    ]).map(p => (
                        <label key={p.id} onClick={() => { setProvider(p.id); setTestResult(null); }} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                            background: provider === p.id ? `rgba(${p.id === "gemini" ? "66,133,244" : "217,119,6"},0.06)` : "var(--surface-2)",
                            border: `2px solid ${provider === p.id ? p.color : "var(--surface-border)"}`,
                            transition: "all 0.15s",
                        }}>
                            <input type="radio" name="provider" value={p.id} checked={provider === p.id}
                                onChange={() => { setProvider(p.id); setTestResult(null); }}
                                style={{ accentColor: p.color }} />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: provider === p.id ? "#1a202c" : "#64748b" }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>{p.desc}</div>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {/* API Key */}
            <div className="card" style={{ borderRadius: 14, padding: 24, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                    API Key — {provider === "gemini" ? "Google" : "Anthropic"}
                </div>
                <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
                    {provider === "gemini" ? (
                        <>Obtenha em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: "var(--brand-500)" }}>aistudio.google.com/apikey</a></>
                    ) : (
                        <>Obtenha em <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: "var(--brand-500)" }}>console.anthropic.com</a></>
                    )}. Salva apenas no seu navegador.
                </p>

                {currentSavedKey ? (
                    <div style={{
                        display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
                        background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)",
                        borderRadius: 8, padding: "8px 12px"
                    }}>
                        <span style={{ fontSize: 14 }}>✅</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>Configurada</div>
                            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{maskKey(currentSavedKey)}</div>
                        </div>
                        <button className="btn-ghost" onClick={handleClearKey}
                            style={{ fontSize: 11, color: "#ef4444", padding: "2px 8px" }}>Remover</button>
                    </div>
                ) : (
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                        background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
                        borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#f59e0b"
                    }}>
                        ⚠️ Sem API Key — relatórios de IA desabilitados
                    </div>
                )}

                <input className="input" type="password"
                    placeholder={currentSavedKey ? "Substituir chave..." : provider === "gemini" ? "AIza..." : "sk-ant-..."}
                    value={currentInputKey}
                    onChange={e => {
                        setTestResult(null);
                        if (provider === "gemini") setGeminiKey(e.target.value);
                        else setClaudeKey(e.target.value);
                    }}
                    style={{ width: "100%" }}
                />

                {testResult && (
                    <div style={{
                        marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 12,
                        background: testResult.ok ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                        border: `1px solid ${testResult.ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                        color: testResult.ok ? "#16a34a" : "#dc2626",
                    }}>
                        {testResult.message}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-ghost" onClick={handleTestKey} disabled={testing || !canTest} style={{ minWidth: 140 }}>
                    {testing ? "Testando..." : "🔌 Testar"}
                </button>
                <button className="btn-primary" onClick={handleSave} style={{ flex: 1, justifyContent: "center" }} disabled={!canSave}>
                    {saved ? "✅ Salvo!" : "Salvar"}
                </button>
            </div>
        </div>
    );
}
