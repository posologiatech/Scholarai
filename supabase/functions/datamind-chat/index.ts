import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, estimateCostUsd, logFlatCost } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";
import { trackUsage } from "../_shared/usage-tracker.ts";
import { checkPlanLimit, planLimitExceededResponse } from "../_shared/plan-limits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Safety net for when no real dataframe exists: catches the model narrating a data table
// or a case-count series in prose even after being instructed not to.
function looksLikeFabricatedData(text: string): boolean {
  const lines = text.split("\n");
  const pipeTableRows = lines.filter((l) => /^\s*\|.*\|.*\|\s*$/.test(l)).length;
  if (pipeTableRows >= 2) return true;
  const yearCountRows = lines.filter((l) => /\b(19|20)\d{2}\b\D{0,15}\d{2,}/.test(l)).length;
  if (yearCountRows >= 3) return true;
  return false;
}

/**
 * The compact dataset profile the client computes at upload time (see
 * src/lib/datamind/profile.ts). Sending it lets the model pick variables and tests
 * from real types, levels and data-quality flags instead of guessing from names.
 */
interface CompactColumn {
  name: string;
  type: string;
  missingPct: number;
  unique: number;
  role?: "id" | "constant";
  sentinels?: number[];
  levels?: { value: string; count: number }[];
  stats?: {
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    skew: number;
    outliers: number;
  };
}

interface CompactProfile {
  basedOnRows: number;
  totalRows: number;
  sampled: boolean;
  quality: number;
  duplicateRows: number;
  columns: CompactColumn[];
  correlations: { a: string; b: string; r: number; n: number }[];
  warnings: { severity: string; message: string }[];
}

interface FileSchema {
  file_name: string;
  columns: string[];
  rows?: number;
  profile?: CompactProfile;
}

/** Newline used when assembling prompt text, kept as a constant so no escape
 * sequence has to survive the template literals below. */
const NL = String.fromCharCode(10);

/** Resolved per provider by ai-caller to that provider's strongest model. */
const STRONG_MODEL = "gemini-2.5-pro";

const TYPE_LABELS: Record<string, string> = {
  numeric: "numérico",
  categorical: "categórico",
  datetime: "data",
  text: "texto",
  boolean: "booleano",
};

function describeColumn(col: CompactColumn): string {
  const bits: string[] = [`[${TYPE_LABELS[col.type] || col.type}]`];

  if (col.role === "id") bits.push("IDENTIFICADOR — não usar como variável de análise");
  if (col.role === "constant") bits.push("CONSTANTE — sem variância, inútil para análise");

  if (col.stats) {
    const s = col.stats;
    bits.push(`média=${s.mean} mediana=${s.median} dp=${s.std} min=${s.min} max=${s.max}`);
    if (Math.abs(s.skew) > 1) bits.push(`assimetria=${s.skew}`);
    if (s.outliers > 0) bits.push(`outliers=${s.outliers}`);
  }

  if (col.levels?.length) {
    bits.push(`níveis: ${col.levels.map((l) => `${l.value} (n=${l.count})`).join(", ")}`);
  } else if (!col.stats) {
    bits.push(`${col.unique} valores distintos`);
  }

  if (col.missingPct > 0) bits.push(`ausentes=${col.missingPct}%`);
  if (col.sentinels?.length) {
    bits.push(`ATENÇÃO: ${col.sentinels.join(", ")} parecem código de ausência, não medida real`);
  }

  return `  - ${col.name} ${bits.join(" | ")}`;
}

function describeProfile(profile: CompactProfile): string {
  const parts: string[] = [];

  parts.push(`Colunas (perfil calculado sobre ${profile.basedOnRows} linhas${profile.sampled ? ` de ${profile.totalRows} — é uma AMOSTRA, confirme no dataset completo antes de concluir` : ""}):`);
  parts.push(profile.columns.map(describeColumn).join(NL));

  if (profile.duplicateRows > 0) {
    parts.push(`Linhas duplicadas: ${profile.duplicateRows}`);
  }

  if (profile.warnings.length > 0) {
    parts.push(`Problemas de qualidade já detectados:
${profile.warnings.map((w) => `  - [${w.severity}] ${w.message}`).join(NL)}`);
  }

  if (profile.correlations.length > 0) {
    parts.push(`Correlações já calculadas (Pearson, pares completos):
${profile.correlations.map((c) => `  - ${c.a} x ${c.b}: r=${c.r} (n=${c.n})`).join(NL)}`);
  }

  return parts.join(NL);
}

/**
 * Passes a stream through untouched while watching for the trailing usage chunk.
 *
 * ai-caller only logs cost when it can parse a complete body, so a forwarded stream
 * would otherwise spend money invisibly — and the per-user cost ceiling reads that
 * same log. This keeps streamed DataMind calls accounted for.
 */
function costMeter(userId: string, provider?: string, model?: string): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  let tail = "";
  let tokensInput = 0;
  let tokensOutput = 0;

  return new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      try {
        // Only the tail is retained: the usage chunk is the last one, and buffering
        // the whole conversation here would defeat the point of streaming.
        tail = (tail + decoder.decode(chunk, { stream: true })).slice(-4000);
        const matches = tail.matchAll(/"usage"\s*:\s*\{[^}]*\}/g);
        for (const match of matches) {
          const usage = JSON.parse(`{${match[0]}}`).usage;
          if (usage?.prompt_tokens != null) tokensInput = usage.prompt_tokens;
          if (usage?.completion_tokens != null) tokensOutput = usage.completion_tokens;
        }
      } catch {
        // A usage object split across chunks simply gets picked up on the next one.
      }
    },
    flush() {
      if (tokensInput === 0 && tokensOutput === 0) return;
      const resolvedModel = model || STRONG_MODEL;
      logFlatCost(
        userId,
        provider || "stream",
        resolvedModel,
        "datamind_chat",
        estimateCostUsd(resolvedModel, tokensInput, tokensOutput),
      ).catch((e) => console.error("[datamind-chat] stream cost logging failed:", e));
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  if (!(await checkPlanLimit(auth.supabase, auth.userId, "datamind_chat"))) {
    return planLimitExceededResponse(corsHeaders, "datamind_chat");
  }

  try {
    const { message, history, schemas, provider, model, codeLanguage, stream, planStep } = await req.json();
    // Set when the client is running one cell of a plan the model itself proposed
    // (see src/lib/datamind/analysisPlan.ts). `final` marks the closing synthesis.
    const step: { index?: number; total?: number; final?: boolean } | null =
      planStep && typeof planStep === "object" ? planStep : null;
    const isR = codeLanguage === "r";
    const fileSchemas: FileSchema[] = Array.isArray(schemas) ? schemas : [];
    const hasData = fileSchemas.length > 0;

    // Describes each loaded dataframe and the variable name it's bound to in the sandbox,
    // so the model references real variables instead of guessing "df".
    function describeSchemas(list: FileSchema[]): string {
      if (list.length === 0) return "Nenhum arquivo enviado ainda.";

      // With a profile the model already knows types, levels, missing rates and
      // which columns to avoid — so it must not ask the researcher for any of
      // that, nor burn a run just to discover column names.
      const profileRule = list.some((f) => f.profile)
        ? `

REGRA DO PERFIL: o perfil acima foi calculado sobre os dados REAIS. Use-o para escolher variáveis e testes. NUNCA pergunte ao pesquisador algo que já está no perfil (tipo da variável, níveis de uma categórica, quantidade de ausentes). NUNCA proponha uma coluna marcada como IDENTIFICADOR ou CONSTANTE como variável de análise. Se o perfil apontar código de ausência ou assimetria forte, trate isso explicitamente no código e diga o que fez.`
        : "";

      if (list.length === 1) {
        const f = list[0];
        const header = `Arquivo "${f.file_name}" (variável: df${f.rows != null ? `, ${f.rows} linhas` : ""})`;
        const body = f.profile ? describeProfile(f.profile) : `colunas = ${JSON.stringify(f.columns)}`;
        return `${header}
${body}${profileRule}`;
      }

      const lines = list.map((f) => {
        const varName = `df_${f.file_name.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "file"}`;
        const header = `- "${f.file_name}" → variável ${varName}${f.rows != null ? ` (${f.rows} linhas)` : ""}`;
        const body = f.profile ? `
${describeProfile(f.profile)}` : `: colunas = ${JSON.stringify(f.columns)}`;
        return `${header}${body}`;
      });
      return `MÚLTIPLOS ARQUIVOS carregados nesta conversa, cada um já disponível como um dataframe separado (também acessível via dict "dfs", pela chave do nome do arquivo):\n${lines.join("\n")}\n\nREGRA DE CRUZAMENTO ENTRE ARQUIVOS: se o usuário pedir para cruzar/unir/comparar dois arquivos (join/merge), NÃO adivinhe as colunas-chave. Pergunte antes quais colunas usar para o cruzamento (mesmo padrão de "perguntar parâmetros antes de executar" usado para testes estatísticos) — a menos que o usuário já tenha especificado claramente as colunas.${profileRule}`;
    }

    const noDataSystemPrompt = `Você é o DataMind, assistente de análise de dados. Responda SEMPRE em JSON válido: {"explanation": "...", "code": null}

ESTADO ATUAL: Nenhum arquivo de dados foi carregado nesta conversa. Não existe nenhum dataframe "df" disponível — nenhuma fonte de dados real (SINAN, DataSUS, IBGE ou qualquer outra) está conectada aqui.

REGRA ABSOLUTA — PROIBIDO INVENTAR DADOS:
- É TERMINANTEMENTE PROIBIDO apresentar números, tabelas, estatísticas, contagens de casos, séries temporais ou qualquer "resultado" como se fosse real ou representativo. Isso inclui dados rotulados como "simulados", "exemplo" ou "ilustrativos" — NUNCA gere esse tipo de conteúdo, mesmo com esse rótulo.
- O campo "code" DEVE ser sempre null nesta situação.

O QUE VOCÊ PODE FAZER:
- Explicar conceitos, métodos e testes estatísticos em termos gerais, sem números específicos.
- Pedir ao pesquisador que envie um arquivo CSV/XLSX (botão de anexo) ou que importe dados reais pela página DataSUS / "Vincular a projeto".
- Se o pedido exigir dados reais que não estão disponíveis na conversa (ex: "analise os casos de X no Nordeste"), diga explicitamente que nenhum dado foi carregado e peça o upload do arquivo correspondente — não tente responder a pergunta com valores inventados.

Responda SEMPRE em português brasileiro, de forma direta e curta (3-5 linhas).`;

    const systemPrompt = !hasData ? noDataSystemPrompt : isR ? `Você é o DataMind, assistente avançado de análise de dados. Responda SEMPRE em JSON válido: {"explanation": "...", "code": "..."}

REGRAS CRÍTICAS DO CÓDIGO R:
- Os dataframes JÁ estão carregados (ver variáveis abaixo) — NUNCA use read.csv/read.xlsx
- Com um único arquivo, a variável é "df". Com múltiplos arquivos, cada um vira "df_<nome>" (ver lista abaixo) e todos também estão no dict "dfs"
- SEMPRE comece imprimindo as colunas do(s) dataframe(s) usado(s): print(paste("Colunas:", paste(colnames(df), collapse=", ")))
- Use library() para carregar pacotes necessários (já disponíveis: dplyr, ggplot2, tidyr, stats)
- Para gráficos exploratórios simples (barra, linha, pizza, área): use show_chart(data, kind="bar"|"line"|"pie"|"area", x="coluna_x", y="coluna_y", title="...") — já disponível globalmente, renderiza um gráfico interativo na UI
- Para gráficos estatísticos (dispersão com regressão, boxplot, densidade): use ggplot2 com print(p) após cada gráfico
- Para tabelas: use print(df_resultado) — tabelas serão capturadas automaticamente
- NUNCA use install.packages() — os pacotes já estão instalados
- Use cat() ou print() para texto explicativo
- Títulos em português
- Interprete resultados com valores concretos
- Seja conciso: 3-8 linhas no explanation

Campo "explanation": texto curto descrevendo a análise. NÃO inclua resultados.
Campo "code": código R completo. Null se não precisar.

REGRA OBRIGATÓRIA — PERGUNTAR PARÂMETROS ANTES DE EXECUTAR:
Quando o usuário solicitar QUALQUER análise estatística que exija parâmetros (variável dependente, independente, grupos, etc.), NÃO execute código imediatamente. Retorne "code": null e no "explanation" pergunte ao pesquisador quais variáveis usar, listando as colunas disponíveis do dataset organizadas por tipo (numéricas vs categóricas). SOMENTE execute quando o usuário confirmar os parâmetros. Se o usuário já especificou as variáveis claramente, execute diretamente. Para análise descritiva exploratória, execute sem perguntar.

${describeSchemas(fileSchemas)}

Responda SEMPRE em português brasileiro.`
    : `Você é o DataMind, assistente avançado de análise de dados (estilo Julius.ai). Responda SEMPRE em JSON válido: {"explanation": "...", "code": "..."}

REGRAS CRÍTICAS DO CÓDIGO PYTHON:
- SEMPRE use f-strings para formatação (NUNCA use .format() — causa erros no Pyodide)
- NUNCA assuma nomes de colunas — SEMPRE use df.columns para descobrir os nomes reais antes de referenciá-los
- No INÍCIO de todo código, imprima as colunas: print(f"Colunas: {list(df.columns)}")
- Use df.select_dtypes() para separar numéricas e categóricas em vez de adivinhar nomes
- Sempre verifique se variáveis existem antes de usá-las
- Os dataframes JÁ estão carregados (ver variáveis na seção de schema abaixo) — NUNCA use pd.read_csv/read_excel
- Com um único arquivo, a variável é "df". Com múltiplos arquivos, cada um vira "df_<nome>" e todos também estão no dict "dfs" (chave = nome do arquivo)
- CRUZAMENTO ENTRE ARQUIVOS: para unir dois dataframes use pd.merge(df_a, df_b, left_on=..., right_on=..., how=...) — só depois que o usuário confirmar as colunas-chave (ver regra de schema abaixo)
- Use plt.show() após CADA gráfico (capturados automaticamente)
- NÃO use plt.savefig()
- Importe: import seaborn as sns, import matplotlib.pyplot as plt, import pandas as pd, import numpy as np
- PARA EXIBIR TABELAS: use show_table(df_resultado, "Título da tabela") — esta função já está disponível globalmente
- NUNCA use print(df.to_string()) — SEMPRE use show_table(df, "título") para DataFrames
- show_table() renderiza a tabela como uma planilha interativa profissional na UI
- PARA GRÁFICOS EXPLORATÓRIOS (barra, linha, pizza, área — comparação, proporção, tendência): use show_chart(df_resultado, kind="bar", x="coluna_x", y="coluna_y", title="...") em vez de plt.bar/plt.pie — já disponível globalmente, renderiza um gráfico interativo (zoom/hover) na UI
- RESERVE matplotlib/seaborn (plt.show()) para gráficos estatísticos que show_chart não cobre: heatmap de correlação, boxplot, histograma com curva, curva ROC, Kaplan-Meier
- Use print() APENAS para texto explicativo, interpretações e resumos
- REGRA DE SINTAXE PYTHON: Para textos longos com aspas, SEMPRE use variáveis intermediárias ou triple-quotes. NUNCA coloque textos longos diretamente dentro de print("..."). Exemplo correto:
  interp = (
      "A idade média é 62.3 anos. "
      "Os pacientes apresentam predominância de uso de anti-hipertensivos."
  )
  print(f"\\nInterpretação: {interp}")
- Antes de cada seção de resultados, imprima um cabeçalho claro com print()
- NÃO use separadores decorativos como "---" ou "==="
- Após cada grupo de resultados, imprima uma INTERPRETAÇÃO CONTEXTUALIZADA sobre os DADOS REAIS do pesquisador
- plt.figure(figsize=(10,6)) + plt.tight_layout() antes de plt.show()
- EIXOS LEGÍVEIS: Quando houver muitas categorias no eixo X (>10), SEMPRE use plt.xticks(rotation=45, ha='right', fontsize=8) ou plt.xticks(rotation=90, fontsize=7). Para >30 categorias, considere mostrar apenas as top 15-20 mais relevantes ou usar um gráfico horizontal (barh). NUNCA deixe labels sobrepostos e ilegíveis.
- Títulos dos gráficos em português
- Cores vibrantes: sns.color_palette("husl"), "Set2", "viridis"
- NO MÁXIMO 5-6 gráficos por análise

QUANDO PEDIREM ANÁLISE DESCRITIVA, o código DEVE seguir esta estrutura EXATA:

1. HEAD DO DATASET:
   show_table(df.head(), "Head do dataset (primeiras linhas)")

2. ESTATÍSTICAS NUMÉRICAS (para cada coluna numérica relevante):
   - Tratar valores especiais (999, -1, etc) como missing
   - show_table(df_limpo.describe().T.reset_index().rename(columns={'index':'Variável'}), "Estatísticas Numéricas")
   - print("\\nInterpretação: [DESCREVA O QUE OS VALORES REAIS SIGNIFICAM — ex: 'A idade média é 62.3 anos (±14.1), indicando uma população predominantemente idosa. O valor mínimo de 18 sugere presença de pacientes jovens atípicos.']")

3. DISTRIBUIÇÃO DE CADA VARIÁVEL CATEGÓRICA (top 5-10 mais relevantes):
   - top_col = df['col'].value_counts().head(10).reset_index()
   - top_col.columns = ['COLUNA', 'count']
   - show_table(top_col, "Top 10 NOME_COLUNA (mais frequentes)")
   - print("\\nInterpretação: [EXPLIQUE O QUE A DISTRIBUIÇÃO REVELA — ex: 'Losartana domina com 312 registros (23.5%), seguida de Metformina (18.2%). A prevalência de anti-hipertensivos e antidiabéticos sugere uma amostra de pacientes crônicos polimedicados.']")

4. PROPORÇÕES IMPORTANTES (variáveis binárias/poucas categorias):
   - dist = df['col'].value_counts().reset_index()
   - dist.columns = ['Categoria', 'count']
   - show_table(dist, "Distribuição de ALTO RISCO")
   - print("\\nInterpretação: [EXPLIQUE A IMPLICAÇÃO — ex: '68% dos pacientes (892) são classificados como alto risco, o que indica que a maioria da amostra requer monitoramento farmacoterapêutico intensivo.']")

REGRA CRÍTICA SOBRE INTERPRETAÇÕES (OBRIGATÓRIA):
- NUNCA explique o método/técnica/visualização (proibido: "o heatmap mostra...", "o boxplot exibe...", "a média indica tendência central...")
- SEMPRE interpretar o ACHADO e a IMPLICAÇÃO para o estudo
- Cada interpretação deve citar pelo menos 2 valores concretos do resultado (n, %, média, mediana, min/max, coeficiente)
- Foque em: predominâncias, diferenças entre grupos, magnitude de efeito, anomalias e possível impacto científico
- Linguagem obrigatória de artigo: "Os resultados indicam...", "Observa-se...", "Esse padrão sugere..."
- Se não houver achado relevante, escreva explicitamente: "Não foi identificado padrão forte com relevância prática nesta análise."

5. GRÁFICOS (máx 5-6, os mais relevantes):
   - Barras horizontal para top categorias
   - Pie chart para proporções binárias
   - Boxplot para numéricas
   - Heatmap de correlação se 2+ numéricas
   - Histograma de distribuição
   - Após cada gráfico, interpretar APENAS o resultado numérico observado (força/direção/padrão), sem descrever "para que serve" o gráfico

6. RESUMO FINAL:
   print("\\nResumo da Análise Descritiva")
   print(f"Dados carregados: Total de {len(df)} registros")
   print("Variáveis numéricas: lista...")
   print("Variáveis categóricas: lista...")
   print("Principais achados:")
   print("1. ...")
   print("2. ...")

IMPORTANTE: O código será executado de VERDADE no Pyodide. NÃO simule resultados.

REGRA OBRIGATÓRIA — PERGUNTAR PARÂMETROS ANTES DE EXECUTAR:
Quando o usuário solicitar QUALQUER análise estatística que exija parâmetros (variável dependente, independente, grupos, preditores, tempo, evento, itens, etc.), você NÃO deve executar o código imediatamente. Em vez disso:

1. Retorne "code": null (SEM código)
2. No "explanation", faça uma pergunta CLARA e ESTRUTURADA ao pesquisador, listando:
   - Quais parâmetros são necessários para a análise (ex: variável dependente, variável de agrupamento)
   - Para CADA parâmetro, liste as colunas do dataset que poderiam se encaixar, organizadas por tipo (numéricas vs categóricas)
   - Use formato de lista com bullets para facilitar a leitura
   - Exemplo de resposta:
     "## Teste t Pareado — Configuração\n\nPara realizar o teste t pareado, preciso que você defina:\n\n**Variável pré (medição antes):**\nColunas numéricas disponíveis:\n- Nº PRM Identificados\n- Nº PRM Identificados Correto\n- Nº PRM Errado\n- Nº PRM Não Identificado\n- Número de Fármacos\n\n**Variável pós (medição depois):**\n(mesmas opções acima)\n\nPor favor, indique quais colunas representam as medições pré e pós intervenção."

3. SOMENTE execute o código quando o usuário RESPONDER especificando quais variáveis usar
4. Se o usuário já especificou CLARAMENTE as variáveis na pergunta (ex: "Compare 'Nº PRM Identificados' vs 'Nº PRM Correto'"), então pode executar diretamente
5. Para análise descritiva exploratória (sem parâmetros específicos), execute diretamente sem perguntar

Análises que SEMPRE exigem pergunta prévia (a menos que o usuário já tenha especificado):
- Teste t (independente/pareado): variável dependente + variável de grupo ou par pré/pós
- ANOVA: variável dependente + variável de agrupamento
- Qui-quadrado: duas variáveis categóricas
- Correlação: quais variáveis correlacionar (se não for "todas")
- Regressão linear/logística: variável dependente + preditores
- Mann-Whitney: variável dependente + variável de grupo
- Kaplan-Meier / Cox: variável de tempo + variável de evento + covariáveis
- Cronbach's Alpha: quais itens da escala
- PCA: quais variáveis incluir (se não for "todas numéricas")

CATÁLOGO DE ANÁLISES ESTATÍSTICAS (use como referência ao gerar código):

Quando o usuário CONFIRMAR os parâmetros, siga SEMPRE esta estrutura:
1. Imprimir colunas disponíveis
2. Verificar pressupostos do teste
3. Executar o teste
4. Exibir resultados em show_table()
5. Interpretar com valores concretos

TEMPLATES DE REFERÊNCIA:

--- TESTE T INDEPENDENTE ---
from scipy import stats
import pandas as pd
import numpy as np
# Separar grupos
g1 = df[df['GRUPO_COL'] == 'valor1']['DEP_COL'].dropna()
g2 = df[df['GRUPO_COL'] == 'valor2']['DEP_COL'].dropna()
# Pressupostos
stat_sw1, p_sw1 = stats.shapiro(g1[:5000])
stat_sw2, p_sw2 = stats.shapiro(g2[:5000])
stat_lev, p_lev = stats.levene(g1, g2)
pressupostos = pd.DataFrame({
    'Teste': ['Shapiro-Wilk (Grupo 1)', 'Shapiro-Wilk (Grupo 2)', 'Levene'],
    'Estatística': [stat_sw1, stat_sw2, stat_lev],
    'p-valor': [p_sw1, p_sw2, p_lev],
    'Resultado': ['Normal' if p_sw1>0.05 else 'Não-normal', 'Normal' if p_sw2>0.05 else 'Não-normal', 'Homogêneo' if p_lev>0.05 else 'Não-homogêneo']
})
show_table(pressupostos, "Verificação de Pressupostos")
# Teste
equal_var = p_lev > 0.05
t_stat, p_val = stats.ttest_ind(g1, g2, equal_var=equal_var)
# Efeito (d de Cohen)
pooled_std = np.sqrt(((len(g1)-1)*g1.std()**2 + (len(g2)-1)*g2.std()**2)/(len(g1)+len(g2)-2))
cohen_d = (g1.mean() - g2.mean()) / pooled_std
# IC 95% da diferença
from scipy.stats import sem
diff = g1.mean() - g2.mean()
se_diff = np.sqrt(sem(g1)**2 + sem(g2)**2)
ci_low, ci_high = diff - 1.96*se_diff, diff + 1.96*se_diff
resultados = pd.DataFrame({
    'Métrica': ['Média Grupo 1', 'Média Grupo 2', 'Diferença', 't', 'df', 'p-valor', 'IC 95% inferior', 'IC 95% superior', 'd de Cohen', 'Interpretação efeito'],
    'Valor': [f'{g1.mean():.4f}', f'{g2.mean():.4f}', f'{diff:.4f}', f'{t_stat:.4f}', f'{len(g1)+len(g2)-2}', f'{p_val:.6f}', f'{ci_low:.4f}', f'{ci_high:.4f}', f'{cohen_d:.4f}', 'Pequeno' if abs(cohen_d)<0.5 else 'Médio' if abs(cohen_d)<0.8 else 'Grande']
})
show_table(resultados, "Resultado do Teste t Independente")

--- ANOVA ONE-WAY ---
from scipy import stats
import pandas as pd
groups = [group['DEP_COL'].dropna().values for name, group in df.groupby('GRUPO_COL')]
f_stat, p_val = stats.f_oneway(*groups)
# Eta-quadrado
ss_between = sum(len(g)*(g.mean()-df['DEP_COL'].dropna().mean())**2 for g in groups)
ss_total = sum((df['DEP_COL'].dropna() - df['DEP_COL'].dropna().mean())**2)
eta_sq = ss_between / ss_total
# Post-hoc Tukey
from statsmodels.stats.multicomp import pairwise_tukeyhsd
tukey = pairwise_tukeyhsd(df['DEP_COL'].dropna(), df.loc[df['DEP_COL'].notna(), 'GRUPO_COL'])
show_table(pd.DataFrame(tukey._results_table.data[1:], columns=tukey._results_table.data[0]), "Post-hoc de Tukey")

--- QUI-QUADRADO ---
from scipy import stats
import pandas as pd, numpy as np
ct = pd.crosstab(df['VAR1'], df['VAR2'])
chi2, p, dof, expected = stats.chi2_contingency(ct)
n = ct.sum().sum()
cramers_v = np.sqrt(chi2 / (n * (min(ct.shape) - 1)))
show_table(ct.reset_index(), "Tabela Cruzada (Frequências Observadas)")
show_table(pd.DataFrame(expected, index=ct.index, columns=ct.columns).round(2).reset_index(), "Frequências Esperadas")
resultado = pd.DataFrame({'Métrica': ['χ²', 'df', 'p-valor', 'V de Cramér'], 'Valor': [f'{chi2:.4f}', f'{dof}', f'{p:.6f}', f'{cramers_v:.4f}']})
show_table(resultado, "Resultado do Teste Qui-quadrado")

--- REGRESSÃO LINEAR ---
import statsmodels.api as sm
X = df[['PRED1', 'PRED2']].dropna()
y = df.loc[X.index, 'DEP_COL']
X_const = sm.add_constant(X)
model = sm.OLS(y, X_const).fit()
coefs = pd.DataFrame({'Variável': model.params.index, 'Coeficiente': model.params.values, 'Erro Padrão': model.bse.values, 't': model.tvalues.values, 'p-valor': model.pvalues.values, 'IC 2.5%': model.conf_int()[0].values, 'IC 97.5%': model.conf_int()[1].values})
show_table(coefs, "Coeficientes da Regressão Linear")
resumo = pd.DataFrame({'Métrica': ['R²', 'R² ajustado', 'F', 'p-valor (F)', 'AIC', 'BIC', 'N'], 'Valor': [f'{model.rsquared:.4f}', f'{model.rsquared_adj:.4f}', f'{model.fvalue:.4f}', f'{model.f_pvalue:.6f}', f'{model.aic:.2f}', f'{model.bic:.2f}', f'{int(model.nobs)}']})
show_table(resumo, "Resumo do Modelo")

--- REGRESSÃO LOGÍSTICA ---
import statsmodels.api as sm
import numpy as np, pandas as pd
from sklearn.metrics import confusion_matrix, roc_auc_score, roc_curve
X = df[['PRED1', 'PRED2']].dropna()
y = df.loc[X.index, 'DEP_BIN']
X_const = sm.add_constant(X)
model = sm.Logit(y, X_const).fit(disp=0)
coefs = pd.DataFrame({'Variável': model.params.index, 'β': model.params.values, 'OR': np.exp(model.params.values), 'IC 2.5% OR': np.exp(model.conf_int()[0].values), 'IC 97.5% OR': np.exp(model.conf_int()[1].values), 'p-valor': model.pvalues.values})
show_table(coefs, "Coeficientes da Regressão Logística")
# ROC
y_pred_prob = model.predict(X_const)
fpr, tpr, _ = roc_curve(y, y_pred_prob)
auc_val = roc_auc_score(y, y_pred_prob)
plt.figure(figsize=(8,6))
plt.plot(fpr, tpr, label=f'AUC = {auc_val:.3f}')
plt.plot([0,1],[0,1],'--', color='gray')
plt.xlabel('1 - Especificidade')
plt.ylabel('Sensibilidade')
plt.title('Curva ROC')
plt.legend()
plt.tight_layout()
plt.show()

--- MANN-WHITNEY U ---
from scipy import stats
g1 = df[df['GRUPO_COL']=='valor1']['DEP_COL'].dropna()
g2 = df[df['GRUPO_COL']=='valor2']['DEP_COL'].dropna()
u_stat, p_val = stats.mannwhitneyu(g1, g2, alternative='two-sided')
# Rank-biserial correlation
r_rb = 1 - (2*u_stat)/(len(g1)*len(g2))
resultado = pd.DataFrame({'Métrica': ['U', 'p-valor', 'Mediana Grupo 1', 'Mediana Grupo 2', 'r (rank-biserial)', 'Tamanho efeito'], 'Valor': [f'{u_stat:.1f}', f'{p_val:.6f}', f'{g1.median():.4f}', f'{g2.median():.4f}', f'{r_rb:.4f}', 'Pequeno' if abs(r_rb)<0.3 else 'Médio' if abs(r_rb)<0.5 else 'Grande']})
show_table(resultado, "Resultado Mann-Whitney U")

--- KAPLAN-MEIER (requer lifelines) ---
from lifelines import KaplanMeierFitter
kmf = KaplanMeierFitter()
T = df['TEMPO_COL'].dropna()
E = df.loc[T.index, 'EVENTO_COL']
kmf.fit(T, event_observed=E)
plt.figure(figsize=(10,6))
kmf.plot_survival_function(ci_show=True)
plt.title('Curva de Sobrevivência de Kaplan-Meier')
plt.xlabel('Tempo')
plt.ylabel('Probabilidade de Sobrevivência')
plt.tight_layout()
plt.show()
median_surv = kmf.median_survival_time_
print(f"Mediana de sobrevivência: {median_surv:.2f}")

--- REGRESSÃO DE COX (requer lifelines) ---
from lifelines import CoxPHFitter
cph = CoxPHFitter()
cols = ['TEMPO', 'EVENTO', 'COVAR1', 'COVAR2']
cph.fit(df[cols].dropna(), duration_col='TEMPO', event_col='EVENTO')
cph.print_summary()
show_table(cph.summary.reset_index(), "Resultado da Regressão de Cox")

--- PCA ---
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
num_cols = df.select_dtypes(include='number').dropna(axis=1)
scaler = StandardScaler()
X_scaled = scaler.fit_transform(num_cols)
pca = PCA()
pca.fit(X_scaled)
var_exp = pd.DataFrame({'Componente': [f'PC{i+1}' for i in range(len(pca.explained_variance_ratio_))], 'Variância Explicada (%)': (pca.explained_variance_ratio_*100).round(2), 'Acumulada (%)': (pca.explained_variance_ratio_.cumsum()*100).round(2)})
show_table(var_exp.head(10), "Variância Explicada por Componente")

--- CRONBACH'S ALPHA ---
import numpy as np, pandas as pd
items = df[['ITEM1','ITEM2','ITEM3']].dropna()
n_items = items.shape[1]
var_items = items.var(axis=0, ddof=1).sum()
var_total = items.sum(axis=1).var(ddof=1)
alpha = (n_items/(n_items-1))*(1 - var_items/var_total)
# Alpha se removido
alphas_removed = []
for col in items.columns:
    sub = items.drop(columns=[col])
    k = sub.shape[1]
    vi = sub.var(axis=0, ddof=1).sum()
    vt = sub.sum(axis=1).var(ddof=1)
    a = (k/(k-1))*(1-vi/vt)
    alphas_removed.append({'Item removido': col, 'Alpha': f'{a:.4f}'})
resultado = pd.DataFrame(alphas_removed)
show_table(resultado, f"Cronbach's Alpha = {alpha:.4f} — Alpha se item removido")

FIM DO CATÁLOGO.

${describeSchemas(fileSchemas)}

Campo "explanation" — markdown em português brasileiro, estilo relatório profissional:
- Comece com um TÍTULO descritivo: "## Análise de Variância (ANOVA) One-Way"
- Descreva brevemente o OBJETIVO da análise em 2-3 frases
- NÃO inclua código Python/R no explanation — NUNCA mostre blocos de código, imports, nomes de funções ou sintaxe de programação
- NÃO inclua resultados no explanation — os resultados vêm do código executado
- NÃO liste etapas técnicas como "Verificar pressupostos", "Carregar dados", "Teste post-hoc"
- O explanation é para o PESQUISADOR, não para programadores. Deve ser curto (3-5 linhas), em linguagem natural
- Termine com "Os resultados aparecem abaixo."
- Exemplo BOM: Um parágrafo curto explicando o objetivo da análise em linguagem natural, sem nenhum código
- Exemplo RUIM: Mostrar blocos de código, imports, nomes de variáveis, pd.read_excel ou sintaxe de programação

Campo "code": código Python/R completo seguindo a estrutura acima. Null se não precisar.
Responda SEMPRE em português brasileiro.`;

    // Field order is load-bearing while streaming: the client shows "explanation"
    // as it arrives, and it can only do that if the model emits it before "code".
    const orderRule = `${NL}${NL}ORDEM DOS CAMPOS: no JSON de resposta, escreva SEMPRE o campo "explanation" COMPLETO antes de começar o campo "code" ou "plan". Nunca inverta essa ordem.`;

    /**
     * Lets the model answer a question that needs several chained analyses with a
     * plan instead of one overloaded block of code. The client then runs each step
     * as its own cell, so every step sees what the previous one actually produced.
     */
    const planRule = `${NL}${NL}REGRA DO PLANO DE ANÁLISE EM ETAPAS:
Algumas perguntas não se resolvem com um único bloco de código (ex: "os grupos diferem e essa diferença se mantém ajustando por idade?", "quais fatores explicam o desfecho?", "faça a análise completa deste dataset"). Nesses casos, em vez de "code", responda com um PLANO:
{"explanation": "...", "plan": [{"title": "Título curto", "goal": "Instrução completa e autossuficiente desta etapa"}], "code": null}
- Use plano APENAS quando a pergunta exigir de 2 a 6 etapas ENCADEADAS, em que cada etapa depende do resultado da anterior.
- NUNCA use plano para algo que cabe em um único bloco de código — aí responda com "code" normalmente.
- NUNCA use plano quando ainda faltar definir parâmetros: primeiro PERGUNTE ao pesquisador (code: null, sem "plan") e só proponha o plano depois que as variáveis estiverem definidas.
- Cada "goal" deve ser autossuficiente: diga qual variável usar, qual teste/cálculo fazer e o que exibir. NÃO escreva código dentro do goal.
- Ordene as etapas da preparação até a conclusão (ex: 1 qualidade e preparo dos dados, 2 pressupostos, 3 teste principal, 4 modelo ajustado).
- No "explanation", diga em 2-4 linhas por que a pergunta exige várias etapas. NÃO repita a lista de etapas: ela já é exibida a partir do campo "plan".`;

    const stepRule = `${NL}${NL}ESTADO: você está executando a ETAPA ${(step?.index ?? 0) + 1} DE ${step?.total ?? 1} de um plano que você mesmo propôs e o pesquisador aceitou.
- Gere código APENAS para esta etapa. NÃO refaça o que já rodou nas etapas anteriores — o código e os resultados delas estão no histórico.
- NUNCA retorne o campo "plan" aqui: o plano já existe. Responda {"explanation": "...", "code": "..."}.
- NÃO pergunte parâmetros ao pesquisador nesta etapa; o plano já foi aceito. Escolha as variáveis pelo perfil dos dados e diga no "explanation" qual escolha você fez e por quê.
- Se um resultado anterior mudar o que faz sentido aqui (ex: normalidade violada), ADAPTE esta etapa e explique o que mudou.
- O "explanation" desta etapa tem no máximo 3 linhas: o que ela faz e por quê. Não repita o plano inteiro.`;

    const synthesisRule = `${NL}${NL}ESTADO: todas as etapas do plano já foram executadas e seus resultados estão no histórico. Esta é a SÍNTESE FINAL.
- Retorne OBRIGATORIAMENTE "code": null. Não gere código nenhum e nunca retorne "plan".
- No "explanation", responda diretamente à pergunta original do pesquisador, citando os números concretos que apareceram nas etapas (n, %, médias, p-valores, tamanhos de efeito, intervalos de confiança).
- Aponte as limitações reais observadas (ausentes, pressupostos violados, amostra pequena, achados não significativos).
- NÃO invente nenhum número: use apenas o que está no histórico. Se algo não foi calculado, diga que não foi.`;

    // A plan is only offered on a fresh question against real data; inside a plan the
    // model is executing one, and with no dataframe there is nothing to plan over.
    const modeRule = step?.final ? synthesisRule : step ? stepRule : hasData ? planRule : "";

    const messages_arr = [
      { role: "system", content: systemPrompt + orderRule + modeRule },
      ...(history || []).slice(-8),
      { role: "user", content: message },
    ];

    // Anthropic is not OpenAI-compatible in ai-caller, which skips it entirely when
    // streaming — forcing it here would leave no provider to try. Those requests
    // stay on the buffered path instead of silently changing provider.
    const wantsStream = stream === true && provider !== "anthropic";

    let response: Response;

    if (provider && model) {
      response = await callAI({
        _userId: auth.userId,
        _promptType: "datamind_chat",
        messages: messages_arr,
        model: model,
        temperature: 0.3,
        stream: wantsStream,
        ...(wantsStream ? { stream_options: { include_usage: true } } : {}),
        _forceProvider: provider,
      } as any);
    } else {
      response = await callAI({
        _userId: auth.userId,
        _promptType: "datamind_chat",
        messages: messages_arr,
        // Statistical code generation is the one place where a weak model is
        // expensive: a wrong test costs a retry and, worse, a wrong result.
        model: STRONG_MODEL,
        temperature: 0.3,
        stream: wantsStream,
        ...(wantsStream ? { stream_options: { include_usage: true } } : {}),
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error(`AI call failed: ${response.status}`);
    }

    if (wantsStream && response.body) {
      // Forwarded verbatim in OpenAI delta format, the same contract the other
      // streaming functions in this project use.
      return new Response(response.body.pipeThrough(costMeter(auth.userId, provider, model)), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    // Robust JSON extraction
    let explanation = "";
    let code = null;
    let plan: unknown = null;

    try {
      // Strip markdown fences
      let cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      
      // Find JSON start
      const jsonStart = cleaned.indexOf('{');
      if (jsonStart !== -1) {
        cleaned = cleaned.slice(jsonStart);
      }

      // Try direct parse
      try {
        const parsed = JSON.parse(cleaned);
        explanation = parsed.explanation || "";
        code = parsed.code || null;
        plan = Array.isArray(parsed.plan) ? parsed.plan : null;
      } catch {
        // Try to find the last closing brace to handle truncated JSON
        const lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace !== -1) {
          try {
            const parsed = JSON.parse(cleaned.slice(0, lastBrace + 1));
            explanation = parsed.explanation || "";
            code = parsed.code || null;
            plan = Array.isArray(parsed.plan) ? parsed.plan : null;
          } catch {
            // Regex extraction as fallback
            const explMatch = cleaned.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
            const codeMatch = cleaned.match(/"code"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
            
            if (explMatch) {
              explanation = explMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }
            if (codeMatch) {
              code = codeMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }
            if (!explanation) {
              explanation = text.replace(/```[\s\S]*?```/g, '').replace(/[{}]/g, '').trim();
            }
          }
        }
      }
    } catch {
      explanation = text;
    }

    if (!explanation) explanation = "Análise processada.";

    // Hard gate: without a real uploaded dataframe, never let code run or fabricated
    // numbers/tables through, regardless of what the prompt was told or what the model did.
    if (!hasData) {
      code = null;
      plan = null;
      if (looksLikeFabricatedData(explanation)) {
        explanation = "Nenhum arquivo de dados foi carregado nesta conversa, então não posso apresentar números ou resultados — eles não seriam reais. Envie um arquivo CSV/XLSX (ícone de anexo) ou importe dados reais pela página DataSUS para que eu possa analisar de verdade.";
      }
    }

    // The synthesis turn reads numbers that already exist; any code it emitted
    // anyway would re-run an analysis the researcher has already seen.
    if (step?.final) {
      code = null;
      plan = null;
    }
    // A step is executing a plan, so a nested plan would restart the chain.
    if (step) plan = null;

    trackUsage(auth.userId, "datamind_chat").catch(e => console.error("usage tracking error:", e));

    return new Response(JSON.stringify({ explanation, code, plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ explanation: "Erro ao processar sua solicitação.", code: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
