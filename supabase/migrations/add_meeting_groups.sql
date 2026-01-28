-- Meeting Groups Feature Migration (FIXED v3)
-- Run this in Supabase SQL Editor

-- First, drop ALL existing policies
DROP POLICY IF EXISTS "Users can view their groups" ON meeting_groups;
DROP POLICY IF EXISTS "Users can create groups" ON meeting_groups;
DROP POLICY IF EXISTS "Owners can update groups" ON meeting_groups;
DROP POLICY IF EXISTS "Owners can delete groups" ON meeting_groups;
DROP POLICY IF EXISTS "Members can view group members" ON group_members;
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
DROP POLICY IF EXISTS "Users can leave or creators can remove" ON group_members;
DROP POLICY IF EXISTS "Owners can manage members or users can leave" ON group_members;
DROP POLICY IF EXISTS "Users can view meetings" ON meetings;
DROP POLICY IF EXISTS "Users can create meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update meetings" ON meetings;
DROP POLICY IF EXISTS "Users can view their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;

-- ========================================
-- Meeting Groups Table
-- ========================================
CREATE TABLE IF NOT EXISTS meeting_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- Group Members Table
-- ========================================
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES meeting_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- ========================================
-- Add group_id to meetings table
-- ========================================
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES meeting_groups(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meetings_group_id ON meetings(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);

-- ========================================
-- Row Level Security
-- ========================================
ALTER TABLE meeting_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_group_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT group_id FROM group_members WHERE user_id = uid;
$$;

-- ========================================
-- MEETING_GROUPS Policies
-- ========================================

-- Users can see groups they CREATED or are MEMBERS of
CREATE POLICY "Users can view their groups"
  ON meeting_groups FOR SELECT
  USING (
    created_by = auth.uid() OR 
    id IN (SELECT get_user_group_ids(auth.uid()))
  );

-- Users can create groups (they set themselves as created_by)
CREATE POLICY "Users can create groups"
  ON meeting_groups FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Only creator can update
CREATE POLICY "Owners can update groups"
  ON meeting_groups FOR UPDATE
  USING (created_by = auth.uid());

-- Only creator can delete  
CREATE POLICY "Owners can delete groups"
  ON meeting_groups FOR DELETE
  USING (created_by = auth.uid());

-- ========================================
-- GROUP_MEMBERS Policies
-- ========================================

-- Users can see members of groups they belong to
CREATE POLICY "Members can view group members"
  ON group_members FOR SELECT
  USING (group_id IN (SELECT get_user_group_ids(auth.uid())));

-- Users can add themselves to any group (for joining via code)
CREATE POLICY "Users can join groups"
  ON group_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can leave, or group creator can remove anyone
CREATE POLICY "Users can leave or creators can remove"
  ON group_members FOR DELETE
  USING (
    user_id = auth.uid() OR
    group_id IN (SELECT id FROM meeting_groups WHERE created_by = auth.uid())
  );

-- ========================================
-- MEETINGS Policies (updated)
-- ========================================

CREATE POLICY "Users can view meetings"
  ON meetings FOR SELECT
  USING (
    user_id = auth.uid() OR
    group_id IN (SELECT get_user_group_ids(auth.uid()))
  );

CREATE POLICY "Users can create meetings"
  ON meetings FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    (group_id IS NULL OR group_id IN (SELECT get_user_group_ids(auth.uid())))
  );

CREATE POLICY "Users can update meetings"
  ON meetings FOR UPDATE
  USING (
    user_id = auth.uid() OR
    group_id IN (SELECT get_user_group_ids(auth.uid()))
  );
