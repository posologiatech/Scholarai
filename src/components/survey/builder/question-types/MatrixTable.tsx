import { SurveyQuestion, MatrixItem, useSurveyStore } from "@/hooks/useSurveyStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, X } from "lucide-react";

interface Props {
  question: SurveyQuestion;
  editable?: boolean;
  respondMode?: boolean;
  value?: any; // { [rowId]: columnId }
  onChange?: (value: any) => void;
}

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

const MatrixTable = ({ question, editable, respondMode, value, onChange }: Props) => {
  const { updateQuestion } = useSurveyStore();
  const rows = [...(question.matrix_rows || [])].sort((a, b) => a.order - b.order);
  const cols = [...(question.matrix_columns || [])].sort((a, b) => a.order - b.order);

  const addRow = () => {
    const newRow: MatrixItem = { id: genId(), text: `Statement ${rows.length + 1}`, order: rows.length };
    updateQuestion(question.id, { matrix_rows: [...rows, newRow] });
  };

  const addCol = () => {
    const newCol: MatrixItem = { id: genId(), text: `Scale ${cols.length + 1}`, order: cols.length };
    updateQuestion(question.id, { matrix_columns: [...cols, newCol] });
  };

  const updateItem = (type: "matrix_rows" | "matrix_columns", id: string, text: string) => {
    const items = type === "matrix_rows" ? rows : cols;
    updateQuestion(question.id, {
      [type]: items.map((i) => (i.id === id ? { ...i, text } : i)),
    });
  };

  const removeItem = (type: "matrix_rows" | "matrix_columns", id: string) => {
    const items = type === "matrix_rows" ? rows : cols;
    updateQuestion(question.id, { [type]: items.filter((i) => i.id !== id) });
  };

  const answers = value || {};

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 font-normal text-muted-foreground min-w-[160px]" />
            {cols.map((col) => (
              <th key={col.id} className="text-center p-2 font-normal min-w-[80px]">
                {editable ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={col.text}
                      onChange={(e) => updateItem("matrix_columns", col.id, e.target.value)}
                      className="h-7 text-xs text-center border-dashed"
                    />
                    {cols.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={() => removeItem("matrix_columns", col.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{col.text}</span>
                )}
              </th>
            ))}
            {editable && (
              <th className="p-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addCol}>
                  <Plus className="h-3 w-3" />
                </Button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border/50 hover:bg-muted/30">
              <td className="p-2">
                {editable ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={row.text}
                      onChange={(e) => updateItem("matrix_rows", row.id, e.target.value)}
                      className="h-7 text-xs border-dashed"
                    />
                    {rows.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={() => removeItem("matrix_rows", row.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <span className="text-sm">{row.text}</span>
                )}
              </td>
              {cols.map((col) => (
                <td key={col.id} className="text-center p-2">
                  {respondMode ? (
                    <RadioGroup
                      value={answers[row.id] || ""}
                      onValueChange={(v) => onChange?.({ ...answers, [row.id]: v })}
                      className="inline-flex"
                    >
                      <RadioGroupItem value={col.id} />
                    </RadioGroup>
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/20 mx-auto" />
                  )}
                </td>
              ))}
              {editable && <td />}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <Button variant="ghost" size="sm" className="text-xs mt-2" onClick={addRow}>
          <Plus className="h-3 w-3 mr-1" />
          Add Row
        </Button>
      )}
    </div>
  );
};

export default MatrixTable;
