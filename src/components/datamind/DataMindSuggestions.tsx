import { DataMindFile, Message } from "@/pages/DataMind";
import { Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  files: DataMindFile[];
  messages?: Message[];
  onSelect: (question: string) => void;
  loading: boolean;
}

const generateSuggestions = (files: DataMindFile[], messages: Message[] = []): string[] => {
  if (files.length === 0) return [];

  const file = files[0];
  const schema = file.schema_info as { columns?: string[]; rows?: number; file_type?: string; file_name?: string };
  const columns = schema?.columns || [];

  // Gather what has already been analyzed from message history
  const allContent = messages
    .filter(m => m.role === "assistant" || m.role === "user")
    .map(m => m.content.toLowerCase())
    .join(" ");

  const hasExploratoria = allContent.includes("exploratória") || allContent.includes("descritiva") || allContent.includes("describe");
  const hasDistribuicao = allContent.includes("distribuição") || allContent.includes("frequência");
  const hasCorrelacao = allContent.includes("correlação") || allContent.includes("correlacao");
  const hasMissing = allContent.includes("ausente") || allContent.includes("missing") || allContent.includes("nulo");
  const hasOutlier = allContent.includes("outlier");
  const hasComparacao = allContent.includes("comparar") || allContent.includes("comparação") || allContent.includes("teste t") || allContent.includes("anova");
  const hasRegressao = allContent.includes("regressão") || allContent.includes("regressao");
  const hasCluster = allContent.includes("cluster") || allContent.includes("agrupamento");

  // No messages yet — initial suggestions
  if (messages.length === 0) {
    if (columns.length === 0) {
      return [
        "Faça uma análise exploratória completa dos dados",
        "Mostre as primeiras linhas e descreva as colunas",
        "Identifique valores ausentes e estatísticas descritivas",
        "Crie um gráfico com os dados mais relevantes",
      ];
    }

    const suggestions: string[] = [
      "Faça uma análise exploratória completa dos dados",
      "Mostre as primeiras linhas e descreva todas as colunas",
    ];

    const categoricalKeywords = ["nome", "name", "tipo", "type", "categoria", "category", "status", "cidade", "city", "sexo", "gender", "medicamento", "classe", "prm"];
    const categoricalCols = columns.filter(c => categoricalKeywords.some(k => c.toLowerCase().includes(k)));

    if (categoricalCols.length > 0) {
      suggestions.push(`Qual a distribuição de ${categoricalCols[0]}? Mostre em gráfico`);
    }

    suggestions.push("Identifique valores ausentes e estatísticas descritivas");

    return suggestions.slice(0, 4);
  }

  // Sequential suggestions based on what's been done
  const suggestions: string[] = [];

  if (!hasExploratoria) {
    suggestions.push("Faça uma análise exploratória completa dos dados");
  }

  if (hasExploratoria && !hasMissing) {
    suggestions.push("Identifique valores ausentes e inconsistências nos dados");
  }

  if (hasExploratoria && !hasDistribuicao) {
    const categoricalKeywords = ["tipo", "type", "categoria", "status", "sexo", "gender", "medicamento", "classe", "prm"];
    const categoricalCols = columns.filter(c => categoricalKeywords.some(k => c.toLowerCase().includes(k)));
    if (categoricalCols.length > 0) {
      suggestions.push(`Mostre a distribuição de ${categoricalCols[0]} com gráfico de barras`);
    } else {
      suggestions.push("Mostre a distribuição das variáveis categóricas em gráficos");
    }
  }

  if ((hasExploratoria || hasDistribuicao) && !hasCorrelacao) {
    suggestions.push("Analise a correlação entre as variáveis numéricas com heatmap");
  }

  if ((hasExploratoria || hasDistribuicao) && !hasOutlier) {
    suggestions.push("Identifique outliers nas variáveis numéricas com boxplot");
  }

  if ((hasCorrelacao || hasDistribuicao) && !hasComparacao) {
    suggestions.push("Compare grupos usando testes estatísticos (t-test, ANOVA)");
  }

  if (hasComparacao && !hasRegressao) {
    suggestions.push("Faça uma regressão logística para prever a variável alvo");
  }

  if (hasComparacao && !hasCluster) {
    suggestions.push("Aplique análise de cluster para identificar padrões");
  }

  // Always offer a custom chart option
  if (suggestions.length < 4) {
    suggestions.push("Crie um gráfico personalizado com as variáveis mais relevantes");
  }

  // Fallback if we ran out of sequential ideas
  if (suggestions.length === 0) {
    suggestions.push("Gere um relatório resumido com as principais descobertas");
    suggestions.push("Crie visualizações adicionais dos dados");
  }

  return suggestions.slice(0, 4);
};

const DataMindSuggestions = ({ files, messages = [], onSelect, loading }: Props) => {
  const suggestions = generateSuggestions(files, messages);

  if (suggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Sugestões de análise</span>
        <span className="text-xs text-muted-foreground">{suggestions.length} disponíveis</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s, i) => (
          <motion.button
            key={`${i}-${s.slice(0, 20)}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelect(s)}
            disabled={loading}
            className="rounded-lg border border-border/60 bg-card px-3 py-2 text-xs text-foreground hover:bg-accent hover:border-primary/30 transition-colors text-left max-w-[250px] truncate disabled:opacity-50"
            title={s}
          >
            {s}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default DataMindSuggestions;