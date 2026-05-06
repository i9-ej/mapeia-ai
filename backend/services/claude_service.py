import os
import json
from typing import Optional
import anthropic
from dotenv import load_dotenv

load_dotenv()

CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")
DEFAULT_MODEL = "claude-sonnet-4-6"

# ---------------------------------------------------------------------------
# System instruction reutilizado em todos os prompts de mapeamento BPM
# ---------------------------------------------------------------------------
BPM_SYSTEM_ROLE = (
    "Você é um consultor sênior de Business Process Management (BPM), "
    "Design de Processos e Consultoria Operacional especializado no setor de saúde. "
    "Seus entregáveis devem ter qualidade de consultoria premium — extremamente claros, "
    "detalhados, profissionais, padronizados e visualmente estruturados. "
    "Use linguagem executiva e objetiva. Nunca simplifique processos complexos. "
    "Nunca deixe etapas sem detalhamento suficiente. "
    "Mantenha consistência absoluta em estrutura e terminologia."
)


def _get_client(api_key: Optional[str] = None) -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=api_key or CLAUDE_API_KEY)


def _extract_json(text: str) -> str:
    """Extract JSON from markdown code blocks if present."""
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


async def analyze_process_as_is(
    context_text: str,
    project_info: dict,
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> dict:
    """
    Analyze document context and extract AS-IS process structure.
    Returns a structured dict with expanded stage detail (9 fields per stage).
    """
    prompt = f"""{BPM_SYSTEM_ROLE}

Você está conduzindo o mapeamento AS-IS (estado atual) de um processo operacional.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO DO PROJETO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Clínica / Organização: {project_info.get('clinic_name', 'N/A')}
- Setor / Departamento: {project_info.get('sector', 'N/A')}
- Objetivos Declarados: {project_info.get('objectives', 'N/A')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENTOS / TRANSCRIÇÕES FORNECIDOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{context_text[:6000]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analise profundamente o conteúdo fornecido e execute:

1. **Resumo Executivo** — Síntese do processo em 3-5 frases de nível executivo.
2. **Mapeamento de Etapas** — Para CADA etapa do processo, detalhe obrigatoriamente os 9 campos:
   - Nome da Etapa (claro e conciso)
   - Objetivo da Etapa (por que existe)
   - Responsável Principal (quem executa)
   - Inputs Necessários (informações/recursos de entrada)
   - Atividades Realizadas (ações detalhadas)
   - Outputs Gerados (entregas da etapa)
   - Dependências (equipes/processos que dependem desta etapa)
   - Riscos / Gargalos Identificados (problemas potenciais)
   - Notas Operacionais (exceções, considerações relevantes)
3. **Atores / Responsáveis** envolvidos no processo.
4. **Pontos de Dor** — Problemas e ineficiências observadas.
5. **Gargalos** — Pontos onde o fluxo fica restrito.
6. **Perguntas de Clarificação** — SOMENTE se existirem lacunas que impeçam um mapeamento completo.

Responda **exclusivamente** em JSON válido com o schema abaixo:
{{
  "process_name": "string",
  "executive_summary": "string (resumo executivo de 3-5 frases)",
  "process_type": "as_is",
  "actors": ["string"],
  "steps": [
    {{
      "id": "step_1",
      "name": "string",
      "objective": "string (por que esta etapa existe)",
      "responsible": "string (ator principal)",
      "inputs": ["string (recursos/informações necessários)"],
      "activities": ["string (ações executadas nesta etapa)"],
      "outputs": ["string (entregas geradas)"],
      "dependencies": ["string (processos/equipes dependentes)"],
      "risks_bottlenecks": ["string (riscos e gargalos desta etapa)"],
      "operational_notes": "string (exceções e considerações)",
      "type": "task|decision|start|end",
      "next": ["step_2"],
      "actor": "string"
    }}
  ],
  "pain_points": ["string"],
  "bottlenecks": ["string"],
  "clarification_questions": ["string"],
  "confidence_score": 0.0
}}

REGRAS CRÍTICAS:
- Nunca resuma demais processos complexos.
- Cada etapa DEVE ter todos os 9 campos preenchidos.
- Se o contexto for insuficiente, liste perguntas de clarificação e ajuste o confidence_score para < 0.7.
- Linguagem profissional e objetiva.
"""
    client = _get_client(api_key)
    response = client.messages.create(
        model=model or DEFAULT_MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )
    text = _extract_json(response.content[0].text)
    return json.loads(text)


async def generate_clarification_response(
    context_text: str,
    project_info: dict,
    previous_analysis: dict,
    consultant_answers: list[dict],
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> dict:
    """Re-analyze with consultant's clarification answers to produce a complete process model."""
    qa_text = "\n".join([
        f"P: {item['question']}\nR: {item['answer']}"
        for item in consultant_answers
    ])

    prompt = f"""{BPM_SYSTEM_ROLE}

Você está refinando o mapeamento AS-IS de um processo operacional com base nas respostas do consultor.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO DO PROJETO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Clínica: {project_info.get('clinic_name', 'N/A')}
- Setor: {project_info.get('sector', 'N/A')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANÁLISE PRÉVIA (RASCUNHO AS-IS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{json.dumps(previous_analysis, ensure_ascii=False, indent=2)[:3000]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPOSTAS DO CONSULTOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{qa_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Produza o modelo AS-IS COMPLETO E DEFINITIVO incorporando todas as respostas acima.
Cada etapa DEVE conter os 9 campos obrigatórios: name, objective, responsible, inputs, activities, outputs, dependencies, risks_bottlenecks, operational_notes.
Inclua o executive_summary atualizado.
Responda em JSON válido com o mesmo schema anterior.
confidence_score deve ser >= 0.85 se as lacunas foram preenchidas adequadamente.
"""
    client = _get_client(api_key)
    response = client.messages.create(
        model=model or DEFAULT_MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )
    text = _extract_json(response.content[0].text)
    return json.loads(text)


async def generate_improvements_report(
    process_analysis: dict,
    project_info: dict,
    knowledge_context: str = "",
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> str:
    """Generate a premium consulting-grade process mapping and improvement report."""
    prompt = f"""{BPM_SYSTEM_ROLE}

Você está produzindo um relatório profissional de Mapeamento de Processos e Melhorias para entrega ao cliente.
O relatório deve ter qualidade de consultoria de primeira linha — imediatamente utilizável em ambiente corporativo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO DO PROJETO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Clínica / Organização: {project_info.get('clinic_name')}
- Setor / Departamento: {project_info.get('sector')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANÁLISE DO PROCESSO AS-IS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{json.dumps(process_analysis, ensure_ascii=False, indent=2)[:5000]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO DE MERCADO / BASE DE CONHECIMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{knowledge_context[:1500] if knowledge_context else 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPLATE OBRIGATÓRIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Gere o relatório EXATAMENTE na estrutura Markdown abaixo. Não altere a estrutura.

# 📄 MAPEAMENTO DE PROCESSO — [NOME DO PROCESSO]

## 1. Resumo Executivo
Síntese executiva do processo: o que é, por que existe, escopo e principais observações em 3-5 parágrafos concisos.

---

## 2. Etapas do Processo

Para CADA etapa identificada, use este formato:

### Etapa [N] — [Nome da Etapa]
- **Objetivo:** Por que esta etapa existe
- **Responsável:** Quem executa
- **Inputs:** Informações e recursos necessários
- **Atividades:** Ações executadas detalhadamente
- **Outputs:** Entregas geradas por esta etapa
- **Dependências:** Processos e equipes que dependem desta etapa
- **Riscos / Gargalos:** Problemas potenciais ou observados
- **Notas Operacionais:** Exceções e considerações relevantes

(Repetir para TODAS as etapas)

---

# 📄 RELATÓRIO DE MELHORIAS — [NOME DO PROCESSO]

Para CADA melhoria identificada, use este formato:

## Melhoria [N]
- **Problema Identificado:** Descrição objetiva do problema
- **Impacto Operacional / Negócio:** Consequências causadas pelo problema
- **Causa Raiz Provável:** Análise lógica da causa raiz
- **Recomendação de Melhoria:** Ação corretiva recomendada
- **Benefício Esperado:** Resultado esperado após implementação
- **Prioridade:** Alta | Média | Baixa
- **Complexidade de Implementação:** Alta | Média | Baixa

(Repetir para TODAS as melhorias identificadas — mínimo 5)

---

## Matriz de Priorização

| # | Melhoria | Prioridade | Complexidade | Impacto Estimado |
|---|----------|-----------|-------------|-----------------|
(Tabela consolidando todas as melhorias)

---

## KPIs de Monitoramento

Listar indicadores-chave para medir a eficácia das melhorias implementadas.

---

## Conclusão e Próximos Passos

Encerramento executivo com recomendações de sequenciamento.

REGRAS CRÍTICAS:
- NUNCA resuma demais processos complexos.
- NUNCA deixe etapas sem detalhamento.
- NUNCA altere a estrutura do template.
- Linguagem executiva, profissional e sofisticada.
- Mínimo de 5 melhorias identificadas.
- O relatório deve parecer produzido por uma consultoria de primeira linha.
"""
    client = _get_client(api_key)
    response = client.messages.create(
        model=model or DEFAULT_MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text


async def generate_n8n_report(
    process_analysis: dict,
    project_info: dict,
    software_api_info: str = "",
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> str:
    """Generate premium n8n automation workflow suggestions report."""
    prompt = f"""{BPM_SYSTEM_ROLE}

Você é também um especialista em automação de processos com n8n, RPA e integrações via API.
Produza um relatório de automação de nível consultivo para entrega ao cliente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO DO PROJETO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Clínica / Organização: {project_info.get('clinic_name')}
- Setor / Departamento: {project_info.get('sector')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANÁLISE DO PROCESSO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{json.dumps(process_analysis, ensure_ascii=False, indent=2)[:4000]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INFORMAÇÕES DE APIs DOS SOFTWARES UTILIZADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{software_api_info or 'Não identificado. Verificar documentação oficial dos fornecedores.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPLATE OBRIGATÓRIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Gere o relatório EXATAMENTE na estrutura Markdown abaixo:

# 📄 RELATÓRIO DE AUTOMAÇÃO COM N8N — [NOME DO PROCESSO]

## 1. Resumo Executivo
Visão geral das oportunidades de automação e ROI potencial.

## 2. Softwares Identificados no Processo

| Software | Função no Processo | Criticidade |
|----------|-------------------|-------------|

## 3. Disponibilidade de APIs

| Software | API Disponível | Documentação | Tipo de Integração | Observações |
|----------|---------------|-------------|-------------------|-------------|

## 4. Fluxos de Automação Propostos no n8n

Para CADA fluxo proposto:

### Automação [N] — [Nome do Fluxo]
- **Problema que Resolve:** Descrição do problema atual
- **Fluxo Proposto:** Diagrama textual passo a passo do workflow n8n
- **Nodes n8n Utilizados:** Lista dos nodes necessários
- **Gatilho (Trigger):** O que inicia o fluxo
- **Resultado Esperado:** Output da automação
- **Economia de Tempo Estimada:** Horas/semana economizadas
- **Complexidade de Implementação:** Alta | Média | Baixa

## 5. Estimativa Consolidada de Economia

| Automação | Tempo Atual | Tempo Automatizado | Economia Semanal |
|-----------|------------|-------------------|-----------------|

## 6. Roadmap de Implementação

| Fase | Automações | Prazo Estimado | Pré-requisitos |
|------|-----------|---------------|---------------|

## 7. Integrações Nativas n8n Recomendadas
Lista de nodes e integrações nativas do n8n que se aplicam.

## 8. Conclusão e Recomendações Estratégicas
Encerramento executivo com priorização das automações.

REGRAS CRÍTICAS:
- Mínimo de 3 fluxos de automação propostos.
- Linguagem executiva, técnica e sofisticada.
- Dados específicos do projeto — nunca genéricos.
"""
    client = _get_client(api_key)
    response = client.messages.create(
        model=model or DEFAULT_MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text


async def generate_bpmn_xml_from_process(
    process_analysis: dict,
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> str:
    """Generate valid BPMN 2.0 XML from the process JSON."""
    steps_json = json.dumps(process_analysis.get("steps", []), ensure_ascii=False, indent=2)
    process_name = process_analysis.get("process_name", "Processo AS-IS")
    actors = process_analysis.get("actors", [])

    prompt = f"""
Gere um arquivo XML BPMN 2.0 válido para o seguinte processo.
Use o namespace correto: xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
Inclua lanes para cada ator.
Inclua eventos de início e fim, tasks e gateways conforme necessário.
O ID do processo deve ser "Process_1".

Processo: {process_name}
Atores: {', '.join(actors)}
Etapas:
{steps_json[:3000]}

Responda APENAS com o XML BPMN válido, sem explicações, sem markdown.
"""
    client = _get_client(api_key)
    response = client.messages.create(
        model=model or DEFAULT_MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )
    xml = response.content[0].text.strip()
    if "```" in xml:
        xml = xml.split("```")[1]
        if xml.startswith("xml"):
            xml = xml[3:]
    return xml.strip()

