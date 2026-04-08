"use client";

import { useState, useEffect } from "react";
import {
    getProvider, saveProvider, type AIProvider,
    getGeminiKey, saveGeminiKey, getGeminiModel, saveGeminiModel,
    getClaudeKey, saveClaudeKey, getClaudeModel, saveClaudeModel,
} from "@/lib/aiClient";

const GEMINI_MODELS = [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", desc: "Padrão — mais rápido, tier gratuito", recommended: true },
    { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", desc: "Menor custo" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", desc: "Mais analítico, custo maior" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash", desc: "Equilíbrio velocidade/qualidade" },
];

const CLAUDE_MODELS = [
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", desc: "Equilibrado — recomendado", recommended: true },
    { value: "claude-opus-4-6", label: "Claude Opus 4.6", desc: "Mais capaz, maior custo" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", desc: "Mais rápido, menor custo" },
];

function maskKey(key: string) {
    if (!key) return null;
    return key.slice(0, 6) + "••••••••••••••••••••" + key.slice(-4);
}

export default function SettingsPage() {
    const [provider, setProvider] = useState<AIProvider>("gemini");

    // Gemini state
    const [geminiKey, setGeminiKey] = useState("");
    const [geminiSavedKey, setGeminiSavedKey] = useState("");
    const [geminiModel, setGeminiModel] = useState("gemini-2.0-flash");

    // Claude state
    const [claudeKey, setClaudeKey] = useState("");
    const [claudeSavedKey, setClaudeSavedKey] = useState("");
    const [claudeModel, setClaudeModel] = useState("claude-sonnet-4-6");

    // UI state
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

    useEffect(() => {
        setProvider(getProvider());
        setGeminiSavedKey(getGeminiKey());
        setGeminiModel(getGeminiModel());
        setClaudeSavedKey(getClaudeKey());
        setClaudeModel(getClaudeModel());
    }, []);

    function handleSave() {
        saveProvider(provider);

        if (provider === "gemini") {
            const trimmed = geminiKey.trim();
            if (trimmed) { saveGeminiKey(trimmed); setGeminiSavedKey(trimmed); setGeminiKey(""); }
            saveGeminiModel(geminiModel);
        } else {
            const trimmed = claudeKey.trim();
            if (trimmed) { saveClaudeKey(trimmed); setClaudeSavedKey(trimmed); setClaudeKey(""); }
            saveClaudeModel(claudeModel);
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
                const model = geminiModel;
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Diga apenas: OK" }] }] }),
                    }
                );
                if (res.ok) {
                    const data = await res.json();
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                    setTestResult({ ok: true, message: `✅ Conexão OK! Gemini respondeu: "${text.trim()}"` });
                } else {
                    const err = await res.json().catch(() => ({}));
                    setTestResult({ ok: false, message: `❌ Erro ${res.status}: ${err?.error?.message || "Verifique sua chave."}` });
                }
            } else {
                const res = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": key,
                        "anthropic-version": "2023-06-01",
                        "anthropic-dangerous-direct-browser-access": "true",
                    },
                    body: JSON.stringify({
                        model: claudeModel,
                        max_tokens: 20,
                        messages: [{ role: "user", content: "Diga apenas: OK" }],
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    const text = data?.content?.[0]?.text || "";
                    setTestResult({ ok: true, message: `✅ Conexão OK! Claude respondeu: "${text.trim()}"` });
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
        <div style={{ padding: "32px 40px", maxWidth: 720 }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>
                    ⚙️ Configurações
                </h1>
                <p style={{ fontSize: 14, color: "#475569", marginTop: 4 }}>
                    Configure a IA que alimenta o Chat de Clarificação, Geração de BPMN e Relatórios
                </p>
            </div>

            {/* Provider Selector */}
            <div className="glass" style={{ borderRadius: 16, padding: 28, marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>
                    🤖 Provedor de IA
                </div>
                <p style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>
                    Escolha qual IA será usada para gerar BPMN, análises e relatórios.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {([
                        {
                            id: "gemini" as AIProvider,
                            name: "Google Gemini",
                            icon: "✦",
                            desc: "Gemini 2.0 Flash e modelos Pro. Tier gratuito disponível.",
                            color: "#4285f4",
                        },
                        {
                            id: "claude" as AIProvider,
                            name: "Anthropic Claude",
                            icon: "◆",
                            desc: "Claude Sonnet 4.6 e outros modelos. Alta qualidade de raciocínio.",
                            color: "#d97706",
                        },
                    ]).map(p => (
                        <label key={p.id} onClick={() => { setProvider(p.id); setTestResult(null); }} style={{
                            display: "flex", flexDirection: "column", gap: 8,
                            padding: "18px 20px", borderRadius: 12, cursor: "pointer",
                            background: provider === p.id ? `rgba(${p.id === "gemini" ? "66,133,244" : "217,119,6"},0.08)` : "var(--surface-2)",
                            border: `2px solid ${provider === p.id ? (p.id === "gemini" ? "#4285f4" : "#d97706") : "var(--surface-border)"}`,
                            transition: "all 0.15s",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <input type="radio" name="provider" value={p.id} checked={provider === p.id}
                                    onChange={() => { setProvider(p.id); setTestResult(null); }}
                                    style={{ accentColor: p.color }} />
                                <span style={{ fontSize: 18 }}>{p.icon}</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: provider === p.id ? "#e2e8f0" : "#94a3b8" }}>
                                    {p.name}
                                </span>
                            </div>
                            <div style={{ fontSize: 12, color: "#475569", paddingLeft: 30 }}>{p.desc}</div>
                        </label>
                    ))}
                </div>
            </div>

            {/* API Key Section */}
            <div className="glass" style={{ borderRadius: 16, padding: 28, marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>
                    🔑 {provider === "gemini" ? "Google Gemini API Key" : "Anthropic Claude API Key"}
                </div>
                <p style={{ fontSize: 13, color: "#475569", marginBottom: 20, lineHeight: 1.6 }}>
                    {provider === "gemini" ? (
                        <>Obtenha uma chave gratuita em{" "}
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
                                style={{ color: "#818cf8" }}>aistudio.google.com/apikey</a>.</>
                    ) : (
                        <>Obtenha sua chave em{" "}
                            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer"
                                style={{ color: "#818cf8" }}>console.anthropic.com/settings/keys</a>.</>
                    )}{" "}
                    A chave é salva <strong style={{ color: "#94a3b8" }}>apenas no seu navegador</strong> (localStorage).
                </p>

                {/* Current key status */}
                {currentSavedKey ? (
                    <div style={{
                        display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
                        background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                        borderRadius: 10, padding: "10px 14px"
                    }}>
                        <span style={{ fontSize: 16 }}>✅</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#22c55e" }}>API Key configurada</div>
                            <div style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>{maskKey(currentSavedKey)}</div>
                        </div>
                        <button className="btn-ghost" onClick={handleClearKey}
                            style={{ fontSize: 12, color: "#ef4444", padding: "4px 10px" }}>
                            🗑 Remover
                        </button>
                    </div>
                ) : (
                    <div style={{
                        display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
                        background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
                        borderRadius: 10, padding: "10px 14px"
                    }}>
                        <span style={{ fontSize: 16 }}>⚠️</span>
                        <div style={{ fontSize: 13, color: "#f59e0b" }}>
                            Nenhuma API Key configurada — recursos de IA estão desabilitados
                        </div>
                    </div>
                )}

                {/* Input new key */}
                <input
                    className="input"
                    type="password"
                    placeholder={
                        currentSavedKey
                            ? "Substituir pela nova chave..."
                            : provider === "gemini"
                                ? "Cole sua API Key: AIza..."
                                : "Cole sua API Key: sk-ant-..."
                    }
                    value={currentInputKey}
                    onChange={e => {
                        setTestResult(null);
                        if (provider === "gemini") setGeminiKey(e.target.value);
                        else setClaudeKey(e.target.value);
                    }}
                    style={{ width: "100%" }}
                />

                {/* Test result */}
                {testResult && (
                    <div style={{
                        marginTop: 12, padding: "10px 14px", borderRadius: 8, fontSize: 13,
                        background: testResult.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                        border: `1px solid ${testResult.ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                        color: testResult.ok ? "#86efac" : "#fca5a5",
                    }}>
                        {testResult.message}
                    </div>
                )}
            </div>

            {/* Model Selection */}
            <div className="glass" style={{ borderRadius: 16, padding: 28, marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>
                    🧠 Modelo {provider === "gemini" ? "Gemini" : "Claude"}
                </div>
                <p style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>
                    Escolha o modelo usado para Clarificação, BPMN e Relatórios.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(provider === "gemini" ? GEMINI_MODELS : CLAUDE_MODELS).map(m => {
                        const activeModel = provider === "gemini" ? geminiModel : claudeModel;
                        const isActive = activeModel === m.value;
                        return (
                            <label key={m.value} style={{
                                display: "flex", alignItems: "flex-start", gap: 12,
                                padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                                background: isActive ? "rgba(97,114,243,0.1)" : "var(--surface-2)",
                                border: `1px solid ${isActive ? "rgba(97,114,243,0.35)" : "var(--surface-border)"}`,
                                transition: "all 0.15s",
                            }}>
                                <input type="radio" name="model" value={m.value} checked={isActive}
                                    onChange={() => {
                                        if (provider === "gemini") setGeminiModel(m.value);
                                        else setClaudeModel(m.value);
                                    }}
                                    style={{ marginTop: 2, accentColor: "#818cf8" }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? "#e2e8f0" : "#94a3b8" }}>
                                        {m.label}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{m.desc}</div>
                                </div>
                                {m.recommended && (
                                    <span style={{ fontSize: 10, background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "2px 8px", borderRadius: 6, fontWeight: 600, whiteSpace: "nowrap" }}>
                                        Recomendado
                                    </span>
                                )}
                            </label>
                        );
                    })}
                </div>
            </div>

            {/* Usage Info */}
            <div className="glass" style={{ borderRadius: 16, padding: 22, marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b", marginBottom: 12 }}>
                    📋 Onde a IA é utilizada
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                        { icon: "💬", label: "Chat de Clarificação", desc: "Analisa docs + perguntas e valida o modelo AS-IS" },
                        { icon: "🔀", label: "Geração de BPMN", desc: "Gera o processo AS-IS estruturado a partir do contexto real" },
                        { icon: "📊", label: "Relatório de Melhorias", desc: "Diagnóstico de gargalos, plano de ação e KPIs" },
                        { icon: "⚡", label: "Relatório n8n & Automação", desc: "Fluxos de automação, APIs e roadmap de implementação" },
                    ].map(item => (
                        <div key={item.label} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--surface-border)" }}>
                            <span style={{ fontSize: 16, width: 24 }}>{item.icon}</span>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8" }}>{item.label}</div>
                                <div style={{ fontSize: 12, color: "#475569" }}>{item.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
                <button
                    className="btn-ghost"
                    onClick={handleTestKey}
                    disabled={testing || !canTest}
                    style={{ minWidth: 160 }}
                >
                    {testing ? "⚙️ Testando..." : "🔌 Testar Conexão"}
                </button>
                <button
                    className="btn-primary"
                    onClick={handleSave}
                    style={{ flex: 1, justifyContent: "center" }}
                    disabled={!canSave}
                >
                    {saved ? "✅ Salvo!" : "💾 Salvar Configurações"}
                </button>
            </div>
        </div>
    );
}
