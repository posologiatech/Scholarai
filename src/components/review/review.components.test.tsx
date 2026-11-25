import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { GradeEditor } from "./GradeEditor";
import { ReviewTypePicker } from "./ReviewTypePicker";
import { ThemeMatrix } from "./ThemeMatrix";
import type { Ctx, Theme } from "@/lib/review/artifacts";
import { newGradeEntry, type GradeEntry } from "@/lib/review/grade";
import { getReviewType } from "@/lib/review/types";

vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "pt", t: (k: string) => k }) }));

describe("ReviewTypePicker", () => {
  it("shows the three types and the translated framework for the integrative review", () => {
    render(<ReviewTypePicker value={null} onChange={() => {}} locale="pt" />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByText("Problema, população e variáveis")).toBeInTheDocument();
    expect(screen.queryByText(/Problem \/ population/)).toBeNull();
  });
  it("reports the choice", () => {
    const onChange = vi.fn();
    render(<ReviewTypePicker value={null} onChange={onChange} locale="pt" />);
    fireEvent.click(screen.getByRole("radio", { name: /Revisão de escopo/ }));
    expect(onChange).toHaveBeenCalledWith("scoping");
  });
});

function GradeHarness({ initial }: { initial: GradeEntry[] }) {
  const [entries, setEntries] = useState(initial);
  return <GradeEditor entries={entries} includedCount={8} highRiskCount={3} locale="pt" canEdit onChange={setEntries} />;
}

describe("GradeEditor", () => {
  it("asks for all five domains, then shows the computed certainty", () => {
    render(<GradeHarness initial={[{ ...newGradeEntry("a"), outcome: "Demência" }]} />);
    expect(screen.getByText("Julgue os 5 domínios")).toBeInTheDocument();
    for (const d of ["Risco de viés", "Inconsistência", "Evidência indireta", "Imprecisão", "Viés de publicação"]) {
      fireEvent.change(screen.getByLabelText(d), { target: { value: d === "Risco de viés" ? "1" : "0" } });
    }
    expect(screen.getByText(/⊕⊕⊕◯ Moderada/)).toBeInTheDocument();
  });
  it("tells the reviewer how many studies they rated at high risk of bias", () => {
    render(<GradeHarness initial={[{ ...newGradeEntry("a"), outcome: "x" }]} />);
    expect(screen.getByText("3 de 8 estudos com alto risco de viés na sua avaliação.")).toBeInTheDocument();
  });
  it("offers upgrade factors only for observational evidence", () => {
    render(<GradeHarness initial={[{ ...newGradeEntry("a"), outcome: "x" }]} />);
    expect(screen.queryByText(/Aumenta: Efeito grande/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Desenho"), { target: { value: "observational" } });
    expect(screen.getByText(/Aumenta: Efeito grande/)).toBeInTheDocument();
  });
  it("adds and removes outcomes", () => {
    render(<GradeHarness initial={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar desfecho/ }));
    expect(screen.getByLabelText("Desfecho")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover desfecho" }));
    expect(screen.queryByLabelText("Desfecho")).toBeNull();
  });
});

function ThemeHarness() {
  const [state, setState] = useState<{ themes: Theme[]; assign: Record<string, string[]> }>({ themes: [], assign: {} });
  const studies = [{ id: "a", title: "T", authors: ["Silva, J"], year: 2020 }];
  return <ThemeMatrix studies={studies} findings={new Map([["a", "Menor risco"]])} themes={state.themes} assign={state.assign} locale="pt" canEdit onChange={(themes, assign) => setState({ themes, assign })} />;
}

describe("ThemeMatrix", () => {
  it("creates a theme, assigns a study to it and removes the theme with its assignments", () => {
    render(<ThemeHarness />);
    fireEvent.change(screen.getByLabelText("Novo tema"), { target: { value: "Segurança" } });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar tema/ }));
    const box = screen.getByRole("checkbox", { name: /Silva \(2020\) — Segurança/ });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(screen.getByRole("checkbox", { name: /Silva \(2020\) — Segurança/ })).toBeChecked();
    expect(screen.getByText("Menor risco")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover tema Segurança" }));
    expect(screen.getByText("Nenhum tema ainda.")).toBeInTheDocument();
  });
  it("ignores an empty theme name", () => {
    render(<ThemeHarness />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar tema/ }));
    expect(screen.getByText("Nenhum tema ainda.")).toBeInTheDocument();
  });
});

const ctx: Ctx = {
  locale: "pt", reviewType: "systematic",
  studies: [{ id: "a", title: "Metformin and dementia", authors: ["Silva, J"], year: 2020 }, { id: "b", title: "<b>Injected</b> title", authors: ["Lee, K"], year: 2019 }],
  fields: [{ key: "country", label: "País", kind: "text" }, { key: "population", label: "População", kind: "text" }, { key: "intervention", label: "Intervenção", kind: "text" }],
  extraction: new Map([["a", { country: "Brasil", population: "idosos", intervention: "metformina" }]]),
  appraisals: [{ record_id: "a", tool: "rob2", domains: { D1: { judgement: "low" }, D2: { judgement: "low" }, D3: { judgement: "some" }, D4: { judgement: "low" }, D5: { judgement: "low" } }, overall: "some" }],
  searches: [{ source: "pubmed", method: "api", interface: "x", query: "q", run_at: "2026-11-25T00:00:00Z", results_count: 10, imported_count: 10, filters: {} }],
  sourceLabel: () => "PubMed / MEDLINE", excluded: [{ id: "x", title: "Out", authors: ["Roe"], year: 2018, reason: "wrong_design" }],
  themes: [], assign: {}, grade: [{ ...newGradeEntry("g"), outcome: "Demência", downgrades: { risk_of_bias: 0, inconsistency: 0, indirectness: 0, imprecision: 0, publication_bias: 0 } }],
};

describe("ArtifactsPanel for a systematic review", () => {
  const def = getReviewType("systematic")!;
  const rows = [{ duplicate_of: null, screen_status: "included" as const, exclusion_reason_code: null }, { duplicate_of: "z", screen_status: "pending" as const, exclusion_reason_code: null }];
  const view = () => render(<ArtifactsPanel def={def} ctx={ctx} statusRows={rows} locale="pt" />);

  it("renders every artifact the type defines", () => {
    view();
    for (const a of def.artifacts) expect(screen.getByRole("heading", { name: new RegExp(a.label.pt.replace(/[()]/g, "\\$&")) })).toBeInTheDocument();
  });
  it("fills the tables from the data", () => {
    view();
    expect(screen.getByText("PubMed / MEDLINE")).toBeInTheDocument();
    expect(screen.getByText("Desenho de estudo não elegível")).toBeInTheDocument();
    expect(screen.getByText("⊕⊕⊕⊕ Alta")).toBeInTheDocument();
  });
  it("draws the risk-of-bias figure and never turns a paper title into markup", () => {
    const { container } = view();
    expect(container.querySelector('svg[aria-label="RoB 2"]')).not.toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });
  it("explains why forest and funnel plots are not generated here", () => {
    view();
    expect(screen.getAllByText(/dependem de efeitos numéricos por estudo/)).toHaveLength(2);
  });
  it("offers CSV, SVG and PNG exports", () => {
    view();
    expect(screen.getAllByRole("button", { name: "CSV" }).length).toBeGreaterThan(3);
    expect(screen.getAllByRole("button", { name: "SVG" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "PNG" }).length).toBeGreaterThan(0);
  });
});

describe("ArtifactsPanel for a scoping review", () => {
  it("lets the user pick the fields of the evidence map and redraws it", () => {
    const def = getReviewType("scoping")!;
    const { container } = render(<ArtifactsPanel def={def} ctx={{ ...ctx, reviewType: "scoping" }} statusRows={[]} locale="pt" />);
    expect(screen.getByRole("heading", { name: /Mapa de evidências em bolhas/ })).toBeInTheDocument();
    const rows = screen.getByText("Linhas").closest("label")!;
    fireEvent.change(within(rows).getByRole("combobox"), { target: { value: "country" } });
    expect(within(rows).getByRole("combobox")).toHaveValue("country");
    expect(container.querySelector('svg[aria-label*="País"]')).not.toBeNull();
  });
});
