import { Project, DocumentMeta, ProcessMeta, ReportMeta } from "./api";

export const MOCK_PROJECTS: Project[] = [
    {
        id: 1,
        name: "Mapeamento Financeiro Q1",
        clinic_name: "Clínica São Lucas",
        sector: "Financeiro",
        objectives: "Reduzir tempo de faturamento e inadimplência. Automatizar cobranças via WhatsApp.",
        status: "complete",
        created_at: "2026-02-10T10:00:00Z",
        updated_at: "2026-02-25T14:00:00Z",
    },
    {
        id: 2,
        name: "Fluxo de Atendimento",
        clinic_name: "Instituto CardioVida",
        sector: "Atendimento",
        objectives: "Mapear AS-IS do processo de agendamento até a consulta. Identificar gargalos.",
        status: "bpmn_ready",
        created_at: "2026-02-18T09:00:00Z",
        updated_at: "2026-02-27T11:00:00Z",
    },
    {
        id: 3,
        name: "Processo de RH e Escalas",
        clinic_name: "Clínica BelaVida",
        sector: "RH",
        objectives: "Digitalizar escalonamento de médicos e controle de ponto.",
        status: "analysis",
        created_at: "2026-02-26T08:00:00Z",
    },
    {
        id: 4,
        name: "Prontuário Eletrônico",
        clinic_name: "Hospital Santo André",
        sector: "TI",
        objectives: "Analisar integração entre sistemas MV e iClinic.",
        status: "draft",
        created_at: "2026-02-28T10:00:00Z",
    },
];

export const MOCK_DOCUMENTS: DocumentMeta[] = [
    { id: 1, filename: "transcricao_reuniao.txt", file_type: "txt", file_size: 12400, created_at: "2026-02-20T10:00:00Z", has_content: true },
    { id: 2, filename: "fluxo_atual.docx", file_type: "docx", file_size: 45200, created_at: "2026-02-21T14:30:00Z", has_content: true },
    { id: 3, filename: "dados_faturamento.xlsx", file_type: "xlsx", file_size: 89000, created_at: "2026-02-22T09:15:00Z", has_content: true },
];

export const MOCK_PROCESS: ProcessMeta = {
    id: 1,
    process_name: "Processo de Faturamento AS-IS",
    process_type: "as_is",
    version: 1,
    created_at: "2026-02-25T15:00:00Z",
    has_bpmn: true,
};

export const MOCK_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/BPMN/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://clinicflow.io/bpmn">
  <bpmn:process id="Process_1" name="Processo de Faturamento" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Consulta Realizada"/>
    <bpmn:task id="Task_1" name="Registrar Atendimento no Sistema"/>
    <bpmn:task id="Task_2" name="Gerar Guia de Cobrança"/>
    <bpmn:exclusiveGateway id="Gateway_1" name="Convênio ou Particular?"/>
    <bpmn:task id="Task_3" name="Submeter ao Convênio (TISS)"/>
    <bpmn:task id="Task_4" name="Emitir Nota Fiscal"/>
    <bpmn:task id="Task_5" name="Aguardar Glosa / Aprovação"/>
    <bpmn:task id="Task_6" name="Baixar Pagamento"/>
    <bpmn:endEvent id="EndEvent_1" name="Faturamento Concluído"/>
    <bpmn:sequenceFlow id="f1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <bpmn:sequenceFlow id="f2" sourceRef="Task_1" targetRef="Task_2"/>
    <bpmn:sequenceFlow id="f3" sourceRef="Task_2" targetRef="Gateway_1"/>
    <bpmn:sequenceFlow id="f4" sourceRef="Gateway_1" targetRef="Task_3" name="Convênio"/>
    <bpmn:sequenceFlow id="f5" sourceRef="Gateway_1" targetRef="Task_4" name="Particular"/>
    <bpmn:sequenceFlow id="f6" sourceRef="Task_3" targetRef="Task_5"/>
    <bpmn:sequenceFlow id="f7" sourceRef="Task_5" targetRef="Task_6"/>
    <bpmn:sequenceFlow id="f8" sourceRef="Task_4" targetRef="Task_6"/>
    <bpmn:sequenceFlow id="f9" sourceRef="Task_6" targetRef="EndEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="232" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="240" y="210" width="120" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2">
        <dc:Bounds x="410" y="210" width="120" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1" isMarkerVisible="true">
        <dc:Bounds x="585" y="225" width="50" height="50"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_3_di" bpmnElement="Task_3">
        <dc:Bounds x="690" y="140" width="120" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_4_di" bpmnElement="Task_4">
        <dc:Bounds x="690" y="290" width="120" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_5_di" bpmnElement="Task_5">
        <dc:Bounds x="870" y="140" width="120" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_6_di" bpmnElement="Task_6">
        <dc:Bounds x="1050" y="210" width="120" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="1232" y="232" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="f1_di" bpmnElement="f1"><di:waypoint x="188" y="250"/><di:waypoint x="240" y="250"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f2_di" bpmnElement="f2"><di:waypoint x="360" y="250"/><di:waypoint x="410" y="250"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f3_di" bpmnElement="f3"><di:waypoint x="530" y="250"/><di:waypoint x="585" y="250"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f4_di" bpmnElement="f4"><di:waypoint x="610" y="225"/><di:waypoint x="610" y="180"/><di:waypoint x="690" y="180"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f5_di" bpmnElement="f5"><di:waypoint x="610" y="275"/><di:waypoint x="610" y="330"/><di:waypoint x="690" y="330"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f6_di" bpmnElement="f6"><di:waypoint x="810" y="180"/><di:waypoint x="870" y="180"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f7_di" bpmnElement="f7"><di:waypoint x="990" y="180"/><di:waypoint x="1020" y="180"/><di:waypoint x="1020" y="250"/><di:waypoint x="1050" y="250"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f8_di" bpmnElement="f8"><di:waypoint x="810" y="330"/><di:waypoint x="930" y="330"/><di:waypoint x="930" y="250"/><di:waypoint x="1050" y="250"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f9_di" bpmnElement="f9"><di:waypoint x="1170" y="250"/><di:waypoint x="1232" y="250"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export const MOCK_IMPROVEMENTS_REPORT = `# Relatório de Melhorias de Processo

## 1. Diagnóstico do Processo Atual

O processo de faturamento da **Clínica São Lucas** apresenta múltiplos pontos de ineficiência que impactam diretamente o fluxo de caixa e a produtividade da equipe. A análise identificou um ciclo médio de **12 dias** entre a consulta e o recebimento, com retrabalho significativo nas etapas de submissão ao convênio.

## 2. Principais Gargalos Identificados

| Gargalo | Impacto | Frequência |
|---------|---------|-----------|
| Registro manual no sistema | Alto | Toda consulta |
| Glosas não tratadas proativamente | Crítico | 23% dos atendimentos |
| Falta de integração entre sistemas | Alto | Diário |
| Cobranças de particulares sem automação | Médio | 40% dos atendimentos |
| Relatório de inadimplência manual | Baixo | Semanal |

## 3. Atores e Responsabilidades

- **Recepcionista**: Registro de atendimento, agendamentos
- **Faturista**: Geração de guias, submissão TISS, acompanhamento de glosas
- **Financeiro**: Baixa de pagamentos, relatórios de inadimplência
- **Médico**: Laudo para convenio, códigos de procedimento

## 4. Plano de Ação Priorizado

| Ação | Responsável | Prazo | Impacto |
|------|-------------|-------|---------|
| Automatizar cobrança de particulares via WhatsApp | TI + Financeiro | 2 semanas | 🔴 Alto |
| Integrar iClinic com sistema de faturamento | TI | 1 mês | 🔴 Alto |
| Dashboard de glosas em tempo real | Faturamento | 3 semanas | 🟡 Médio |
| Alertas automáticos de inadimplência | Financeiro | 2 semanas | 🟡 Médio |
| Treinamento da equipe no novo fluxo | RH | 2 dias | 🟢 Baixo |

## 5. Processos TO-BE Recomendados

1. **Registro automático** → Integração direta com prontuário eletrônico
2. **Geração de guia** → Template automático baseado no CID e procedimento
3. **Submissão TISS** → API direta com operadoras (sem digitação manual)
4. **Cobrança particular** → WhatsApp Business API com link de pagamento
5. **Controle de glosas** → Dashboard com alertas e prazo de recurso
6. **Baixa de pagamento** → Integrações bancárias automáticas (Open Finance)

## 6. KPIs de Monitoramento

- **Taxa de Glosa**: meta < 5% (atual: 23%)
- **Ciclo de Recebimento**: meta < 5 dias (atual: 12 dias)  
- **Taxa de Inadimplência**: meta < 3%
- **Tempo de Registro por Atendimento**: meta < 2 min

## 7. Conclusão

A implementação das automações propostas pode reduzir o ciclo de recebimento em **até 58%** e a taxa de glosa em **75%**, representando ganho estimado de **R$ 85.000/mês** em recuperação de receitas e redução de retrabalho.`;

export const MOCK_N8N_REPORT = `# Relatório de Automação com n8n

## 1. Softwares Identificados no Processo

Com base na análise do processo de faturamento, identificamos os seguintes softwares em uso na clínica:

- **iClinic** (Prontuário Eletrônico)  
- **WhatsApp Business** (Comunicação com pacientes)
- **Google Calendar** (Agendamentos)
- **MV Sistemas** (Faturamento hospitalar)

## 2. Disponibilidade de APIs

| Software | API Disponível | Documentação | Tipo de Integração |
|----------|---------------|-------------|-------------------|
| iClinic | ✅ Sim | api.iclinic.com.br | REST + Webhooks |
| WhatsApp Business | ✅ Sim | Meta Developers | Cloud API / REST |
| Google Calendar | ✅ Sim | developers.google.com | REST + OAuth2 |
| MV Sistemas | ⚠️ Parcial | Portal do Parceiro | REST + HL7 FHIR |

## 3. Fluxos de Automação Propostos no n8n

### Fluxo 1: Cobrança Automática de Particulares
\`\`\`
Webhook iClinic (consulta finalizada)
  → Verificar tipo de pagamento (Particular)
  → Gerar link de pagamento (Stripe/PagSeguro)
  → WhatsApp Business: enviar mensagem de cobrança
  → Aguardar 48h → IF não pago → enviar lembrete
  → IF não pago (7d) → criar tarefa no sistema de inadimplência
\`\`\`

### Fluxo 2: Monitoramento de Glosas
\`\`\`
Schedule (diário, 08h00)
  → Consultar API MV: listar guias com status "Glosada"
  → Filtrar glosas com prazo de recurso < 5 dias
  → Enviar alerta por Email para faturista
  → Criar task no sistema de gestão
  → Registrar no Google Sheets (auditoria)
\`\`\`

### Fluxo 3: Confirmação de Consulta
\`\`\`
Google Calendar: trigger (24h antes da consulta)
  → Buscar dados do paciente no iClinic
  → WhatsApp Business: enviar mensagem de confirmação
  → IF não confirmado (4h) → ligar via Twilio
  → Atualizar status no iClinic (confirmado/cancelado)
\`\`\`

### Fluxo 4: Relatório Semanal para Gestão
\`\`\`
Schedule (toda segunda-feira, 07h00)
  → Consultar API iClinic: consultas da semana anterior
  → Calcular métricas (taxa de glosa, recebimento médio)
  → Gerar PDF com Google Docs API
  → Enviar por Gmail para diretoria
\`\`\`

## 4. Estimativa de Economia de Tempo

| Processo | Antes (manual) | Depois (n8n) | Economia |
|----------|---------------|-------------|---------|
| Cobrança de particulares | 15 min/paciente | 0 min | 100% |
| Monitoramento de glosas | 2h/dia | 5 min/revisão | 95% |
| Confirmação de consultas | 45 min/dia | 0 min | 100% |
| Relatório semanal | 3h/semana | 10 min/revisão | 94% |

## 5. Roadmap de Implementação

**Semana 1-2**: Setup n8n (auto-hospedado) + configurar credenciais (iClinic, WhatsApp, Google)  
**Semana 3**: Implementar Fluxo 3 (confirmação de consultas) — menor risco  
**Semana 4**: Implementar Fluxo 1 (cobrança automática)  
**Semana 5-6**: Implementar Fluxo 2 (monitoramento glosas)  
**Semana 7**: Implementar Fluxo 4 + refinamentos

## 6. Integrações Nativas n8n Recomendadas

- **n8n WhatsApp Business node** (oficial) para mensagens
- **Google Calendar trigger** para agendamentos  
- **HTTP Request node** para APIs REST (iClinic, MV)
- **Gmail node** para relatórios e alertas
- **Google Sheets node** para auditoria e logs
- **Schedule trigger** para processos recorrentes`;
