import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { subjectsService } from '../services/subjects.service';
import { chaptersService } from '../services/chapters.service';
import { topicsService } from '../services/topics.service';
import { ProgressBar } from '../components/ui/ProgressBar';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { getGreeting } from '../utils/greeting';
import { calcProgress } from '../utils/progress';
import { BookOpen, CheckCircle, Clock, Calendar } from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dueSoon, setDueSoon] = useState([]);
  const [needRevisionList, setNeedRevisionList] = useState([]);
  const [todayStudy, setTodayStudy] = useState([]);

  const displayName =
    user?.user_metadata?.display_name ||
    user?.email?.split('@')[0] ||
    'there';

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const subjects = await subjectsService.getAll(user.id);

      const [due, revision] = await Promise.all([
        topicsService.getTopicsDueSoon(7).catch(() => []),
        topicsService.getTopicsNeedingRevision().catch(() => []),
      ]);

      const allData = await Promise.all(
        subjects.map(async (subject) => {
          try {
            const chapters = await chaptersService.getBySubject(subject.id);
            const topicsArrays = await Promise.all(
              chapters.map((ch) => topicsService.getByChapter(ch.id).catch(() => []))
            );
            const topics = topicsArrays.flat();
            return { subject, chapters, topics };
          } catch (err) {
            console.error('Failed to load chapters for subject:', subject.name, err);
            return { subject, chapters: [], topics: [] };
          }
        })
      );

      setData(allData);
      setDueSoon(due);
      setNeedRevisionList(revision);

      // Filter topics due today
      setTodayStudy([]);
    } catch (error) {
      console.error('Error loading dashboard subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  // Overall progress
  const totalTopics = data.reduce((sum, d) => sum + d.topics.length, 0);
  const completedTopics = data.reduce((sum, d) => sum + d.topics.filter((t) => t.is_completed).length, 0);
  const overallPct = calcProgress(completedTopics, totalTopics);

  // Understanding stats
  const allTopics = data.flatMap(d => d.topics);
  const understoodCount = allTopics.filter(t => t.understanding_status === 'understood').length;
  const needRevisionCount = allTopics.filter(t => t.understanding_status === 'need_revision').length;
  const dontUnderstandCount = allTopics.filter(t => t.understanding_status === 'dont_understand').length;

  // Continue studying — find chapters with some but not full completion
  const continueItems = data
    .flatMap(({ subject, chapters, topics }) =>
      chapters.map((ch) => {
        const chTopics = topics.filter((t) => t.chapter_id === ch.id);
        const chCompleted = chTopics.filter((t) => t.is_completed).length;
        return { subject, chapter: ch, total: chTopics.length, completed: chCompleted };
      })
    )
    .filter((item) => item.total > 0 && item.completed < item.total)
    .sort((a, b) => b.completed / (b.total || 1) - a.completed / (a.total || 1))
    .slice(0, 3);

  if (loading) return <LoadingState />;

  return (
    <div style={{ animation: 'fadeIn 0.2s ease', maxWidth: 800 }}>
      {/* Greeting */}
      <div style={{ marginBottom: '2rem' }}>
        <p className="greeting">{getGreeting()} 🌷</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
          {displayName}, here's your study overview.
        </p>
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No subjects yet"
          description="Start by adding your first subject."
          action={
            <button className="btn btn-primary" onClick={() => navigate('/subjects')}>
              Go to Subjects
            </button>
          }
        />
      ) : (
        <>
          {/* Study Overview Stats */}
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, color: 'var(--choco)', marginBottom: '1rem' }}>
              Your Study Overview
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <BookOpen size={20} style={{ color: 'var(--warm)', marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--choco)', fontFamily: 'Lora, serif' }}>
                  {data.length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Subjects
                </div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <CheckCircle size={20} style={{ color: '#6B8E23', marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--choco)', fontFamily: 'Lora, serif' }}>
                  {completedTopics}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Completed
                </div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <Clock size={20} style={{ color: '#DAA520', marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--choco)', fontFamily: 'Lora, serif' }}>
                  {needRevisionList.length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Need Revision
                </div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <Calendar size={20} style={{ color: 'var(--brown)', marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--choco)', fontFamily: 'Lora, serif' }}>
                  {dueSoon.length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Due This Week
                </div>
              </div>
            </div>
          </section>

          {/* Overall Progress */}
          <section style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, color: 'var(--choco)', margin: 0 }}>
                Overall progress
              </h2>
              <span style={{ fontSize: '1.25rem', fontFamily: 'Lora, serif', fontWeight: 700, color: 'var(--warm)' }}>
                {overallPct}%
              </span>
            </div>
            <ProgressBar completed={completedTopics} total={totalTopics} />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.375rem' }}>
              {completedTopics} of {totalTopics} topics completed across {data.length} subject{data.length !== 1 ? 's' : ''}
            </p>
          </section>

          {/* Understanding Summary */}
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, color: 'var(--choco)', marginBottom: '1rem' }}>
              Understanding Summary
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
              <div className="card" style={{ padding: '0.875rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6B8E23' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-main)' }}>Understood</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--choco)', fontFamily: 'Lora, serif' }}>
                  {understoodCount}
                </div>
              </div>
              <div className="card" style={{ padding: '0.875rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#DAA520' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-main)' }}>Need Revision</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--choco)', fontFamily: 'Lora, serif' }}>
                  {needRevisionCount}
                </div>
              </div>
              <div className="card" style={{ padding: '0.875rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#CD5C5C' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-main)' }}>Don't Understand</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--choco)', fontFamily: 'Lora, serif' }}>
                  {dontUnderstandCount}
                </div>
              </div>
            </div>
          </section>

          {/* Subjects Overview */}
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, color: 'var(--choco)', marginBottom: '1rem' }}>
              Subjects
            </h2>
            <div className="subject-grid">
              {data.map(({ subject, chapters, topics }) => {
                const subCompleted = topics.filter((t) => t.is_completed).length;
                const subTotal = topics.length;
                const subPct = calcProgress(subCompleted, subTotal);
                return (
                  <div
                    key={subject.id}
                    className="card card-hover"
                    onClick={() => navigate(`/subjects/${subject.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/subjects/${subject.id}`)}
                    aria-label={`Open ${subject.name}`}
                  >
                    <div style={{ marginBottom: '0.625rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--choco)', marginBottom: '0.2rem' }}>
                        {subject.name}
                      </div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-light)' }}>
                        {chapters.length} chapter{chapters.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <ProgressBar completed={subCompleted} total={subTotal} />
                    <div style={{ fontSize: '0.775rem', color: 'var(--muted)', marginTop: '0.4rem', textAlign: 'right', fontWeight: 600 }}>
                      {subPct}%
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Continue Studying */}
          {continueItems.length > 0 && (
            <section style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, color: 'var(--choco)', marginBottom: '0.875rem' }}>
                Continue studying
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {continueItems.map(({ subject, chapter, total, completed }) => (
                  <div
                    key={chapter.id}
                    className="card card-hover"
                    style={{ padding: '1rem 1.25rem' }}
                    onClick={() => navigate(`/subjects/${subject.id}/chapters/${chapter.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/subjects/${subject.id}/chapters/${chapter.id}`)}
                    aria-label={`Continue ${chapter.name}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.775rem', color: 'var(--text-light)', marginBottom: '0.2rem' }}>
                          {subject.name}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--choco)' }}>
                          {chapter.name}
                        </div>
                        <div style={{ fontSize: '0.775rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                          {completed} of {total} topics completed
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, width: 80 }}>
                        <ProgressBar completed={completed} total={total} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Today's Study */}
          {todayStudy.length > 0 && (
            <section style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, color: 'var(--choco)', marginBottom: '0.875rem' }}>
                Today's Study
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {todayStudy.slice(0, 5).map((topic) => {
                  const chapter = topic.chapters;
                  const subject = chapter ? chapter.subjects : null;
                  return (
                    <div
                      key={topic.id}
                      className="card card-hover"
                      style={{ padding: '1rem 1.25rem' }}
                      onClick={() => {
                        if (subject && chapter) {
                          navigate(`/subjects/${subject.id}/chapters/${chapter.id}/topics/${topic.id}`);
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.775rem', color: 'var(--text-light)', marginBottom: '0.2rem' }}>
                            {subject?.name} → {chapter?.name}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--choco)' }}>
                            {topic.name}
                          </div>
                        </div>
                        {topic.is_completed && (
                          <span className="badge complete" style={{ fontSize: '0.7rem' }}>✓</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Upcoming */}
          {dueSoon.length > 0 && (
            <section style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, color: 'var(--choco)', marginBottom: '0.875rem' }}>
                Upcoming
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {dueSoon.slice(0, 5).map((topic) => {
                  const chapter = topic.chapters;
                  const subject = chapter ? chapter.subjects : null;
                  return (
                    <div
                      key={topic.id}
                      className="card card-hover"
                      style={{ padding: '1rem 1.25rem' }}
                      onClick={() => {
                        if (subject && chapter) {
                          navigate(`/subjects/${subject.id}/chapters/${chapter.id}/topics/${topic.id}`);
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.775rem', color: 'var(--text-light)', marginBottom: '0.2rem' }}>
                            {subject?.name} → {chapter?.name}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--choco)' }}>
                            {topic.name}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}


        </>
      )}
    </div>
  );
}
