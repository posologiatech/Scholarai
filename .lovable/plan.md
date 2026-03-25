

# Melhorias de Rigor Científico no Módulo de Escrita

## Diagnóstico

Os prompts atuais são genéricos demais. Falta:
- Proibição explícita de fabricação de dados/citações
- Instruções de tom e estilo de pesquisador sênior
- RAG para verificar claims contra o texto real dos papers
- Revisão em múltiplas camadas (factual, estilística, estrutural)
- Novas ações especializadas (Abstract estruturado, Peer Review simulado, Hedging linguístico)

## Mudanças

### 1. Reescrever todos os System Prompts (`writing-assist/index.ts`)

Cada action ganha um prompt com regras de rigor:

```text
REGRAS INVIOLÁVEIS:
1. ZERO FABRICAÇÃO: Jamais invente dados, estatísticas, nomes de autores, títulos de artigos ou resultados experimentais.
2. CITAÇÃO VERIFICÁVEL: Cada afirmação factual DEVE ter [N] referenciando APENAS os papers fornecidos.
3. HEDGING CIENTÍFICO: Use "suggests", "indicates", "was observed" — nunca linguagem absolutista.
4. DISTINÇÃO EVIDÊNCIA vs INTERPRETAÇÃO: Separe claramente o que os dados mostram do que o autor interpreta.
5. Se um dado NÃO está nos papers fornecidos, escreva "[DADO NÃO DISPONÍVEL NAS FONTES]".
6. Ao reportar resultados numéricos, inclua sempre: valor, intervalo de confiança/desvio padrão, e tamanho amostral quando disponíveis.
```

Instruções de estilo sênior:
```text
ESTILO DE ESCRITA:
- Escreva como um pesquisador sênior com 20+ anos de publicações em periódicos de alto impacto.
- Conecte parágrafos com transições lógicas naturais (não use "Além disso", "Adicionalmente" repetidamente).
- Cada parágrafo: frase-tópico → evidência com citação → análise → transição.
- Varie a estrutura das frases. Alterne entre frases curtas incisivas e períodos compostos mais elaborados.
- Use voz ativa quando descrever suas contribuições e voz passiva para procedimentos padronizados.
- Na Discussão, sempre confronte seus resultados com a literatura existente explicitamente.
```

### 2. Integrar RAG na Escrita (`writing-assist/index.ts`)

Antes de gerar texto, buscar chunks semânticos dos papers selecionados (mesmo pipeline do `chat-papers`):
- Embeddar o prompt/seção do usuário
- Buscar top-10 chunks via `match_paper_chunks`
- Incluir os trechos reais no contexto do prompt

Isso permite que a IA cite **trechos reais** dos papers em vez de apenas metadados.

### 3. Novas Actions no Edge Function

| Action | Descrição |
|--------|-----------|
| `generate_abstract` | Gera abstract estruturado (Objetivo, Métodos, Resultados, Conclusão) a partir do artigo completo |
| `peer_review` | Simula revisão por pares: identifica pontos fracos, gaps metodológicos, sugestões de melhoria |
| `improve_hedging` | Analisa o texto e corrige linguagem absolutista para hedging científico adequado |
| `generate_highlights` | Gera "Key Findings" / "Highlights" no formato exigido por muitos periódicos |

### 4. Validação Anti-Alucinação no Backend

Após o AI gerar texto (para ações não-streaming), aplicar a mesma "Guarda Pretoriana" do `chat-papers`:
- Verificar se citações `[N]` referenciam apenas papers fornecidos
- Substituir IDs inválidos por `[?]`

Para streaming: validar no frontend antes de inserir no editor.

### 5. Novos Botões na Toolbar (`WritingAssistant.tsx`)

- **"Peer Review"**: Simula revisão por pares do texto no editor
- **"Abstract"**: Gera abstract estruturado do artigo completo
- **"Hedging"**: Corrige linguagem absolutista
- **"Highlights"**: Gera key findings

Organizar toolbar em 2 grupos visuais:
- **Escrita**: Gerar Rascunho, Continuar, Citações
- **Revisão**: Reformular, Verificar, Peer Review, Hedging

### 6. Validação de Citações no Frontend

Ao clicar "Inserir" no AI Output, verificar se todas as citações `[N]` correspondem a papers selecionados. Alertar o pesquisador se houver citações sem correspondência.

### 7. Indicador de Qualidade do Texto

Barra no rodapé do editor mostrando métricas simples:
- Contagem de citações vs. afirmações factuais (ratio)
- Presença de hedging words
- Variedade vocabular (type-token ratio simplificado)

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/writing-assist/index.ts` | Reescrever prompts com rigor; adicionar RAG; novas actions (abstract, peer_review, hedging, highlights); validação anti-alucinação |
| `src/pages/WritingAssistant.tsx` | Novos botões (Peer Review, Abstract, Hedging, Highlights); toolbar reorganizada em grupos; validação de citações no Insert; indicador de qualidade |

## Resultado Esperado

O módulo passará a:
1. Nunca fabricar dados — toda informação é rastreável aos papers fornecidos
2. Escrever com fluência de pesquisador sênior, com transições naturais e hedging adequado
3. Usar trechos reais dos papers (via RAG) em vez de apenas metadados
4. Oferecer ferramentas de revisão que simulam o processo real de peer review
5. Alertar o pesquisador sobre citações suspeitas antes de inserir no editor

