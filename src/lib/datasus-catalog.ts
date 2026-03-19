// DataSUS/TabNet catalog — bases, agravos, UFs, códigos IBGE

export interface TabNetBase {
  id: string;
  label: string;
  labelEn: string;
  description: string;
  baseUrl: string;
  defFile: string;
  availableYears: number[];
  filePrefix: string;
}

export const TABNET_BASES: TabNetBase[] = [
  {
    id: "sinan_dengue",
    label: "SINAN - Dengue",
    labelEn: "SINAN - Dengue",
    description: "Casos notificados de Dengue",
    baseUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe",
    defFile: "sinannet/cnv/denguebrn.def",
    availableYears: [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
    filePrefix: "denguebrn",
  },
  {
    id: "sinan_chikungunya",
    label: "SINAN - Chikungunya",
    labelEn: "SINAN - Chikungunya",
    description: "Casos notificados de Chikungunya",
    baseUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe",
    defFile: "sinannet/cnv/chikibrn.def",
    availableYears: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
    filePrefix: "chikibrn",
  },
  {
    id: "sinan_tuberculose",
    label: "SINAN - Tuberculose",
    labelEn: "SINAN - Tuberculosis",
    description: "Casos notificados de Tuberculose",
    baseUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe",
    defFile: "sinannet/cnv/tubercbrn.def",
    availableYears: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    filePrefix: "tubercbrn",
  },
  {
    id: "sinan_hanseniase",
    label: "SINAN - Hanseníase",
    labelEn: "SINAN - Leprosy",
    description: "Casos notificados de Hanseníase",
    baseUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe",
    defFile: "sinannet/cnv/hansbrn.def",
    availableYears: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    filePrefix: "hansbrn",
  },
  {
    id: "sim",
    label: "SIM - Mortalidade",
    labelEn: "SIM - Mortality",
    description: "Sistema de Informação sobre Mortalidade",
    baseUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe",
    defFile: "sim/cnv/obt10br.def",
    availableYears: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022],
    filePrefix: "obt10br",
  },
  {
    id: "sinasc",
    label: "SINASC - Nascidos Vivos",
    labelEn: "SINASC - Live Births",
    description: "Sistema de Informação sobre Nascidos Vivos",
    baseUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe",
    defFile: "sinasc/cnv/nvbr.def",
    availableYears: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022],
    filePrefix: "nvbr",
  },
  {
    id: "sih",
    label: "SIH - Internações",
    labelEn: "SIH - Hospitalizations",
    description: "Sistema de Informações Hospitalares",
    baseUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe",
    defFile: "sih/cnv/nirbr.def",
    availableYears: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
    filePrefix: "nirbr",
  },
];

export interface UF {
  code: string;
  ibge: string;
  name: string;
  region: string;
}

export const UFS: UF[] = [
  { code: "AC", ibge: "12", name: "Acre", region: "Norte" },
  { code: "AL", ibge: "27", name: "Alagoas", region: "Nordeste" },
  { code: "AP", ibge: "16", name: "Amapá", region: "Norte" },
  { code: "AM", ibge: "13", name: "Amazonas", region: "Norte" },
  { code: "BA", ibge: "29", name: "Bahia", region: "Nordeste" },
  { code: "CE", ibge: "23", name: "Ceará", region: "Nordeste" },
  { code: "DF", ibge: "53", name: "Distrito Federal", region: "Centro-Oeste" },
  { code: "ES", ibge: "32", name: "Espírito Santo", region: "Sudeste" },
  { code: "GO", ibge: "52", name: "Goiás", region: "Centro-Oeste" },
  { code: "MA", ibge: "21", name: "Maranhão", region: "Nordeste" },
  { code: "MT", ibge: "51", name: "Mato Grosso", region: "Centro-Oeste" },
  { code: "MS", ibge: "50", name: "Mato Grosso do Sul", region: "Centro-Oeste" },
  { code: "MG", ibge: "31", name: "Minas Gerais", region: "Sudeste" },
  { code: "PA", ibge: "15", name: "Pará", region: "Norte" },
  { code: "PB", ibge: "25", name: "Paraíba", region: "Nordeste" },
  { code: "PR", ibge: "41", name: "Paraná", region: "Sul" },
  { code: "PE", ibge: "26", name: "Pernambuco", region: "Nordeste" },
  { code: "PI", ibge: "22", name: "Piauí", region: "Nordeste" },
  { code: "RJ", ibge: "33", name: "Rio de Janeiro", region: "Sudeste" },
  { code: "RN", ibge: "24", name: "Rio Grande do Norte", region: "Nordeste" },
  { code: "RS", ibge: "43", name: "Rio Grande do Sul", region: "Sul" },
  { code: "RO", ibge: "11", name: "Rondônia", region: "Norte" },
  { code: "RR", ibge: "14", name: "Roraima", region: "Norte" },
  { code: "SC", ibge: "42", name: "Santa Catarina", region: "Sul" },
  { code: "SP", ibge: "35", name: "São Paulo", region: "Sudeste" },
  { code: "SE", ibge: "28", name: "Sergipe", region: "Nordeste" },
  { code: "TO", ibge: "17", name: "Tocantins", region: "Norte" },
];

export const REGIONS = [
  { id: "norte", label: "Norte", ufs: ["AC", "AP", "AM", "PA", "RO", "RR", "TO"] },
  { id: "nordeste", label: "Nordeste", ufs: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"] },
  { id: "sudeste", label: "Sudeste", ufs: ["ES", "MG", "RJ", "SP"] },
  { id: "sul", label: "Sul", ufs: ["PR", "RS", "SC"] },
  { id: "centro-oeste", label: "Centro-Oeste", ufs: ["DF", "GO", "MT", "MS"] },
];

export const MAJOR_CITIES: Record<string, string> = {
  "São Paulo": "355030",
  "Rio de Janeiro": "330455",
  "Brasília": "530010",
  "Salvador": "292740",
  "Fortaleza": "230440",
  "Belo Horizonte": "310620",
  "Manaus": "130260",
  "Curitiba": "410690",
  "Recife": "261160",
  "Goiânia": "520870",
  "Belém": "150140",
  "Porto Alegre": "431490",
  "São Luís": "211130",
  "Maceió": "270430",
  "Campo Grande": "500270",
  "Natal": "240810",
  "Teresina": "221100",
  "João Pessoa": "250750",
  "Aracaju": "280030",
  "Cuiabá": "510340",
  "Florianópolis": "420540",
  "Vitória": "320530",
  "Palmas": "172100",
  "Macapá": "160030",
  "Porto Velho": "110020",
  "Rio Branco": "120040",
  "Boa Vista": "140010",
};

export const CID10_COMMON: Record<string, string> = {
  "A90": "Dengue",
  "A91": "Febre hemorrágica devida ao vírus da dengue",
  "A92.0": "Chikungunya",
  "A15": "Tuberculose respiratória",
  "A30": "Hanseníase",
  "B24": "HIV/AIDS",
  "A01": "Febre tifóide e paratifóide",
  "A09": "Diarréia e gastroenterite",
  "B05": "Sarampo",
  "B06": "Rubéola",
  "J09-J18": "Influenza e pneumonia",
  "U07.1": "COVID-19",
  "B50-B54": "Malária",
  "A75-A79": "Rickettsioses",
  "A27": "Leptospirose",
  "B57": "Doença de Chagas",
  "B55": "Leishmaniose",
  "A37": "Coqueluche",
  "A36": "Difteria",
  "A33-A35": "Tétano",
};

export const EXAMPLE_QUERIES = {
  pt: [
    "Qual foi a evolução dos casos de dengue em São Paulo nos últimos 5 anos?",
    "Mortalidade geral por UF no Sudeste de 2015 a 2022",
    "Casos de SRAG e COVID-19 no Brasil de 2021 a 2024",
    "Notificações de tuberculose no Nordeste de 2015 a 2023",
    "Casos de hanseníase por estado no Brasil nos últimos 10 anos",
    "Nascidos vivos por estado na região Sul de 2015 a 2022",
    "Casos de influenza/gripe no Sudeste em 2022 e 2023",
    "Evolução de óbitos por tuberculose em Minas Gerais nos últimos 10 anos",
  ],
  en: [
    "How did dengue cases evolve in São Paulo over the last 5 years?",
    "Overall mortality by state in Southeast Brazil from 2015 to 2022",
    "SRAG and COVID-19 cases in Brazil from 2021 to 2024",
    "Tuberculosis notifications in Northeast Brazil from 2015 to 2023",
    "Leprosy cases by state in Brazil over the last 10 years",
    "Live births by state in Southern Brazil from 2015 to 2022",
    "Influenza cases in Southeast Brazil in 2022 and 2023",
    "Tuberculosis death trends in Minas Gerais over the last 10 years",
  ],
};

export const DATASUS_SYSTEM_PROMPT = `Você é um especialista em epidemiologia e saúde pública brasileira, com profundo conhecimento do DataSUS, TabNet e dos sistemas de informação em saúde do Brasil (SINAN, SIM, SINASC, SIH, SIA).

Sua tarefa é interpretar perguntas de pesquisadores sobre dados epidemiológicos e gerar código Python para consultar o TabNet do DataSUS.

## Bases de dados disponíveis:
- SINAN (doenças de notificação): dengue, chikungunya, tuberculose, hanseníase, HIV/AIDS, etc.
- SIM (mortalidade): óbitos por causa (CID-10), faixa etária, sexo, localidade
- SINASC (nascidos vivos): nascimentos, peso ao nascer, tipo de parto
- SIH (internações hospitalares): AIHs, diagnóstico, procedimento, custo

## Regras para geração de código:
1. Use SEMPRE f-strings para formatação (NUNCA use .format())
2. Use pandas para manipulação de dados
3. Use matplotlib/seaborn para gráficos
4. Imprima os dados tabulares com print() e show_table() quando disponível
5. Sempre inclua tratamento de erros com try/except
6. Os dados devem ser simulados de forma realista quando o acesso direto ao TabNet não funcionar
7. Gere dados que reflitam padrões epidemiológicos reais do Brasil
8. Inclua sempre a fonte e o período dos dados no output
9. Crie visualizações claras com títulos em português
10. Use variáveis intermediárias para textos longos

## Mapeamento de UFs (código IBGE):
${UFS.map(uf => `${uf.name}: ${uf.ibge} (${uf.code})`).join(", ")}

## Cidades principais (código IBGE):
${Object.entries(MAJOR_CITIES).map(([city, code]) => `${city}: ${code}`).join(", ")}

## CID-10 comuns:
${Object.entries(CID10_COMMON).map(([code, name]) => `${code}: ${name}`).join(", ")}

Ao gerar código, considere:
- Dados do SINAN são tipicamente disponíveis com 1-2 anos de atraso
- O TabNet pode não responder — gere dados simulados realistas como fallback
- Sempre mostre tendências temporais quando a pergunta envolver evolução
- Inclua análise interpretativa nos prints (ex: "Observa-se um aumento de X%...")
`;
