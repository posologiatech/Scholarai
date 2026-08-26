import { SurveyQuestion } from "@/hooks/useSurveyStore";
import MultipleChoice from "./question-types/MultipleChoice";
import TextEntry from "./question-types/TextEntry";
import MatrixTable from "./question-types/MatrixTable";
import SliderQuestion from "./question-types/SliderQuestion";
import RankOrder from "./question-types/RankOrder";
import ConstantSum from "./question-types/ConstantSum";
import DateTimeQuestion from "./question-types/DateTimeQuestion";
import NpsQuestion from "./question-types/NpsQuestion";
import SignatureQuestion from "./question-types/SignatureQuestion";
import FileUploadQuestion from "./question-types/FileUploadQuestion";
import { useSurveyStore } from "@/hooks/useSurveyStore";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  question: SurveyQuestion;
  editable?: boolean;
  respondMode?: boolean;
  value?: any;
  onChange?: (value: any) => void;
  /** Anonymous distribution token, forwarded to types that upload files (signature, file_upload).
   *  Only the real public respond page has one — the builder's own preview leaves it unset. */
  token?: string;
}

const QuestionRenderer = ({ question, editable, respondMode, value, onChange, token }: Props) => {
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
      {question.is_required && <span className="text-destructive"> *</span>}
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
      {question.question_type === "date_time" && <DateTimeQuestion {...typeProps} />}
      {question.question_type === "nps" && <NpsQuestion {...typeProps} />}
      {question.question_type === "signature" && <SignatureQuestion {...typeProps} token={token} />}
      {question.question_type === "file_upload" && <FileUploadQuestion {...typeProps} token={token} />}
    </div>
  );
};

export default QuestionRenderer;
