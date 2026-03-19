

# Funcionalidades de Alto Impacto para o Módulo DataSUS/SINAN

## Análise do mercado atual

Ferramentas como TabNet, PCDaS/Fiocruz, e plataformas como IVIS e InfoGripe oferecem visualizações estáticas ou dashboards pré-definidos. Nenhuma oferece **análise epidemiológica interativa por linguagem natural com dados reais cruzados**. O módulo já tem essa base — as funcionalidades abaixo o transformariam em algo sem equivalente no mercado.

---

## 1. Detecção de Surtos e Alertas Epidemiológicos em Tempo Real (Early Warning System)

**Impacto: Extremamente alto**

O sistema analisaria automaticamente os dados de arboviroses, SRAG e TB para detectar anomalias estatísticas (z-score, CUSUM, médias móveis) e gerar alertas proativos.

- O usuário configura monitoramento: "Monitorar dengue em SP"
- O sistema consulta InfoDengue semanalmente (cron via Supabase pg_cron ou scheduled function)
- Quando detecta aumento acima de 2 desvios-padrão da média histórica, envia alerta por email/notificação
- Dashboard com mapa de calor por UF mostrando nível de alerta (verde/amarelo/vermelho)
- Comparação automática com o mesmo período de anos anteriores

**Diferencial**: Nenhuma ferramenta pública oferece alertas personalizados por região/doença com análise automática. O CIEVS faz isso internamente mas não é acessível a pesquisadores.

**Implementação**:
- Nova tabela `datasus_alerts` (user_id, disease, location, threshold, active)
- Scheduled edge function `check-datasus-alerts` que roda diariamente
- Componente `DataSUSAlertsDashboard` com mapa do Brasil interativo (SVG)
- Notificações via email (Resend já integrado) e in-app

---

## 2. Geração Automática de Boletins Epidemiológicos (Auto-Report)

**Impacto: Muito alto**

Um clique gera um boletim epidemiológico completo em formato PDF/DOCX, com:
- Resumo executivo com principais achados
- Tabelas de incidência/mortalidade por UF
- Gráficos de série temporal e mapas coropléticos
- Comparação interanual
- Metodologia e fontes utilizadas
- Formatação ABNT ou padrão SVS/MS

**Diferencial**: Pesquisadores e secretarias de saúde gastam dias para montar boletins manualmente. Automatizar isso com dados reais e formatação profissional economiza semanas de trabalho.

**Implementação**:
- Botão "Gerar Boletim" na interface de resultados
- Edge function `generate-epi-bulletin` que:
  1. Busca dados de múltiplas fontes automaticamente
  2. Gera análise narrativa via AI
  3. Produz gráficos via Pyodide
  4. Monta documento final (HTML → PDF via puppeteer ou jsPDF no frontend)
- Templates pré-definidos: Boletim Municipal, Estadual, Temático

---

## 3. Análise Geoespacial com Mapas Coropléticos Interativos

**Impacto: Muito alto**

Em vez de apenas tabelas e gráficos de linha, gerar mapas do Brasil/estados com coloração por intensidade do indicador (incidência, mortalidade, cobertura vacinal).

- Mapa SVG do Brasil com UFs clicáveis
- Mapa por municípios dentro de cada UF
- Animação temporal (slider de ano mostrando evolução)
- Overlay de múltiplos indicadores (ex: saneamento + dengue)

**Diferencial**: O TabNet não gera mapas. O PCDaS gera mapas mas sem interatividade nem cruzamento. Mapas animados por ano seriam únicos.

**Implementação**:
- Biblioteca Leaflet ou D3.js com GeoJSON do IBGE (malha municipal)
- Componente `EpiMap` renderizado no frontend
- O código Python gera os dados; o frontend renderiza o mapa
- GeoJSON compactado hospedado no Supabase Storage

---

## 4. Comparador Inteligente de Municípios/UFs (Benchmarking)

**Impacto: Alto**

Permitir que o usuário pergunte "Compare a mortalidade infantil entre Ceará e Maranhão nos últimos 10 anos" e receba:
- Tabela lado a lado
- Gráfico comparativo
- Análise de tendência (melhoria/piora)
- Ranking entre UFs similares (mesmo IDH, mesma região)
- Correlação com indicadores socioeconômicos (PIB, saneamento)

**Diferencial**: Nenhuma ferramenta permite comparação natural por chat com cruzamento automático de variáveis socioeconômicas.

**Implementação**:
- Expandir o prompt de extração para detectar intenção de comparação
- Buscar dados de ambas localidades + dados IBGE Agregados
- Prompt de análise específico para comparação com ranking

---

## Recomendação de prioridade

| Funcionalidade | Impacto | Complexidade | Prioridade |
|---|---|---|---|
| Alertas epidemiológicos | Extremo | Alta | 1 |
| Boletins automáticos | Muito alto | Média | 2 |
| Mapas coropléticos | Muito alto | Média | 3 |
| Benchmarking de municípios | Alto | Baixa | 4 |

A funcionalidade de **Alertas Epidemiológicos** seria o maior diferencial — transforma o módulo de uma ferramenta reativa (o usuário pergunta) para proativa (o sistema avisa). Nenhum concorrente público oferece isso para pesquisadores individuais.

Deseja que eu implemente alguma dessas funcionalidades? Posso começar por qualquer uma, ou por todas em sequência começando pelos alertas.

