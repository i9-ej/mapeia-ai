"use client";

import { useState } from "react";
import Link from "next/link";
import { useProjects } from "@/lib/useProjects";
import { Project } from "@/lib/api";

const SECTORS = ["Financeiro", "Atendimento", "RH", "TI", "Operacional", "Faturamento", "Compras"];

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  analysis: "Em Análise",
  bpmn_ready: "BPMN Pronto",
  complete: "Concluído",
};

const STATUS_PROGRESS: Record<string, number> = {
  draft: 10, analysis: 45, bpmn_ready: 75, complete: 100,
};

function ProjectCard({ project }: { project: Project }) {
  const progress = STATUS_PROGRESS[project.status] || 0;
  const date = new Date(project.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <Link href={`/projects/${project.id}`} style={{ textDecoration: "none" }}>
      <div className="glass glass-hover" style={{
        borderRadius: 16, padding: 22,
        display: "flex", flexDirection: "column", gap: 14,
        cursor: "pointer", height: "100%"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 4, lineHeight: 1.3 }}>
              {project.name}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{project.clinic_name}</div>
          </div>
          <span className={`badge badge-${project.status}`}>
            {STATUS_LABELS[project.status]}
          </span>
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(97,114,243,0.1)", borderRadius: 6,
          padding: "4px 10px", width: "fit-content"
        }}>
          <span style={{ fontSize: 11 }}>📁</span>
          <span style={{ fontSize: 12, color: "#818cf8", fontWeight: 500 }}>{project.sector}</span>
        </div>

        {project.objectives && (
          <p style={{
            fontSize: 13, color: "#475569", lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden"
          }}>
            {project.objectives}
          </p>
        )}

        <div style={{ marginTop: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#475569" }}>Progresso</span>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#334155" }}>Criado em {date}</div>
      </div>
    </Link>
  );
}

function NewProjectModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (p: Project) => void;
}) {
  const [form, setForm] = useState({ name: "", clinic_name: "", sector: "Financeiro", objectives: "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newProject: Project = {
      id: Date.now(),
      ...form,
      status: "draft",
      created_at: new Date().toISOString(),
    };
    onCreate(newProject);
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="animate-fade-in" style={{
        background: "var(--surface-1)", border: "1px solid var(--surface-border)",
        borderRadius: 20, padding: 32, width: "100%", maxWidth: 480
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
          Novo Projeto
        </div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 24 }}>
          Configure as informações do projeto de mapeamento
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Nome do Projeto *
            </label>
            <input className="input" required placeholder="Ex: Mapeamento Financeiro Q1"
              value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Nome da Clínica *
            </label>
            <input className="input" required placeholder="Ex: Clínica São Lucas"
              value={form.clinic_name} onChange={e => setForm(p => ({ ...p, clinic_name: e.target.value }))} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Setor *
            </label>
            <select className="input" value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))}
              style={{ cursor: "pointer", appearance: "auto" }}>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Objetivos
            </label>
            <textarea className="input" placeholder="Descreva os objetivos do mapeamento..."
              value={form.objectives} onChange={e => setForm(p => ({ ...p, objectives: e.target.value }))} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: "center" }}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 2, justifyContent: "center" }}>
              ✨ Criar Projeto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { projects, loaded, addProject, deleteProject } = useProjects();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = projects.filter(p => {
    const matchSearch = search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.clinic_name.toLowerCase().includes(search.toLowerCase()) ||
      p.sector.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || p.status === filter;
    return matchSearch && matchFilter;
  });

  const stats = {
    total: projects.length,
    complete: projects.filter(p => p.status === "complete").length,
    inProgress: projects.filter(p => p.status === "analysis" || p.status === "bpmn_ready").length,
    draft: projects.filter(p => p.status === "draft").length,
  };

  if (!loaded) {
    return (
      <div style={{ padding: "32px 40px", display: "flex", alignItems: "center", gap: 10, color: "#475569" }}>
        <span className="animate-spin" style={{ display: "inline-block" }}>⚙</span> Carregando projetos...
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1400 }}>
      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreate={(p) => { addProject(p); }}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.5px" }}>
            Dashboard de Projetos
          </h1>
          <p style={{ fontSize: 14, color: "#475569", marginTop: 4 }}>
            Gerencie seus projetos de mapeamento de processos clínicos
          </p>
        </div>
        <button className="btn-primary" id="btn-new-project" onClick={() => setShowModal(true)}>
          + Novo Projeto
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Total de Projetos", value: stats.total, icon: "📋", color: "#818cf8" },
          { label: "Concluídos", value: stats.complete, icon: "✅", color: "#22c55e" },
          { label: "Em Andamento", value: stats.inProgress, icon: "⚡", color: "#f59e0b" },
          { label: "Rascunhos", value: stats.draft, icon: "📝", color: "#64748b" },
        ].map(stat => (
          <div key={stat.label} className="glass" style={{ borderRadius: 14, padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{stat.label}</div>
              </div>
              <div style={{ fontSize: 28 }}>{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="🔍  Buscar projetos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="tab-nav">
          {[
            { key: "all", label: "Todos" },
            { key: "draft", label: "Rascunho" },
            { key: "analysis", label: "Análise" },
            { key: "bpmn_ready", label: "BPMN" },
            { key: "complete", label: "Concluídos" },
          ].map(f => (
            <button key={f.key} className={`tab-btn ${filter === f.key ? "active" : ""}`}
              onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#334155" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>Nenhum projeto encontrado</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>Ajuste os filtros ou crie um novo projeto</div>
          <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => { setFilter("all"); setSearch(""); }}>
            Limpar filtros
          </button>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 20
        }}>
          {filtered.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  );
}
