

## Plano: Sistema de Consentimento de Cookies (LGPD/GDPR)

### Visão Geral

Implementar um banner de consentimento de cookies com categorização, persistência da escolha do usuário, e uso estratégico dos dados coletados para melhorar a experiência na plataforma.

---

### Categorias de Cookies

| Categoria | Descrição | Obrigatório? |
|-----------|-----------|--------------|
| **Essenciais** | Sessão Supabase, preferência de idioma, estado do sidebar | Sim (sempre ativo) |
| **Funcionais** | Buscas recentes, onboarding concluído, preferências de UI | Opcional |
| **Analíticos** | Páginas visitadas, tempo de sessão, funcionalidades usadas, origem do tráfego | Opcional |

---

### Componentes a Criar

1. **`src/hooks/useCookieConsent.ts`** — Zustand store para gerenciar o estado do consentimento (salvo em localStorage). Expõe funções como `acceptAll()`, `rejectAll()`, `setCategory(cat, bool)`, e `hasConsent(category)`.

2. **`src/components/app/CookieBanner.tsx`** — Banner fixo no rodapé com:
   - Texto explicativo bilíngue (PT/EN)
   - Botão "Aceitar todos"
   - Botão "Apenas essenciais"
   - Botão "Personalizar" que abre modal com toggles por categoria
   - Link para a página de Privacidade

3. **`src/components/app/CookieSettingsDialog.tsx`** — Modal com toggles para cada categoria, descrição do que cada uma coleta, e botão salvar.

4. **`src/lib/analytics.ts`** — Módulo de analytics leve que só coleta dados se o usuário consentiu com cookies analíticos. Registra eventos no Supabase (tabela `analytics_events`).

---

### Integração no Sistema

- O `CookieBanner` será adicionado no `App.tsx`, visível em todas as páginas.
- O banner só aparece se o usuário ainda não fez uma escolha.
- Um link "Configurações de Cookies" será adicionado no Footer para reabrir as preferências.

---

### Como Usar os Dados a Seu Favor

**Se o usuário consentir com cookies analíticos**, o sistema registrará:

| Evento | Uso Estratégico |
|--------|-----------------|
| Páginas visitadas | Identificar quais funcionalidades são mais usadas |
| Termos de busca | Entender temas de pesquisa em alta |
| Tempo por funcionalidade | Priorizar melhorias onde usuários passam mais tempo |
| Funil de conversão | Medir onde usuários abandonam (signup → busca → extração) |
| Origem do acesso | Saber de onde vêm os usuários (blog, direto, referral) |

Esses dados serão acessíveis no painel Admin existente, com um novo dashboard de analytics.

---

### Tabela Supabase

```sql
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  page_path text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
alter table public.analytics_events enable row level security;
```

---

### Alterações em Arquivos Existentes

- **`src/App.tsx`** — Adicionar `<CookieBanner />` 
- **`src/components/landing/Footer.tsx`** — Adicionar link "Configurações de Cookies"
- **`src/pages/Privacy.tsx`** — Expandir seção de Cookies com detalhes das categorias
- **`src/i18n/translations.ts`** — Adicionar chaves de tradução para banner e modal
- **`src/pages/Admin.tsx`** — Adicionar aba de Analytics (se consentido)

---

### Arquivos Novos

- `src/hooks/useCookieConsent.ts`
- `src/components/app/CookieBanner.tsx`
- `src/components/app/CookieSettingsDialog.tsx`
- `src/lib/analytics.ts`

