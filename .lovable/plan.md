

# Análise de Conformidade CEP/LGPD do Módulo de Pesquisa

Após revisão detalhada do código atual, identifiquei **lacunas significativas** que impedem a conformidade plena com as exigências do CEP (Comitê de Ética em Pesquisa / Resolução CNS 466/2012 e 510/2016) e da LGPD (Lei 13.709/2018). Abaixo, o diagnóstico e o plano de correção.

---

## Diagnóstico: O que JÁ funciona

- Consentimento etapizado (micro-commitments por seção)
- Assinatura digital em canvas com geração de PDF
- Registro de user_agent e timestamp
- Código anônimo para participantes (participant_code)
- Armazenamento seguro em bucket privado (consents, study-documents)

## Diagnóstico: O que FALTA

### 1. Captura de IP no TCLE (CEP + LGPD Auditoria)
O IP é registrado nas respostas do survey (`survey-respond` edge function), mas **NÃO** é capturado na assinatura do TCLE. O `ConsentRespond.tsx` insere `consent_signatures` diretamente do frontend sem capturar o IP real (o campo `ip_address` fica `null`). O IP precisa ser coletado via edge function server-side.

### 2. Direito de Revogação do Consentimento (LGPD Art. 8° §5° / CEP 466/2012)
Não existe nenhum mecanismo para o participante **revogar** seu consentimento. A LGPD exige que o consentimento possa ser revogado a qualquer momento, e o CEP exige que o participante possa se retirar do estudo sem prejuízo.

### 3. Trilha de Auditoria (CEP / GCP-ICH)
Não há tabela de auditoria que registre ações como: consentimento assinado, consentimento revogado, dados alterados, dados exportados. O CEP e as Boas Práticas Clínicas (GCP) exigem rastreabilidade completa.

### 4. Envio de Cópia do PDF ao Participante (Resolução 466/2012)
O PDF é gerado e salvo no storage, mas **não é enviado** por e-mail ao participante. A Resolução 466/2012 exige que o participante receba uma via do TCLE assinado.

### 5. Versionamento do TCLE (CEP)
Se o pesquisador edita o TCLE após participantes já terem assinado, não há controle de versão. O CEP exige que alterações no TCLE gerem uma nova versão e que participantes anteriores sejam re-consentidos se necessário.

### 6. Política de Retenção e Exclusão de Dados (LGPD Art. 16)
Não há mecanismo para exclusão dos dados pessoais do participante (nome, e-mail, assinatura) após o término do estudo ou mediante solicitação.

### 7. Base Legal e Finalidade (LGPD Art. 7° e 11)
O TCLE não registra explicitamente a base legal do tratamento de dados (consentimento para pesquisa científica) nem a finalidade específica. Isso deve constar no PDF gerado.

---

## Plano de Implementação

### A. Edge Function para Assinatura do TCLE (IP + PDF + E-mail)
Mover a lógica de submissão do consentimento para uma **edge function** `consent-sign` que:
- Captura o IP real via headers (`x-forwarded-for`)
- Gera o PDF server-side com IP, timestamp e hash de integridade
- Envia cópia do PDF por e-mail ao participante via Resend (secret `RESEND_API_KEY` já existe)
- Registra na `consent_signatures` com IP preenchido

### B. Tabela de Auditoria
```sql
CREATE TABLE public.study_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL,
  participant_id UUID,
  action TEXT NOT NULL, -- 'consent_signed', 'consent_revoked', 'data_modified', 'data_exported', 'data_deleted'
  actor_id UUID, -- user_id do pesquisador ou null para participante
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
Com RLS: pesquisadores veem logs dos seus estudos, insert público para edge functions.

### C. Mecanismo de Revogação de Consentimento
- Adicionar campo `revoked_at` e `revocation_reason` na tabela `consent_signatures`
- Botão "Revogar Consentimento" acessível ao participante (via link no e-mail do TCLE)
- Ao revogar: marca o participante como `withdrawn`, registra na trilha de auditoria, anonimiza dados pessoais (nome, e-mail, assinatura)

### D. Versionamento do TCLE
- Adicionar campo `version` (integer, default 1) na tabela `study_consents`
- Ao editar um TCLE com assinaturas existentes: criar nova versão em vez de sobrescrever
- Registrar qual versão cada participante assinou na `consent_signatures`

### E. Metadados Legais no PDF
- Incluir no PDF: base legal (LGPD Art. 7°, inciso IV - pesquisa), finalidade do tratamento, direito de revogação, contato do pesquisador e do CEP

### F. Funcionalidade de Exclusão de Dados (LGPD Art. 18)
- Botão no painel do pesquisador para anonimizar dados de um participante
- Substitui nome, e-mail e assinatura por "[DADOS REMOVIDOS]", mantendo dados estatísticos anônimos

---

## Arquivos Envolvidos

**Novos:**
- `supabase/functions/consent-sign/index.ts` (edge function para assinatura com IP + e-mail)
- Migração SQL (audit_log, campos de revogação e versionamento)

**Modificados:**
- `src/components/survey/consent/ConsentRespond.tsx` (chamar edge function em vez de insert direto)
- `src/components/survey/consent/ConsentBuilder.tsx` (controle de versão)
- `src/components/survey/ecrf/ParticipantList.tsx` (botão anonimizar)
- `src/components/survey/ecrf/ParticipantDetail.tsx` (status revogação)
- `src/components/survey/results/SurveyResultsPanel.tsx` (aba auditoria)
- `supabase/config.toml` (nova edge function)

---

## Resumo das Lacunas por Norma

| Requisito | CEP 466/2012 | LGPD | GCP-ICH | Status Atual |
|-----------|:---:|:---:|:---:|:---:|
| Via do TCLE ao participante | Sim | - | Sim | Falta |
| IP na assinatura | Sim | Sim | Sim | Falta |
| Revogação de consentimento | Sim | Sim | Sim | Falta |
| Trilha de auditoria | Sim | - | Sim | Falta |
| Versionamento do TCLE | Sim | - | Sim | Falta |
| Exclusão/anonimização de dados | - | Sim | - | Falta |
| Base legal no documento | - | Sim | - | Falta |

