-- Fix: Allow users to look up groups by join code when joining
-- Run this in Supabase SQL Editor

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their groups" ON meeting_groups;

-- Create updated policy that also allows lookup by join_code
CREATE POLICY "Users can view groups"
  ON meeting_groups FOR SELECT
  USING (
    created_by = auth.uid() OR 
    id IN (SELECT get_user_group_ids(auth.uid())) OR
    TRUE  -- Allow all authenticated users to see groups for join code lookup
  );
