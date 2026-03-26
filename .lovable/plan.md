

# Declaração de Uso de IA no Módulo de Escrita Científica

## Contexto

Editoras como Elsevier, Nature/Springer, SciELO e instituições como CNPq exigem cada vez mais a declaração transparente do uso de IA generativa em artigos científicos. O módulo de escrita já usa IA extensivamente (geração de rascunhos, reformulação, peer review simulado, etc.), então é essencial rastrear automaticamente esse uso e gerar a declaração adequada.

## Funcionalidade Proposta

### 1. Rastreamento Automático de Uso de IA

Cada vez que o pesquisador usar uma ação de IA (gerar rascunho, reformular, continuar, etc.), o sistema registra automaticamente em um estado local:
- Ação realizada (ex: "draft_section", "rephrase", "peer_review")
- Seção do artigo onde foi usada
- Timestamp
- Modelo/ferramenta implícita (o sistema usa IA via backend)

Nenhuma intervenção manual do pesquisador para registrar -- é transparente.

### 2. Gerador de Declaração de IA

Um novo botão "Declaração IA" na toolbar (grupo separado, com ícone de escudo/certificado), que abre um Dialog/painel com:

**Formulário configurável:**
- Seletor de modelo/ferramenta (pré-preenchido: ex. "GPT-4o via Arca Research", com opção de adicionar outros manualmente como "ChatGPT", "Claude", "Gemini")
- Checkboxes de finalidade (pré-marcados baseado no uso real): Brainstorming, Rascunho de texto, Revisão/reformulação, Tradução, Resumo/Abstract, Análise de dados, Peer review simulado, Correção de hedging, Geração de highlights
- Campo de texto para detalhes adicionais
- Seletor de idioma da declaração (PT-BR / EN)
- Seletor de formato/editora: Genérico, Elsevier, Nature/Springer, SciELO, ABNT

**Saída gerada:**
- Texto da declaração formatado conforme a editora selecionada, seguindo o template padrão
- Botão para copiar e botão para inserir no editor
- Preview da declaração antes de inserir

### 3. Templates por Editora

Cada editora tem requisitos ligeiramente diferentes:

- **Elsevier**: Declaração na seção "Declaration of Generative AI and AI-assisted technologies in the writing process". IA não pode ser listada como autor.
- **Nature/Springer**: Declaração no Methods ou Acknowledgements. Transparência sobre como a IA foi usada.
- **SciELO**: Declaração explícita com responsabilidade do autor humano.
- **Genérico (COPE/ICMJE)**: Template adaptável para qualquer periódico.

### 4. Design (estética premium do módulo)

- Botão na toolbar com ícone de escudo (ShieldAlert ou similar), gradiente verde/teal para diferenciar dos grupos "Escrita" (azul) e "Revisão" (roxo)
- Dialog com cabeçalho gradient, glassmorphism, cards de finalidade com checkboxes estilizados
- Preview da declaração em card com borda gradient e tipografia serif
- Badge no botão indicando quantas ações de IA foram usadas no documento atual

### 5. Persistência

O registro de uso de IA será salvo junto com o documento na tabela `writing_documents`, usando o campo `metadata` (jsonb) já existente -- não precisa de nova tabela nem migração.

Estrutura no metadata:
```json
{
  "ai_usage": [
    { "action": "draft_section", "section": "Introduction", "timestamp": "..." },
    { "action": "rephrase", "section": "Discussion", "timestamp": "..." }
  ],
  "ai_declaration": {
    "tools": ["GPT-4o via Arca Research"],
    "purposes": ["draft", "rephrase"],
    "language": "pt",
    "publisher_format": "elsevier"
  }
}
```

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/WritingAssistant.tsx` | Estado de rastreamento de IA; registro automático a cada chamada `streamAI`; botão "Declaração IA" na toolbar; Dialog com formulário e preview; lógica de geração de texto da declaração; inserção no editor; persistência via campo `metadata` |

## Detalhes Técnicos

- Zero migração de banco -- usa campo `metadata` (jsonb) já existente em `writing_documents`
- A geração da declaração é feita localmente (templates pré-definidos com interpolação), sem chamada extra à IA -- a declaração deve ser determinística e verificável
- O rastreamento acontece dentro do callback `streamAI` existente, adicionando ao array `aiUsageLog` no state
- O `saveDocument` já salva `metadata`, bastando incluir o log de IA nele
- Templates em PT-BR e EN, selecionáveis pelo pesquisador

