-- Remove max_tokens check constraint to allow higher values
-- Run this in Supabase SQL Editor

-- Drop the existing check constraint
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_max_tokens_check;

-- Add new constraint allowing up to 16000 tokens
ALTER TABLE app_settings ADD CONSTRAINT app_settings_max_tokens_check 
  CHECK (max_tokens >= 100 AND max_tokens <= 16000);
