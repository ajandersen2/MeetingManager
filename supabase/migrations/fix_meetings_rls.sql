-- Fix RLS Policies for Meetings
-- Run this in Supabase SQL Editor to fix the 403 Forbidden error

-- Drop existing policies on meetings
DROP POLICY IF EXISTS "Users can view meetings" ON meetings;
DROP POLICY IF EXISTS "Users can create meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can view their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;

-- Recreate helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_group_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT group_id FROM group_members WHERE user_id = uid;
$$;

-- Create new policies that work with both personal and group meetings

-- SELECT: Users can see their own meetings OR meetings in their groups
CREATE POLICY "Users can view meetings"
  ON meetings FOR SELECT
  USING (
    user_id = auth.uid() OR
    group_id IN (SELECT get_user_group_ids(auth.uid()))
  );

-- INSERT: Users can create meetings (as themselves)
-- Note: Group membership is validated in the frontend
CREATE POLICY "Users can create meetings"
  ON meetings FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own meetings OR meetings in their groups
CREATE POLICY "Users can update meetings"
  ON meetings FOR UPDATE
  USING (
    user_id = auth.uid() OR
    group_id IN (SELECT get_user_group_ids(auth.uid()))
  );

-- DELETE: Only meeting creator can delete
CREATE POLICY "Users can delete meetings"
  ON meetings FOR DELETE
  USING (user_id = auth.uid());
