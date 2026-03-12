

# Reformulação do Módulo de Pesquisa → Plataforma de Pesquisa Clínica

## Visão Geral

Transformar o módulo de Surveys atual (inspirado no Qualtrics) em uma plataforma completa de pesquisa clínica com 4 módulos: TCLE, eCRF, Painel do Pesquisador e Síntese com IA. O sistema atual já possui um construtor de questionários com 6 tipos de questões, lógica condicional, distribuição e análise de resultados -- tudo isso será preservado e expandido.

Devido à magnitude, a implementação será dividida em **4 fases sequenciais**.

---

## Fase 1: Módulo de TCLE (Termo de Consentimento Livre e Esclarecido)

### Banco de Dados
Nova tabela `study_consents` para armazenar templates de TCLE vinculados a um survey/study:

```sql
CREATE TABLE public.study_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'TCLE',
  sections JSONB NOT NULL DEFAULT '[]',
  -- sections: [{id, title, content_html, media_url?, media_type?, require_checkbox: bool}]
  video_url TEXT,
  audio_url TEXT,
  require_signature BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.consent_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES study_consents(id) ON DELETE CASCADE,
  respondent_name TEXT NOT NULL,
  respondent_email TEXT,
  signature_data TEXT, -- base64 canvas image
  ip_address TEXT,
  user_agent TEXT,
  section_confirmations JSONB NOT NULL DEFAULT '[]',
  -- [{section_id, confirmed_at}]
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_path TEXT -- path in storage bucket
);
```

### Componentes UI
- **ConsentBuilder**: editor no painel do pesquisador para criar seções do TCLE (Riscos, Benefícios, Privacidade, etc.), com upload de vídeo/áudio explicativo
- **ConsentRespond**: tela pública que apresenta o TCLE em etapas (micro-commitments). Cada seção tem checkbox "Li e compreendi". Canvas de assinatura digital com o dedo (usando HTML5 Canvas)
- **PDF automático**: ao assinar, gera PDF via `jspdf` (já instalado) com timestamp, IP, assinatura, e salva no bucket `papers` (ou novo bucket `consents`). Envia cópia por e-mail via edge function
- Nova aba **"TCLE"** no SurveyBuilder (tabs: Construir | TCLE | Fluxo | Distribuir | Resultados)

### Fluxo
1. Pesquisador cria TCLE no builder com seções e mídia
2. Participante acessa link → vê TCLE etapizado → confirma cada seção → assina no canvas
3. Sistema gera PDF, salva no storage, envia por e-mail
4. Só após TCLE assinado o participante pode responder o questionário (eCRF)

---

## Fase 2: eCRF (Electronic Case Report Form) - Evolução do Construtor

### Banco de Dados
```sql
-- Participantes do estudo (centrado no paciente)
CREATE TABLE public.study_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  participant_code TEXT NOT NULL, -- código anônimo
  consent_signature_id UUID REFERENCES consent_signatures(id),
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Visitas/Timepoints longitudinais
CREATE TABLE public.study_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  label TEXT NOT NULL, -- 'Baseline (T0)', 'Acompanhamento 30d (T1)'
  visit_order INTEGER NOT NULL DEFAULT 0,
  target_days INTEGER, -- dias após baseline
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documentos anexados por participante
CREATE TABLE public.participant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES study_participants(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES study_visits(id),
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT, -- 'lab_result', 'prescription', 'image'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Funcionalidades
- **Validação de dados em tempo real**: campo `validation_rules` da `survey_questions` expandido com tipos clínicos pré-configurados (PA sistólica: 40-300 mmHg, Glicemia: 10-1000 mg/dL, Peso: 0.5-500 kg). No `QuestionContextPanel`, dropdown com templates de validação clínica
- **Lógica Condicional Dinâmica**: já existente via `survey_logic_rules`, será aprimorada com mais operadores e ações (hide_question, skip_block, show_warning)
- **Estrutura Longitudinal**: nova aba "Visitas" no builder para definir timepoints. No formulário de resposta, o participante é identificado por código e seleciona a visita correspondente
- **Upload de documentos**: botão de upload no formulário de resposta (câmera/galeria otimizado para mobile) vinculado ao participante e visita, usando bucket `papers` ou novo bucket `study-documents`
- **Novos tipos de questão**: `number_clinical` (com unidade e range), `date_field`, `file_upload`

---

## Fase 3: Painel do Pesquisador (Centro de Comando)

### Componentes
- **Dashboard de Recrutamento**: gráfico de funil (Recharts, já instalado): Convidados → TCLEs assinados → Coletas em andamento → Coletas finalizadas. Cards de resumo com números totais
- **Sistema de Queries/Alertas**: aba "Qualidade de Dados" que varre automaticamente as respostas buscando: campos obrigatórios vazios, valores fora do range de validação, participantes com visitas atrasadas. Lista de alertas com filtros por severidade
- **Exportação Data-Ready**: botão "Exportar para Análise" no painel de resultados, gerando CSV/XLSX com variáveis codificadas numericamente (Masculino→0, Feminino→1) conforme mapeamento definido nas choices. Toggle para nomes de variáveis já existe, será expandido com codificação automática. Botão direto para enviar ao DataMind (já existe)

### Modificações
- `SurveyResultsPanel` ganha novas abas: "Recrutamento" (funil), "Qualidade" (queries), além das existentes "Relatórios" e "Dados"
- `ResponseDataGrid` ganha toggle de codificação numérica

---

## Fase 4: Síntese com IA para Documentos Clínicos

### Edge Function
Nova edge function `clinical-synthesis` que recebe os dados coletados de um participante (todas as visitas) e gera um rascunho de evolução clínica ou sumário descritivo do caso.

### UI
- Botão "Gerar Síntese Clínica" na ficha do participante (visível apenas para o pesquisador)
- Dialog mostrando o rascunho gerado com opção de editar e salvar como PDF
- Manter o botão "Gerar com IA" existente para criação de questões

---

## Resumo de Arquivos

### Novos arquivos (~15)
- `src/components/survey/consent/ConsentBuilder.tsx`
- `src/components/survey/consent/ConsentRespond.tsx`
- `src/components/survey/consent/SignatureCanvas.tsx`
- `src/components/survey/ecrf/VisitManager.tsx`
- `src/components/survey/ecrf/ParticipantList.tsx`
- `src/components/survey/ecrf/ParticipantDetail.tsx`
- `src/components/survey/ecrf/DocumentUpload.tsx`
- `src/components/survey/ecrf/ClinicalValidationTemplates.tsx`
- `src/components/survey/results/RecruitmentFunnel.tsx`
- `src/components/survey/results/DataQualityAlerts.tsx`
- `supabase/functions/clinical-synthesis/index.ts`
- `supabase/functions/consent-pdf/index.ts`

### Arquivos modificados (~10)
- `src/pages/SurveyBuilder.tsx` (novas abas)
- `src/pages/SurveyRespond.tsx` (fluxo TCLE + visitas)
- `src/pages/Surveys.tsx` (nova coluna participantes)
- `src/hooks/useSurveyStore.ts` (novos tipos e estado para visitas/participantes)
- `src/components/survey/builder/QuestionContextPanel.tsx` (validação clínica)
- `src/components/survey/results/SurveyResultsPanel.tsx` (novas abas)
- `src/components/survey/results/ResponseDataGrid.tsx` (codificação numérica)
- `src/App.tsx` (novas rotas)
- Migrações SQL (4-5 arquivos)

### Dependências
Nenhuma nova dependência necessária. O projeto já possui `jspdf`, `recharts`, `xlsx`, `framer-motion` e todos os componentes UI necessários.

---

## Ordem de Implementação Sugerida

Dado o tamanho, recomendo implementar em **etapas menores**:
1. **Primeiro**: Fase 2 parcial - validação clínica + novos tipos de questão (usa infraestrutura existente)
2. **Segundo**: Fase 1 - TCLE completo (módulo independente)
3. **Terceiro**: Fase 2 completa - visitas longitudinais + participantes + uploads
4. **Quarto**: Fase 3 - Dashboard de recrutamento e qualidade
5. **Quinto**: Fase 4 - Síntese com IA

Posso começar pela Fase 1 (TCLE) ou pela ordem sugerida acima. Qual prefere?

