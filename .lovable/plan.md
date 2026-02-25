

# Revisao de UX e Melhorias de Fluxos do ScholarAI

## Diagnostico Atual

Apos analise completa de todas as paginas e fluxos, identifiquei os seguintes problemas de experiencia do usuario:

---

## 1. Onboarding Inexistente

**Problema**: Apos login, o usuario cai diretamente no Dashboard sem nenhuma orientacao. Nao ha tour guiado, tooltips de boas-vindas, ou explicacao de como usar a plataforma. Um pesquisador novo nao sabe por onde comecar entre as 6+ secoes do sistema (Search, Library, Extraction, Reports, Ref Check, Illustrations).

**Solucao**: Criar um fluxo de onboarding para novos usuarios:
- Detectar se e o primeiro acesso do usuario (flag `onboarding_completed` na tabela `user_approvals` ou localStorage)
- Exibir um modal/dialog de boas-vindas com 3-4 slides explicando o fluxo principal:
  1. "Pesquise artigos cientificos" (icone Search)
  2. "Extraia dados automaticamente" (icone Table)
  3. "Gere relatorios com IA" (icone FileText)
  4. "Verifique referencias" (icone Shield)
- Botao "Comecar" que fecha o modal
- Opcao de "Pular" para usuarios que ja conhecem

---

## 2. Navegacao Mobile Ausente no AppHeader

**Problema**: O `AppHeader` mostra navegacao apenas em `md:flex` (desktop). Em dispositivos moveis, os 6+ links de navegacao ficam completamente ocultos sem nenhum menu hamburger. Usuarios mobile ficam presos na pagina atual.

**Solucao**: Adicionar menu hamburger mobile ao AppHeader, similar ao que ja existe no Header da landing page. Incluir sheet/drawer lateral com todos os links de navegacao.

---

## 3. Dashboard sem Contexto para Primeiro Uso

**Problema**: O Dashboard mostra "Pesquisas recentes" vazio e um placeholder de "Projetos" sem funcionalidade. Para um usuario novo, a pagina parece vazia e sem proposito.

**Solucao**:
- Substituir o placeholder de projetos por cards de acao rapida: "Pesquisar artigos", "Enviar PDFs", "Gerar ilustracao"
- Melhorar estado vazio das pesquisas recentes com sugestoes mais proeminentes
- Adicionar indicador de progresso do onboarding (ex: "Complete 3 de 5 passos")

---

## 4. Fluxo de Busca sem Feedback Visual de Progresso

**Problema**: Na pagina SearchResults, durante a busca e extracao de colunas, o usuario ve apenas spinners genericos. Nao ha indicacao clara de "estamos buscando em 5 fontes" ou "extraindo coluna 2 de 4".

**Solucao**: Adicionar indicadores de progresso mais detalhados:
- Mostrar quais fontes estao sendo consultadas (Semantic Scholar, PubMed, etc.)
- Progress bar para extracao de colunas

---

## 5. Pagina de Extracao (PDF) sem Guia

**Problema**: A pagina Extraction exige que o usuario: (1) envie PDFs, (2) defina uma pergunta de pesquisa, (3) crie colunas de extracao, e (4) clique em extrair. Sao 4 passos sem nenhuma orientacao sobre a ordem ou o que cada campo espera.

**Solucao**: Adicionar steps/wizard visual mostrando a sequencia:
- Step 1: "Envie seus PDFs"
- Step 2: "Defina sua pergunta de pesquisa"
- Step 3: "Configure as colunas de extracao"
- Step 4: "Extraia os dados"
- Incluir exemplos pre-preenchidos como placeholders

---

## 6. Relatarios Salvos em localStorage

**Problema**: A pagina Reports salva relatorios gerados em `localStorage`. Isso significa que os relatorios se perdem ao trocar de navegador/dispositivo ou limpar cache. Dado que relatorios sao o output principal de valor da plataforma, isso e critico.

**Solucao**: Criar tabela `reports` no Supabase para persistir relatorios no banco de dados com RLS por usuario.

---

## 7. Ilustracoes sem Exemplos de Prompt

**Problema**: A pagina de Ilustracoes tem apenas um textarea vazio. O usuario nao sabe que tipo de prompt gera bons resultados.

**Solucao**: Adicionar chips de exemplos clicaveis abaixo do textarea:
- "Diagrama da replicacao do SARS-CoV-2"
- "Ciclo de Krebs com enzimas"
- "Sinapse neuronal com neurotransmissores"

---

## 8. Reference Check Limitado a Texto

**Problema**: O Reference Check aceita arquivos mas le com `file.text()`, que so funciona para TXT. PDFs nao serao lidos corretamente, apesar do UI sugerir que aceita PDFs.

**Solucao**: Remover "PDF" da mensagem de aceite ou integrar leitura real de PDF (via edge function existente `extract-pdf`).

---

## 9. Landing Page sem Mencionar Features Novas

**Problema**: A FeaturesSection mostra apenas 4 features (Search, Extraction, Reports, Review) mas o sistema agora tem Ilustracoes IA e Reference Check. Novos usuarios nao sabem que essas features existem.

**Solucao**: Adicionar cards para Ilustracoes e Reference Check na FeaturesSection.

---

## 10. Falta de Empty States Acessiveis

**Problema**: Varias paginas (Library, Reports) tem empty states que apenas dizem "nada aqui" sem call-to-action claro para o proximo passo.

**Solucao**: Melhorar empty states com botoes de acao direta:
- Library vazia: botao "Fazer sua primeira pesquisa"
- Reports vazio: botao "Ir para a biblioteca"

---

## Plano de Implementacao

### Prioridade 1 - Critico para UX
1. **Menu mobile no AppHeader** - Adicionar hamburger menu com Sheet/Drawer
2. **Onboarding modal** - Criar componente `OnboardingDialog` com slides de boas-vindas
3. **Dashboard quick actions** - Substituir placeholder de projetos por cards de acao

### Prioridade 2 - Melhoria de Fluxo
4. **Exemplos de prompt nas Ilustracoes** - Chips clicaveis
5. **Empty states com CTAs** - Library, Reports
6. **Landing page atualizada** - Adicionar features novas

### Prioridade 3 - Qualidade de Dados
7. **Persistir reports no Supabase** - Migracao SQL + refactor da pagina Reports
8. **Corrigir Reference Check** - Remover "PDF" do aceite ou integrar leitura

### Detalhamento Tecnico

**Arquivos a criar:**
- `src/components/app/OnboardingDialog.tsx` - Modal de onboarding com 4 slides
- `src/components/app/MobileNav.tsx` - Menu mobile para AppHeader

**Arquivos a modificar:**
- `src/components/app/AppHeader.tsx` - Integrar MobileNav
- `src/pages/Dashboard.tsx` - Quick action cards no lugar do placeholder
- `src/pages/Illustrations.tsx` - Adicionar chips de exemplo
- `src/pages/Library.tsx` - CTA no empty state
- `src/pages/Reports.tsx` - CTA no empty state + migrar localStorage para Supabase
- `src/pages/ReferenceCheck.tsx` - Corrigir aceite de arquivos
- `src/components/landing/FeaturesSection.tsx` - Adicionar 2 features
- `src/i18n/translations.ts` - Novas traducoes

**Migracao SQL (se aprovado item 7):**
- Tabela `reports` com `id`, `user_id`, `title`, `content`, `search_id`, `created_at`
- RLS para acesso por usuario

