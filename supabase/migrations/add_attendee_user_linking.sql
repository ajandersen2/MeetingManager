-- Enhanced Attendees with User Linking
-- Run this in Supabase SQL Editor

-- Add user_id column to meeting_attendees (nullable for custom names)
ALTER TABLE meeting_attendees 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add display_name to user_profiles for search
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_user_id ON meeting_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON user_profiles(display_name);

-- Update existing users to have email as display name if not set
UPDATE user_profiles 
SET display_name = (SELECT email FROM auth.users WHERE auth.users.id = user_profiles.user_id)
WHERE display_name IS NULL;
