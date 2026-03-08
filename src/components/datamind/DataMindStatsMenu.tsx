import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BarChart3, ChevronRight, FlaskConical } from "lucide-react";

interface Props {
  onInsertPrompt: (prompt: string) => void;
  disabled?: boolean;
}

const STATS_CATEGORIES = [
  {
    label: "Comparação de Médias",
    icon: "📊",
    items: [
      {
        label: "Teste t independente",
        prompt:
          "Realize um teste t independente para comparar as médias de [variável dependente] entre os grupos de [variável de agrupamento]. Verifique os pressupostos (normalidade com Shapiro-Wilk, homocedasticidade com Levene). Reporte: médias, desvios-padrão, t, df, p-valor, IC 95%, tamanho de efeito (d de Cohen).",
      },
      {
        label: "Teste t pareado",
        prompt:
          "Realize um teste t pareado para comparar [variável pré] vs [variável pós]. Verifique normalidade das diferenças (Shapiro-Wilk). Reporte: médias, diferença média, t, df, p-valor, IC 95% da diferença, d de Cohen.",
      },
      {
        label: "ANOVA one-way",
        prompt:
          "Realize uma ANOVA one-way para comparar as médias de [variável dependente] entre os grupos de [variável de agrupamento]. Verifique pressupostos (normalidade, Levene). Se significativo, faça teste post-hoc de Tukey. Reporte: F, df, p-valor, η², comparações múltiplas.",
      },
      {
        label: "ANOVA two-way (fatorial)",
        prompt:
          "Realize uma ANOVA two-way (fatorial) para [variável dependente] com fatores [fator 1] e [fator 2]. Inclua interação. Reporte: F, df, p-valor para cada efeito principal e interação, η² parcial, gráfico de interação.",
      },
    ],
  },
  {
    label: "Correlação",
    icon: "🔗",
    items: [
      {
        label: "Correlação de Pearson",
        prompt:
          "Calcule a correlação de Pearson entre [variável 1] e [variável 2]. Verifique normalidade bivariada. Reporte: r, p-valor, IC 95%, R², gráfico de dispersão com linha de regressão.",
      },
      {
        label: "Correlação de Spearman",
        prompt:
          "Calcule a correlação de Spearman entre [variável 1] e [variável 2]. Reporte: ρ (rho), p-valor. Mostre gráfico de dispersão.",
      },
      {
        label: "Matriz de correlação",
        prompt:
          "Gere uma matriz de correlação de Pearson para todas as variáveis numéricas. Mostre um heatmap com anotações e destaque correlações significativas (p < 0.05).",
      },
    ],
  },
  {
    label: "Regressão",
    icon: "📈",
    items: [
      {
        label: "Regressão linear simples",
        prompt:
          "Realize uma regressão linear simples com [variável dependente] como Y e [variável independente] como X. Reporte: coeficientes (β), erro padrão, t, p-valor, R², R² ajustado, F do modelo. Mostre gráfico de dispersão com reta de regressão e gráfico de resíduos.",
      },
      {
        label: "Regressão linear múltipla",
        prompt:
          "Realize uma regressão linear múltipla com [variável dependente] como Y e [lista de preditores] como variáveis independentes. Reporte: tabela de coeficientes (β, SE, t, p, IC 95%), R², R² ajustado, F do modelo, VIF para multicolinearidade. Mostre gráfico de resíduos vs ajustados e Q-Q plot.",
      },
      {
        label: "Regressão logística",
        prompt:
          "Realize uma regressão logística com [variável dependente binária] como Y e [lista de preditores] como variáveis independentes. Reporte: coeficientes (β), OR (odds ratio) com IC 95%, p-valor, pseudo-R², AIC, matriz de confusão, acurácia, sensibilidade, especificidade, curva ROC com AUC.",
      },
    ],
  },
  {
    label: "Testes Não-Paramétricos",
    icon: "🔬",
    items: [
      {
        label: "Mann-Whitney U",
        prompt:
          "Realize o teste de Mann-Whitney U para comparar [variável] entre os grupos de [variável de agrupamento]. Reporte: U, p-valor, rank biserial correlation (tamanho de efeito), medianas dos grupos.",
      },
      {
        label: "Wilcoxon signed-rank",
        prompt:
          "Realize o teste de Wilcoxon signed-rank para comparar [variável pré] vs [variável pós]. Reporte: W, p-valor, tamanho de efeito (r), medianas.",
      },
      {
        label: "Kruskal-Wallis",
        prompt:
          "Realize o teste de Kruskal-Wallis para comparar [variável] entre os grupos de [variável de agrupamento]. Se significativo, faça comparações post-hoc de Dunn. Reporte: H, df, p-valor, medianas dos grupos.",
      },
      {
        label: "Qui-quadrado",
        prompt:
          "Realize o teste de Qui-quadrado de independência entre [variável categórica 1] e [variável categórica 2]. Reporte: χ², df, p-valor, V de Cramér, tabela cruzada com frequências observadas e esperadas, resíduos padronizados ajustados.",
      },
    ],
  },
  {
    label: "Análise Multivariada",
    icon: "🧮",
    items: [
      {
        label: "PCA (Análise de Componentes Principais)",
        prompt:
          "Realize uma PCA (Análise de Componentes Principais) nas variáveis numéricas. Padronize os dados antes. Reporte: variância explicada por componente, gráfico scree plot, biplot das 2 primeiras componentes, loadings das variáveis.",
      },
      {
        label: "Análise de Cluster (K-Means)",
        prompt:
          "Realize uma análise de cluster K-Means nas variáveis numéricas. Padronize os dados. Determine o número ótimo de clusters pelo método do cotovelo e silhueta. Reporte: centroides, tamanho de cada cluster, gráfico de silhueta, visualização 2D (PCA).",
      },
      {
        label: "Cronbach's Alpha",
        prompt:
          "Calcule o Cronbach's Alpha para as variáveis [lista de itens da escala]. Reporte: α geral, α se item removido, correlação item-total. Interprete a confiabilidade.",
      },
    ],
  },
  {
    label: "Análise de Sobrevivência",
    icon: "⏱️",
    items: [
      {
        label: "Kaplan-Meier",
        prompt:
          "Realize uma análise de sobrevivência de Kaplan-Meier com [variável de tempo] como tempo e [variável de evento] como evento/censura. Se houver grupos, compare com log-rank test. Mostre curvas de sobrevivência com IC 95%, tabela de sobrevivência com medianas.",
      },
      {
        label: "Regressão de Cox",
        prompt:
          "Realize uma regressão de Cox (modelo de riscos proporcionais) com [variável de tempo], [variável de evento] e [lista de covariáveis]. Verifique o pressuposto de riscos proporcionais (teste de Schoenfeld). Reporte: HR (hazard ratio) com IC 95%, p-valor para cada covariável.",
      },
    ],
  },
];

const DataMindStatsMenu = ({ onInsertPrompt, disabled }: Props) => {
  const [open, setOpen] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs h-7"
          disabled={disabled}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Análises
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 max-h-[420px] overflow-y-auto" align="end" sideOffset={8}>
        <div className="px-3 py-2 border-b border-border/40">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3" />
            Análises Estatísticas
          </p>
        </div>
        {STATS_CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <button
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
              onClick={() =>
                setExpandedCat(expandedCat === cat.label ? null : cat.label)
              }
            >
              <span className="text-sm text-foreground flex items-center gap-2">
                <span>{cat.icon}</span>
                {cat.label}
              </span>
              <ChevronRight
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                  expandedCat === cat.label ? "rotate-90" : ""
                }`}
              />
            </button>
            {expandedCat === cat.label && (
              <div className="border-t border-border/20 bg-muted/20">
                {cat.items.map((item) => (
                  <button
                    key={item.label}
                    className="w-full text-left px-6 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    onClick={() => {
                      onInsertPrompt(item.prompt);
                      setOpen(false);
                      setExpandedCat(null);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export default DataMindStatsMenu;
