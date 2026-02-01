-- Add raw_transcript column to store original transcript before AI generation
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS raw_transcript TEXT;
