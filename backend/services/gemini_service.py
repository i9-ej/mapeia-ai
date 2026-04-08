import os
import json
from typing import Optional
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=GEMINI_API_KEY)

MODEL_NAME = "gemini-2.0-flash"


def _get_model():
    return genai.GenerativeModel(MODEL_NAME)


async def analyze_process_as_is(context_text: str, project_info: dict) -> dict:
    """
    Analyze document context and extract AS-IS process structure.
    Returns a structured dict with steps, actors, pain points, and clarification questions.
    """
    prompt = f"""
Você é um especialista em mapeamento de processos de clínicas médicas.

**Projeto:**
- Clínica: {project_info.get('clinic_name', 'N/A')}
- Setor: {project_info.get('sector', 'N/A')}
- Objetivos: {project_info.get('objectives', 'N/A')}

**Documentos / Transcrições fornecidos:**
---
{context_text[:6000]}
---

Com base nestas informações, realize:
1. Identifique e estruture o processo AS-IS (estado atual)
2. Liste todos os atores/responsáveis envolvidos
3. Identifique gargalos, problemas e ineficiências
4. Liste EXATAMENTE as perguntas de clarificação necessárias para completar o mapeamento (se houver lacunas)

Responda **exclusivamente** em JSON válido com o seguinte schema:
{{
  "process_name": "string",
  "summary": "string",
  "actors": ["string"],
  "steps": [
    {{
      "id": "step_1",
      "name": "string",
      "actor": "string",
      "description": "string",
      "type": "task|decision|start|end",
      "next": ["step_2"]
    }}
  ],
  "pain_points": ["string"],
  "bottlenecks": ["string"],
  "clarification_questions": ["string"],
  "confidence_score": 0.0
}}
"""
    model = _get_model()
    response = model.generate_content(prompt)
    text = response.text.strip()
    # Extract JSON from markdown code blocks if present
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


async def generate_clarification_response(
    context_text: str,
    project_info: dict,
    previous_analysis: dict,
    consultant_answers: list[dict]
) -> dict:
    """Re-analyze with consultant's clarification answers to produce a complete process model."""
    qa_text = "\n".join([
        f"P: {item['question']}\nR: {item['answer']}"
        for item in consultant_answers
    ])

    prompt = f"""
Você é um especialista em mapeamento de processos de clínicas médicas.

**Projeto:**
- Clínica: {project_info.get('clinic_name', 'N/A')}
- Setor: {project_info.get('sector', 'N/A')}

**Análise prévia (rascunho AS-IS):**
{json.dumps(previous_analysis, ensure_ascii=False, indent=2)[:3000]}

**Respostas do consultor às perguntas de clarificação:**
{qa_text}

Agora, produza o modelo AS-IS COMPLETO E DEFINITIVO incorporando as respostas acima.
Responda em JSON válido com o mesmo schema anterior. confidence_score deve ser >= 0.85 se as lacunas foram preenchidas.
"""
    model = _get_model()
    response = model.generate_content(prompt)
    text = response.text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


async def generate_improvements_report(
    process_analysis: dict,
    project_info: dict,
    knowledge_context: str = ""
) -> str:
    """Generate a structured markdown improvements report."""
    prompt = f"""
Você é um consultor sênior de otimização de processos em clínicas médicas.

**Projeto:** {project_info.get('clinic_name')} - {project_info.get('sector')}

**Análise do Processo AS-IS:**
{json.dumps(process_analysis, ensure_ascii=False, indent=2)[:4000]}

**Contexto de conhecimento do mercado:**
{knowledge_context[:1500] if knowledge_context else 'N/A'}

Gere um relatório profissional em Markdown com:
# Relatório de Melhorias de Processo
## 1. Diagnóstico do Processo Atual
## 2. Principais Gargalos Identificados (tabela)
## 3. Atores e Responsabilidades
## 4. Plano de Ação Priorizado (tabela: Ação | Responsável | Prazo | Impacto)
## 5. Processos TO-BE Recomendados (passo a passo simplificado)
## 6. KPIs de Monitoramento
## 7. Conclusão
"""
    model = _get_model()
    response = model.generate_content(prompt)
    return response.text


async def generate_n8n_report(
    process_analysis: dict,
    project_info: dict,
    software_api_info: str = ""
) -> str:
    """Generate n8n automation workflow suggestions report."""
    prompt = f"""
Você é um especialista em automação de processos (n8n, RPA, APIs).

**Projeto:** {project_info.get('clinic_name')} - {project_info.get('sector')}

**Análise do Processo:**
{json.dumps(process_analysis, ensure_ascii=False, indent=2)[:3000]}

**Informações de APIs dos softwares utilizados:**
{software_api_info or 'Não identificado ainda.'}

Gere um relatório profissional em Markdown:
# Relatório de Automação com n8n
## 1. Softwares Identificados no Processo
## 2. Disponibilidade de APIs (tabela: Software | API Disponível | Documentação | Tipo de Integração)
## 3. Fluxos de Automação Propostos no n8n (diagrama textual de cada fluxo)
## 4. Estimativa de Economia de Tempo
## 5. Roadmap de Implementação
## 6. Integrações Nativas n8n Recomendadas
"""
    model = _get_model()
    response = model.generate_content(prompt)
    return response.text


async def generate_bpmn_xml_from_process(process_analysis: dict) -> str:
    """Ask Gemini to produce valid BPMN 2.0 XML from the process JSON."""
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
    model = _get_model()
    response = model.generate_content(prompt)
    xml = response.text.strip()
    if "```" in xml:
        xml = xml.split("```")[1]
        if xml.startswith("xml"):
            xml = xml[3:]
    return xml.strip()
