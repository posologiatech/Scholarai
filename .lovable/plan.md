

# Plano: Integração DataSUS/SINAN no Módulo de Pesquisa

## Visão Geral

Criar uma funcionalidade de consulta inteligente ao DataSUS/SINAN via chat, onde o usuário faz perguntas em linguagem natural e o sistema busca, analisa e visualiza dados epidemiológicos automaticamente.

## Desafio Técnico Principal

O DataSUS/TabNet não possui uma API REST pública. Os dados são acessíveis via:
- **TabNet** (interface web com formulários POST complexos)
- **Arquivos .DBC/.DBF** (microdados para download)
- **PySUS** (biblioteca Python que faz scraping do TabNet)

Como o Lovable não suporta backend Python (FastAPI), a estratégia será usar o **Pyodide (WebAssembly)** já existente no DataMind para executar PySUS diretamente no navegador, combinado com uma Edge Function de IA que interpreta a pergunta e gera o código de consulta.

## Arquitetura

```text
┌─────────────────────────────────────────────────────┐
│  Frontend (React)                                    │
│  ┌──────────────┐    ┌───────────────────────────┐  │
│  │ DataSUS Chat │───▶│ Edge Function             │  │
│  │ (pergunta)   │    │ datasus-query             │  │
│  │              │◀───│ (IA + tool calling)        │  │
│  └──────┬───────┘    └───────────────────────────┘  │
│         │                                            │
│         ▼                                            │
│  ┌──────────────┐    ┌───────────────────────────┐  │
│  │ Pyodide      │───▶│ PySUS / TabNet scraper    │  │
│  │ Web Worker   │    │ (executa no browser)       │  │
│  │              │◀───│ retorna DataFrame          │  │
│  └──────┬───────┘    └───────────────────────────┘  │
│         │                                            │
│         ▼                                            │
│  ┌──────────────────────────────────────────────┐   │
│  │ Renderização: gráficos + tabelas + resumo    │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Componentes a Implementar

### 1. Página DataSUS (`src/pages/DataSUS.tsx`)
- Interface de chat dedicada, reutilizando padrões do DataMind
- Tela de boas-vindas com exemplos de perguntas: "Casos de dengue em SP (2019-2024)", "Mortalidade por COVID no Nordeste", "Incidência de tuberculose por faixa etária"
- Área de resultados com gráficos (Matplotlib via Pyodide) e tabelas interativas
- Seletor de base de dados: SINAN, SIM, SINASC, SIH, SIA

### 2. Edge Function `datasus-query` (`supabase/functions/datasus-query/index.ts`)
- Recebe a pergunta do usuário + histórico do chat
- Usa Lovable AI Gateway com tool calling para:
  - **`parse_datasus_query`**: Extrai parâmetros estruturados (agravo/CID, UF/município, período, faixa etária, sexo)
  - **`generate_datasus_code`**: Gera código Python/PySUS para consulta ao TabNet
- Retorna JSON: `{ explanation, code, parameters }`
- System prompt especializado em epidemiologia e nomenclatura DataSUS

### 3. Catálogo de Bases DataSUS (`src/lib/datasus-catalog.ts`)
- Mapeamento das bases disponíveis no TabNet (URLs, parâmetros, códigos CID-10)
- Lista de agravos do SINAN com códigos
- Mapeamento de UFs e códigos IBGE
- Templates de código PySUS para cada tipo de consulta

### 4. Worker Pyodide At