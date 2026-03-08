

## Plano de Monetização — ScholarAI / Arca Research

### Contexto

O sistema possui 12+ funcionalidades de alto valor (busca semântica, revisão sistemática, DataMind, Knowledge Graph, ilustrações, meta-análise, surveys, etc.) e já menciona "planos pagos" no FAQ sem implementação real. Não há nenhuma infraestrutura de pagamento ou gating de features atualmente.

---

### Modelo de Planos Proposto

| | **Free** | **Pro** (R$49/mês) | **Team** (R$89/mês/usuário) | **Enterprise** (sob consulta) |
|---|---|---|---|---|
| Buscas semânticas | 20/mês | Ilimitadas | Ilimitadas | Ilimitadas |
| Papers na biblioteca | 50 | 500 | Ilimitado | Ilimitado |
| Extrações AI/mês | 5 | 100 | 300 | Ilimitado |
| Revisões sistemáticas | 1 ativa | 5 ativas | Ilimitadas | Ilimitadas |
| DataMind (chat AI) | 10 msgs/mês | 200 msgs/mês | 500 msgs/mês | Ilimitado |
| Resumo com IA | 3/mês | Ilimitado | Ilimitado | Ilimitado |
| Workspaces | 1 | 5 | Ilimitados | Ilimitados |
| Colaboradores | — | — | Até 20 | Ilimitado |
| Knowledge Graph | — | Sim | Sim | Sim |
| Meta-análise | — | Sim | Sim | Sim |
| Ilustrações AI | — | 10/mês | 30/mês | Ilimitado |
| Alertas de literatura | — | 3 | 10 | Ilimitado |
| Suporte | Comunidade | Email | Prioritário | Dedicado |
| API access | — | — | — | Sim |

---

### Implementação Técnica

#### 1. Infraestrutura de Pagamentos (Stripe)
- Ativar integração Stripe do Lovable
- Criar 3 produtos (Pro, Team, Enterprise) com preços mensais e anuais (desconto 20%)
- Criar Edge Function para checkout e webhooks
- Tabela `subscriptions` no Supabase para rastrear plano ativo

#### 2. Tabela de Limites e Uso
```sql
-- Rastrear uso por feature
create table public.usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  feature text not null, -- 'search', 'extraction', 'datamind_chat', etc.
  period text not null,  -- '2026-03'
  count int default 0,
  unique(user_id, feature, period)
);

-- Plano do usuário
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  plan text default 'free', -- 'free', 'pro', 'team', 'enterprise'
  stripe_customer_id text,
  stripe_subscription_id text,
  status text default 'active',
  current_period_end timestamptz,
  created_at timestamptz default now()
);
```

#### 3. Hook de Gating — `useSubscription`
- Hook que lê o plano atual e os limites de uso
- Função `canUse(feature)` que verifica se o usuário atingiu o limite
- Componente `<UpgradeGate feature="knowledge_graph" />` para bloquear features premium

#### 4. Página de Pricing (`/pricing`)
- Cards com os 4 planos lado a lado
- Toggle mensal/anual
- Botões de checkout integrados ao Stripe
- Highlight no plano "Pro" como recomendado
- Bilíngue (PT/EN)

#### 5. Paywall UX
- Quando o limite é atingido, mostrar modal elegante com:
  - Quanto já usou vs. limite
  - Benefícios do upgrade
  - Botão direto para checkout
- Features bloqueadas mostram ícone de cadeado com tooltip "Pro"

#### 6. Portal do Cliente
- Página `/account/billing` para gerenciar assinatura
- Histórico de faturas, cancelamento, troca de plano
- Integração com Stripe Customer Portal

---

### Alterações em Arquivos Existentes

- **`src/App.tsx`** — Adicionar rotas `/pricing` e `/account/billing`
- **`src/components/landing/Header.tsx`** — Adicionar link "Preços" no menu
- **`src/components/landing/CTASection.tsx`** — Redirecionar para `/pricing`
- **`src/pages/FAQ.tsx`** — Atualizar resposta sobre preços
- **`src/components/app/AppSidebar.tsx`** — Mostrar badge do plano e uso
- Edge functions que consomem AI — Incrementar `usage_tracking`

### Novos Arquivos

- `src/pages/Pricing.tsx`
- `src/pages/AccountBilling.tsx`
- `src/hooks/useSubscription.ts`
- `src/components/app/UpgradeGate.tsx`
- `src/components/app/UsageMeter.tsx`
- `supabase/functions/stripe-checkout/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- Migration para tabelas `subscriptions` e `usage_tracking`

---

### Estratégia de Receita Adicional

Com os dados de **cookies analytics** já implementados, você poderá:

1. **Identificar features mais usadas** → justificar o que colocar no paywall
2. **Medir funil de conversão** → signup → uso gratuito → hit de limite → upgrade
3. **Ajustar limites** → se 80% dos free users usam <10 buscas, o limite de 20 é generoso o suficiente

---

### Ordem de Implementação Sugerida

1. Ativar Stripe + criar produtos
2. Criar tabelas `subscriptions` e `usage_tracking`
3. Implementar página `/pricing`
4. Criar `useSubscription` hook + `UpgradeGate`
5. Integrar gating nas features premium
6. Portal de billing

