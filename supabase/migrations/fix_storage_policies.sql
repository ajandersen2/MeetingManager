-- Storage Bucket RLS Policies Fix
-- Run this in your Supabase SQL Editor

-- First, ensure the bucket exists and is accessible
-- Go to Storage > Create Bucket > Name: "meeting-attachments" > Make it private

-- Then run these policies:

-- Allow authenticated users to upload files to the meeting-attachments bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'meeting-attachments');

-- Allow authenticated users to view their files
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'meeting-attachments');

-- Allow authenticated users to update their files
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'meeting-attachments');

-- Allow authenticated users to delete their files
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'meeting-attachments');
