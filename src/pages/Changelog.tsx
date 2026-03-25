import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguage } from "@/i18n/LanguageContext";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Rocket, Lightbulb, Calendar, Plus, Pencil, Trash2, Search,
  CheckCircle2, Clock, Sparkles, Bug, Zap, Puzzle, Filter, RefreshCw, Loader2,
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

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  released: { label: "Lançado", icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  planned: { label: "Planejado", icon: Clock, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  idea: { label: "Ideia", icon: Lightbulb, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
};

const categoryConfig: Record<string, { label: string; icon: React.ElementType }> = {
  feature: { label: "Funcionalidade", icon: Sparkles },
  bugfix: { label: "Correção", icon: Bug },
  improvement: { label: "Melhoria", icon: Zap },
  integration: { label: "Integração", icon: Puzzle },
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-600",
  high: "bg-orange-500/10 text-orange-600",
  critical: "bg-destructive/10 text-destructive",
};

// ── Master manifest of all features in the platform ──────────────────
// Each entry describes a feature that should exist in system_changelog.
// The sync button compares titles against existing entries and inserts
// anything missing.
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
  { title: "Equipe de Pesquisa Colaborativa", description: "Possibilidade de adicionar membros da equipe de pesquisa (coordenadores, pesquisadores colaboradores, estudantes de graduação e pós-graduação) aos surveys. Membros herdam permissões de visualização e coleta de dados.", category: "feature", status: "released", priority: "medium", released_at: "2025-03-25", module: "surveys", version: null },
  { title: "DataSUS — Consulta epidemiológica", description: "Consulta de dados epidemiológicos do Brasil (SIM, SINASC, SINAN) com linguagem natural, geração de código Python e visualizações.", category: "feature", status: "released", priority: "high", released_at: "2025-09-01", module: "datasus", version: null },
  { title: "DataSUS — Alertas epidemiológicos", description: "Sistema de alertas automáticos para variações anormais em indicadores de saúde pública por estado e doença.", category: "feature", status: "released", priority: "medium", released_at: "2025-09-15", module: "datasus", version: null },
  { title: "DataSUS — Boletim epidemiológico", description: "Geração automatizada de boletins epidemiológicos em PDF com dados do DataSUS.", category: "feature", status: "released", priority: "medium", released_at: "2025-09-15", module: "datasus", version: null },
  { title: "Assistente de escrita científica", description: "Editor de 3 painéis com seleção de fontes (papers, DataMind, PDFs), geração de seções, inserção de citações, reformulação e verificação de consistência. Suporte a APA, Vancouver e ABNT.", category: "feature", status: "released", priority: "high", released_at: "2025-10-01", module: "escrita", version: null },
  { title: "CAPES APC Advisor", description: "Orientação sobre periódicos elegíveis aos acordos transformativos CAPES para pagamento de APC. Sugestão de journals por escopo, diretrizes de submissão e formatação automática do artigo.", category: "feature", status: "released", priority: "high", released_at: "2025-10-15", module: "escrita", version: null },
  { title: "Lacunas de pesquisa (Research Gaps)", description: "Identificação automática de lacunas, contradições e áreas inexploradas na literatura com sugestões de novas pesquisas.", category: "feature", status: "released", priority: "medium", released_at: "2025-10-01", module: "busca", version: null },
  { title: "Avaliador de questões de pesquisa", description: "Avaliação da qualidade de questões de pesquisa com sugestões de melhoria baseadas em critérios FINER e PICO.", category: "feature", status: "released", priority: "medium", released_at: "2025-02-01", module: "busca", version: null },
  { title: "Relatórios automáticos", description: "Geração de relatórios acadêmicos estruturados a partir de buscas salvas com exportação em múltiplos formatos.", category: "feature", status: "released", priority: "medium", released_at: "2025-03-01", module: "relatórios", version: null },
  { title: "Retração de artigos (Retraction Watch)", description: "Monitoramento de status de retração de artigos via DOI com verificação periódica.", category: "feature", status: "released", priority: "medium", released_at: "2025-03-15", module: "biblioteca", version: null },
  { title: "Formatação para periódico", description: "Reformatação automática de artigos para periódicos específicos com ajuste de estrutura, citações e seções.", category: "feature", status: "released", priority: "medium", released_at: "2025-10-01", module: "escrita", version: null },
  { title: "Upload e extração de PDFs", description: "Upload de PDFs próprios do pesquisador com extração automática de texto para uso como fonte no assistente de escrita.", category: "feature", status: "released", priority: "medium", released_at: "2025-10-01", module: "escrita", version: null },
  { title: "Geração de questões com IA", description: "Geração automática de perguntas para surveys usando IA com base no objetivo da pesquisa.", category: "feature", status: "released", priority: "medium", released_at: "2025-07-01", module: "surveys", version: null },
  { title: "Compliance e documentos regulatórios", description: "Geração de documentos de compliance para pesquisa (CEP, LGPD, ICH-GCP) com templates editáveis.", category: "feature", status: "released", priority: "medium", released_at: "2025-08-15", module: "surveys", version: null },
  { title: "Pipeline de Atualizações e Roadmap", description: "Sistema de changelog integrado com registro retroativo de funcionalidades, planejamento de roadmap e notificação proativa para administradores sobre itens planejados e ideias pendentes.", category: "feature", status: "released", priority: "medium", released_at: "2025-03-25", module: "sistema", version: null },
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
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category: "feature", status: "released",
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

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", category: "feature", status: "released", priority: "medium", module: "", version: "", released_at: "" });
    setDialogOpen(true);
  };

  const openEdit = (e: ChangelogEntry) => {
    setEditing(e);
    setForm({
      title: e.title, description: e.description, category: e.category,
      status: e.status, priority: e.priority || "medium",
      module: e.module || "", version: e.version || "",
      released_at: e.released_at ? e.released_at.slice(0, 10) : "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      status: form.status,
      priority: form.priority,
      module: form.module || null,
      version: form.version || null,
      released_at: form.released_at ? new Date(form.released_at).toISOString() : null,
      created_by: user?.id,
    };

    if (editing) {
      await supabase.from("system_changelog" as any).update(payload as any).eq("id", editing.id);
      toast({ title: "Atualização editada" });
    } else {
      await supabase.from("system_changelog" as any).insert(payload as any);
      toast({ title: "Entrada adicionada ao changelog" });
    }
    setDialogOpen(false);
    fetchEntries();
  };

  const remove = async (id: string) => {
    await supabase.from("system_changelog" as any).delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast({ title: "Entrada removida" });
  };

  const filtered = entries.filter((e) => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const released = filtered.filter((e) => e.status === "released");
  const planned = filtered.filter((e) => e.status === "planned");
  const ideas = filtered.filter((e) => e.status === "idea");

  const renderEntry = (entry: ChangelogEntry) => {
    const st = statusConfig[entry.status] || statusConfig.released;
    const cat = categoryConfig[entry.category] || categoryConfig.feature;
    const StatusIcon = st.icon;
    const CatIcon = cat.icon;

    return (
      <Card key={entry.id} className="group">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`rounded-lg p-2 ${st.color} shrink-0 mt-0.5`}>
              <StatusIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm text-foreground">{entry.title}</h3>
                {isAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(entry.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{entry.description}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                  <CatIcon className="h-2.5 w-2.5" />{cat.label}
                </Badge>
                {entry.module && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{entry.module}</Badge>
                )}
                {entry.version && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">v{entry.version}</Badge>
                )}
                {entry.priority && entry.status !== "released" && (
                  <Badge className={`text-[10px] px-1.5 py-0 border-0 ${priorityColors[entry.priority]}`}>
                    {entry.priority === "critical" ? "Crítico" : entry.priority === "high" ? "Alta" : entry.priority === "medium" ? "Média" : "Baixa"}
                  </Badge>
                )}
                {entry.released_at && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Calendar className="h-2.5 w-2.5" />
                    {format(new Date(entry.released_at), "dd MMM yyyy", { locale: ptBR })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Rocket className="h-6 w-6 text-primary" />
              {locale === "pt" ? "Pipeline de Atualizações" : "Update Pipeline"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {locale === "pt" ? "Histórico de atualizações e roadmap de funcionalidades" : "Update history and feature roadmap"}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nova entrada
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="released">Lançados</SelectItem>
              <SelectItem value="planned">Planejados</SelectItem>
              <SelectItem value="idea">Ideias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-8">
            {/* Released */}
            {released.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Lançados ({released.length})
                </h2>
                <div className="space-y-2">{released.map(renderEntry)}</div>
              </section>
            )}

            {/* Planned */}
            {planned.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Clock className="h-5 w-5 text-blue-500" /> Planejados ({planned.length})
                </h2>
                <div className="space-y-2">{planned.map(renderEntry)}</div>
              </section>
            )}

            {/* Ideas */}
            {ideas.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Lightbulb className="h-5 w-5 text-amber-500" /> Ideias ({ideas.length})
                </h2>
                <div className="space-y-2">{ideas.map(renderEntry)}</div>
              </section>
            )}

            {filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Rocket className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma entrada encontrada</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar entrada" : "Nova entrada no changelog"}</DialogTitle>
            <DialogDescription>Registre uma atualização, ideia ou funcionalidade planejada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Descrição detalhada..." rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="released">Lançado</SelectItem>
                  <SelectItem value="planned">Planejado</SelectItem>
                  <SelectItem value="idea">Ideia</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
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
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Módulo" value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} />
              <Input placeholder="Versão" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            </div>
            {form.status === "released" && (
              <Input type="date" value={form.released_at} onChange={(e) => setForm({ ...form, released_at: e.target.value })} />
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
