export interface CAPESAgreement {
  id: string;
  publisher: string;
  description: string;
  journalCount: string;
  eligibleInstitutions: number;
  scopeAreas: string[];
  links: {
    label: string;
    url: string;
  }[];
  highlights: string[];
}

export const CAPES_AGREEMENTS: CAPESAgreement[] = [
  {
    id: "springer-nature",
    publisher: "Springer Nature",
    description: "Acordo de Leitura e Publicação com acesso irrestrito a 1.763 títulos de periódicos, sendo 1.738 híbridos aptos para publicação em acesso aberto.",
    journalCount: "1.738 periódicos híbridos",
    eligibleInstitutions: 435,
    scopeAreas: ["Multidisciplinar", "Ciências Biológicas", "Ciências Exatas", "Engenharias", "Ciências da Saúde", "Ciências Sociais", "Ciências Humanas"],
    links: [
      { label: "Instituições elegíveis", url: "https://resource-preview-cms.springernature.com/springer-cms/rest/v1/content/27829128/data/v7" },
      { label: "Periódicos elegíveis", url: "https://www.periodicos.capes.gov.br/images/documents/Eligible+journals%2031122025_Springer%20Nature.pdf" },
      { label: "Guia do autor", url: "https://www.periodicos.capes.gov.br/images/documents/Author+guide+PT_Springer%20Nature.pdf" },
    ],
    highlights: ["Maior catálogo entre os acordos", "Nature Portfolio incluso", "Processo de aprovação via Springer Author Portal"],
  },
  {
    id: "elsevier",
    publisher: "Elsevier",
    description: "Acordo contemplando 434 instituições brasileiras elegíveis para submissão em 1.619 periódicos híbridos da Freedom Collection.",
    journalCount: "1.619 periódicos híbridos (Freedom Collection)",
    eligibleInstitutions: 434,
    scopeAreas: ["Multidisciplinar", "Ciências da Saúde", "Engenharias", "Ciências Biológicas", "Ciências Exatas", "Ciências Agrárias"],
    links: [
      { label: "Saiba mais (Elsevier Brasil)", url: "https://www.elsevier.com/pt-br/open-access/agreements/brazil" },
    ],
    highlights: ["Freedom Collection completa", "Inclui Lancet, Cell e outros periódicos de alto impacto", "Submissão via Editorial Manager"],
  },
  {
    id: "acm",
    publisher: "Association for Computing Machinery (ACM)",
    description: "Acordo para publicação em periódicos da ACM, vigente desde dezembro de 2025. Pesquisadores podem submeter diretamente na página do periódico.",
    journalCount: "Periódicos ACM listados em PDF",
    eligibleInstitutions: 434,
    scopeAreas: ["Ciência da Computação", "Tecnologia da Informação", "Engenharia de Software", "Inteligência Artificial", "Sistemas de Informação"],
    links: [
      { label: "Instituições elegíveis", url: "https://www.periodicos.capes.gov.br/images/documents/Lista%20de%20IES_ACM.pdf" },
      { label: "Periódicos elegíveis", url: "https://www.periodicos.capes.gov.br/images/documents/Peri%C3%B3dicos%20para%20Publica%C3%A7%C3%A3o%20ACM.pdf" },
    ],
    highlights: ["Foco em Computação e TI", "Submissão direta na página do periódico", "ACM Digital Library inclusa"],
  },
  {
    id: "rsp",
    publisher: "Royal Society Publishing (RSP)",
    description: "Acordo com a academia científica mais antiga com existência contínua (desde 1660). Acesso para leitura e publicação em 10 periódicos.",
    journalCount: "10 periódicos",
    eligibleInstitutions: 260,
    scopeAreas: ["Ciências Biológicas", "Ciências Exatas", "Física", "Matemática", "Química", "Engenharias"],
    links: [
      { label: "Saiba mais (PDF)", url: "https://www.periodicos.capes.gov.br/images/documents/Acordo%20CAPES%E2%80%93Royal%20Society_%20Publica%C3%A7%C3%A3o%20em%20Acesso%20Aberto%20Sem%20Custos%20_%20Royal%20Society.pdf" },
    ],
    highlights: ["Proceedings of the Royal Society A & B", "Philosophical Transactions", "Alta tradição científica"],
  },
  {
    id: "wiley",
    publisher: "Wiley",
    description: "Acordo que garante publicação ilimitada em acesso aberto nos periódicos híbridos da Wiley, beneficiando 434 instituições.",
    journalCount: "Periódicos híbridos (publicação ilimitada)",
    eligibleInstitutions: 434,
    scopeAreas: ["Multidisciplinar", "Ciências da Saúde", "Engenharias", "Ciências Biológicas", "Ciências Sociais", "Ciências Humanas"],
    links: [
      { label: "Saiba mais (Wiley OA)", url: "https://www.wiley.com/en-br/publish/open-access/oa-agreement" },
    ],
    highlights: ["Publicação ilimitada em acesso aberto", "Mais de mil revistas científicas", "Wiley Online Library"],
  },
  {
    id: "ieee",
    publisher: "Institute of Electrical and Electronics Engineers (IEEE)",
    description: "Acordo vigente desde novembro de 2024 para pagamento de APC em publicações IEEE, incluindo o IEEE Access com 100% de conteúdo aberto.",
    journalCount: "IEEE Access + outros periódicos",
    eligibleInstitutions: 434,
    scopeAreas: ["Engenharia Elétrica", "Engenharia Eletrônica", "Ciência da Computação", "Telecomunicações", "Automação", "Energia"],
    links: [
      { label: "Saiba mais (IEEE OA Partners)", url: "https://open.ieee.org/partners/capes-transformative-agreement/" },
    ],
    highlights: ["IEEE Access (100% acesso aberto)", "Relevante para engenharias e tecnologia", "Alto fator de impacto em áreas técnicas"],
  },
  {
    id: "acs",
    publisher: "American Chemical Society (ACS)",
    description: "Acordo que permite publicação em acesso aberto nos periódicos ACS sem custo para o pesquisador, após aprovação por revisão por pares.",
    journalCount: "Periódicos ACS de Química e áreas correlatas",
    eligibleInstitutions: 434,
    scopeAreas: ["Química", "Bioquímica", "Engenharia Química", "Ciência dos Materiais", "Farmacologia", "Ciências Ambientais"],
    links: [
      { label: "Saiba mais (ACS Open Science)", url: "https://acsopenscience.org/customers/capes/" },
    ],
    highlights: ["Foco em Química e áreas correlatas", "Publicação sem custo após peer review", "JACS, ACS Nano e outros de alto impacto"],
  },
];

export const CAPES_GENERAL_LINKS = {
  portaria120: "https://cad.capes.gov.br/ato-administrativo-detalhar?idAtoAdmElastic=14902#anchor",
  orcidCadastro: "https://meusdados.capes.gov.br/",
  powerBiDashboard: "https://app.powerbi.com/view?r=eyJrIjoiMTY1YTA3N2EtZmYwZC00ZjBiLWFmYjUtNzIxMTBkOThlY2FkIiwidCI6IjJmNGRlYmI4LTY0M2EtNGRiZS05MjdiLTllNTYyZWY3MDBiOSJ9",
  faq: "https://www.periodicos.capes.gov.br/index.php/ajuda/perguntas-frequentes.html",
  portalPeriodicos: "https://www.periodicos.capes.gov.br/index.php/acessoaberto/acordos-transformativos.html",
};

export const CAPES_REQUIREMENTS = [
  "Possuir ORCID válido cadastrado em meusdados.capes.gov.br na seção 'Identificadores'",
  "Atender aos requisitos do art. 10 da Portaria nº 120/2024",
  "Estar vinculado a uma instituição elegível no acordo da editora",
  "O artigo deve ser aprovado no processo de revisão por pares do periódico",
  "O autor correspondente deve estar afiliado a uma instituição brasileira elegível",
];
