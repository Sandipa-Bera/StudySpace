import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Star } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { topicsService } from '../services/topics.service';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import type { Topic } from '../types';

export function FavoritesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, [user]);

  const loadFavorites = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await topicsService.getFavorites();
      setFavorites(data);
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicClick = (topic: Topic) => {
    const chapter = (topic as any).chapters;
    if (chapter) {
      const subject = (chapter as any).subjects;
      if (subject) {
        navigate(`/subjects/${subject.id}/chapters/${chapter.id}/topics/${topic.id}`);
      }
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div style={{ animation: 'fadeIn 0.2s ease', maxWidth: 720 }}>
      <div className="page-header">
        <h1 className="page-title">Favorites</h1>
        <p className="page-subtitle">Your bookmarked topics</p>
      </div>

      {favorites.length === 0 ? (
        <EmptyState
          icon="⭐"
          title="No favorites yet"
          description="Star important topics from their detail page to find them quickly here."
        />
      ) : (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {favorites.length} {favorites.length === 1 ? 'topic' : 'topics'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {favorites.map((topic) => {
              const chapter = (topic as any).chapters;
              const subject = chapter ? (chapter as any).subjects : null;

              return (
                <div
                  key={topic.id}
                  className="card card-hover"
                  onClick={() => handleTopicClick(topic)}
                  style={{ padding: '1.25rem 1.5rem' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--dusty)',
                        flexShrink: 0,
                        marginTop: '0.125rem',
                      }}
                    >
                      <Star size={18} fill="currentColor" />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: '500',
                          color: 'var(--choco)',
                          marginBottom: '0.375rem',
                          lineHeight: '1.4',
                        }}
                      >
                        {topic.name}
                      </div>

                      <div
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-muted)',
                          marginBottom: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        {subject && (
                          <>
                            <BookOpen size={14} />
                            <span>{subject.name}</span>
                            {chapter && <span style={{ color: 'var(--border)' }}>→</span>}
                            {chapter && <span>{chapter.name}</span>}
                          </>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {topic.is_completed && (
                          <span className="badge complete">Completed</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
