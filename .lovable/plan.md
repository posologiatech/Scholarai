

# Survey Module (ScholarAI Surveys) -- Implementation Plan

## Overview

A new Qualtrics-inspired survey/data collection module integrated into ScholarAI, designed for academic research. Surveys created here can export collected responses directly into DataMind for analysis.

## Why This Is Competitive

- **Deep academic integration**: Surveys link directly to DataMind analysis pipelines, eliminating the export-import cycle researchers face with Qualtrics + SPSS/R.
- **AI-powered question generation**: Leverage existing AI infrastructure to suggest questions based on research objectives.
- **Built-in statistical summaries**: Mean, SD, CI displayed inline in reports -- no external tools needed.
- **Bilingual (PT/EN)** out of the box.
- **Workspace collaboration**: Team members can co-edit surveys via existing workspace infrastructure.

---

## Database Schema (New Tables)

```text
surveys
├── id, user_id, workspace_id?, title, description, status (draft/active/closed)
├── settings (jsonb: randomization, progress_bar, back_button, etc.)
├── created_at, updated_at, published_at, closed_at

survey_blocks
├── id, survey_id, title, description, block_order
├── randomize_questions (bool), settings (jsonb)

survey_questions
├── id, block_id, survey_id, question_type, question_text, description
├── question_order, is_required, validation_rules (jsonb)
├── choices (jsonb: [{id, text, value, order}])
├── matrix_rows (jsonb), matrix_columns (jsonb)
├── settings (jsonb: randomize_choices, slider_min/max, etc.)

survey_logic_rules
├── id, survey_id, source_question_id?, source_block_id?
├── condition (jsonb: {field, operator, value})
├── action (show_block/hide_question/skip_to/end_survey)
├── target_id (uuid), rule_order

survey_contacts
├── id, survey_id, user_id, first_name, last_name, email
├── institution, custom_fields (jsonb), status (not_sent/sent/responded)

survey_distributions
├── id, survey_id, type (anonymous_link/email), anonymous_token
├── email_subject, email_body, scheduled_at, sent_at

survey_responses
├── id, survey_id, respondent_id?, contact_id?
├── started_at, completed_at, status (in_progress/complete/disqualified)
├── ip_address, user_agent, duration_seconds
├── metadata (jsonb: embedded_data, geo, etc.)

survey_answers
├── id, response_id, question_id
├── answer_text, answer_numeric, answer_choices (jsonb)
├── matrix_answers (jsonb: [{row_id, column_id}])
```

RLS: All tables scoped to `user_id = auth.uid()`. Public survey responses allow anonymous insert via edge function (no JWT). Workspace-shared surveys use existing `is_workspace_member()`.

---

## File & Component Structure

```text
src/pages/
├── Surveys.tsx                    (project list / dashboard)
├── SurveyBuilder.tsx              (3-pane builder)
├── SurveyFlow.tsx                 (visual logic editor)
├── SurveyDistribution.tsx         (links, email, contacts)
├── SurveyResults.tsx              (reports + raw data)
├── SurveyPreview.tsx              (respondent-facing preview)
├── SurveyRespond.tsx              (public respondent page, no auth)

src/components/survey/
├── SurveyProjectList.tsx          (data table with status, responses, sparklines)
├── builder/
│   ├── BlockSidebar.tsx           (left pane: block navigation, drag-reorder)
│   ├── QuestionCanvas.tsx         (center: inline WYSIWYG editing)
│   ├── QuestionContextPanel.tsx   (right: type, validation, randomization)
│   ├── QuestionRenderer.tsx       (renders each question type)
│   ├── question-types/
│   │   ├── MultipleChoice.tsx
│   │   ├── TextEntry.tsx
│   │   ├── MatrixTable.tsx
│   │   ├── SliderQuestion.tsx
│   │   ├── RankOrder.tsx
│   │   └── ConstantSum.tsx
├── flow/
│   ├── FlowCanvas.tsx             (visual nested-list / node-based flow)
│   ├── ConditionBuilder.tsx       (dropdown rule rows)
│   └── LogicBadge.tsx             (GitBranch icon on questions with logic)
├── distribution/
│   ├── AnonymousLinkTab.tsx       (URL + QR code + copy)
│   ├── EmailComposerTab.tsx       (rich text + piped text insertion)
│   └── ContactListTab.tsx         (data table + CSV upload)
├── results/
│   ├── ReportsDashboard.tsx       (Recharts widgets grid)
│   ├── ResponseDataGrid.tsx       (raw data table, variable name toggle)
│   ├── StatsSummary.tsx           (mean, SD, n calculations)
│   └── ExportEngine.tsx           (CSV, TSV, XLSX export)
├── respond/
│   ├── RespondentForm.tsx         (public form with logic evaluation)
│   └── ProgressIndicator.tsx

src/hooks/
├── useSurveyStore.ts              (Zustand store for survey builder state)

supabase/functions/
├── survey-respond/index.ts        (anonymous response submission, verify_jwt=false)
├── survey-export-datamind/index.ts (push responses into DataMind conversation)
```

---

## Implementation Phases

### Phase 1: Foundation (Database + Routing + Project List)
- Create all database tables with RLS policies via migration tool
- Add routes: `/surveys`, `/surveys/:id/build`, `/surveys/:id/flow`, `/surveys/:id/distribute`, `/surveys/:id/results`, `/survey/respond/:token`
- Add "Surveys" nav link in AppSidebar (ClipboardList icon)
- Build `SurveyProjectList` with status badges, response counts, sparkline trends, search/filter, "Create Survey" button

### Phase 2: Survey Builder (Core Engine)
- Implement Zustand store (`useSurveyStore`) managing the nested survey object (blocks → questions → choices/matrix)
- Build 3-pane layout: BlockSidebar | QuestionCanvas | QuestionContextPanel
- Implement all 6 question types with inline editing
- Drag-and-drop reordering for blocks and questions
- Auto-save to Supabase on changes (debounced)

### Phase 3: Logic Engine & Survey Flow
- Build ConditionBuilder component (question selector → operator → value → action)
- Visual flow editor showing block sequence with branch indicators
- Extend Zustand store with `logicRules` array
- Preview mode that evaluates logic rules in real-time
- GitBranch badges on questions with active logic

### Phase 4: Distribution Module
- Anonymous link generation with unique token + QR code (via canvas/SVG)
- Email composer with piped text insertion (`{{Contact.FirstName}}`, etc.)
- Contact list management table with CSV upload
- Schedule send UI (mock for now, real via edge function later)
- `survey-respond` edge function for anonymous submissions (no JWT)

### Phase 5: Data & Analysis + DataMind Integration
- Reports dashboard with Recharts: bar charts, donut charts, stacked bars for Likert
- Statistical calculations: mean, SD, confidence intervals
- Raw data grid with question text / variable name toggle
- Export engine: CSV, TSV, XLSX (using existing xlsx dependency)
- **DataMind integration**: "Analyze in DataMind" button that creates a new DataMind conversation with survey responses auto-loaded as a CSV file in the `datamind-files` bucket, enabling immediate analysis

### Phase 6: Respondent-Facing Form
- Public page at `/survey/respond/:token` (no auth required)
- Progress bar, one-block-at-a-time or all-at-once modes
- Logic evaluation engine to show/hide questions dynamically
- Mobile-responsive form design
- Submission via `survey-respond` edge function

---

## DataMind Integration Detail

The key differentiator: a single click from Survey Results exports all responses as a structured CSV into DataMind. The `survey-export-datamind` edge function:
1. Queries `survey_answers` joined with `survey_questions` for headers
2. Generates CSV with proper variable names
3. Uploads to `datamind-files` bucket
4. Creates a new `datamind_conversations` entry with an initial system message referencing the file
5. Redirects user to `/datamind/:newConversationId`

---

## Design System

Consistent with existing ScholarAI design: white backgrounds, `bg-muted/50` panels, primary blue accents, shadcn/ui components throughout. The builder uses `ResizablePanelGroup` for the 3-pane layout (already in the project). Question cards use the existing `Card` component with subtle borders.

