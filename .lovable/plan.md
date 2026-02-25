

# Etapas Pendentes - Melhoria de UX

Dos 10 itens identificados no plano original, **8 ja foram implementados**. Restam 2 melhorias de fluxo:

---

## 1. Wizard Visual na Pagina de Extracao (PDF)

**Problema atual**: A pagina de Extracao exige 4 passos (upload PDFs, pergunta de pesquisa, colunas, extrair) mas nao orienta o usuario sobre a sequencia.

**Solucao**: Adicionar um indicador de steps no topo da pagina:

```text
[1. Upload PDFs] --> [2. Pergunta] --> [3. Colunas] --> [4. Extrair]
     ativo           desativado       desativado       desativado
```

- Cada step fica destacado conforme o usuario completa a etapa anterior
- Steps anteriores ficam com checkmark verde
- Step atual fica destacado com cor primaria
- Steps futuros ficam em cinza

**Arquivo modificado**: `src/pages/Extraction.tsx`
- Adicionar componente de steps no topo (inline, sem criar arquivo separado)
- Calcular step atual com base no estado: PDFs carregados? Pergunta preenchida? Colunas definidas?

---

## 2. Indicadores de Progresso Detalhados na Busca

**Problema atual**: Durante a busca no SearchResults, o usuario ve apenas um spinner generico sem saber o que esta acontecendo.

**Solucao**: Substituir o spinner simples por indicadores contextuais:

- Durante busca: mostrar texto "Buscando em Semantic Scholar, PubMed, OpenAlex..." com animacao
- Durante extracao de colunas: mostrar progress bar com "Extraindo coluna 2 de 4: Metodologia"

**Arquivo modificado**: `src/pages/SearchResults.tsx`
- Melhorar a area de loading com mensagens de status mais descritivas
- Adicionar progress bar (componente ja existente em `ui/progress.tsx`) para extracao de colunas

---

## 3. Traducoes

**Arquivo modificado**: `src/i18n/translations.ts`
- Adicionar textos para os steps da extracao e mensagens de progresso da busca

---

## Resumo

| Item | Status |
|------|--------|
| Menu mobile | Feito |
| Onboarding modal | Feito |
| Dashboard quick actions | Feito |
| Prompt chips (Ilustracoes) | Feito |
| Empty states com CTAs | Feito |
| Landing page atualizada | Feito |
| Reports no Supabase | Feito |
| Reference Check corrigido | Feito |
| **Wizard na Extracao** | **Pendente** |
| **Progresso na Busca** | **Pendente** |

Apos implementar esses 2 itens, o plano de melhoria de UX estara 100% concluido.

