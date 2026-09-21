import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, FileText, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { globalSearch } from '../services/search.service';
import type { SearchResult } from '../types';

export function SearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() && user) {
        performSearch(query);
      } else if (!query.trim()) {
        setResults([]);
        setHasSearched(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, user]);

  const performSearch = async (searchQuery: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const searchResults = await globalSearch(user.id, searchQuery);
      setResults(searchResults);
      setHasSearched(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'subject':
        navigate(`/subjects/${result.id}`);
        break;
      case 'chapter':
        if (result.subject_name) {
          navigate(`/subjects/${result.id}`);
        }
        break;
      case 'topic':
        if (result.chapter_name && result.subject_name) {
          navigate(`/subjects/${result.subject_name}/chapters/${result.chapter_name}/topics/${result.id}`);
        }
        break;
      case 'note':
        if (result.topic_name && result.chapter_name && result.subject_name) {
          navigate(`/subjects/${result.subject_name}/chapters/${result.chapter_name}/topics/${result.topic_name}`);
        }
        break;
      case 'journal':
        navigate('/journal');
        break;
    }
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'subject':
        return <BookOpen size={16} />;
      case 'chapter':
        return <BookOpen size={16} />;
      case 'topic':
        return <FileText size={16} />;
      case 'note':
        return <FileText size={16} />;
      case 'journal':
        return <MessageSquare size={16} />;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'subject':
        return 'Subject';
      case 'chapter':
        return 'Chapter';
      case 'topic':
        return 'Topic';
      case 'note':
        return 'Note';
      case 'journal':
        return 'Journal';
    }
  };

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className="page-header">
      <h1 className="page-title">Search</h1>
      <p className="page-subtitle">Find subjects, chapters, topics, notes, and journal entries</p>

      <div className="form-group" style={{ marginTop: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '0.875rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-light)',
            }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search everything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
            autoFocus
          />
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Searching...</p>
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div className="empty-state">
          <h3>No results found</h3>
          <p>Try different keywords or check your spelling</p>
        </div>
      )}

      {!loading && hasSearched && results.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          {Object.entries(groupedResults).map(([type, typeResults]) => (
            <div key={type} style={{ marginBottom: '1.5rem' }}>
              <h3
                style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '0.75rem',
                }}
              >
                {getTypeLabel(type as SearchResult['type'])} ({typeResults.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {typeResults.map((result) => (
                  <div
                    key={`${result.type}-${result.id}`}
                    className="card card-hover"
                    onClick={() => handleResultClick(result)}
                    style={{ padding: '1rem 1.25rem' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div
                        style={{
                          color: 'var(--warm)',
                          display: 'flex',
                          alignItems: 'center',
                          marginTop: '0.125rem',
                        }}
                      >
                        {getTypeIcon(result.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            color: 'var(--choco)',
                            marginBottom: '0.25rem',
                          }}
                        >
                          {result.title}
                        </div>
                        {result.context && (
                          <div
                            style={{
                              fontSize: '0.8125rem',
                              color: 'var(--text-muted)',
                              lineHeight: '1.4',
                            }}
                          >
                            {result.context}
                          </div>
                        )}
                        {(result.subject_name || result.chapter_name || result.topic_name) && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-light)',
                              marginTop: '0.375rem',
                            }}
                          >
                            {result.subject_name && <span>{result.subject_name}</span>}
                            {result.chapter_name && (
                              <span>
                                {result.subject_name && ' → '}
                                {result.chapter_name}
                              </span>
                            )}
                            {result.topic_name && (
                              <span>
                                {result.chapter_name && ' → '}
                                {result.topic_name}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasSearched && !loading && (
        <div className="empty-state">
          <h3>Start searching</h3>
          <p>Type above to search across your subjects, chapters, topics, notes, and journal</p>
        </div>
      )}
    </div>
  );
}
