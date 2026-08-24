-- Cosmetic fix for rows already inserted before the venue display-label
-- mapping existed in refresh-discover-feed (raw MEDLINE abbreviation
-- "N Engl J Med" was used as the badge text instead of "NEJM").
UPDATE public.discover_items SET source_label = 'NEJM' WHERE source_label = 'N Engl J Med';
