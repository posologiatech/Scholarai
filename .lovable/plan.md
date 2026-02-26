

## Problema Identificado

A triagem esta excluindo a maioria dos artigos por dois motivos principais:

1. **Artigos sem abstract**: Muitos artigos coletados das APIs nao possuem abstract. Quando o abstract esta vazio ("No abstract available"), a IA nao consegue avaliar os criterios e marca tudo como "no", resultando em exclusao automatica.

2. **Prompt de triagem muito rigoroso**: O prompt atual trata a falta de informacao como motivo de exclusao. Em revisoes sistematicas, a triagem inicial deve ser **inclusiva** -- na duvida, o artigo deve ser incluido (principio da sensibilidade sobre especificidade).

3. **Criterios gerados muito restritivos**: Os criterios auto-gerados podem ser muito especificos, causando exclusoes desnecessarias.

## Solucao Proposta

### 1. Melhorar o prompt de triagem (`screen-papers/index.ts`)

- Instruir a IA a seguir o principio de **inclusao na duvida**: se o abstract nao contem informacao suficiente para excluir, a resposta deve ser "maybe" ou "yes", nunca "no"
- Artigos sem abstract devem automaticamente receber recomendacao "maybe" (nao "exclude")
- Ajustar o limiar: so excluir quando o artigo e **claramente** irrelevante para a pergunta de pesquisa

### 2. Tratar "maybe" como inclusao no frontend (`StepScreening.tsx`)

- Atualmente so artigos com `recommendation === "include"` sao incluidos
- Mudar para incluir tanto "include" quanto "maybe" na contagem de artigos incluidos
- Isso segue a pratica padrao de revisoes sistematicas onde artigos duvidosos passam para a fase seguinte

### 3. Melhorar os criterios gerados (`generate-screening-criteria/index.ts`)

- Ajustar o prompt para gerar criterios mais amplos e com foco em relevancia tematica geral
- Reduzir de 5-8 para 3-5 criterios para evitar exclusoes multiplas

## Detalhes Tecnicos

**`supabase/functions/screen-papers/index.ts`**: Reescrever o system prompt para:
- Explicitar que a triagem deve ser inclusiva (sensibilidade > especificidade)
- Artigos sem abstract devem receber score >= 0.5 e recomendacao "maybe"
- So excluir quando o titulo claramente indica irrelevancia total

**`src/components/app/systematic-review/StepScreening.tsx`**: Alterar a logica de inclusao (linhas 145-148 e 192-195) para incluir artigos com recomendacao "include" OU "maybe".

**`supabase/functions/generate-screening-criteria/index.ts`**: Reduzir criterios para 3-5 e instruir que sejam amplos.

Ambas as edge functions serao reimplantadas apos as alteracoes.

