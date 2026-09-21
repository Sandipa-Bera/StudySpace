import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getUserActivity } from '../services/activity.service';
import { LoadingState } from '../components/ui/LoadingState';
import { Clock, CheckCircle, Edit, Star, Trash2, Plus, Play, Pause } from 'lucide-react';
import type { ActivityLog } from '../types';

export function ActivityPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadActivities();
  }, [user]);

  const loadActivities = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getUserActivity(user.id, 50);
      setActivities(data);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (actionType: string) => {
    switch (actionType) {
      case 'topic_completed':
        return <CheckCircle size={16} style={{ color: '#6B8E23' }} />;
      case 'topic_updated':
        return <Edit size={16} style={{ color: 'var(--warm)' }} />;
      case 'topic_favorited':
        return <Star size={16} style={{ color: 'var(--dusty)' }} />;
      case 'topic_deleted':
        return <Trash2 size={16} style={{ color: 'var(--rose)' }} />;
      case 'note_created':
      case 'note_updated':
        return <Edit size={16} style={{ color: 'var(--brown)' }} />;
      case 'note_deleted':
        return <Trash2 size={16} style={{ color: 'var(--rose)' }} />;
      case 'study_session_started':
        return <Play size={16} style={{ color: 'var(--warm)' }} />;
      case 'study_session_ended':
        return <Pause size={16} style={{ color: 'var(--warm)' }} />;
      case 'subject_created':
      case 'chapter_created':
      case 'topic_created':
        return <Plus size={16} style={{ color: 'var(--warm)' }} />;
      default:
        return <Clock size={16} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const getActivityLabel = (activity: ActivityLog) => {
    const metadata = activity.metadata as Record<string, string> | null;
    const entityName = metadata?.name || activity.entity_type;

    switch (activity.action_type) {
      case 'topic_completed':
        return `Completed ${entityName}`;
      case 'topic_updated':
        return `Updated ${entityName}`;
      case 'topic_favorited':
        return `Added ${entityName} to favorites`;
      case 'topic_deleted':
        return `Deleted ${entityName}`;
      case 'note_created':
        return `Added notes to ${entityName}`;
      case 'note_updated':
        return `Updated notes for ${entityName}`;
      case 'note_deleted':
        return `Deleted notes from ${entityName}`;
      case 'study_session_started':
        return `Started studying ${entityName}`;
      case 'study_session_ended':
        const duration = metadata?.duration;
        return `Finished studying ${entityName}${duration ? ` (${duration})` : ''}`;
      case 'subject_created':
        return `Created subject: ${entityName}`;
      case 'chapter_created':
        return `Created chapter: ${entityName}`;
      case 'topic_created':
        return `Created topic: ${entityName}`;
      default:
        return `${activity.action_type} ${entityName}`;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const groupByDate = (activities: ActivityLog[]) => {
    const groups: Record<string, ActivityLog[]> = {};
    activities.forEach(activity => {
      const date = new Date(activity.created_at).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });
    return groups;
  };

  if (loading) return <LoadingState />;

  const groupedActivities = groupByDate(activities);

  return (
    <div style={{ animation: 'fadeIn 0.2s ease', maxWidth: 720 }}>
      <div className="page-header">
        <h1 className="page-title">Activity History</h1>
        <p className="page-subtitle">Your recent study activities</p>
      </div>

      {activities.length === 0 ? (
        <div className="empty-state">
          <Clock size={32} style={{ opacity: 0.5, marginBottom: '0.75rem' }} />
          <h3>No activity yet</h3>
          <p>Your study activities will appear here</p>
        </div>
      ) : (
        <div style={{ marginTop: '1.5rem' }}>
          {Object.entries(groupedActivities).map(([date, dayActivities]) => (
            <div key={date} style={{ marginBottom: '2rem' }}>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '1rem',
              }}>
                {date}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {dayActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="card"
                    style={{
                      padding: '0.875rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.875rem',
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      {getActivityIcon(activity.action_type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.125rem' }}>
                        {getActivityLabel(activity)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                        {formatTime(activity.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
