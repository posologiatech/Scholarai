import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguage } from "@/i18n/LanguageContext";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Rocket, Plus, Trash2, Sparkles, CheckCircle2, Clock, Loader2,
  Lightbulb, Calendar,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  released_at: string | null;
  created_at: string;
  module: string | null;
  version: string | null;
}

const priorityLabel: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const priorityBadgeClass: Record<string, string> = {
  critical: "bg-red-500 text-white hover:bg-red-500",
  high: "bg-red-500 text-white hover:bg-red-500",
  medium: "bg-orange-500 text-white hover:bg-orange-500",
  low: "bg-muted text-muted-foreground hover:bg-muted",
};

// ── Roadmap proposals pool ──
// The system picks from this pool when auto-generating roadmap items.
const ROADMAP_PROPOSALS_POOL = [
  { title: "App Mobile (PWA)", description: "Versão mobile progressiva para acesso offline e notificações push.", priority: "high", category: "feature", module: "sistema" },
  { title: "Análise de Desempenho por Competência", description: "Dashboard de competências cruzando resultados de múltiplas avaliações por aluno.", priority: "high", category: "feature", module: "datamind" },
  { title: "IA para Feedback Personalizado", description: "Feedback automático por IA adaptado ao perfil de erros de cada aluno.", priority: "high", category: "feature", module: "surveys" },
  { title: "Integração com LMS", description: "Conectores para Moodle, Canvas e Google Classroom para importação/exportação de dados.", priority: "medium", category: "integration", module: "sistema" },
  { title: "Banco de Casos Clínicos Compartilhado", description: "Marketplace específico para casos clínicos reutilizáveis entre professores e instituições.", priority: "medium", category: "feature", module: "surveys" },
  { title: "Exportação SCORM/xAPI", description: "Exportação de surveys e formulários em formato SCORM e xAPI para LMS.", priority: "medium", category: "feature", module: "surveys" },
  { title: "Análise de Sentimentos em Respostas", description: "Análise de sentimentos com NLP para respostas abertas de surveys.", priority: "medium", category: "feature", module: "datamind" },
  { title: "Relatório Automático de Revisão Sistemática PDF", description: "Exportação automática da revisão sistemática completa em formato PDF acadêmico.", priority: "high", category: "feature", module: "revisão sistemática" },
  { title: "Busca Semântica de Artigos", description: "Busca por similaridade semântica usando embeddings de artigos indexados.", priority: "high", category: "feature", module: "busca" },
  { title: "Modo Escuro Completo", description: "Tema escuro polido em todas as páginas e componentes da plataforma.", priority: "low", category: "improvement", module: "sistema" },
  { title: "Notificações In-App em Tempo Real", description: "Sistema de notificações push dentro da plataforma para alertas, menções e atualizações.", priority: "high", category: "feature", module: "sistema" },
  { title: "API Pública REST/GraphQL", description: "API aberta para que instituições integrem dados da plataforma em sistemas próprios.", priority: "high", category: "feature", module: "sistema" },
  { title: "Geração de Slides a partir de Artigos", description: "Criação automática de apresentações (PPTX) a partir de papers selecionados.", priority: "medium", category: "feature", module: "escrita" },
  { title: "Painel de Métricas de Impacto", description: "Visualização de h-index, citações e métricas de impacto por autor e periódico.", priority: "medium", category: "feature", module: "busca" },
  { title: "Controle de Versão de Documentos", description: "Histórico de versões e diff visual para documentos do assistente de escrita.", priority: "medium", category: "feature", module: "escrita" },
  { title: "Integração com Zotero/Mendeley", description: "Sincronização bidirecional de referências com gerenciadores bibliográficos.", priority: "high", category: "integration", module: "biblioteca" },
  { title: "Templates de Artigo por Periódico", description: "Templates pré-formatados com seções e estilos de periódicos populares.", priority: "medium", category: "feature", module: "escrita" },
  { title: "Detecção de Plágio", description: "Verificação de originalidade do texto com comparação contra bases acadêmicas.", priority: "high", category: "feature", module: "escrita" },
  { title: "Gamificação para Pesquisadores", description: "Sistema de badges, streaks e ranking para incentivar produtividade acadêmica.", priority: "low", category: "feature", module: "sistema" },
  { title: "Multi-tenant para Instituições", description: "Suporte a múltiplas instituições com branding customizado e gestão centralizada.", priority: "high", category: "feature", module: "admin" },
  { title: "Análise de Redes de Coautoria", description: "Grafo interativo de coautorias entre pesquisadores a partir dos artigos indexados.", priority: "medium", category: "feature", module: "busca" },
  { title: "Suporte a Dados Longitudinais", description: "Coleta de dados longitudinais com follow-up automático e análise temporal.", priority: "high", category: "feature", module: "surveys" },
  { title: "Assistente de Grant Writing", description: "IA para auxiliar na redação de projetos de financiamento (FAPESP, CNPq, NIH).", priority: "high", category: "feature", module: "escrita" },
  { title: "Dashboard Institucional", description: "Painel gerencial para coordenadores com métricas de produção científica do departamento.", priority: "medium", category: "feature", module: "admin" },
];

// ── Features manifest for changelog sync ──
const FEATURES_MANIFEST: Omit<ChangelogEntry, "id" | "created_at">[] = [
  { title: "Busca multi-fonte de artigos", description: "Busca simultânea em PubMed, Semantic Scholar, OpenAlex, CORE, Europe PMC e Crossref com deduplicação inteligente.", category: "feature", status: "released", priority: "high", released_at: "2025-01-15", module: "busca", version: null },
  { title: "Síntese de IA", description: "Síntese automática de artigos selecionados usando inteligência artificial, gerando resumos estruturados com citações.", category: "feature", status: "released", priority: "high", released_at: "2025-01-15", module: "busca", version: null },
  { title: "Chat com artigos (Oracle)", description: "Assistente de IA conversacional que responde perguntas sobre artigos selecionados com citações inline e referências.", category: "feature", status: "released", priority: "high", released_at: "2025-02-01", module: "busca", version: null },
  { title: "Grafo de conhecimento", description: "Visualização interativa de redes de citações entre artigos, identificando clusters temáticos e artigos-chave.", category: "feature", status: "released", priority: "medium", released_at: "2025-02-01", module: "busca", version: null },
  { title: "Classificação de citações", description: "Classificação automática de citações como suportivas, contrastantes ou mencionais usando IA.", category: "feature", status: "released", priority: "medium", released_at: "2025-02-15", module: "busca", version: null },
  { title: "Extração de dados (colunas customizáveis)", description: "Extração automatizada de dados de artigos em colunas personalizáveis com prompts de IA e cache de resultados.", category: "feature", status: "released", priority: "high", released_at: "2025-02-15", module: "extração", version: null },
  { title: "Verificação de referências", description: "Verificação automática de referências bibliográficas contra APIs acadêmicas, detectando erros e inconsistências.", category: "feature", status: "released", priority: "medium", released_at: "2025-03-01", module: "referências", version: null },
  { title: "Biblioteca pessoal", description: "Gerenciamento de buscas salvas, artigos favoritos e exportação em múltiplos formatos bibliográficos (BibTeX, RIS, CSV, XLSX).", category: "feature", status: "released", priority: "medium", released_at: "2025-03-01", module: "biblioteca", version: null },
  { title: "Alertas de literatura", description: "Monitoramento automático de novas publicações para queries salvas com notificação periódica.", category: "feature", status: "released", priority: "medium", released_at: "2025-03-15", module: "alertas", version: null },
  { title: "Geração de ilustrações científicas", description: "Criação de ilustrações científicas com IA, editor de anotações, templates por área e galeria comunitária.", category: "feature", status: "released", priority: "medium", released_at: "2025-03-15", module: "ilustrações", version: null },
  { title: "Revisão sistemática", description: "Workflow completo de revisão sistemática: definição de questão PICO, busca booleana, triagem com IA, avaliação de qualidade, extração e geração de relatório PRISMA.", category: "feature", status: "released", priority: "high", released_at: "2025-04-01", module: "revisão sistemática", version: null },
  { title: "Meta-análise", description: "Cálculos de meta-análise com forest plots, funnel plots, teste de heterogeneidade e análise de viés de publicação.", category: "feature", status: "released", priority: "high", released_at: "2025-04-15", module: "meta-análise", version: null },
  { title: "Risco de viés", description: "Avaliação de risco de viés com ferramentas RoB 2.0, ROBINS-I e Newcastle-Ottawa, gerando tabelas de resumo.", category: "feature", status: "released", priority: "medium", released_at: "2025-04-15", module: "risco de viés", version: null },
  { title: "DataMind — Análise de dados conversacional", description: "Interface conversacional para análise de dados com upload de arquivos, execução de código Python/R, gráficos interativos e sugestões de análise.", category: "feature", status: "released", priority: "high", released_at: "2025-05-01", module: "datamind", version: null },
  { title: "DataMind — Dashboards e pipelines", description: "Criação de dashboards com widgets fixáveis, pipelines reutilizáveis de análise e compartilhamento público de dashboards.", category: "feature", status: "released", priority: "medium", released_at: "2025-05-15", module: "datamind", version: null },
  { title: "DataMind — Conexões de banco de dados", description: "Conexão direta a bancos de dados externos (PostgreSQL, MySQL) com exploração de schema e queries em linguagem natural.", category: "feature", status: "released", priority: "medium", released_at: "2025-06-01", module: "datamind", version: null },
  { title: "DataMind — Versionamento e colaboração", description: "Sistema de checkpoints, branches e colaboração em tempo real para análises de dados.", category: "feature", status: "released", priority: "medium", released_at: "2025-06-01", module: "datamind", version: null },
  { title: "DataMind — Limpeza de dados", description: "Painel de limpeza de dados com detecção automática de problemas, perfil estatístico e transformações assistidas por IA.", category: "feature", status: "released", priority: "medium", released_at: "2025-06-15", module: "datamind", version: null },
  { title: "Construtor de surveys/formulários", description: "Editor visual de questionários com blocos, fluxos condicionais, pré-visualização e múltiplos tipos de pergunta (Likert, matriz, ranking, soma constante).", category: "feature", status: "released", priority: "high", released_at: "2025-07-01", module: "surveys", version: null },
  { title: "eCRF e gestão de participantes", description: "Gerenciamento clínico de participantes, visitas, documentos e templates de validação clínica.", category: "feature", status: "released", priority: "high", released_at: "2025-07-15", module: "surveys", version: null },
  { title: "Termo de consentimento digital", description: "Construtor de TCLE com seções configuráveis, assinatura digital, áudio/vídeo e revogação online.", category: "feature", status: "released", priority: "high", released_at: "2025-07-15", module: "surveys", version: null },
  { title: "Distribuição de surveys", description: "Distribuição via link anônimo com QR Code, lista de contatos e composição de e-mails.", category: "feature", status: "released", priority: "medium", released_at: "2025-08-01", module: "surveys", version: null },
  { title: "Resultados e relatórios de surveys", description: "Dashboard de resultados com gráficos, grade de dados, funil de recrutamento, alertas de qualidade e exportação.", category: "feature", status: "released", priority: "medium", released_at: "2025-08-01", module: "surveys", version: null },
  { title: "Integridade de dados (hashing)", description: "Sistema de integridade criptográfica com SHA-256 para respostas de formulários, auditoria de alterações e verificação de inviolabilidade.", category: "feature", status: "released", priority: "high", released_at: "2025-05-19", module: "surveys", version: null },
  { title: "Equipe de Pesquisa Colaborativa", description: "Possibilidade de adicionar membros da equipe de pesquisa (coordenadores, pesquisadores colaboradores, estudantes de graduação e pós-graduação) aos surveys.", category: "feature", status: "released", priority: "medium", released_at: "2025-03-25", module: "surveys", version: null },
  { title: "DataSUS — Consulta epidemiológica", description: "Consulta de dados epidemiológicos do Brasil (SIM, SINASC, SINAN) com linguagem natural, geração de código Python e visualizações.", category: "feature", status: "released", priority: "high", released_at: "2025-09-01", module: "datasus", version: null },
  { title: "DataSUS — Alertas epidemiológicos", description: "Sistema de alertas automáticos para variações anormais em indicadores de saúde pública por estado e doença.", category: "feature", status: "released", priority: "medium", released_at: "2025-09-15", module: "datasus", version: null },
  { title: "DataSUS — Boletim epidemiológico", description: "Geração automatizada de boletins epidemiológicos em PDF com dados do DataSUS.", category: "feature", status: "released", priority: "medium", released_at: "2025-09-15", module: "datasus", version: null },
  { title: "Assistente de escrita científica", description: "Editor de 3 painéis com seleção de fontes (papers, DataMind, PDFs), geração de seções, inserção de citações, reformulação e verificação de consistência.", category: "feature", status: "released", priority: "high", released_at: "2025-10-01", module: "escrita", version: null },
  { title: "CAPES APC Advisor", description: "Orientação sobre periódicos elegíveis aos acordos transformativos CAPES para pagamento de APC.", category: "feature", status: "released", priority: "high", released_at: "2025-10-15", module: "escrita", version: null },
  { title: "Lacunas de pesquisa (Research Gaps)", description: "Identificação automática de lacunas, contradições e áreas inexploradas na literatura com sugestões de novas pesquisas.", category: "feature", status: "released", priority: "medium", released_at: "2025-10-01", module: "busca", version: null },
  { title: "Avaliador de questões de pesquisa", description: "Avaliação da qualidade de questões de pesquisa com sugestões de melhoria baseadas em critérios FINER e PICO.", category: "feature", status: "released", priority: "medium", released_at: "2025-02-01", module: "busca", version: null },
  { title: "Relatórios automáticos", description: "Geração de relatórios acadêmicos estruturados a partir de buscas salvas com exportação em múltiplos formatos.", category: "feature", status: "released", priority: "medium", released_at: "2025-03-01", module: "relatórios", version: null },
  { title: "Retração de artigos (Retraction Watch)", description: "Monitoramento de status de retração de artigos via DOI com verificação periódica.", category: "feature", status: "released", priority: "medium", released_at: "2025-03-15", module: "biblioteca", version: null },
  { title: "Formatação para periódico", description: "Reformatação automática de artigos para periódicos específicos com ajuste de estrutura, citações e seções.", category: "feature", status: "released", priority: "medium", released_at: "2025-10-01", module: "escrita", version: null },
  { title: "Upload e extração de PDFs", description: "Upload de PDFs próprios do pesquisador com extração automática de texto para uso como fonte no assistente de escrita.", category: "feature", status: "released", priority: "medium", released_at: "2025-10-01", module: "escrita", version: null },
  { title: "Geração de questões com IA", description: "Geração automática de perguntas para surveys usando IA com base no objetivo da pesquisa.", category: "feature", status: "released", priority: "medium", released_at: "2025-07-01", module: "surveys", version: null },
  { title: "Compliance e documentos regulatórios", description: "Geração de documentos de compliance para pesquisa (CEP, LGPD, ICH-GCP) com templates editáveis.", category: "feature", status: "released", priority: "medium", released_at: "2025-08-15", module: "surveys", version: null },
  { title: "Pipeline de Atualizações e Roadmap", description: "Sistema de changelog integrado com registro retroativo de funcionalidades, planejamento de roadmap e notificação proativa para administradores.", category: "feature", status: "released", priority: "medium", released_at: "2025-03-25", module: "sistema", version: null },
  { title: "Sistema de assinaturas (Stripe)", description: "Integração com Stripe para planos Free, Pro e Enterprise com checkout, portal do cliente e verificação de limites.", category: "integration", status: "released", priority: "high", released_at: "2025-01-15", module: "sistema", version: null },
  { title: "Internacionalização (PT/EN)", description: "Suporte completo a português e inglês em toda a plataforma com troca dinâmica de idioma.", category: "feature", status: "released", priority: "medium", released_at: "2025-01-15", module: "sistema", version: null },
  { title: "Cookie consent (LGPD)", description: "Banner de consentimento de cookies com categorias configuráveis e integração com analytics.", category: "feature", status: "released", priority: "medium", released_at: "2025-02-01", module: "sistema", version: null },
  { title: "Onboarding interativo", description: "Diálogo de boas-vindas para novos usuários apresentando as principais funcionalidades da plataforma.", category: "improvement", status: "released", priority: "low", released_at: "2025-02-15", module: "sistema", version: null },
  { title: "Painel administrativo", description: "Dashboard administrativo com métricas de uso, gestão de usuários, chaves de API e logs de atividade.", category: "feature", status: "released", priority: "high", released_at: "2025-02-01", module: "admin", version: null },
  { title: "Detecção automática de atualizações no pipeline", description: "Botão que varre o manifesto de funcionalidades da plataforma e insere automaticamente as entradas ausentes no changelog.", category: "improvement", status: "released", priority: "medium", released_at: "2025-03-25", module: "sistema", version: null },
];

const Changelog = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { locale } = useLanguage();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"changelog" | "roadmap">("roadmap");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [concluding, setConcluding] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", category: "feature", status: "planned",
    priority: "medium", module: "", version: "", released_at: "",
  });

  const fetchEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("system_changelog" as any)
      .select("*")
      .order("released_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    setEntries((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  // ── Auto-propose roadmap items every 30 days ──
  const autoPropose = useCallback(async () => {
    if (!user?.id || !isAdmin) return;

    const STORAGE_KEY = "roadmap_last_proposed";
    const lastProposed = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    if (lastProposed && now - parseInt(lastProposed) < THIRTY_DAYS) return;

    // Check existing planned/idea titles to avoid duplicates
    const existingTitles = new Set(
      entries
        .filter(e => e.status === "planned" || e.status === "idea")
        .map(e => e.title.toLowerCase().trim())
    );
    const allExistingTitles = new Set(entries.map(e => e.title.toLowerCase().trim()));

    // Pick 7-8 proposals that don't already exist
    const available = ROADMAP_PROPOSALS_POOL.filter(
      p => !allExistingTitles.has(p.title.toLowerCase().trim())
    );

    if (available.length === 0) {
      localStorage.setItem(STORAGE_KEY, String(now));
      return;
    }

    // Shuffle and take 7-8
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const count = Math.min(shuffled.length, 7 + Math.round(Math.random()));
    const selected = shuffled.slice(0, count);

    const payloads = selected.map(p => ({
      title: p.title,
      description: p.description,
      category: p.category,
      status: "planned",
      priority: p.priority,
      module: p.module || null,
      version: null,
      released_at: null,
      created_by: user.id,
    }));

    const { error } = await supabase.from("system_changelog" as any).insert(payloads as any);
    if (!error) {
      localStorage.setItem(STORAGE_KEY, String(now));
      toast({ title: `${selected.length} novas propostas no Roadmap`, description: "O sistema sugeriu novas atualizações para implementação." });
      await fetchEntries();
    }
  }, [user?.id, isAdmin, entries]);

  useEffect(() => {
    if (!loading && entries.length > 0 && isAdmin) {
      autoPropose();
    }
  }, [loading, isAdmin]);

  // ── Sync missing released features ──
  const syncMissing = async () => {
    setSyncing(true);
    try {
      const existingTitles = new Set(entries.map(e => e.title.toLowerCase().trim()));
      const missing = FEATURES_MANIFEST.filter(f => !existingTitles.has(f.title.toLowerCase().trim()));

      if (missing.length === 0) {
        toast({ title: "Pipeline atualizado", description: "Todas as funcionalidades já estão registradas." });
        setSyncing(false);
        return;
      }

      const payloads = missing.map(f => ({
        title: f.title, description: f.description, category: f.category,
        status: f.status, priority: f.priority, module: f.module || null,
        version: f.version || null,
        released_at: f.released_at ? new Date(f.released_at).toISOString() : null,
        created_by: user?.id,
      }));

      const { error } = await supabase.from("system_changelog" as any).insert(payloads as any);
      if (error) throw error;

      toast({ title: `${missing.length} entrada(s) adicionada(s)` });
      await fetchEntries();
    } catch (err: any) {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  // ── Conclude roadmap item → move to changelog ──
  const concludeItem = async (entry: ChangelogEntry) => {
    setConcluding(entry.id);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("system_changelog" as any)
      .update({ status: "released", released_at: now } as any)
      .eq("id", entry.id);

    if (!error) {
      toast({ title: "Atualização concluída!", description: `"${entry.title}" foi adicionada ao Changelog.` });
      await fetchEntries();
    } else {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    setConcluding(null);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", category: "feature", status: "planned", priority: "medium", module: "", version: "", released_at: "" });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    const payload = {
      title: form.title.trim(), description: form.description.trim(),
      category: form.category, status: form.status, priority: form.priority,
      module: form.module || null, version: form.version || null,
      released_at: form.released_at ? new Date(form.released_at).toISOString() : null,
      created_by: user?.id,
    };

    if (editing) {
      await supabase.from("system_changelog" as any).update(payload as any).eq("id", editing.id);
      toast({ title: "Entrada editada" });
    } else {
      await supabase.from("system_changelog" as any).insert(payload as any);
      toast({ title: "Entrada adicionada" });
    }
    setDialogOpen(false);
    fetchEntries();
  };

  const remove = async (id: string) => {
    await supabase.from("system_changelog" as any).delete().eq("id", id);
    setEntries(prev => prev.filter(e => e.id !== id));
    toast({ title: "Entrada removida" });
  };

  const released = entries.filter(e => e.status === "released");
  const roadmap = entries.filter(e => e.status === "planned" || e.status === "idea");

  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedRoadmap = [...roadmap].sort(
    (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
  );

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Rocket className="h-6 w-6 text-primary" />
              Pipeline de Atualizações
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Histórico de funcionalidades e planejamento futuro do sistema.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openNew} className="gap-1.5 bg-[hsl(var(--primary))] text-primary-foreground">
              <Plus className="h-4 w-4" /> Nova Entrada
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          <button
            onClick={() => setActiveTab("changelog")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "changelog"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Changelog ({released.length})
          </button>
          <button
            onClick={() => setActiveTab("roadmap")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "roadmap"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lightbulb className="h-4 w-4" />
            Roadmap ({roadmap.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeTab === "roadmap" ? (
          /* ── ROADMAP TAB ── */
          <div className="space-y-4">
            {sortedRoadmap.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma atualização planejada</p>
                <p className="text-xs mt-1">O sistema proporá novas atualizações a cada 30 dias.</p>
              </div>
            ) : (
              sortedRoadmap.map(entry => {
                const borderColor =
                  entry.priority === "critical" || entry.priority === "high"
                    ? "border-l-blue-500"
                    : entry.priority === "medium"
                    ? "border-l-blue-400"
                    : "border-l-blue-300";

                return (
                  <div
                    key={entry.id}
                    className={`bg-card rounded-xl border border-border/60 border-l-4 ${borderColor} p-5 flex items-start gap-4 transition-all hover:shadow-md`}
                  >
                    <Sparkles className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{entry.title}</h3>
                        <Badge className={`text-[11px] px-2 py-0.5 border-0 rounded-full ${priorityBadgeClass[entry.priority] || priorityBadgeClass.medium}`}>
                          {priorityLabel[entry.priority] || "Média"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={concluding === entry.id}
                          onClick={() => concludeItem(entry)}
                        >
                          {concluding === entry.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                          Concluir
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isAdmin && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={syncMissing} disabled={syncing} className="gap-1.5 text-xs">
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                  {syncing ? "Sincronizando..." : "Sincronizar funcionalidades"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* ── CHANGELOG TAB ── */
          <div className="space-y-3">
            {released.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Rocket className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma atualização no changelog</p>
              </div>
            ) : (
              released.map(entry => (
                <div
                  key={entry.id}
                  className="bg-card rounded-xl border border-border/60 border-l-4 border-l-emerald-500 p-4 flex items-start gap-3 group"
                >
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground">{entry.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {entry.module && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{entry.module}</Badge>
                      )}
                      {entry.released_at && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          {format(new Date(entry.released_at), "dd MMM yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => remove(entry.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))
            )}

            {isAdmin && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={syncMissing} disabled={syncing} className="gap-1.5 text-xs">
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                  {syncing ? "Sincronizando..." : "Sincronizar funcionalidades"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar entrada" : "Nova entrada"}</DialogTitle>
            <DialogDescription>Registre uma atualização ou funcionalidade planejada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Descrição detalhada..." rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="released">Lançado</SelectItem>
                  <SelectItem value="planned">Planejado</SelectItem>
                  <SelectItem value="idea">Ideia</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">Funcionalidade</SelectItem>
                  <SelectItem value="bugfix">Correção</SelectItem>
                  <SelectItem value="improvement">Melhoria</SelectItem>
                  <SelectItem value="integration">Integração</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Módulo" value={form.module} onChange={e => setForm({ ...form, module: e.target.value })} />
              <Input placeholder="Versão" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} />
            </div>
            {form.status === "released" && (
              <Input type="date" value={form.released_at} onChange={e => setForm({ ...form, released_at: e.target.value })} />
            )}
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={!form.title.trim() || !form.description.trim()}>
              {editing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Changelog;
