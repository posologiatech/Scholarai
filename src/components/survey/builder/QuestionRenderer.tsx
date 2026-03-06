import { SurveyQuestion } from "@/hooks/useSurveyStore";
import MultipleChoice from "./question-types/MultipleChoice";
import TextEntry from "./question-types/TextEntry";
import MatrixTable from "./question-types/MatrixTable";
import SliderQuestion from "./question-types/SliderQuestion";
import RankOrder from "./question-types/RankOrder";
import ConstantSum from "./question-types/ConstantSum";
import { useSurveyStore } from "@/hooks/useSurveyStore";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  question: SurveyQuestion;
  editable?: boolean;
  respondMode?: boolean;
  value?: any;
  onChange?: (value: any) => void;
}

const QuestionRenderer = ({ question, editable, respondMode, value, onChange }: Props) => {
  const { updateQuestion } = useSurveyStore();

  const questionTextEl = editable ? (
    <Textarea
      value={question.question_text}
      onChange={(e) => updateQuestion(question.id, { question_text: e.target.value })}
      placeholder="Enter your question text..."
      className="text-base font-medium border-none shadow-none resize-none p-0 min-h-0 focus-visible:ring-0 bg-transparent"
      rows={1}
    />
  ) : (
    <p className="text-base font-medium text-foreground">
      {question.question_text || "Untitled Question"}
    </p>
  );

  const typeProps = { question, editable, respondMode, value, onChange };

  return (
    <div className="space-y-3">
      {questionTextEl}
      {question.description && !editable && (
        <p className="text-sm text-muted-foreground">{question.description}</p>
      )}
      {question.question_type === "multiple_choice" && <MultipleChoice {...typeProps} />}
      {question.question_type === "text_entry" && <TextEntry {...typeProps} />}
      {question.question_type === "matrix_table" && <MatrixTable {...typeProps} />}
      {question.question_type === "slider" && <SliderQuestion {...typeProps} />}
      {question.question_type === "rank_order" && <RankOrder {...typeProps} />}
      {question.question_type === "constant_sum" && <ConstantSum {...typeProps} />}
    </div>
  );
};

export default QuestionRenderer;
