

# ScholarAI — Plataforma de Pesquisa Acadêmica com IA

## Visão Geral
Construir um site institucional de marketing completo + a estrutura inicial do aplicativo web (autenticação, dashboard e busca básica), com suporte bilíngue (PT-BR / EN).

---

## Fase 1: Site Institucional (Marketing)

### 1.1 Landing Page / Home
- **Hero Section** com proposta de valor ("IA para Pesquisa Científica"), barra de busca decorativa e CTA "Comece Gratuitamente"
- **Prova social** com logos de universidades e estatísticas de uso
- **Seções de features**: Busca Semântica, Tabela de Extração, Relatórios por IA, Revisão Sistemática
- **Footer** com links institucionais

### 1.2 Páginas de Soluções
- Página dedicada para cada recurso principal (Busca de Artigos, Revisão Sistemática, Alertas, Relatórios)
- Explicações visuais com ilustrações e exemplos de uso

### 1.3 Páginas por Público-alvo
- Farmacêutica, Academia, Tecnologia Médica, Governo
- Exemplos de aplicação e benefícios para cada setor

### 1.4 Casos de Uso
- Estudos de caso fictícios mas realistas mostrando economia de tempo e precisão

### 1.5 Recursos e Suporte
- FAQ / Central de Ajuda
- Página "Sobre a Equipe"

### 1.6 Páginas Legais
- Termos de Serviço
- Política de Privacidade

---

## Fase 2: Infraestrutura do App

### 2.1 Sistema de Internacionalização (i18n)
- Seletor de idioma (PT-BR / EN) no header
- Todas as strings traduzidas via sistema de localização

### 2.2 Autenticação
- Login e Cadastro via email (Supabase Auth)
- Login com Google
- Recuperação de senha
- Proteção de rotas do app

### 2.3 Dashboard / Workspace
- Interface limpa com barra de busca central ("Qual sua pergunta de pesquisa?")
- Histórico de buscas recentes
- Atalhos para projetos salvos (estrutura visual, funcionalidade futura)

### 2.4 Busca Básica de Papers
- Campo de busca semântica
- Integração via Edge Functions com **Semantic Scholar API** e **PubMed/NCBI API**
- Resultados combinados em lista unificada
- Uso do **Google Gemini** (via Lovable AI Gateway) para gerar resumo/síntese dos top resultados

### 2.5 Página de Resultados
- **Súmula de IA** no topo respondendo à pergunta
- **Lista de artigos** com título, autores, ano, abstract
- Filtros básicos: ano, tipo de estudo, fonte (Semantic Scholar / PubMed)
- Estrutura de tabela preparada para colunas customizáveis (funcionalidade avançada futura)

---

## Fase 3: Funcionalidades Futuras (não implementadas agora, mas a arquitetura estará preparada)
- Extração de dados em colunas customizáveis
- Visualizador de PDF com chat integrado
- Biblioteca pessoal e upload de PDFs
- Gerador de relatórios / revisão sistemática
- Alertas inteligentes
- Exportação (CSV, BibTeX, RIS)
- Sistema de pagamentos

---

## Design e UX
- Design moderno e limpo inspirado no Elicit (baseado nas screenshots enviadas)
- Cores neutras com acentos em azul/roxo para transmitir confiança acadêmica
- Tipografia clara e espaçamento generoso para leitura confortável
- Responsivo para desktop e mobile
- Navegação principal com logo, links de soluções, idioma e CTA de login

