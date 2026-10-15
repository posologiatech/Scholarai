import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { HelpCircle, Plus, Pencil, Trash2, FlaskConical, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import {
  useResearchQuestions, useSaveResearchQuestion, useDeleteResearchQuestion,
  usePromoteResearchQuestion, type ResearchQuestion,
} from "@/hooks/useResearchQuestions";
import {
  CATEGORY_LABEL, CATEGORY_STYLE, type ResearchProjectCategory,
} from "@/lib/research/types";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORIES: ResearchProjectCategory[] = ["ic", "tcc", "pos_graduacao", "extensao", "monitoria", "outro"];

const EMPTY = { question: "", description: "", cnpq_area: "", keywords: "", category: "outro" as ResearchProjectCategory };

export const ResearchQuestionsPanel = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const navigate = useNavigate();
  const { data: questions = [], isLoading } = useResearchQuestions();
  const saveMut = useSaveResearchQuestion();
  const deleteMut = useDeleteResearchQuestion();
  const promoteMut = usePromoteResearchQuestion();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [toDelete, setToDelete] = useState<ResearchQuestion | null>(null);
  const [toPromote, setToPromote] = useState<ResearchQuestion | null>(null);
  const [withAI, setWithAI] = useState(true);

  const openNew = () => { setEditingId(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (q: ResearchQuestion) => {
    setEditingId(q.id);
    setForm({
      question: q.question,
      description: q.description ?? "",
      cnpq_area: q.cnpq_area ?? "",
      keywords: q.keywords.join(", "),
      category: (q.category ?? "outro") as ResearchProjectCategory,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.question.trim()) return toast.error(pt ? "Escreva a pergunta de pesquisa" : "Write the research question");
    try {
      await saveMut.mutateAsync({
        id: editingId ?? undefined,
        question: form.question,
        description: form.description,
        cnpq_area: form.cnpq_area,
        category: form.category,
        keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      });
      toast.success(pt ? "Pergunta salva" : "Question saved");
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteMut.mutateAsync(toDelete.id);
      toast.success(pt ? "Pergunta excluída" : "Question deleted");
      setToDelete(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const handlePromote = async () => {
    if (!toPromote) return;
    try {
      const { project, aiError } = await promoteMut.mutateAsync({ question: toPromote, withAI });
      if (aiError) {
        toast.warning(pt
          ? `Projeto criado, mas o rascunho com IA falhou (${aiError}). Use a Auto-redação IA no projeto.`
          : `Project created, but the AI draft failed (${aiError}). Use AI Auto-write inside the project.`);
      } else {
        toast.success(pt ? "Projeto criado a partir da pergunta" : "Project created from the question");
      }
      setToPromote(null);
      navigate(`/research/${project.id}`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-sm text-muted-foreground">
          {pt
            ? "Guarde perguntas de pesquisa que ainda não viraram projeto. Quando estiver pronto, transforme a pergunta em um projeto."
            : "Keep research questions that are not projects yet. When you are ready, turn a question into a project."}
        </p>
        <Button onClick={openNew}><Plus className="h-4 w-4" />{pt ? "Nova pergunta" : "New question"}</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{pt ? "Carregando..." : "Loading..."}</p>
      ) : questions.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">
            {pt ? "Nenhuma pergunta de pesquisa ainda. Cadastre a primeira!" : "No research questions yet. Add your first!"}
          </p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {questions.map((q) => {
            const cat = (q.category ?? "outro") as ResearchProjectCategory;
            const style = CATEGORY_STYLE[cat];
            return (
              <Card key={q.id} className="h-full flex flex-col relative overflow-hidden">
                <span className={cn("absolute left-0 top-0 bottom-0 w-1", style.bar)} aria-hidden />
                <CardContent className="pl-5 pt-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold leading-snug line-clamp-4">{q.question}</h3>
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(q)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setToDelete(q)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={cn("text-[10px] font-medium", style.badge)}>
                      {CATEGORY_LABEL[cat][locale]}
                    </Badge>
                    {q.cnpq_area && <span className="text-xs text-muted-foreground">{q.cnpq_area}</span>}
                  </div>
                  {q.description && <p className="text-sm text-muted-foreground line-clamp-4 mb-3">{q.description}</p>}
                  {q.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {q.keywords.slice(0, 4).map((k) => <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>)}
                    </div>
                  )}
                  <div className="mt-auto pt-2">
                    {q.project_id ? (
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link to={`/research/${q.project_id}`}>
                          <FlaskConical className="h-4 w-4" />{pt ? "Ver projeto" : "View project"}
                          <ArrowRight className="h-4 w-4 ml-auto" />
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" className="w-full" onClick={() => setToPromote(q)}>
                        <FlaskConical className="h-4 w-4" />{pt ? "Transformar em projeto" : "Turn into project"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? (pt ? "Editar pergunta" : "Edit question") : (pt ? "Nova pergunta de pesquisa" : "New research question")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{pt ? "Pergunta de pesquisa *" : "Research question *"}</Label>
              <Textarea rows={2} value={form.question}
                placeholder={pt ? "Ex.: A reconciliação medicamentosa reduz reinternações em idosos?" : "e.g. Does medication reconciliation reduce readmissions in older adults?"}
                onChange={(e) => setForm({ ...form, question: e.target.value })} />
            </div>
            <div>
              <Label>{pt ? "Descrição" : "Description"}</Label>
              <Textarea rows={5} value={form.description}
                placeholder={pt ? "Contexto, motivação, hipóteses, dados disponíveis, ideias de método…" : "Context, motivation, hypotheses, available data, method ideas…"}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{pt ? "Categoria" : "Category"}</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as ResearchProjectCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        <span className="flex items-center gap-2">
                          <span className={cn("h-2.5 w-2.5 rounded-full", CATEGORY_STYLE[c].dot)} />
                          {CATEGORY_LABEL[c][locale]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{pt ? "Área CNPq" : "Field"}</Label>
                <Input value={form.cnpq_area} onChange={(e) => setForm({ ...form, cnpq_area: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{pt ? "Palavras-chave (vírgula)" : "Keywords (comma)"}</Label>
              <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{pt ? "Cancelar" : "Cancel"}</Button>
            <Button onClick={handleSave} disabled={saveMut.isPending}>{pt ? "Salvar" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toPromote} onOpenChange={(o) => !o && setToPromote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pt ? "Transformar em projeto?" : "Turn into a project?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pt
                ? "Será criado um projeto de pesquisa com esta pergunta como título e objetivo, no mesmo formato dos demais projetos. A pergunta continua salva e passa a apontar para o projeto."
                : "A research project will be created with this question as its title and objective, in the same format as your other projects. The question stays saved and links to the project."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={withAI} onCheckedChange={(v) => setWithAI(v === true)} className="mt-0.5" />
            <span>
              <span className="font-medium inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-primary" />
                {pt ? "Gerar o rascunho do projeto com IA" : "Draft the project with AI"}
              </span>
              <span className="block text-muted-foreground">
                {pt
                  ? "A IA escreve introdução, objetivos, metodologia, fases, resultados esperados e cronograma para responder à pergunta. Pode levar até um minuto e consome créditos de IA."
                  : "AI writes the introduction, objectives, methods, phases, expected results and schedule to answer the question. May take up to a minute and uses AI credits."}
              </span>
            </span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promoteMut.isPending}>{pt ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handlePromote(); }}
              disabled={promoteMut.isPending}
            >
              {promoteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {promoteMut.isPending
                ? (withAI ? (pt ? "Escrevendo projeto…" : "Writing project…") : (pt ? "Criando…" : "Creating…"))
                : (pt ? "Criar projeto" : "Create project")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pt ? "Excluir pergunta?" : "Delete question?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.project_id
                ? (pt ? "O projeto criado a partir dela não será excluído." : "The project created from it will not be deleted.")
                : (pt ? "Esta ação não pode ser desfeita." : "This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{pt ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {pt ? "Excluir" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
