

# Plano: Correções das 7 Lacunas do Ofício Circular CONEP nº 23/2022 (Bloco 1)

Após análise detalhada do Ofício Circular nº 23/2022/CONEP e comparação com o sistema atual, identifico **13 lacunas** totais. Este plano cobre as **7 primeiras** (mais críticas e estruturais).

---

## As 7 Lacunas deste Bloco

| # | Lacuna | Artigo CONEP | Descrição |
|---|--------|-------------|-----------|
| 1 | Link de auto-revogação no documento | 5.4 | O documento deve conter link para retirada do consentimento |
| 2 | Co-assinatura do pesquisador | 4.3-7 | Documento deve ser assinado pelo participante E pelo pesquisador |
| 3 | Riscos do ambiente virtual | 2.1-I | Seção obrigatória sobre riscos do meio virtual e medidas de segurança |
| 4 | Contato do pesquisador visível | 2.2-V/VI | Horários e formas de contato disponíveis durante o consentimento |
| 5 | Exportação rascunho para CEP | 4.3-8 | Documento não-definitivo para apreciação pelo CEP antes da aplicação |
| 6 | Aviso de privacidade do local | 2.2-VII | Explicar importância da segurança do local onde ocorre o consentimento |
| 7 | Garantia de acesso em papel | 2.3-I | Garantir ao participante a opção de ter acesso ao termo em papel |

---

## Implementação

### 1. Página pública de revogação de consentimento (Art. 5.4)
- Criar **nova rota pública** `/consent/revoke/:signatureId` com página onde o participante pode revogar seu consentimento autonomamente
- O link será incluído no **e-mail do TCLE** e no **PDF gerado** pela edge function `consent-sign`
- A página valida o `signatureId`, exibe nome parcial do participante, pede confirmação + motivo, e chama a edge function para processar
- Criar **nova edge function** `consent-revoke` que: valida o signature ID, marca `revoked_at`, atualiza status do participante para `withdrawn`, registra na `study_audit_log`

**Arquivos:** `src/pages/ConsentRevoke.tsx` (novo), `supabase/functions/consent-revoke/index.ts` (novo), editar `consent-sign/index.ts` (adicionar link no e-mail), editar `App.tsx` (rota)

### 2. Co-assinatura do pesquisador (Art. 4.3-7)
- Adicionar campos na tabela `consent_signatures`: `researcher_name`, `researcher_signed_at`, `researcher_ip`
- No painel do pesquisador (`ParticipantDetail.tsx`), adicionar botão **"Assinar como Pesquisador"** que registra a co-assinatura
- Atualizar o PDF/e-mail para incluir a assinatura do pesquisador quando disponível
- Badge visual indicando status: "Aguardando assinatura do pesquisador" / "Assinado por ambas as partes"

**Arquivos:** migração SQL, `ParticipantDetail.tsx`, `consent-sign/index.ts`

### 3. Seção obrigatória de riscos do ambiente virtual (Art. 2.1-I)
- Adicionar ao `defaultSections` do `ConsentBuilder.tsx` uma nova seção padrão: **"Riscos do Ambiente Virtual"** com template pré-preenchido descrevendo riscos de privacidade digital, interceptação de dados, falhas tecnológicas, e medidas de segurança adotadas
- Marcar esta seção com flag `is_required: true` para que não possa ser removida

**Arquivos:** `ConsentBuilder.tsx`

### 4. Contato do pesquisador visível durante consentimento (Art. 2.2-V/VI)
- Salvar dados de contato do pesquisador na tabela `study_consents` (novos campos: `researcher_name`, `researcher_email`, `researcher_phone`, `contact_hours`)
- Exibir card de contato no `ConsentRespond.tsx` com informações do pesquisador, horários de atendimento e formas de contato (e-mail, telefone, vídeo)
- Card visível em TODAS as etapas do consentimento (não apenas na assinatura)

**Arquivos:** migração SQL, `ConsentBuilder.tsx` (campos de configuração), `ConsentRespond.tsx` (exibição)

### 5. Exportação de rascunho para CEP (Art. 4.3-8)
- Adicionar botão **"Exportar Rascunho para CEP"** no `ComplianceDocuments.tsx`
- Gera documento com marca d'água "[RASCUNHO - PARA APRECIAÇÃO DO CEP]" contendo: texto completo do TCLE, link de acesso que será dado ao participante, formato idêntico ao que o participante verá
- Texto copiável (requisito do Art. 5.3)

**Arquivos:** `ComplianceDocuments.tsx`

### 6. Aviso de privacidade do local (Art. 2.2-VII)
- Adicionar tela/aviso **antes** da primeira seção do TCLE no `ConsentRespond.tsx`
- Texto: "Antes de prosseguir, certifique-se de que você está em um local privado e seguro para ler este documento e formalizar seu consentimento. O sigilo e a confidencialidade das informações dependem também da segurança do ambiente onde você se encontra."
- Checkbox obrigatório: "Confirmo que estou em local seguro e privado"

**Arquivos:** `ConsentRespond.tsx`

### 7. Garantia de acesso em papel (Art. 2.3-I)
- Adicionar no `ConsentRespond.tsx` um aviso informando que o participante pode solicitar versão em papel
- Adicionar no `ConsentBuilder.tsx` campo para o pesquisador informar endereço/contato para solicitação de via em papel
- Incluir essa informação no e-mail e PDF enviados ao participante

**Arquivos:** `ConsentBuilder.tsx`, `ConsentRespond.tsx`, `consent-sign/index.ts`

---

## Migração SQL necessária

```sql
-- Campos para co-assinatura do pesquisador
ALTER TABLE consent_signatures ADD COLUMN researcher_name TEXT;
ALTER TABLE consent_signatures ADD COLUMN researcher_signed_at TIMESTAMPTZ;
ALTER TABLE consent_signatures ADD COLUMN researcher_ip TEXT;

-- Campos de contato do pesquisador no TCLE
ALTER TABLE study_consents ADD COLUMN researcher_name TEXT;
ALTER TABLE study_consents ADD COLUMN researcher_email TEXT;
ALTER TABLE study_consents ADD COLUMN researcher_phone TEXT;
ALTER TABLE study_consents ADD COLUMN contact_hours TEXT;
ALTER TABLE study_consents ADD COLUMN paper_access_info TEXT;
```

---

## Resumo de arquivos

**Novos:**
- `src/pages/ConsentRevoke.tsx`
- `supabase/functions/consent-revoke/index.ts`

**Modificados:**
- `supabase/functions/consent-sign/index.ts`
- `src/components/survey/consent/ConsentRespond.tsx`
- `src/components/survey/consent/ConsentBuilder.tsx`
- `src/components/survey/ecrf/ParticipantDetail.tsx`
- `src/components/survey/compliance/ComplianceDocuments.tsx`
- `src/App.tsx`
- `supabase/config.toml`
- `src/integrations/supabase/types.ts`
- Migração SQL

