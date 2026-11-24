-- Handwritten (Apple Pencil) notes: the ink of a note is kept next to its text.
-- `ink` holds the strokes ({v, w, h, paper, n, strokes}); the note's own `body` holds the text the AI read from it,
-- so handwritten notes are searched, connected and turned into tasks exactly like typed ones.
-- Safe to run more than once. Run in the Supabase SQL editor.

alter table public.smart_notes add column if not exists ink jsonb;
