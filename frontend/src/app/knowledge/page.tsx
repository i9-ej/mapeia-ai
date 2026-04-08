"use client";

import { useState } from "react";

interface KnowledgeItem {
    id: number;
    category: string;
    content: string;
    source: string;
    created_at: string;
}

const MOCK_KNOWLEDGE: KnowledgeItem[] = [
    {
        id: 1,
        category: "Financeiro",
        content: "Em clínicas de médio porte, a taxa de glosa média é 15-25% nas primeiras submissões ao convênio. Processos com validação automática de código CID reduzem glosas em 60%.",
        source: "Projeto Clínica São Lucas",
        created_at: "2026-02-25T15:00:00Z",
    },
    {
        id: 2,
        category: "Atendimento",
        content: "O tempo médio de espera em triagens com sistema de senhas manual é 18 min. Digitalização com totem reduz para 5 min. WhatsApp scheduling reduz no-shows em 45%.",
        source: "Projeto Instituto CardioVida",
        created_at: "2026-02-27T11:00:00Z",
    },
    {
        id: 3,
        category: "Automação",
        content: "iClinic e WhatsApp Business API podem ser integrados via n8n em 2 semanas. Automação de cobrança reduz inadimplência em 30% e ahorra 15 min/atendimento.",
        source: "Análise de ferramentas IA",
        created_at: "2026-02-28T09:00:00Z",
    },
    {
        id: 4,
        category: "RH",
        content: "Escalas médicas manuais em Excel geram conflitos em 40% dos casos. Soluções como Pulsus ou Google Sheets com automação reduzem conflitos a menos de 5%.",
        source: "Projeto Clínica BelaVida",
        created_at: "2026-02-26T14:00:00Z",
    },
];

const CATEGORIES = ["Todos", "Financeiro", "Atendimento", "Automação", "RH", "TI"];
const CATEGORY_COLORS: Record<string, string> = {
    Financeiro: "#22c55e", Atendimento: "#6172f3", Automação: "#f59e0b", RH: "#ec4899", TI: "#06b6d4",
};

export default function KnowledgePage() {
    const [items, setItems] = useState<KnowledgeItem[]>(MOCK_KNOWLEDGE);
    const [filter, setFilter] = useState("Todos");
    const [search, setSearch] = useState("");
    const [showAdd, setShowAdd] = useState(false);
    const [newItem, setNewItem] = useState({ category: "Financeiro", content: "", source: "" });

    const filtered = items.filter(item => {
        const matchCat = filter === "Todos" || item.category === filter;
        const matchSearch = search === "" || item.content.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
    });

    function addItem() {
        if (!newItem.content.trim()) return;
        setItems(prev => [{
            id: Date.now(),
            ...newItem,
            created_at: new Date().toISOString(),
        }, ...prev]);
        setNewItem({ category: "Financeiro", content: "", source: "" });
        setShowAdd(false);
    }

    return (
        <div style={{ padding: "32px 40px", maxWidth: 1100 }}>
            <div style={{ marginBottom: 32 }}>
                <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>
                    🧠 Base de Conhecimento
                </h1>
                <p style={{ fontSize: 14, color: "#475569", marginTop: 4 }}>
                    Aprendizados e insights do mercado de clínicas acumulados pelo sistema
                </p>
            </div>

            {/* Stats bar */}
            <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
                {[
                    { label: "Total de Insights", value: items.length, icon: "📚" },
                    { label: "Categorias", value: new Set(items.map(i => i.category)).size, icon: "🏷" },
                    { label: "Projetos Fonte", value: new Set(items.map(i => i.source)).size, icon: "🔗" },
                ].map(s => (
                    <div key={s.label} className="glass" style={{ borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 22 }}>{s.icon}</span>
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: "#818cf8" }}>{s.value}</div>
                            <div style={{ fontSize: 11, color: "#475569" }}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
                <input className="input" style={{ maxWidth: 280 }}
                    placeholder="🔍 Buscar conhecimentos..."
                    value={search} onChange={e => setSearch(e.target.value)} />
                <div className="tab-nav">
                    {CATEGORIES.map(cat => (
                        <button key={cat} className={`tab-btn ${filter === cat ? "active" : ""}`}
                            onClick={() => setFilter(cat)}>{cat}</button>
                    ))}
                </div>
                <button className="btn-primary" style={{ marginLeft: "auto" }} onClick={() => setShowAdd(!showAdd)}>
                    + Adicionar
                </button>
            </div>

            {/* Add form */}
            {showAdd && (
                <div className="animate-fade-in glass" style={{ borderRadius: 14, padding: 20, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 14 }}>Novo Conhecimento</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>Categoria</label>
                                <select className="input" style={{ appearance: "auto" }}
                                    value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}>
                                    {CATEGORIES.filter(c => c !== "Todos").map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>Fonte</label>
                                <input className="input" placeholder="Ex: Projeto Clínica X" value={newItem.source}
                                    onChange={e => setNewItem(p => ({ ...p, source: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>Conhecimento / Insight</label>
                            <textarea className="input" placeholder="Descreva o aprendizado ou insight..." rows={3}
                                value={newItem.content} onChange={e => setNewItem(p => ({ ...p, content: e.target.value }))} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={addItem}>✨ Indexar Conhecimento</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Knowledge items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filtered.map(item => (
                    <div key={item.id} className="glass glass-hover" style={{ borderRadius: 14, padding: "18px 22px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                            <span style={{
                                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                                background: `${CATEGORY_COLORS[item.category] || "#6172f3"}20`,
                                color: CATEGORY_COLORS[item.category] || "#6172f3",
                                border: `1px solid ${CATEGORY_COLORS[item.category] || "#6172f3"}40`,
                            }}>
                                {item.category}
                            </span>
                            <div style={{ fontSize: 11, color: "#334155" }}>
                                {new Date(item.created_at).toLocaleDateString("pt-BR")}
                            </div>
                        </div>
                        <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, marginBottom: 10 }}>
                            {item.content}
                        </p>
                        <div style={{ fontSize: 11, color: "#475569" }}>
                            🔗 Fonte: <span style={{ color: "#64748b" }}>{item.source}</span>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div style={{ textAlign: "center", padding: "60px 0", color: "#334155" }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                        <div style={{ color: "#475569" }}>Nenhum conhecimento encontrado</div>
                    </div>
                )}
            </div>
        </div>
    );
}
