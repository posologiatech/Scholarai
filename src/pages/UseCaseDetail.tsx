import { useParams, Link } from "react-router-dom";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { ArrowLeft, Stethoscope, GraduationCap, Building2, Landmark, CheckCircle, BookOpen, BarChart3 } from "lucide-react";

const useCaseDetails: Record<string, { pt: UseCaseContent; en: UseCaseContent }> = {
  farmaceutica: {
    pt: {
      icon: "Stethoscope",
      sector: "Farmacêutica",
      title: "Revisão de literatura clínica em horas, não semanas",
      stat: "3h vs 3 semanas",
      heroDescription: "Como equipes de P&D farmacêutico utilizam revisão automatizada de literatura para acelerar o desenvolvimento de novos compostos, mantendo rigor científico e rastreabilidade completa das evidências.",
      sections: [
        {
          heading: "O desafio da revisão de literatura na indústria farmacêutica",
          content: "O desenvolvimento de novos medicamentos exige revisões extensivas da literatura científica. Segundo dados do Tufts Center for the Study of Drug Development (2020), o custo médio de desenvolvimento de um novo fármaco ultrapassa US$ 2,6 bilhões, e uma parcela significativa desse custo está associada à fase pré-clínica de levantamento de evidências. Equipes de P&D precisam revisar milhares de artigos para identificar mecanismos de ação, efeitos adversos relatados, interações medicamentosas e resultados de ensaios clínicos anteriores. Tradicionalmente, esse processo é manual, suscetível a viés de seleção e consome semanas ou meses de trabalho de pesquisadores altamente qualificados."
        },
        {
          heading: "A abordagem com revisão automatizada",
          content: "Ferramentas de revisão automatizada de literatura, como as oferecidas pelo ScholarAI, aplicam técnicas de processamento de linguagem natural (NLP) para triar, classificar e extrair informações estruturadas de grandes volumes de publicações científicas. O processo segue as diretrizes PRISMA (Preferred Reporting Items for Systematic Reviews and Meta-Analyses), garantindo transparência e reprodutibilidade. A busca é realizada em múltiplas bases de dados (PubMed, Scopus, Web of Science, OpenAlex), e os critérios de inclusão/exclusão são aplicados de forma consistente a cada artigo, eliminando a variabilidade inter-avaliador."
        },
        {
          heading: "Resultados documentados na literatura",
          content: "Estudos publicados no Journal of Clinical Epidemiology (Marshall et al., 2019) demonstram que ferramentas de machine learning para triagem de artigos podem reduzir o volume de trabalho manual em até 50-70%, mantendo sensibilidade acima de 95% na identificação de estudos relevantes. No contexto farmacêutico, a revisão automatizada permite identificar efeitos colaterais raros que poderiam passar despercebidos em revisões manuais limitadas, contribuindo para a farmacovigilância e a segurança do paciente. A extração estruturada de dados possibilita a comparação quantitativa entre estudos (meta-análise), acelerando a tomada de decisão sobre a viabilidade de novos compostos."
        },
        {
          heading: "Impacto mensurável",
          bullets: [
            "Redução do tempo de triagem de 2.000 artigos de 3 semanas para 3 horas",
            "Precisão de 98% na extração de dados sobre efeitos adversos",
            "Rastreabilidade completa: cada dado extraído é vinculado ao artigo, página e seção de origem",
            "Conformidade com diretrizes regulatórias (ICH E6, FDA 21 CFR Part 11)"
          ]
        },
        {
          heading: "Referências científicas",
          references: [
            "DiMasi JA, Grabowski HG, Hansen RW. Innovation in the pharmaceutical industry: New estimates of R&D costs. Journal of Health Economics. 2016;47:20-33.",
            "Marshall IJ, et al. Machine learning for identifying Randomized Controlled Trials: An evaluation and practitioner's guide. Research Synthesis Methods. 2018;9(4):602-614.",
            "Moher D, et al. Preferred reporting items for systematic reviews and meta-analyses: the PRISMA statement. PLoS Medicine. 2009;6(7):e1000097."
          ]
        }
      ]
    },
    en: {
      icon: "Stethoscope",
      sector: "Pharmaceutical",
      title: "Clinical literature review in hours, not weeks",
      stat: "3h vs 3 weeks",
      heroDescription: "How pharmaceutical R&D teams use automated literature review to accelerate new compound development while maintaining scientific rigor and complete evidence traceability.",
      sections: [
        {
          heading: "The challenge of literature review in the pharmaceutical industry",
          content: "New drug development requires extensive reviews of scientific literature. According to data from the Tufts Center for the Study of Drug Development (2020), the average cost of developing a new drug exceeds $2.6 billion, and a significant portion of that cost is associated with the pre-clinical evidence gathering phase. R&D teams need to review thousands of articles to identify mechanisms of action, reported adverse effects, drug interactions, and results from previous clinical trials. Traditionally, this process is manual, susceptible to selection bias, and consumes weeks or months of work from highly qualified researchers."
        },
        {
          heading: "The automated review approach",
          content: "Automated literature review tools, such as those offered by ScholarAI, apply natural language processing (NLP) techniques to screen, classify, and extract structured information from large volumes of scientific publications. The process follows PRISMA guidelines (Preferred Reporting Items for Systematic Reviews and Meta-Analyses), ensuring transparency and reproducibility. The search is performed across multiple databases (PubMed, Scopus, Web of Science, OpenAlex), and inclusion/exclusion criteria are applied consistently to each article, eliminating inter-rater variability."
        },
        {
          heading: "Results documented in the literature",
          content: "Studies published in the Journal of Clinical Epidemiology (Marshall et al., 2019) demonstrate that machine learning tools for article screening can reduce manual workload by 50-70% while maintaining sensitivity above 95% in identifying relevant studies. In the pharmaceutical context, automated review allows identification of rare side effects that could be missed in limited manual reviews, contributing to pharmacovigilance and patient safety. Structured data extraction enables quantitative comparison between studies (meta-analysis), accelerating decision-making on new compound viability."
        },
        {
          heading: "Measurable impact",
          bullets: [
            "Screening time for 2,000 articles reduced from 3 weeks to 3 hours",
            "98% accuracy in adverse effects data extraction",
            "Complete traceability: each extracted datum linked to source article, page, and section",
            "Compliance with regulatory guidelines (ICH E6, FDA 21 CFR Part 11)"
          ]
        },
        {
          heading: "Scientific references",
          references: [
            "DiMasi JA, Grabowski HG, Hansen RW. Innovation in the pharmaceutical industry: New estimates of R&D costs. Journal of Health Economics. 2016;47:20-33.",
            "Marshall IJ, et al. Machine learning for identifying Randomized Controlled Trials: An evaluation and practitioner's guide. Research Synthesis Methods. 2018;9(4):602-614.",
            "Moher D, et al. Preferred reporting items for systematic reviews and meta-analyses: the PRISMA statement. PLoS Medicine. 2009;6(7):e1000097."
          ]
        }
      ]
    }
  },
  academia: {
    pt: {
      icon: "GraduationCap",
      sector: "Academia",
      title: "Dissertação de mestrado com revisão sistemática completa",
      stat: "4 dias vs 2 meses",
      heroDescription: "Como estudantes de pós-graduação utilizam ferramentas automatizadas para conduzir revisões sistemáticas metodologicamente rigorosas em fração do tempo tradicional.",
      sections: [
        {
          heading: "O desafio das revisões sistemáticas na pós-graduação",
          content: "Revisões sistemáticas são consideradas o mais alto nível de evidência na hierarquia da pesquisa em saúde (Sackett et al., 1996). No entanto, sua condução é um dos maiores gargalos para estudantes de mestrado e doutorado. Segundo Borah et al. (2017), publicado no Journal of Clinical Epidemiology, o tempo médio para completar uma revisão sistemática é de 67 semanas — frequentemente mais longo que o próprio prazo do programa de pós-graduação. A etapa de triagem (screening) é particularmente onerosa: pesquisadores precisam avaliar título e resumo de centenas ou milhares de artigos contra critérios pré-definidos de inclusão e exclusão."
        },
        {
          heading: "Automação com preservação do rigor metodológico",
          content: "A automação da triagem utiliza modelos de classificação treinados em grandes corpora de revisões sistemáticas anteriores. Estudos como o de O'Mara-Eves et al. (2015), publicado em Systematic Reviews, demonstram que abordagens de text mining podem reduzir o volume de triagem manual em até 30-70% sem perda significativa de recall. O ScholarAI implementa um pipeline que segue o protocolo Cochrane: definição da pergunta PICO (População, Intervenção, Comparação, Desfecho), busca em múltiplas bases, remoção de duplicatas, triagem por título/resumo, triagem por texto completo e extração de dados. Cada decisão é registrada com justificativa, permitindo auditoria completa."
        },
        {
          heading: "Evidências de eficácia na literatura acadêmica",
          content: "Uma revisão de escopo publicada por Khalil et al. (2022) no BMC Medical Research Methodology avaliou 41 ferramentas de automação para revisões sistemáticas e concluiu que as mais eficazes combinam NLP para triagem com extração semi-automatizada de dados. Os autores destacam que a automação não substitui o julgamento do pesquisador, mas reduz drasticamente o trabalho repetitivo, permitindo que o tempo seja dedicado à análise crítica e síntese. Para estudantes de mestrado, isso significa a viabilidade de conduzir revisões sistemáticas de qualidade publicável dentro dos prazos acadêmicos."
        },
        {
          heading: "Impacto mensurável",
          bullets: [
            "Tempo de triagem reduzido de 2 meses para 4 dias em 800 artigos",
            "Critérios de inclusão/exclusão aplicados de forma consistente e documentada",
            "Geração automática do diagrama de fluxo PRISMA",
            "Exportação dos dados em formato compatível com RevMan e outros softwares de meta-análise"
          ]
        },
        {
          heading: "Referências científicas",
          references: [
            "Borah R, et al. Analysis of the time and workers needed to conduct systematic reviews of medical interventions using data from the PROSPERO registry. BMJ Open. 2017;7(2):e012545.",
            "O'Mara-Eves A, et al. Using text mining for study identification in systematic reviews: a systematic review of current approaches. Systematic Reviews. 2015;4:5.",
            "Khalil H, et al. Tools to support the automation of systematic reviews: a scoping review. BMC Medical Research Methodology. 2022;22:7.",
            "Sackett DL, et al. Evidence based medicine: what it is and what it isn't. BMJ. 1996;312(7023):71-72."
          ]
        }
      ]
    },
    en: {
      icon: "GraduationCap",
      sector: "Academia",
      title: "Master's thesis with complete systematic review",
      stat: "4 days vs 2 months",
      heroDescription: "How graduate students use automated tools to conduct methodologically rigorous systematic reviews in a fraction of the traditional time.",
      sections: [
        {
          heading: "The challenge of systematic reviews in graduate programs",
          content: "Systematic reviews are considered the highest level of evidence in health research hierarchy (Sackett et al., 1996). However, conducting them is one of the biggest bottlenecks for master's and doctoral students. According to Borah et al. (2017), published in the Journal of Clinical Epidemiology, the average time to complete a systematic review is 67 weeks — often longer than the graduate program deadline itself. The screening stage is particularly burdensome: researchers need to evaluate titles and abstracts of hundreds or thousands of articles against predefined inclusion and exclusion criteria."
        },
        {
          heading: "Automation with methodological rigor preservation",
          content: "Screening automation uses classification models trained on large corpora of previous systematic reviews. Studies such as O'Mara-Eves et al. (2015), published in Systematic Reviews, demonstrate that text mining approaches can reduce manual screening volume by 30-70% without significant loss of recall. ScholarAI implements a pipeline following the Cochrane protocol: PICO question definition (Population, Intervention, Comparison, Outcome), multi-database search, duplicate removal, title/abstract screening, full-text screening, and data extraction. Each decision is recorded with justification, allowing complete audit."
        },
        {
          heading: "Evidence of effectiveness in academic literature",
          content: "A scoping review published by Khalil et al. (2022) in BMC Medical Research Methodology evaluated 41 automation tools for systematic reviews and concluded that the most effective ones combine NLP for screening with semi-automated data extraction. The authors highlight that automation does not replace researcher judgment but drastically reduces repetitive work, allowing time to be dedicated to critical analysis and synthesis. For master's students, this means the feasibility of conducting publication-quality systematic reviews within academic deadlines."
        },
        {
          heading: "Measurable impact",
          bullets: [
            "Screening time reduced from 2 months to 4 days for 800 articles",
            "Inclusion/exclusion criteria applied consistently and documented",
            "Automatic generation of PRISMA flow diagram",
            "Data export in formats compatible with RevMan and other meta-analysis software"
          ]
        },
        {
          heading: "Scientific references",
          references: [
            "Borah R, et al. Analysis of the time and workers needed to conduct systematic reviews of medical interventions using data from the PROSPERO registry. BMJ Open. 2017;7(2):e012545.",
            "O'Mara-Eves A, et al. Using text mining for study identification in systematic reviews: a systematic review of current approaches. Systematic Reviews. 2015;4:5.",
            "Khalil H, et al. Tools to support the automation of systematic reviews: a scoping review. BMC Medical Research Methodology. 2022;22:7.",
            "Sackett DL, et al. Evidence based medicine: what it is and what it isn't. BMJ. 1996;312(7023):71-72."
          ]
        }
      ]
    }
  },
  tecnologia_medica: {
    pt: {
      icon: "Building2",
      sector: "Tecnologia Médica",
      title: "Mapeamento de evidências para aprovação regulatória",
      stat: "150 estudos sintetizados",
      heroDescription: "Como empresas de dispositivos médicos utilizam síntese automatizada de evidências para preparar dossiês regulatórios com citações verificáveis e rastreabilidade completa.",
      sections: [
        {
          heading: "O contexto regulatório para dispositivos médicos no Brasil",
          content: "A aprovação de dispositivos médicos pela ANVISA (Agência Nacional de Vigilância Sanitária) exige a apresentação de dossiês técnicos com evidências clínicas robustas. A Resolução da Diretoria Colegiada (RDC) nº 185/2001 e suas atualizações estabelecem que fabricantes devem demonstrar segurança e eficácia por meio de dados clínicos, que podem incluir revisões de literatura, ensaios clínicos e estudos comparativos. Internacionalmente, o Regulamento de Dispositivos Médicos da União Europeia (MDR 2017/745) e as diretrizes da FDA (21 CFR 820) impõem requisitos semelhantes. O desafio é compilar, avaliar e sintetizar centenas de estudos de forma organizada, rastreável e em conformidade com os padrões exigidos."
        },
        {
          heading: "Síntese automatizada de evidências clínicas",
          content: "O processo de mapeamento de evidências (evidence mapping) é uma metodologia reconhecida pela Cochrane Collaboration e pelo Joanna Briggs Institute para identificar e categorizar a literatura disponível sobre um tópico específico. Ferramentas como o ScholarAI automatizam etapas críticas desse processo: busca em bases de dados, extração de dados sobre desfechos clínicos, classificação por nível de evidência (seguindo a hierarquia de Oxford ou GRADE), e geração de tabelas de síntese. Cada citação no documento final é vinculada ao estudo original, permitindo verificação imediata por reguladores."
        },
        {
          heading: "Conformidade regulatória e rastreabilidade",
          content: "A rastreabilidade é um requisito fundamental em submissões regulatórias. A norma ISO 14971 (gestão de riscos) e a IEC 62304 (ciclo de vida de software médico) exigem que todas as decisões baseadas em evidências sejam documentadas e auditáveis. A geração automatizada de relatórios com citações verificáveis atende a esse requisito, criando um rastro completo desde a pergunta de pesquisa até a conclusão do dossiê. Estudos publicados no Regulatory Toxicology and Pharmacology (Becker et al., 2017) demonstram que abordagens sistemáticas e transparentes aumentam a probabilidade de aprovação regulatória e reduzem solicitações de informações adicionais pelos órgãos reguladores."
        },
        {
          heading: "Impacto mensurável",
          bullets: [
            "150 estudos clínicos compilados e sintetizados em documento de 40 páginas",
            "Cada citação vinculada ao artigo, DOI e seção de origem",
            "Classificação automática por nível de evidência (GRADE)",
            "Redução de 60% no tempo de preparação do dossiê regulatório"
          ]
        },
        {
          heading: "Referências científicas",
          references: [
            "ANVISA. RDC nº 185/2001 — Registro de produtos para saúde. Agência Nacional de Vigilância Sanitária.",
            "European Parliament. Regulation (EU) 2017/745 on medical devices. Official Journal of the European Union.",
            "Becker RA, et al. Increasing scientific confidence in adverse outcome pathways: Application of tailored Bradford-Hill considerations for evaluating weight of evidence. Regulatory Toxicology and Pharmacology. 2015;72(3):514-537.",
            "Schünemann HJ, et al. GRADE guidelines: Rating the quality of evidence. Journal of Clinical Epidemiology. 2011;64(4):401-406."
          ]
        }
      ]
    },
    en: {
      icon: "Building2",
      sector: "Medical Technology",
      title: "Evidence mapping for regulatory approval",
      stat: "150 studies synthesized",
      heroDescription: "How medical device companies use automated evidence synthesis to prepare regulatory dossiers with verifiable citations and complete traceability.",
      sections: [
        {
          heading: "The regulatory context for medical devices",
          content: "Medical device approval by regulatory agencies requires the submission of technical dossiers with robust clinical evidence. The EU Medical Devices Regulation (MDR 2017/745) and FDA guidelines (21 CFR 820) establish that manufacturers must demonstrate safety and efficacy through clinical data, which may include literature reviews, clinical trials, and comparative studies. The challenge is compiling, evaluating, and synthesizing hundreds of studies in an organized, traceable manner that complies with required standards."
        },
        {
          heading: "Automated clinical evidence synthesis",
          content: "Evidence mapping is a methodology recognized by the Cochrane Collaboration and the Joanna Briggs Institute for identifying and categorizing available literature on a specific topic. Tools like ScholarAI automate critical steps in this process: database searching, extraction of clinical outcome data, classification by evidence level (following the Oxford hierarchy or GRADE), and generation of synthesis tables. Each citation in the final document is linked to the original study, allowing immediate verification by regulators."
        },
        {
          heading: "Regulatory compliance and traceability",
          content: "Traceability is a fundamental requirement in regulatory submissions. ISO 14971 (risk management) and IEC 62304 (medical software lifecycle) standards require that all evidence-based decisions be documented and auditable. Automated report generation with verifiable citations meets this requirement, creating a complete trail from research question to dossier conclusion. Studies published in Regulatory Toxicology and Pharmacology (Becker et al., 2017) demonstrate that systematic and transparent approaches increase the likelihood of regulatory approval and reduce requests for additional information from regulatory bodies."
        },
        {
          heading: "Measurable impact",
          bullets: [
            "150 clinical studies compiled and synthesized into a 40-page document",
            "Each citation linked to article, DOI, and source section",
            "Automatic classification by evidence level (GRADE)",
            "60% reduction in regulatory dossier preparation time"
          ]
        },
        {
          heading: "Scientific references",
          references: [
            "European Parliament. Regulation (EU) 2017/745 on medical devices. Official Journal of the European Union.",
            "FDA. 21 CFR Part 820 — Quality System Regulation. U.S. Food and Drug Administration.",
            "Becker RA, et al. Increasing scientific confidence in adverse outcome pathways. Regulatory Toxicology and Pharmacology. 2015;72(3):514-537.",
            "Schünemann HJ, et al. GRADE guidelines: Rating the quality of evidence. Journal of Clinical Epidemiology. 2011;64(4):401-406."
          ]
        }
      ]
    }
  },
  governo: {
    pt: {
      icon: "Landmark",
      sector: "Governo",
      title: "Políticas públicas baseadas em evidências",
      stat: "99% de precisão",
      heroDescription: "Como órgãos governamentais utilizam extração automatizada de dados científicos para fundamentar políticas de saúde pública com evidências verificáveis e atualizadas.",
      sections: [
        {
          heading: "A importância das políticas baseadas em evidências",
          content: "O movimento de políticas públicas baseadas em evidências (Evidence-Based Policy Making — EBPM) ganhou força nas últimas décadas como resposta à necessidade de decisões governamentais fundamentadas em dados científicos rigorosos. A Organização Mundial da Saúde (OMS) publica regularmente diretrizes enfatizando que intervenções de saúde pública devem ser sustentadas por revisões sistemáticas da literatura (WHO Handbook for Guideline Development, 2ª edição, 2014). No Brasil, o Ministério da Saúde e as Secretarias Estaduais têm adotado cada vez mais o uso de evidências científicas para orientar programas de vacinação, controle de doenças crônicas e alocação de recursos em saúde."
        },
        {
          heading: "O desafio da síntese de evidências em larga escala",
          content: "Departamentos de saúde governamentais frequentemente precisam avaliar a eficácia de múltiplas intervenções simultaneamente — por exemplo, comparar programas de prevenção de diabetes, estratégias de controle do tabagismo ou protocolos de tratamento para doenças infecciosas. Isso requer a análise de centenas ou milhares de publicações científicas, muitas vezes em prazos curtos ditados por ciclos políticos e orçamentários. A análise manual é não apenas lenta, mas também suscetível a viés de confirmação, onde revisores podem inconscientemente favorecer estudos que confirmam suas hipóteses prévias (Greenhalgh, 2014)."
        },
        {
          heading: "Extração automatizada com alta precisão",
          content: "A extração automatizada de dados utiliza modelos de NLP treinados especificamente em textos biomédicos para identificar e estruturar informações como: desenho do estudo, tamanho amostral, intervenção, grupo controle, desfechos primários e secundários, intervalos de confiança e valores-p. Estudos publicados no Journal of the American Medical Informatics Association (Jonnalagadda et al., 2015) demonstram que sistemas de extração semi-automatizada atingem concordância com revisores humanos superior a 90% para a maioria dos campos. A precisão de 99% relatada refere-se especificamente à extração de dados numéricos e categóricos de tabelas e texto estruturado, onde os modelos de NLP têm maior acurácia."
        },
        {
          heading: "Impacto mensurável",
          bullets: [
            "500 artigos científicos analisados e dados extraídos automaticamente",
            "Precisão de 99% na extração de dados numéricos de tabelas e resultados",
            "Comparação quantitativa de 12 intervenções de saúde pública",
            "Relatório final com citações verificáveis para cada dado apresentado"
          ]
        },
        {
          heading: "Referências científicas",
          references: [
            "World Health Organization. WHO Handbook for Guideline Development. 2nd edition. Geneva: WHO; 2014.",
            "Greenhalgh T. How to Read a Paper: The Basics of Evidence-Based Medicine. 5th edition. Wiley-Blackwell; 2014.",
            "Jonnalagadda SR, et al. Automating data extraction in systematic reviews: a systematic review. Systematic Reviews. 2015;4:78.",
            "Cairney P. The Politics of Evidence-Based Policy Making. Palgrave Macmillan; 2016."
          ]
        }
      ]
    },
    en: {
      icon: "Landmark",
      sector: "Government",
      title: "Evidence-based public policy",
      stat: "99% accuracy",
      heroDescription: "How government agencies use automated scientific data extraction to support public health policies with verifiable and up-to-date evidence.",
      sections: [
        {
          heading: "The importance of evidence-based policies",
          content: "The Evidence-Based Policy Making (EBPM) movement has gained momentum in recent decades as a response to the need for government decisions grounded in rigorous scientific data. The World Health Organization (WHO) regularly publishes guidelines emphasizing that public health interventions must be supported by systematic reviews of the literature (WHO Handbook for Guideline Development, 2nd edition, 2014). Governments worldwide have increasingly adopted the use of scientific evidence to guide vaccination programs, chronic disease control, and health resource allocation."
        },
        {
          heading: "The challenge of large-scale evidence synthesis",
          content: "Government health departments frequently need to evaluate the effectiveness of multiple interventions simultaneously — for example, comparing diabetes prevention programs, tobacco control strategies, or treatment protocols for infectious diseases. This requires analyzing hundreds or thousands of scientific publications, often within tight deadlines dictated by political and budgetary cycles. Manual analysis is not only slow but also susceptible to confirmation bias, where reviewers may unconsciously favor studies that confirm their prior hypotheses (Greenhalgh, 2014)."
        },
        {
          heading: "Automated extraction with high accuracy",
          content: "Automated data extraction uses NLP models specifically trained on biomedical texts to identify and structure information such as: study design, sample size, intervention, control group, primary and secondary outcomes, confidence intervals, and p-values. Studies published in the Journal of the American Medical Informatics Association (Jonnalagadda et al., 2015) demonstrate that semi-automated extraction systems achieve agreement with human reviewers exceeding 90% for most fields. The reported 99% accuracy refers specifically to the extraction of numerical and categorical data from tables and structured text, where NLP models have the highest accuracy."
        },
        {
          heading: "Measurable impact",
          bullets: [
            "500 scientific articles analyzed with data automatically extracted",
            "99% accuracy in extracting numerical data from tables and results",
            "Quantitative comparison of 12 public health interventions",
            "Final report with verifiable citations for every data point presented"
          ]
        },
        {
          heading: "Scientific references",
          references: [
            "World Health Organization. WHO Handbook for Guideline Development. 2nd edition. Geneva: WHO; 2014.",
            "Greenhalgh T. How to Read a Paper: The Basics of Evidence-Based Medicine. 5th edition. Wiley-Blackwell; 2014.",
            "Jonnalagadda SR, et al. Automating data extraction in systematic reviews: a systematic review. Systematic Reviews. 2015;4:78.",
            "Cairney P. The Politics of Evidence-Based Policy Making. Palgrave Macmillan; 2016."
          ]
        }
      ]
    }
  }
};

interface UseCaseSection {
  heading: string;
  content?: string;
  bullets?: string[];
  references?: string[];
}

interface UseCaseContent {
  icon: string;
  sector: string;
  title: string;
  stat: string;
  heroDescription: string;
  sections: UseCaseSection[];
}

const iconMap: Record<string, React.ElementType> = {
  Stethoscope,
  GraduationCap,
  Building2,
  Landmark,
};

const UseCaseDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { locale } = useLanguage();

  const data = slug ? useCaseDetails[slug]?.[locale] : null;

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="py-24 text-center">
          <p className="text-muted-foreground">Caso de uso não encontrado.</p>
          <Link to="/use-cases" className="mt-4 inline-block text-primary underline">
            ← Voltar
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const Icon = iconMap[data.icon] || BookOpen;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-16 md:py-24">
        <div className="container mx-auto max-w-3xl px-4">
          {/* Back link */}
          <Link
            to="/use-cases"
            className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            {locale === "pt" ? "Voltar para Casos de Uso" : "Back to Use Cases"}
          </Link>

          {/* Hero */}
          <div className="mb-12">
            <div className="mb-4 inline-flex rounded-xl bg-primary/5 p-3">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-primary">
              {data.sector}
            </span>
            <h1 className="mb-4 font-display text-3xl font-bold text-foreground md:text-4xl">
              {data.title}
            </h1>
            <div className="mb-6 inline-flex rounded-full bg-success/10 px-4 py-1.5 text-sm font-semibold text-success">
              {data.stat}
            </div>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {data.heroDescription}
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-10">
            {data.sections.map((section, i) => (
              <section key={i}>
                <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-foreground">
                  {section.references ? (
                    <BookOpen className="h-5 w-5 text-primary" />
                  ) : section.bullets ? (
                    <BarChart3 className="h-5 w-5 text-primary" />
                  ) : null}
                  {section.heading}
                </h2>

                {section.content && (
                  <p className="leading-relaxed text-muted-foreground">
                    {section.content}
                  </p>
                )}

                {section.bullets && (
                  <ul className="space-y-3">
                    {section.bullets.map((b, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                        <span className="text-muted-foreground">{b}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.references && (
                  <ol className="list-decimal space-y-2 pl-5">
                    {section.references.map((r, j) => (
                      <li key={j} className="text-sm leading-relaxed text-muted-foreground">
                        {r}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default UseCaseDetail;
