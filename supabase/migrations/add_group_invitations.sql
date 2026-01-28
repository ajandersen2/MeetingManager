-- Group Invitations Migration (FIXED)
-- Run this in Supabase SQL Editor

-- Drop existing policies first
DROP POLICY IF EXISTS "Owners can view group invitations" ON group_invitations;
DROP POLICY IF EXISTS "Owners can create invitations" ON group_invitations;
DROP POLICY IF EXISTS "Users can respond to invitations" ON group_invitations;
DROP POLICY IF EXISTS "Owners can cancel invitations" ON group_invitations;

-- ========================================
-- Group Invitations Table
-- ========================================
CREATE TABLE IF NOT EXISTS group_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES meeting_groups(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(group_id, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_invitations_email ON group_invitations(email);
CREATE INDEX IF NOT EXISTS idx_group_invitations_group_id ON group_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_status ON group_invitations(status);

-- Enable RLS
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's email (avoids auth.users access issues)
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Policies using the helper function
-- Users can see invitations for groups they own OR invitations sent to their email
CREATE POLICY "Owners can view group invitations"
  ON group_invitations FOR SELECT
  USING (
    group_id IN (SELECT id FROM meeting_groups WHERE created_by = auth.uid()) OR
    email = get_current_user_email()
  );

-- Group owners can create invitations
CREATE POLICY "Owners can create invitations"
  ON group_invitations FOR INSERT
  WITH CHECK (
    group_id IN (SELECT id FROM meeting_groups WHERE created_by = auth.uid())
  );

-- Users can update invitations sent to their email (to accept/decline)
CREATE POLICY "Users can respond to invitations"
  ON group_invitations FOR UPDATE
  USING (email = get_current_user_email());

-- Owners can delete invitations
CREATE POLICY "Owners can cancel invitations"
  ON group_invitations FOR DELETE
  USING (
    group_id IN (SELECT id FROM meeting_groups WHERE created_by = auth.uid())
  );
