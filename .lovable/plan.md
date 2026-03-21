

# Plano: Sistema de Integridade e Rastreabilidade de Dados nos Formulários de Pesquisa

## Problema
Atualmente, as respostas dos surveys (`survey_answers`) são imutáveis na prática (sem UPDATE policy), mas não existe:
- Hash criptográfico para provar que um dado não foi adulterado
- Histórico de versões caso uma resposta precise ser editada (ex: correção de erro de digitação pelo pesquisador)
- Trilha de auditoria granular vinculada a cada resposta individual
- Selo de integridade verificável para exportação e auditoria ética (CEP/CONEP)

## Arquitetura

```text
┌─────────────────────────────────────────────────┐
│  Resposta submetida (survey-respond)            │
│                                                 │
│  1. Gera hash SHA-256 de cada answer            │
│  2. Gera hash do response completo (chain)      │
│  3. Salva hash + timestamp no registro          │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  Pesquisador edita uma resposta (UI)            │
│                                                 │
│  1. Copia valor anterior p/ survey_answer_audit │
│  2. Atualiza o valor + gera novo hash           │
│  3. Registra na study_audit_log                 │
│  4. Mantém cadeia de hashes verificável         │
└─────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  Verificação de integridade (UI)                │
│                                                 │
│  Recalcula hashes e compara com armazenados     │
│  Exibe status: ✅ Íntegro | ❌ Violação         │
└─────────────────────────────────────────────────┘
```

## Implementação

### 1. Migração de banco de dados

**Nova tabela `survey_answer_audit`** -- histórico de alterações:
- `id`, `answer_id` (FK), `previous_value` (jsonb), `new_value` (jsonb), `previous_hash`, `new_hash`, `changed_by` (uuid), `change_reason` (text), `ip_address`, `created_at`
- RLS: apenas o dono do survey pode ler/inserir

**Novas colunas em `survey_answers`**:
- `integrity_hash` (text) -- SHA-256 do conteúdo da resposta
- `version` (integer, default 1)
- `last_modified_at` (timestamptz)
- `last_modified_by` (uuid)

**Nova coluna em `survey_responses`**:
- `response_hash` (text) -- SHA-256 encadeado de todos os answer hashes

**Adicionar UPDATE policy em `survey_answers`** -- apenas o dono do survey pode editar, e somente via backend.

### 2. Backend: Hash na submissão (`survey-respond`)
**Arquivo:** `supabase/functions/survey-respond/index.ts`

- Ao inserir cada answer, calcular `SHA-256(question_id + answer_text + answer_numeric + answer_choices + matrix_answers)` e salvar como `integrity_hash`
- Após inserir todas as answers, calcular hash encadeado: `SHA-256(hash1 + hash2 + ... + hashN)` e salvar como `response_hash` no `survey_responses`

### 3. Backend: Edge function para edição auditada
**Arquivo:** `supabase/functions/survey-edit-answer/index.ts`

Nova edge function que:
1. Valida JWT do pesquisador (dono do survey)
2. Busca o answer atual e salva snapshot na `survey_answer_audit`
3. Atualiza o valor + incrementa `version` + recalcula `integrity_hash`
4. Recalcula o `response_hash` do response pai
5. Registra na `study_audit_log` (ação `answer_modified`)

### 4. Backend: Verificação de integridade
**Arquivo:** `supabase/functions/survey-verify-integrity/index.ts`

Nova edge function que:
1. Recebe `response_id`
2. Recalcula todos os hashes a partir dos dados atuais
3. Compara com os hashes armazenados
4. Retorna status por answer + status global

### 5. Frontend: Painel de integridade
**Arquivo:** `src/components/survey/results/DataIntegrityPanel.tsx`

Novo componente que exibe:
- Status de integridade por resposta (verde/vermelho)
- Botão "Verificar integridade" que chama a edge function
- Histórico de alterações por answer (lido de `survey_answer_audit`)
- Contador de versão de cada answer
- Badge no `ResponseDataGrid` indicando se a resposta foi editada

### 6. Frontend: Edição auditada no grid
**Arquivo:** `src/components/survey/results/ResponseDataGrid.tsx`

- Adicionar botão de edição em cada célula do grid (ícone lápis)
- Dialog de edição que exige `change_reason` (obrigatório)
- Indicador visual de células editadas (borda colorida + tooltip com versão)

### 7. Atualizar AuditLogPanel
**Arquivo:** `src/components/survey/results/AuditLogPanel.tsx`

- Adicionar action labels para `answer_modified`, `integrity_verified`, `integrity_violation`
- Exibir detalhes do campo alterado (pergunta, valor anterior, valor novo)

## Detalhes técnicos

**Geração de hash** (no Deno edge function):
```typescript
async function hashAnswer(data: object): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**Imutabilidade**: A coluna `integrity_hash` só pode ser alterada pela edge function `survey-edit-answer` (via service_role). O UPDATE policy de `survey_answers` será restrito a `auth.role() = 'service_role'`.

## Arquivos editados/criados
1. Nova migração SQL (tabela `survey_answer_audit`, colunas em `survey_answers` e `survey_responses`)
2. `supabase/functions/survey-respond/index.ts` -- hash na submissão
3. `supabase/functions/survey-edit-answer/index.ts` -- novo
4. `supabase/functions/survey-verify-integrity/index.ts` -- novo
5. `src/components/survey/results/DataIntegrityPanel.tsx` -- novo
6. `src/components/survey/results/ResponseDataGrid.tsx` -- edição auditada
7. `src/components/survey/results/AuditLogPanel.tsx` -- novos labels
8. `src/components/survey/results/SurveyResultsPanel.tsx` -- integrar aba de integridade

