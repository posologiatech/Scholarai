import { useLanguage } from "@/i18n/LanguageContext";
import { Microscope, Heart, FlaskConical, GitBranch, BarChart3, Brain, Dna, Leaf, Pill, Workflow } from "lucide-react";

export interface Template {
  id: string;
  icon: React.ReactNode;
  label: { pt: string; en: string };
  prompt: { pt: string; en: string };
  category: string;
}

const templates: Template[] = [
  {
    id: "cell-biology",
    icon: <Microscope className="h-5 w-5" />,
    label: { pt: "Biologia Celular", en: "Cell Biology" },
    prompt: { pt: "Diagrama detalhado de uma célula animal com todas as organelas rotuladas: núcleo, mitocôndrias, retículo endoplasmático, complexo de Golgi, ribossomos e membrana plasmática", en: "Detailed diagram of an animal cell with all organelles labeled: nucleus, mitochondria, endoplasmic reticulum, Golgi complex, ribosomes, and plasma membrane" },
    category: "biology",
  },
  {
    id: "molecular",
    icon: <Dna className="h-5 w-5" />,
    label: { pt: "Biologia Molecular", en: "Molecular Biology" },
    prompt: { pt: "Diagrama do processo de transcrição e tradução do DNA, mostrando RNA polimerase, mRNA, ribossomos e cadeia polipeptídica", en: "Diagram of DNA transcription and translation process, showing RNA polymerase, mRNA, ribosomes, and polypeptide chain" },
    category: "biology",
  },
  {
    id: "anatomy",
    icon: <Heart className="h-5 w-5" />,
    label: { pt: "Anatomia", en: "Anatomy" },
    prompt: { pt: "Diagrama anatômico do sistema cardiovascular humano mostrando o coração com suas câmaras, válvulas, artérias e veias principais", en: "Anatomical diagram of the human cardiovascular system showing the heart with chambers, valves, major arteries and veins" },
    category: "medicine",
  },
  {
    id: "neuroscience",
    icon: <Brain className="h-5 w-5" />,
    label: { pt: "Neurociência", en: "Neuroscience" },
    prompt: { pt: "Diagrama de uma sinapse neuronal mostrando vesículas sinápticas, neurotransmissores, receptores pós-sinápticos, fenda sináptica e potencial de ação", en: "Diagram of a neuronal synapse showing synaptic vesicles, neurotransmitters, post-synaptic receptors, synaptic cleft, and action potential" },
    category: "medicine",
  },
  {
    id: "pharmacology",
    icon: <Pill className="h-5 w-5" />,
    label: { pt: "Farmacologia", en: "Pharmacology" },
    prompt: { pt: "Diagrama do mecanismo de ação de um fármaco mostrando ligação ao receptor, cascata de sinalização intracelular e efeito terapêutico", en: "Drug mechanism of action diagram showing receptor binding, intracellular signaling cascade, and therapeutic effect" },
    category: "medicine",
  },
  {
    id: "chemistry",
    icon: <FlaskConical className="h-5 w-5" />,
    label: { pt: "Química / Bioquímica", en: "Chemistry / Biochemistry" },
    prompt: { pt: "Diagrama do ciclo de Krebs (ciclo do ácido cítrico) com todas as enzimas, substratos, produtos e cofatores rotulados", en: "Krebs cycle (citric acid cycle) diagram with all enzymes, substrates, products, and cofactors labeled" },
    category: "chemistry",
  },
  {
    id: "ecology",
    icon: <Leaf className="h-5 w-5" />,
    label: { pt: "Ecologia", en: "Ecology" },
    prompt: { pt: "Diagrama de uma teia alimentar em ecossistema aquático mostrando produtores, consumidores primários, secundários e terciários, e decompositores", en: "Aquatic ecosystem food web diagram showing producers, primary, secondary, and tertiary consumers, and decomposers" },
    category: "biology",
  },
  {
    id: "flowchart",
    icon: <GitBranch className="h-5 w-5" />,
    label: { pt: "Fluxograma de Pesquisa", en: "Research Flowchart" },
    prompt: { pt: "Fluxograma CONSORT de um ensaio clínico randomizado mostrando recrutamento, randomização, alocação, seguimento e análise", en: "CONSORT flowchart for a randomized clinical trial showing recruitment, randomization, allocation, follow-up, and analysis" },
    category: "methods",
  },
  {
    id: "statistics",
    icon: <BarChart3 className="h-5 w-5" />,
    label: { pt: "Diagrama Estatístico", en: "Statistical Diagram" },
    prompt: { pt: "Diagrama explicativo de uma meta-análise com forest plot, mostrando estudos individuais, intervalos de confiança e efeito combinado", en: "Meta-analysis explanatory diagram with forest plot, showing individual studies, confidence intervals, and pooled effect" },
    category: "methods",
  },
  {
    id: "pathway",
    icon: <Workflow className="h-5 w-5" />,
    label: { pt: "Via de Sinalização", en: "Signaling Pathway" },
    prompt: { pt: "Diagrama da via de sinalização MAPK/ERK mostrando receptor tirosina quinase, Ras, Raf, MEK, ERK e fatores de transcrição nucleares", en: "MAPK/ERK signaling pathway diagram showing receptor tyrosine kinase, Ras, Raf, MEK, ERK, and nuclear transcription factors" },
    category: "biology",
  },
];

interface Props {
  onSelect: (prompt: string) => void;
}

export default function IllustrationTemplates({ onSelect }: Props) {
  const { locale } = useLanguage();
  const lang = (locale as "pt" | "en") || "en";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
      {templates.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.prompt[lang])}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-center transition-all hover:border-primary/50 hover:shadow-sm hover:bg-accent/30"
        >
          <div className="rounded-lg bg-primary/10 p-2 text-primary">{t.icon}</div>
          <span className="text-xs font-medium text-foreground leading-tight">{t.label[lang]}</span>
        </button>
      ))}
    </div>
  );
}
