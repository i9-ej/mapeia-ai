"use client";

import { useState } from "react";
import Link from "next/link";
import { useProjects } from "@/lib/useProjects";
import { Project } from "@/lib/api";

const SECTORS = ["Financeiro", "Atendimento", "RH", "TI", "Operacional", "Faturamento", "Compras"];

const STATUS_LABELS: Record<string, string> = {
  draft: "Novo",
  complete: "Concluído",
};

function ProjectCard({ project, onDelete }: { project: Project; onDelete: (id: number) => void }) {
  const date = new Date(project.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <Link href={`/projects/${project.id}`} style={{ textDecoration: "none" }}>
      <div className="card" style={{
        borderRadius: 14, padding: 20,
        display: "flex", flexDirection: "column", gap: 12,
        cursor: "pointer", height: "100%",
        transition: "all 0.2s ease",
        borderLeft: `3px solid ${project.status === "complete" ? "#22c55e" : "var(--brand-500)"}`,
      }}
      onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)"; }}
      onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1a202c", marginBottom: 2, lineHeight: 1.3 }}>
              {project.name}
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{project.clinic_name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className={`badge badge-${project.status}`}>
              {STATUS_LABELS[project.status]}
            </span>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(project.id); }}
              title="Excluir projeto"
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 14, color: "#cbd5e1", padding: "4px",
                borderRadius: 6, transition: "all 0.15s",
                lineHeight: 1,
              }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"; }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >🗑</button>
          </div>
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(232,122,42,0.08)", borderRadius: 6,
          padding: "3px 10px", width: "fit-content"
        }}>
          <span style={{ fontSize: 12, color: "var(--brand-600)", fontWeight: 500 }}>{project.sector}</span>
        </div>

        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{date}</span>
          <span style={{ fontSize: 12, color: "var(--brand-500)", fontWeight: 500 }}>Ver projeto →</span>
        </div>
      </div>
    </Link>
  );
}

function DeleteConfirmModal({ projectName, onConfirm, onCancel }: {
  projectName: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
      zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="animate-fade-in" style={{
        background: "#ffffff", border: "1px solid var(--surface-border)",
        borderRadius: 16, padding: 28, width: "100%", maxWidth: 400,
        boxShadow: "0 24px 48px rgba(0,0,0,0.15)", textAlign: "center"
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a202c", marginBottom: 8 }}>Excluir projeto?</div>
        <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>
          O projeto <strong>{projectName}</strong> será excluído permanentemente, incluindo documentos e relatórios associados.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" onClick={onCancel} style={{ flex: 1, justifyContent: "center" }}>Cancelar</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "10px 16px", borderRadius: 10, border: "none",
            background: "#ef4444", color: "white", fontWeight: 600, fontSize: 13,
            cursor: "pointer", transition: "all 0.15s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6
          }}>🗑 Excluir</button>
        </div>
      </div>
    </div>
  );
}

function NewProjectModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (p: Project, files?: File[]) => void;
}) {
  const [form, setForm] = useState({ name: "", clinic_name: "" });
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const KEY_QUESTIONS = [
    "Qual é o principal objetivo deste mapeamento?",
    "Quais são os maiores problemas/gargalos conhecidos?",
    "Quais softwares/sistemas são utilizados no processo?",
    "Quantas pessoas estão envolvidas no processo?",
    "Existe alguma regulamentação específica a ser considerada?",
    "Qual é a especialidade principal da clínica e quais especialidades secundárias existem?",
    "A clínica atende pelo plano de saúde, particular ou ambos? Quais convênios?",
    "Qual é o volume médio de atendimentos por dia/semana e quantos profissionais atuam na clínica?",
    "Existem múltiplas unidades ou filiais? Como elas se relacionam operacionalmente?",
    "Quais são os 3 maiores problemas operacionais que a gestão enfrenta hoje?",
  ];
  const KEY_PLACEHOLDERS = [
    "Ex: Reduzir tempo de espera dos pacientes, aumentar conversão de leads, automatizar faturamento...",
    "Ex: Agendamento manual, glosas frequentes, retrabalho em guias TISS, falta de follow-up com pacientes...",
    "Ex: iClinic, MV Sistemas, Google Calendar, WhatsApp Business, Planilhas Excel, Tasy...",
    "Ex: 3 médicos, 2 recepcionistas, 1 faturista, 1 gestor financeiro. Total: 7 pessoas no processo",
    "Ex: LGPD para dados de pacientes, normas da ANS para convênios, PGRSS para resíduos...",
    "Ex: Dermatologia (principal), com estética e clínica geral como secundárias. Foco em procedimentos estéticos.",
    "Ex: 60% particular e 40% convênio. Convênios: Unimed, SulAmérica, Bradesco Saúde. Particular com pagamento via PIX e cartão.",
    "Ex: 25 atendimentos/dia, 5 médicos, 3 recepcionistas. Pico às segundas e terças.",
    "Ex: 2 unidades na mesma cidade. Compartilham equipe administrativa mas têm agendas separadas.",
    "Ex: 1) Pacientes não retornam após primeira consulta. 2) Glosas representam 18% do faturamento. 3) Secretárias sobrecarregadas com tarefas manuais.",
  ];
  const [keyAnswers, setKeyAnswers] = useState<string[]>(Array(KEY_QUESTIONS.length).fill(""));

  function toggleSector(s: string) {
    setSelectedSectors(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedSectors.length === 0) return;

    const objectivesText = KEY_QUESTIONS
      .map((q, i) => keyAnswers[i]?.trim() ? `**${q}**\n${keyAnswers[i].trim()}` : null)
      .filter(Boolean)
      .join("\n\n");

    const newProject: Project = {
      id: Date.now(),
      name: form.name,
      clinic_name: form.clinic_name,
      sector: selectedSectors.join(", "),
      objectives: objectivesText || undefined,
      status: "draft",
      created_at: new Date().toISOString(),
    };
    onCreate(newProject, files.length > 0 ? files : undefined);
    onClose();
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "#475569",
    display: "block", marginBottom: 6,
    textTransform: "uppercase", letterSpacing: "0.5px"
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
      zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="animate-fade-in" style={{
        background: "#ffffff", border: "1px solid var(--surface-border)",
        borderRadius: 20, padding: 32, width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 48px rgba(0,0,0,0.15)"
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a202c", marginBottom: 4 }}>
          Novo Projeto
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
          Preencha as informações da clínica. Quanto mais detalhes, melhor o resultado.
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Nome do Projeto */}
          <div>
            <label style={labelStyle}>Nome do Projeto *</label>
            <input className="input" required placeholder="Ex: Mapeamento Financeiro Q1"
              value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>

          {/* Nome da Clínica */}
          <div>
            <label style={labelStyle}>Nome da Clínica *</label>
            <input className="input" required placeholder="Ex: Clínica São Lucas"
              value={form.clinic_name} onChange={e => setForm(p => ({ ...p, clinic_name: e.target.value }))} />
          </div>

          {/* Multi-seleção de Áreas */}
          <div>
            <label style={labelStyle}>
              Áreas / Setores * <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(selecione uma ou mais)</span>
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SECTORS.map(s => {
                const active = selectedSectors.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleSector(s)} style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500,
                    border: active ? "1.5px solid var(--brand-500)" : "1px solid var(--surface-border)",
                    background: active ? "rgba(232,122,42,0.1)" : "var(--surface-2)",
                    color: active ? "var(--brand-600)" : "#64748b",
                    cursor: "pointer", transition: "all 0.2s ease",
                  }}>
                    {active ? "✓ " : ""}{s}
                  </button>
                );
              })}
            </div>
            {selectedSectors.length === 0 && (
              <div style={{ fontSize: 11, color: "#ef4444", marginTop: 6 }}>Selecione pelo menos uma área</div>
            )}
          </div>

          {/* Upload de Arquivos */}
          <div>
            <label style={labelStyle}>📎 Arquivos do Projeto <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional — transcrições, documentos, planilhas)</span></label>
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px 16px", borderRadius: 12,
              border: "1.5px dashed rgba(232,122,42,0.3)",
              background: "rgba(232,122,42,0.03)",
              color: "var(--brand-500)", fontSize: 13, fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s ease",
            }}>
              📁 Clique para selecionar arquivos
              <input type="file" multiple
                accept=".pdf,.doc,.docx,.txt,.xlsx,.csv,.ppt,.pptx"
                style={{ display: "none" }}
                onChange={e => {
                  if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }}
              />
            </label>
            {files.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {files.map((f, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "6px 12px", borderRadius: 8,
                    background: "var(--surface-2)",
                    border: "1px solid var(--surface-border)",
                    fontSize: 12, color: "#475569"
                  }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                      📄 {f.name} <span style={{ color: "#94a3b8" }}>({(f.size / 1024).toFixed(0)} KB)</span>
                    </span>
                    <button type="button" onClick={() => removeFile(i)}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Perguntas-chave */}
          <div>
            <label style={labelStyle}>🧠 Perguntas-chave para a IA <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(quanto mais detalhes, melhor o relatório)</span></label>
            <div style={{ 
              background: "rgba(232,122,42,0.04)", border: "1px solid rgba(232,122,42,0.12)", 
              borderRadius: 10, padding: "10px 14px", marginBottom: 14,
              fontSize: 12, color: "#64748b", lineHeight: 1.5
            }}>
              💡 <strong style={{ color: "#475569" }}>Dica:</strong> Use os exemplos nos campos como guia. Respostas mais detalhadas geram relatórios mais precisos e acionáveis.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {KEY_QUESTIONS.map((q, i) => (
                <div key={i}>
                  <div style={{ fontSize: 12, color: "#334155", marginBottom: 4, lineHeight: 1.4, fontWeight: 500 }}>
                    {i + 1}. {q}
                  </div>
                  <textarea className="input" placeholder={KEY_PLACEHOLDERS[i]}
                    style={{ minHeight: 44, resize: "vertical" }}
                    value={keyAnswers[i]}
                    onChange={e => setKeyAnswers(prev => {
                      const copy = [...prev];
                      copy[i] = e.target.value;
                      return copy;
                    })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Botões */}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: "center" }}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary"
              disabled={selectedSectors.length === 0}
              style={{ flex: 2, justifyContent: "center", opacity: selectedSectors.length === 0 ? 0.5 : 1 }}>
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
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  function handleDeleteProject(id: number) {
    deleteProject(id);
    // Clean up all associated localStorage data
    ["clinicflow_docs_", "clinicflow_chat_", "clinicflow_reports_", "clinicflow_bpmn_"].forEach(prefix => {
      try { localStorage.removeItem(`${prefix}${id}`); } catch {}
    });
    setDeleteTarget(null);
  }

  const filtered = projects.filter(p => {
    return search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.clinic_name.toLowerCase().includes(search.toLowerCase()) ||
      p.sector.toLowerCase().includes(search.toLowerCase());
  });

  if (!loaded) {
    return (
      <div style={{ padding: "32px 40px", display: "flex", alignItems: "center", gap: 10, color: "#475569" }}>
        <span className="animate-spin" style={{ display: "inline-block" }}>⚙</span> Carregando projetos...
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200 }}>
      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreate={(p, files) => {
            addProject(p);
            if (files && files.length > 0) {
              // Read text content from files and save as clinicflow_docs_ for Documents tab and AI
              const TEXT_TYPES = ["txt", "csv", "md", "json", "xml"];
              Promise.all(files.map(async (f, i) => {
                const ext = f.name.split(".").pop()?.toLowerCase() || "txt";
                let textContent: string | undefined;
                if (TEXT_TYPES.includes(ext) && f.size < 500_000) {
                  try { textContent = await f.text(); } catch {}
                }
                return {
                  id: p.id + i + 1,
                  filename: f.name,
                  file_type: ext,
                  file_size: f.size,
                  created_at: new Date().toISOString(),
                  has_content: true,
                  text_content: textContent,
                };
              })).then(docMetas => {
                try {
                  localStorage.setItem(`clinicflow_docs_${p.id}`, JSON.stringify(docMetas));
                } catch {}
              });
            }
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a202c", letterSpacing: "-0.5px" }}>
            Projetos
          </h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
            {projects.length} projeto{projects.length !== 1 ? "s" : ""} de consultoria
          </p>
        </div>
        <button className="btn-primary" id="btn-new-project" onClick={() => setShowModal(true)}>
          + Novo Projeto
        </button>
      </div>

      {/* Search */}
      {projects.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <input
            className="input"
            style={{ maxWidth: 320 }}
            placeholder="Buscar por nome, clínica ou setor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 && projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📋</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#334155", marginBottom: 8 }}>Comece seu primeiro projeto</div>
          <div style={{ fontSize: 14, color: "#94a3b8", maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>
            Crie um novo projeto para mapear processos, identificar melhorias e gerar relatórios consultivos para clínicas.
          </div>
          <button className="btn-primary" style={{ marginTop: 24 }} onClick={() => setShowModal(true)}>
            + Criar Primeiro Projeto
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
          <div style={{ fontSize: 14 }}>Nenhum projeto encontrado para "{search}"</div>
          <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setSearch("")}>
            Limpar busca
          </button>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16
        }}>
          {filtered.map(p => <ProjectCard key={p.id} project={p} onDelete={(id) => setDeleteTarget({ id, name: p.name })} />)}
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          projectName={deleteTarget.name}
          onConfirm={() => handleDeleteProject(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
