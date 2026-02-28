import { DataMindFile } from "@/pages/DataMind";
import { Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  files: DataMindFile[];
  onSelect: (question: string) => void;
  loading: boolean;
}

const generateSuggestions = (files: DataMindFile[]): string[] => {
  if (files.length === 0) return [];

  const file = files[0];
  const schema = file.schema_info as { columns?: string[]; rows?: number; file_type?: string; file_name?: string };
  const columns = schema?.columns || [];

  if (columns.length === 0) {
    // Excel files without parsed columns
    return [
      "Faça uma análise exploratória completa dos dados",
      "Mostre as primeiras linhas e descreva as colunas",
      "Identifique valores ausentes e estatísticas descritivas",
      "Crie um gráfico com os dados mais relevantes",
    ];
  }

  const suggestions: string[] = [];

  // Basic exploration
  suggestions.push("Faça uma análise exploratória completa dos dados");

  // Numeric columns detection (heuristic)
  const numericKeywords = ["valor", "preco", "preço", "total", "quantidade", "qtd", "count", "amount", "score", "nota", "idade", "age", "peso", "height", "weight", "salary", "salario", "codigo", "code", "id", "numero", "number"];
  const categoricalKeywords = ["nome", "name", "tipo", "type", "categoria", "category", "status", "cidade", "city", "estado", "state", "pais", "country", "sexo", "gender", "medicamento", "prm", "unidade"];

  const numericCols = columns.filter(c => numericKeywords.some(k => c.toLowerCase().includes(k)));
  const categoricalCols = columns.filter(c => categoricalKeywords.some(k => c.toLowerCase().includes(k)));

  if (categoricalCols.length > 0) {
    suggestions.push(`Qual a distribuição de ${categoricalCols[0]}? Mostre em um gráfico de barras`);
  }

  if (numericCols.length > 0 && categoricalCols.length > 0) {
    suggestions.push(`Compare ${numericCols[0]} por ${categoricalCols[0]} com um gráfico`);
  }

  if (columns.length >= 2) {
    suggestions.push(`Mostre a correlação entre as variáveis numéricas`);
  }

  if (numericCols.length > 0) {
    suggestions.push(`Quais são os outliers em ${numericCols[0]}?`);
  }

  // Missing values
  suggestions.push("Identifique valores ausentes e mostre a porcentagem por coluna");

  // Top N
  if (categoricalCols.length > 0) {
    suggestions.push(`Quais são os top 10 valores mais frequentes de ${categoricalCols[0]}?`);
  }

  return suggestions.slice(0, 5);
};

const DataMindSuggestions = ({ files, onSelect, loading }: Props) => {
  const suggestions = generateSuggestions(files);

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
            key={i}
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
