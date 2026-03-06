import { useSurveyStore } from "@/hooks/useSurveyStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GitBranch, ArrowRight, Layers } from "lucide-react";
import ConditionBuilder from "./ConditionBuilder";
import LogicBadge from "./LogicBadge";

const actionLabels: Record<string, { en: string; pt: string }> = {
  show_block: { en: "Show Block", pt: "Mostrar Bloco" },
  hide_question: { en: "Hide Question", pt: "Ocultar Questão" },
  skip_to: { en: "Skip To", pt: "Pular Para" },
  end_survey: { en: "End Survey", pt: "Encerrar Pesquisa" },
};

const FlowCanvas = () => {
  const { locale } = useLanguage();
  const { survey, blocks, questions, logicRules, addLogicRule, removeLogicRule } = useSurveyStore();

  if (!survey) return null;

  const sortedBlocks = [...blocks].sort((a, b) => a.block_order - b.block_order);

  return (
    <div className="flex h-full">
      {/* Left: Flow visualization */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6 max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">
                  {locale === "pt" ? "Fluxo da Pesquisa" : "Survey Flow"}
                </h2>
              </div>
            </div>

            {/* Visual flow of blocks */}
            {sortedBlocks.map((block, idx) => {
              const blockQuestions = questions
                .filter((q) => q.block_id === block.id)
                .sort((a, b) => a.question_order - b.question_order);
              const blockRules = logicRules.filter((r) => r.source_block_id === block.id);

              return (
                <div key={block.id}>
                  {/* Block card */}
                  <Card className="border-2 border-border/60 hover:border-primary/40 transition-colors">
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Layers className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">{block.title}</span>
                        <Badge variant="secondary" className="text-[10px] ml-auto">
                          {blockQuestions.length}{" "}
                          {blockQuestions.length === 1
                            ? locale === "pt" ? "questão" : "question"
                            : locale === "pt" ? "questões" : "questions"}
                        </Badge>
                      </div>

                      {/* Questions in block */}
                      <div className="space-y-1.5 ml-6">
                        {blockQuestions.map((q, qIdx) => {
                          const qRules = logicRules.filter((r) => r.source_question_id === q.id);
                          return (
                            <div key={q.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                                Q{qIdx + 1}
                              </span>
                              <span className="truncate flex-1">
                                {q.question_text || (locale === "pt" ? "Sem título" : "Untitled")}
                              </span>
                              {qRules.length > 0 && <LogicBadge count={qRules.length} />}
                            </div>
                          );
                        })}
                      </div>

                      {/* Block-level logic rules */}
                      {blockRules.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-dashed space-y-2">
                          {blockRules.map((rule) => (
                            <div key={rule.id} className="flex items-center gap-2 text-xs bg-primary/5 rounded-md p-2">
                              <GitBranch className="h-3 w-3 text-primary shrink-0" />
                              <span className="text-muted-foreground">
                                {actionLabels[rule.action]?.[locale] || rule.action}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Arrow between blocks */}
                  {idx < sortedBlocks.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 rotate-90" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* End of survey */}
            <div className="flex justify-center py-2">
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 rotate-90" />
            </div>
            <div className="text-center py-4 border-2 border-dashed rounded-lg text-sm text-muted-foreground">
              {locale === "pt" ? "Fim da Pesquisa" : "End of Survey"}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Right: Logic Rules panel */}
      <div className="w-[380px] border-l bg-muted/20 flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {locale === "pt" ? "Regras de Lógica" : "Logic Rules"}
          </h3>
          <Button size="sm" variant="outline" onClick={() => addLogicRule(survey.id)}>
            <Plus className="h-3 w-3 mr-1" />
            {locale === "pt" ? "Nova Regra" : "Add Rule"}
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {logicRules.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <GitBranch className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                <p>{locale === "pt" ? "Nenhuma regra de lógica" : "No logic rules yet"}</p>
                <p className="text-xs mt-1">
                  {locale === "pt"
                    ? "Adicione regras para controlar o fluxo da pesquisa"
                    : "Add rules to control the survey flow"}
                </p>
              </div>
            ) : (
              logicRules.map((rule, idx) => (
                <Card key={rule.id} className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {locale === "pt" ? `Regra ${idx + 1}` : `Rule ${idx + 1}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeLogicRule(rule.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  <ConditionBuilder rule={rule} />
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default FlowCanvas;
