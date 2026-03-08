

## DataMind: Capacidade Estatística Nível SPSS

### Resposta Curta
Sim, é totalmente viável. O DataMind já executa Python via Pyodide (WebAssembly) no navegador, com **scipy**, **statsmodels**, **scikit-learn**, **pandas** e **numpy** pré-instalados. Essas bibliotecas cobrem praticamente todas as análises que o SPSS oferece. O que falta não é capacidade computacional, mas sim **instruções ao modelo de IA** para que ele saiba executar essas análises corretamente.

### O que o SPSS faz que já é possível hoje (bibliotecas já instaladas)

| Categoria SPSS | Equivalente Python (já disponível) |
|---|---|
| Descritivas, Frequências | pandas, scipy.stats.describe |
| Teste t (independente/pareado) | scipy.stats.ttest_ind, ttest_rel |
| ANOVA one-way/two-way | scipy.stats.f_oneway, statsmodels.stats.anova |
| Qui-quadrado | scipy.stats.chi2_contingency |
| Correlação Pearson/Spearman | scipy.stats.pearsonr, spearmanr |
| Regressão Linear/Logística | statsmodels OLS, Logit |
| Mann-Whitney, Wilcoxon, Kruskal-Wallis | scipy.stats |
| Análise de Sobrevivência (Kaplan-Meier) | Precisa instalar lifelines |
| Análise Fatorial / PCA | sklearn.decomposition.PCA, FactorAnalysis |
| Cluster Analysis | sklearn.cluster |
| Cronbach's Alpha | Cálculo manual com numpy |

### O que precisa ser feito

**1. Expandir o system prompt do datamind-chat** com um catálogo de testes estatísticos e suas implementações corretas em Python. Quando o usuário pedir um "teste t" ou "regressão logística", o modelo deve gerar código com:
- Verificação de pressupostos (normalidade via Shapiro-Wilk, homocedasticidade via Levene)
- Execução do teste
- Tabela de resultados formatada (show_table)
- Interpretação contextualizada com valores p, IC 95%, tamanho de efeito

**2. Adicionar pacote `lifelines`** ao worker para análise de sobrevivência (Kaplan-Meier, Cox regression) -- um diferencial importante vs. SPSS básico.

**3. Criar um menu de análises estatísticas** na UI com categorias (similar ao menu do SPSS: Analyze > Compare Means, Correlate, Regression, etc.) que gera prompts pré-formatados para o chat.

### Plano de implementação

**Arquivo 1: `supabase/functions/datamind-chat/index.ts`**
- Adicionar ao system prompt um bloco "CATÁLOGO DE ANÁLISES ESTATÍSTICAS" com ~15 templates de código para os testes mais comuns, incluindo verificação de pressupostos, formatação de output e interpretação
- Templates para: teste t, ANOVA, qui-quadrado, correlação, regressão linear, regressão logística, Mann-Whitney, Kruskal-Wallis, Wilcoxon, PCA, cluster, Cronbach's alpha, análise de sobrevivência

**Arquivo 2: `public/pyodide-worker.js`**
- Adicionar `lifelines` à lista de pacotes instalados via micropip

**Arquivo 3: Novo componente `src/components/datamind/DataMindStatsMenu.tsx`**
- Menu dropdown com categorias de análises estatísticas
- Ao clicar, insere um prompt pré-formatado no input do chat (ex: "Realize um teste t independente comparando [grupo1] vs [grupo2] na variável [var]")
- Categorias: Comparação de Médias, Correlação, Regressão, Testes Não-Paramétricos, Redução de Dimensionalidade, Confiabilidade, Sobrevivência

**Arquivo 4: `src/pages/DataMind.tsx`**
- Integrar o DataMindStatsMenu na barra de ferramentas

### Resumo
A infraestrutura já existe. A implementação consiste em: (1) enriquecer o prompt com templates estatísticos rigorosos, (2) adicionar o pacote lifelines, (3) criar um menu de análises na UI para facilitar o acesso.

