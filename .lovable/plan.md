

# CAPES APC Advisor - Writing Assistant Integration

## Overview

Add a "CAPES APC" feature to the Writing Assistant that helps Brazilian researchers find journals with CAPES-paid APC, get submission guidelines, and format their articles accordingly.

## Architecture

```text
┌──────────────────────────────────────────────────────┐
│  WritingAssistant.tsx                                 │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Sources     │  │ Editor   │  │ AI Output /      │ │
│  │ Panel       │  │          │  │ CAPES Panel      │ │
│  └────────────┘  └──────────┘  └──────────────────┘ │
└──────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐         ┌──────────────────────┐
│ capes-apc-advisor│         │ writing-assist       │
│ (new edge fn)   │         │ (existing, + format) │
└─────────────────┘         └──────────────────────┘
```

## Data: CAPES Agreements Catalog

Create a static catalog file `src/lib/capes-agreements.ts` with structured data for all 7 publishers extracted from the CAPES page:

| Publisher | Journals | Links |
|-----------|----------|-------|
| Springer Nature | 1,738 hybrid | Eligible journals PDF, Author guide PDF, Eligible institutions |
| Elsevier | 1,619 hybrid (Freedom Collection) | Elsevier OA page |
| ACM | Listed in PDF | Institutions PDF, Journals PDF |
| Royal Society Publishing | 10 journals | Info PDF |
| Wiley | Hybrid journals (unlimited) | Wiley OA agreement page |
| IEEE | IEEE Access + others | IEEE OA partners page |
| ACS | Chemistry journals | ACS Open Science page |

Each entry includes: publisher name, description, number of journals, scope areas, eligible journals link, author guide link, institutions link, CAPES portal link, ORCID requirement, and key submission requirements from Portaria 120/2024.

## New Edge Function: `capes-apc-advisor`

**Purpose**: Given the article content/topic being written, use AI to:
1. **`suggest_journals`** action: Analyze the article topic and suggest which CAPES-agreement publishers/journals match the scope. Return ranked suggestions with reasoning.
2. **`get_submission_guidelines`** action: For a chosen journal/publisher, use AI + the known URLs to compile submission guidelines, formatting requirements, and all necessary links.
3. **`format_article`** action: Take the current article text and reformat it according to the chosen journal's style (passed through `writing-assist` with a new action).

## New UI Component: `CAPESAdvisorPanel`

A panel/dialog accessible from the Writing Assistant toolbar via a new button (e.g., "CAPES APC" with a GraduationCap icon). It has 3 steps:

1. **Step 1 - Analyze & Suggest**: Shows article summary, calls AI to suggest matching journals from CAPES agreements. Displays cards for each suggestion with publisher logo, journal scope match score, and key info.

2. **Step 2 - Submission Guidelines**: After selecting a journal, shows formatting rules, submission requirements, required documents, and links:
   - Link to journal submission page
   - Link to eligible journals list
   - Link to author guide
   - Link to CAPES APC payment request (Portaria 120/2024 requirements)
   - ORCID registration requirement at meusdados.capes.gov.br

3. **Step 3 - Format Article**: Button to auto-format the article according to the chosen journal's guidelines, inserting the result into the editor.

## Changes Summary

| File | Change |
|------|--------|
| `src/lib/capes-agreements.ts` | New - Static catalog of all 7 CAPES publisher agreements with links and metadata |
| `supabase/functions/capes-apc-advisor/index.ts` | New - Edge function with `suggest_journals` and `get_submission_guidelines` actions |
| `src/components/app/CAPESAdvisorPanel.tsx` | New - Multi-step dialog UI for journal suggestion, guidelines, and formatting |
| `src/pages/WritingAssistant.tsx` | Add CAPES APC button to toolbar, integrate panel |
| `supabase/functions/writing-assist/index.ts` | Add `format_for_journal` action case |
| `supabase/config.toml` | Register new edge function |
| `src/pages/Docs.tsx` | Document the CAPES APC Advisor feature |
| `src/components/landing/FeaturesSection.tsx` | Update feature count and mention CAPES integration |

## Key Implementation Details

- The static catalog avoids needing to scrape CAPES on every request; it can be updated periodically
- The AI uses the article content + catalog data to match scope intelligently
- All CAPES-specific links (Portaria 120/2024, ORCID registration, Power BI dashboard) are surfaced directly
- The edge function uses `callAI` with tool-calling to return structured journal suggestions
- Free users can access the CAPES advisor (since CAPES agreements benefit all Brazilian researchers)

