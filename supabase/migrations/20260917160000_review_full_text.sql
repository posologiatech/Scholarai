-- Review module phase 4: the text a record's data was extracted from is kept with the record,
-- so every reviewer and the AI quote the same text and each extracted value can be traced back.
ALTER TABLE public.review_records
  ADD COLUMN IF NOT EXISTS full_text text,
  ADD COLUMN IF NOT EXISTS full_text_source text;
