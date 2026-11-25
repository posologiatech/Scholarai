import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChecklistPanel } from "./ChecklistPanel";
import { ManuscriptPanel } from "./ManuscriptPanel";
import type { WritingData } from "@/lib/review/factsInput";
import { withKeys, type FactsInput } from "@/lib/review/facts";
import { manuscriptFor, type WritingState } from "@/lib/review/manuscript";
import type { ReviewRecord } from "@/lib/review/protocol";
import { getReviewType } from "@/lib/review/types";

const api = vi.hoisted(() => ({
  aiDraft: vi.fn(), aiAudit: vi.fn(), loadChecklist: vi.fn(async () => []), saveChecklist: vi.fn(async () => {}),
}));
vi.mock("@/lib/review/writeApi", () => api);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const def = getReviewType("systematic")!;
const manuscript = manuscriptFor(def);
const review = {
  id: "r1", owner_id: "u", locale: "pt", title: "Metformina", question: "A metformina reduz demência?", review_type: "systematic",
  framework: { population: "Idosos", intervention: "Metformina", outcome: "Demência" }, eligibility: [{ kind: "include", text: "Ensaios" }],
  registry: { id: "CRD1" }, protocol_locked_at: "2026-03-01T00:00:00Z", stage_state: {}, ai_disclosure: [],
} as unknown as ReviewRecord;
const studies = withKeys([{ id: "a", title: "Metformin and dementia", year: 2020, authors: ["Silva, J"] }]);
const input: FactsInput = {
  locale: "pt", def, review, studies, fields: [], extraction: new Map(), appraisals: [], grade: [], themes: [], assign: {}, synthesis: {},
  prisma: { identified: 500, duplicatesRemoved: 120, screened: 380, excludedScreening: 340, includedFullText: 40, excludedFullText: 38, finalIncluded: 1, excludedReasons: {} },
  reasonLabels: {}, searches: [{ source: "pubmed", label: "PubMed / MEDLINE", method: "api", query: "q", run_at: "2026-03-05T10:00:00Z", results_count: 300, imported_count: 300 }],
  screening: { reviewers: 2, kappaTitleAbstract: null, aiScreening: false, pilot: false }, aiUses: [],
};
const data = { input, records: [], excluded: [], statusRows: [] } as unknown as WritingData;

function Harness({ initial = {} }: { initial?: WritingState }) {
  const [state, setState] = useState<WritingState>(initial);
  return <ManuscriptPanel review={review} data={data} manuscript={manuscript} state={state} locale="pt" onChange={setState} />;
}
const pick = (name: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));

describe("ManuscriptPanel", () => {
  it("lists the sections the guideline needs and tells the author what only they can write", () => {
    render(<Harness />);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(10);
    pick("Justificativa");
    expect(screen.getByText("Você escreve")).toBeInTheDocument();
    expect(screen.getByText(/exige literatura além dos estudos incluídos/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerar rascunho com IA/ })).toBeNull();
  });

  it("writes the sources section from the data without calling the AI", () => {
    render(<Harness />);
    pick("Fontes de informação");
    fireEvent.click(screen.getByRole("button", { name: "Gerar a partir dos dados" }));
    expect((screen.getByLabelText("Fontes de informação e estratégia de busca") as HTMLTextAreaElement).value).toContain("PubMed / MEDLINE (05/03/2026; consulta direta; 300 resultados)");
    expect(api.aiDraft).not.toHaveBeenCalled();
  });

  it("flags a number that is not in the data and a citation of an unknown study, live as the author types", () => {
    render(<Harness />);
    pick("Seleção dos estudos");
    const box = screen.getByLabelText("Seleção dos estudos");
    fireEvent.change(box, { target: { value: "Foram identificados 500 registros [S1]." } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(box, { target: { value: "Foram identificados 512 registros [S9]." } });
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText('O número "512" não está nos dados da revisão.')).toBeInTheDocument();
    expect(within(alert).getByText(/A citação S9 não corresponde/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprovar mesmo assim" })).toBeInTheDocument();
  });

  it("approves a clean section, and editing it afterwards takes the approval back", () => {
    render(<Harness />);
    pick("Seleção dos estudos");
    const box = screen.getByLabelText("Seleção dos estudos");
    fireEvent.change(box, { target: { value: "Foram identificados 500 registros." } });
    fireEvent.click(screen.getByRole("button", { name: "Aprovar seção" }));
    expect(screen.getByRole("button", { name: "Reabrir para edição" })).toBeInTheDocument();
    fireEvent.change(box, { target: { value: "Foram identificados 500 registros e mais." } });
    expect(screen.getByRole("button", { name: "Aprovar seção" })).toBeInTheDocument();
  });

  it("asks the AI with the section's facts and the study keys, and shows what comes back with its issues", async () => {
    api.aiDraft.mockResolvedValueOnce({ text: "Identificamos 500 registros e 777 outros.", issues: [{ type: "unsupported_number", snippet: "777" }], model: "m" });
    render(<Harness />);
    pick("Seleção dos estudos");
    fireEvent.click(screen.getByRole("button", { name: /Gerar rascunho com IA/ }));
    await waitFor(() => expect((screen.getByLabelText("Seleção dos estudos") as HTMLTextAreaElement).value).toContain("777"));
    const call = api.aiDraft.mock.calls[0][0];
    expect(call.studyKeys).toEqual(["S1"]);
    expect(call.facts.flow.identified).toBe(500);
    expect(screen.getByRole("alert")).toHaveTextContent('"777"');
  });
});

describe("ChecklistPanel", () => {
  it("shows every PRISMA 2020 item with its section and starts them all as missing", () => {
    render(<ChecklistPanel reviewId="r1" manuscript={manuscript} state={{}} locale="pt" />);
    expect(screen.getByText(/0 atendidos · 0 parciais · 42 ausentes de 42/)).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(42);
    expect(screen.getByRole("button", { name: /Auditar o manuscrito com IA/ })).toBeDisabled();
  });

  it("applies the AI audit and lets the author override an item", async () => {
    api.aiAudit.mockResolvedValueOnce({ rows: [{ key: "1", status: "met", quote: "uma revisão sistemática", note: "ok", verified: true }, { key: "5", status: "partial", quote: null, note: "falta justificar", verified: false }], truncated: false });
    render(<ChecklistPanel reviewId="r1" manuscript={manuscript} state={{ sections: { title: { text: "Metformina: uma revisão sistemática" } } }} locale="pt" />);
    fireEvent.click(screen.getByRole("button", { name: /Auditar o manuscrito com IA/ }));
    await waitFor(() => expect(screen.getByText(/1 atendidos · 1 parciais · 40 ausentes de 42/)).toBeInTheDocument());
    expect(api.saveChecklist).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Situação do item 5"), { target: { value: "met" } });
    expect(screen.getByText(/2 atendidos · 0 parciais · 40 ausentes de 42/)).toBeInTheDocument();
  });

  it("warns that the integrative checklist is an adaptation, not an official guideline", () => {
    const m = manuscriptFor(getReviewType("integrative")!);
    render(<ChecklistPanel reviewId="r1" manuscript={m} state={{}} locale="pt" />);
    expect(screen.getByText(/Não existe um checklist oficial para revisões integrativas/)).toBeInTheDocument();
  });

  it("marks PRISMA-ScR's critical-appraisal items as optional", () => {
    render(<ChecklistPanel reviewId="r1" manuscript={manuscriptFor(getReviewType("scoping")!)} state={{}} locale="pt" />);
    expect(screen.getAllByText("opcional")).toHaveLength(2);
  });
});
