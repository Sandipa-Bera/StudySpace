import { supabase } from '../lib/supabase';
import type { ChapterAttachment } from '../types';

function formatSupabaseError(error: any, context: string): Error {
  const msg = error?.message || String(error);
  if (msg.includes('Bucket not found') || msg.includes('The resource was not found') || error?.statusCode === '404' || error?.status === 404) {
    return new Error(`Storage bucket 'attachments' not found in Supabase. Please create a storage bucket named 'attachments' in your Supabase Dashboard.`);
  }
  if ((msg.includes('relation') && msg.includes('does not exist')) || error?.code === '42P01') {
    return new Error(`Database table 'chapter_attachments' does not exist. Please execute supabase_migration.sql in your Supabase SQL Editor.`);
  }
  if (msg.includes('row-level security') || error?.code === '42501') {
    return new Error(`Permission denied by Supabase RLS policy. Please configure RLS policies for storage & tables in Supabase.`);
  }
  return new Error(`${context}: ${msg}`);
}

export async function getChapterAttachments(chapterId: string) {
  const { data, error } = await supabase
    .from('chapter_attachments')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load chapter attachments (table may not exist):', error);
    return [];
  }
  return data as ChapterAttachment[];
}

export async function uploadChapterAttachment(
  chapterId: string,
  file: File,
  userId: string
): Promise<ChapterAttachment> {
  // Validate file size (max 10MB)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('File is too large. Maximum size is 10MB.');
  }

  // Validate file type & extension
  const allowedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
  ];

  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
  const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'ppt', 'pptx', 'txt'];

  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
    throw new Error('File type not supported. Please upload PDF, images, Word, PowerPoint, or text files.');
  }

  const fileName = `${Date.now()}.${fileExt}`;
  const storagePath = `${userId}/chapters/${chapterId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

  if (uploadError) {
    console.error('Supabase storage upload error:', uploadError);
    throw formatSupabaseError(uploadError, 'Storage upload failed');
  }

  const { data, error } = await supabase
    .from('chapter_attachments')
    .insert({
      chapter_id: chapterId,
      file_name: file.name,
      storage_path: storagePath,
      file_type: file.type || 'application/octet-stream',
      file_size: file.size,
    })
    .select()
    .single();

  if (error) {
    console.error('Supabase chapter_attachments insert error:', error);
    throw formatSupabaseError(error, 'Database insert failed');
  }
  return data as ChapterAttachment;
}

export async function deleteChapterAttachment(attachmentId: string, storagePath: string) {
  const { error: storageError } = await supabase.storage
    .from('attachments')
    .remove([storagePath]);

  if (storageError) {
    console.error('Storage remove error:', storageError);
  }

  const { error } = await supabase
    .from('chapter_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) throw formatSupabaseError(error, 'Delete failed');
}

export async function getChapterAttachmentUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(storagePath, 3600);

  if (error) throw formatSupabaseError(error, 'Failed to generate download URL');
  return data.signedUrl;
}

