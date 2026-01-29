-- Add FK relationship from meetings to user_profiles
-- This enables Supabase to join meetings with creator's display name
-- Run this in Supabase SQL Editor

-- Add foreign key from meetings.user_id to user_profiles.user_id
-- Note: user_profiles.user_id already references auth.users, so this creates a chain:
-- meetings.user_id -> user_profiles.user_id -> auth.users.id

ALTER TABLE meetings
ADD CONSTRAINT meetings_user_id_to_profile_fkey
FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
ON DELETE CASCADE;
