import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Wallet, Receipt, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";
import FundingLinkCard from "./FundingLinkCard";

type Item = { id: string; rubrica: string; description: string; planned_amount: number; currency: string; funder: string | null; period_start: string | null; period_end: string | null; };
type Expense = { id: string; budget_item_id: string | null; expense_date: string; amount: number; supplier: string | null; description: string; status: string; invoice_number: string | null; invoice_url: string | null; created_by: string; };

const RUBRICAS = [
  { v: "custeio", l: "Custeio" },
  { v: "capital", l: "Capital" },
  { v: "bolsa", l: "Bolsa" },
  { v: "diaria", l: "Diária" },
  { v: "passagem", l: "Passagem" },
  { v: "servico_terceiros", l: "Serviços de terceiros" },
  { v: "outros", l: "Outros" },
];

const STATUS = [
  { v: "pendente", l: "Pendente" },
  { v: "aprovado", l: "Aprovado" },
  { v: "rejeitado", l: "Rejeitado" },
  { v: "reembolsado", l: "Reembolsado" },
];

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function BudgetTab({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemOpen, setItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<Partial<Item>>({ rubrica: "custeio", currency: "BRL", planned_amount: 0 });
  const [expOpen, setExpOpen] = useState(false);
  const [editExp, setEditExp] = useState<Partial<Expense>>({ expense_date: new Date().toISOString().slice(0, 10), status: "pendente", amount: 0 });

  const load = async () => {
    setLoading(true);
    const [{ data: i }, { data: e }] = await Promise.all([
      supabase.from("research_budget_items").select("*").eq("project_id", projectId).order("rubrica"),
      supabase.from("research_expenses").select("*").eq("project_id", projectId).order("expense_date", { ascending: false }),
    ]);
    setItems((i as Item[]) || []);
    setExpenses((e as Expense[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [projectId]);

  const totals = useMemo(() => {
    const planned = items.reduce((s, i) => s + Number(i.planned_amount || 0), 0);
    const executed = expenses.filter((e) => e.status !== "rejeitado").reduce((s, e) => s + Number(e.amount || 0), 0);
    return { planned, executed, balance: planned - executed, pct: planned ? Math.min(100, (executed / planned) * 100) : 0 };
  }, [items, expenses]);

  const byRubrica = useMemo(() => {
    const map: Record<string, { planned: number; executed: number }> = {};
    for (const i of items) {
      map[i.rubrica] = map[i.rubrica] || { planned: 0, executed: 0 };
      map[i.rubrica].planned += Number(i.planned_amount || 0);
    }
    for (const e of expenses) {
      if (e.status === "rejeitado") continue;
      const item = items.find((x) => x.id === e.budget_item_id);
      const key = item?.rubrica || "outros";
      map[key] = map[key] || { planned: 0, executed: 0 };
      map[key].executed += Number(e.amount || 0);
    }
    return map;
  }, [items, expenses]);

  const saveItem = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = { ...editItem, project_id: projectId, created_by: user.id };
    if (editItem.id) {
      await supabase.from("research_budget_items").update(payload).eq("id", editItem.id);
    } else {
      await supabase.from("research_budget_items").insert(payload);
    }
    setItemOpen(false); setEditItem({ rubrica: "custeio", currency: "BRL", planned_amount: 0 });
    load();
  };

  const saveExp = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = { ...editExp, project_id: projectId, created_by: user.id };
    if (editExp.id) {
      await supabase.from("research_expenses").update(payload).eq("id", editExp.id);
    } else {
      const { error } = await supabase.from("research_expenses").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    setExpOpen(false); setEditExp({ expense_date: new Date().toISOString().slice(0, 10), status: "pendente", amount: 0 });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Previsto</div><div className="text-2xl font-semibold">{fmt(totals.planned)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Executado</div><div className="text-2xl font-semibold">{fmt(totals.executed)}</div><Progress value={totals.pct} className="mt-2 h-1.5" /></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Saldo</div><div className={`text-2xl font-semibold ${totals.balance < 0 ? "text-destructive" : ""}`}>{fmt(totals.balance)}</div></Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4" /> Rubricas orçamentárias</h3>
          <Button size="sm" onClick={() => { setEditItem({ rubrica: "custeio", currency: "BRL", planned_amount: 0 }); setItemOpen(true); }} className="gap-1"><Plus className="h-4 w-4" />Nova rubrica</Button>
        </div>
        {loading ? <div className="text-sm text-muted-foreground">Carregando…</div> : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma rubrica cadastrada.</div>
        ) : (
          <div className="space-y-2">
            {items.map((i) => {
              const r = byRubrica[i.rubrica] || { planned: 0, executed: 0 };
              const pct = i.planned_amount ? Math.min(100, (r.executed / i.planned_amount) * 100) : 0;
              return (
                <div key={i.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/30 cursor-pointer" onClick={() => { setEditItem(i); setItemOpen(true); }}>
                  <Badge variant="secondary" className="capitalize">{RUBRICAS.find((x) => x.v === i.rubrica)?.l || i.rubrica}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{i.description}</div>
                    {i.funder && <div className="text-xs text-muted-foreground">{i.funder}</div>}
                  </div>
                  <div className="text-right text-sm">
                    <div>{fmt(Number(i.planned_amount))}</div>
                    <div className="text-xs text-muted-foreground">executado {fmt(r.executed)}</div>
                  </div>
                  <Progress value={pct} className="w-24 h-1.5" />
                  <Button size="icon" variant="ghost" onClick={async (e) => { e.stopPropagation(); if (confirm("Excluir rubrica?")) { await supabase.from("research_budget_items").delete().eq("id", i.id); load(); } }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> Despesas / Prestação de contas</h3>
          <Button size="sm" onClick={() => { setEditExp({ expense_date: new Date().toISOString().slice(0, 10), status: "pendente", amount: 0 }); setExpOpen(true); }} className="gap-1"><Plus className="h-4 w-4" />Nova despesa</Button>
        </div>
        {expenses.length === 0 ? (
          <div className="text-sm text-muted-foreground">Sem despesas registradas.</div>
        ) : (
          <div className="space-y-1">
            {expenses.map((e) => {
              const item = items.find((i) => i.id === e.budget_item_id);
              return (
                <div key={e.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/30 cursor-pointer text-sm" onClick={() => { setEditExp(e); setExpOpen(true); }}>
                  <span className="text-xs text-muted-foreground w-20">{new Date(e.expense_date).toLocaleDateString("pt-BR")}</span>
                  <Badge variant="outline" className="text-xs">{item ? RUBRICAS.find((r) => r.v === item.rubrica)?.l : "Sem rubrica"}</Badge>
                  <div className="flex-1 truncate">{e.description}{e.supplier ? ` — ${e.supplier}` : ""}</div>
                  <Badge variant={e.status === "aprovado" || e.status === "reembolsado" ? "default" : e.status === "rejeitado" ? "destructive" : "secondary"} className="text-xs">{STATUS.find((s) => s.v === e.status)?.l}</Badge>
                  <span className="font-medium tabular-nums">{fmt(Number(e.amount))}</span>
                  <Button size="icon" variant="ghost" onClick={async (ev) => { ev.stopPropagation(); if (confirm("Excluir despesa?")) { await supabase.from("research_expenses").delete().eq("id", e.id); load(); } }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem.id ? "Editar" : "Nova"} rubrica</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Select value={editItem.rubrica} onValueChange={(v) => setEditItem({ ...editItem, rubrica: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RUBRICAS.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Descrição" value={editItem.description || ""} onChange={(e) => setEditItem({ ...editItem, description: e.target.value })} />
            <Input type="number" step="0.01" placeholder="Valor previsto" value={editItem.planned_amount ?? 0} onChange={(e) => setEditItem({ ...editItem, planned_amount: Number(e.target.value) })} />
            <Input placeholder="Financiador (CNPq, FAPESP, ...)" value={editItem.funder || ""} onChange={(e) => setEditItem({ ...editItem, funder: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={editItem.period_start || ""} onChange={(e) => setEditItem({ ...editItem, period_start: e.target.value })} />
              <Input type="date" value={editItem.period_end || ""} onChange={(e) => setEditItem({ ...editItem, period_end: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setItemOpen(false)}>Cancelar</Button><Button onClick={saveItem}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editExp.id ? "Editar" : "Nova"} despesa</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={editExp.expense_date || ""} onChange={(e) => setEditExp({ ...editExp, expense_date: e.target.value })} />
              <Input type="number" step="0.01" placeholder="Valor" value={editExp.amount ?? 0} onChange={(e) => setEditExp({ ...editExp, amount: Number(e.target.value) })} />
            </div>
            <Select value={editExp.budget_item_id || "none"} onValueChange={(v) => setEditExp({ ...editExp, budget_item_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Rubrica" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem rubrica</SelectItem>
                {items.map((i) => <SelectItem key={i.id} value={i.id}>{RUBRICAS.find((r) => r.v === i.rubrica)?.l} — {i.description}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea placeholder="Descrição da despesa" value={editExp.description || ""} onChange={(e) => setEditExp({ ...editExp, description: e.target.value })} />
            <Input placeholder="Fornecedor" value={editExp.supplier || ""} onChange={(e) => setEditExp({ ...editExp, supplier: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Nº NF" value={editExp.invoice_number || ""} onChange={(e) => setEditExp({ ...editExp, invoice_number: e.target.value })} />
              <Select value={editExp.status} onValueChange={(v) => setEditExp({ ...editExp, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setExpOpen(false)}>Cancelar</Button><Button onClick={saveExp}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
