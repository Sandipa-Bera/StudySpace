import { supabase } from '../lib/supabase';
import type { SearchResult } from '../types';

export async function globalSearch(userId: string, query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const searchTerm = `%${query.toLowerCase()}%`;
  const results: SearchResult[] = [];

  // Search subjects
  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name, description')
    .eq('user_id', userId)
    .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
    .limit(10);

  if (subjects) {
    subjects.forEach(subject => {
      results.push({
        type: 'subject',
        id: subject.id,
        title: subject.name,
        context: subject.description || undefined,
      });
    });
  }

  // Search chapters
  const { data: chapters } = await supabase
    .from('chapters')
    .select(`
      id,
      name,
      description,
      subjects (
        id,
        name
      )
    `)
    .eq('subjects.user_id', userId)
    .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
    .limit(10);

  if (chapters) {
    chapters.forEach(chapter => {
      results.push({
        type: 'chapter',
        id: chapter.id,
        title: chapter.name,
        context: chapter.description || undefined,
        subject_name: (chapter as any).subjects?.name,
      });
    });
  }

  // Search topics
  const { data: topics } = await supabase
    .from('topics')
    .select(`
      id,
      name,
      description,
      chapters (
        id,
        name,
        subjects (
          id,
          name
        )
      )
    `)
    .eq('chapters.subjects.user_id', userId)
    .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
    .limit(20);

  if (topics) {
    topics.forEach(topic => {
      results.push({
        type: 'topic',
        id: topic.id,
        title: topic.name,
        context: topic.description || undefined,
        subject_name: (topic as any).chapters?.subjects?.name,
        chapter_name: (topic as any).chapters?.name,
      });
    });
  }

  // Search topic notes
  const { data: notes } = await supabase
    .from('topic_notes')
    .select(`
      id,
      content,
      topic_id,
      topics (
        id,
        name,
        chapters (
          id,
          name,
          subjects (
            id,
            name
          )
        )
      )
    `)
    .eq('topics.chapters.subjects.user_id', userId)
    .ilike('content', searchTerm)
    .limit(20);

  if (notes) {
    notes.forEach(note => {
      const content = note.content.substring(0, 150);
      results.push({
        type: 'note',
        id: note.id,
        title: (note as any).topics?.name || 'Note',
        context: content + (note.content.length > 150 ? '...' : ''),
        subject_name: (note as any).topics?.chapters?.subjects?.name,
        chapter_name: (note as any).topics?.chapters?.name,
        topic_name: (note as any).topics?.name,
      });
    });
  }

  // Search journal entries
  const { data: journalEntries } = await supabase
    .from('journal_entries')
    .select('id, title, content, entry_date')
    .eq('user_id', userId)
    .or(`title.ilike.${searchTerm},content.ilike.${searchTerm}`)
    .limit(10);

  if (journalEntries) {
    journalEntries.forEach(entry => {
      const content = entry.content.substring(0, 150);
      results.push({
        type: 'journal',
        id: entry.id,
        title: entry.title,
        context: content + (entry.content.length > 150 ? '...' : ''),
      });
    });
  }

  return results;
}
