import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, Bug, Skull, Baby, Wind, Microscope, Users, TrendingUp } from "lucide-react";

interface DataSUSSourcesPanelProps {
  isPt: boolean;
}

const SOURCES = [
  {
    icon: Bug,
    emoji: "🦟",
    labelPt: "Arboviroses (Dengue, Zika, Chikungunya)",
    labelEn: "Arboviruses (Dengue, Zika, Chikungunya)",
    source: "InfoDengue",
    period: "2014–2024",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
  },
  {
    icon: Skull,
    emoji: "💀",
    labelPt: "Mortalidade por causa (CID-10)",
    labelEn: "Mortality by cause (ICD-10)",
    source: "IBGE SIDRA (SIM)",
    period: "2012–2022",
    colorClass: "text-sky-600 dark:text-sky-400",
    bgClass: "bg-sky-500/10",
    borderClass: "border-sky-500/20",
  },
  {
    icon: Baby,
    emoji: "👶",
    labelPt: "Nascidos vivos",
    labelEn: "Live births",
    source: "IBGE SIDRA (SINASC)",
    period: "2012–2022",
    colorClass: "text-pink-600 dark:text-pink-400",
    bgClass: "bg-pink-500/10",
    borderClass: "border-pink-500/20",
  },
  {
    icon: Wind,
    emoji: "🫁",
    labelPt: "SRAG / COVID-19 / Influenza",
    labelEn: "SARI / COVID-19 / Influenza",
    source: "OpenDataSUS",
    period: "2020–2025",
    colorClass: "text-violet-600 dark:text-violet-400",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/20",
  },
  {
    icon: Microscope,
    emoji: "🦠",
    labelPt: "Tuberculose / Hanseníase (notificações)",
    labelEn: "Tuberculosis / Leprosy (notifications)",
    source: "TabNet/SINAN",
    period: "2012–2023",
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/20",
  },
  {
    icon: Users,
    emoji: "📊",
    labelPt: "População estimada, PIB per capita",
    labelEn: "Estimated population, GDP per capita",
    source: "IBGE Agregados",
    period: "2000–2024",
    colorClass: "text-indigo-600 dark:text-indigo-400",
    bgClass: "bg-indigo-500/10",
    borderClass: "border-indigo-500/20",
  },
];

export default function DataSUSSourcesPanel({ isPt }: DataSUSSourcesPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          {isPt ? "Fontes de dados disponíveis" : "Available data sources"}
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SOURCES.map((src) => (
          <Card key={src.source} className="border-border/30 bg-muted/20 shadow-none">
            <CardContent className="p-3 flex items-start gap-3">
              <div className={`h-8 w-8 rounded-lg ${src.bgClass} flex items-center justify-center shrink-0`}>
                <src.icon className={`h-4 w-4 ${src.colorClass}`} />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium text-foreground leading-snug">
                  {isPt ? src.labelPt : src.labelEn}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 h-4 rounded font-medium ${src.bgClass} ${src.colorClass} ${src.borderClass}`}
                  >
                    {src.source}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{src.period}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        {isPt
          ? "Apenas dados reais das fontes acima são retornados. Consultas fora dessas fontes informarão que os dados não estão disponíveis."
          : "Only real data from the sources above is returned. Queries outside these sources will be flagged as unavailable."}
      </p>
    </div>
  );
}
