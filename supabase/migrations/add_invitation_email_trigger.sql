-- Email trigger for group invitations
-- Run this in Supabase SQL Editor AFTER enabling pg_net extension

-- First enable the pg_net extension (for HTTP requests from database)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to send invitation email via Supabase's configured SMTP
CREATE OR REPLACE FUNCTION send_invitation_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  group_name TEXT;
  join_code TEXT;
  inviter_name TEXT;
  app_url TEXT := 'https://your-app-url.com'; -- Update this with your app URL
BEGIN
  -- Get group details
  SELECT mg.name, mg.join_code INTO group_name, join_code
  FROM meeting_groups mg
  WHERE mg.id = NEW.group_id;

  -- Get inviter name
  SELECT COALESCE(up.display_name, au.email) INTO inviter_name
  FROM auth.users au
  LEFT JOIN user_profiles up ON up.user_id = au.id
  WHERE au.id = NEW.invited_by;

  -- Use Supabase's built-in email via auth.email()
  -- This uses the SMTP configuration (Brevo) you set up in Supabase
  PERFORM net.http_post(
    url := 'https://tpkrsccigfqiabmwtpyx.supabase.co/functions/v1/send-invitation-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.jwt.claim.sub', true)
    ),
    body := jsonb_build_object(
      'email', NEW.email,
      'groupName', group_name,
      'inviterName', inviter_name,
      'joinCode', join_code
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the insert
  RAISE WARNING 'Failed to send invitation email: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on group_invitations insert
DROP TRIGGER IF EXISTS on_invitation_created ON group_invitations;
CREATE TRIGGER on_invitation_created
  AFTER INSERT ON group_invitations
  FOR EACH ROW
  EXECUTE FUNCTION send_invitation_email();
