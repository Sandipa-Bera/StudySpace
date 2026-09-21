import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getScratchpad, updateScratchpad, getScratchpadLocal, updateScratchpadLocal } from '../services/scratchpad.service';
import { Sparkles, Save } from 'lucide-react';

export function ScratchpadPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [useLocal, setUseLocal] = useState(false);

  useEffect(() => {
    loadScratchpad();
  }, [user]);

  const loadScratchpad = async () => {
    if (!user) return;
    try {
      const data = await getScratchpad(user.id);
      setContent(data);
    } catch (error) {
      // Fallback to localStorage
      console.log('Using localStorage fallback for scratchpad');
      const localData = getScratchpadLocal();
      setContent(localData);
      setUseLocal(true);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (useLocal) {
        updateScratchpadLocal(content);
        showToast('Saved locally');
      } else {
        await updateScratchpad(user.id, content);
        showToast('Scratchpad saved');
      }
    } catch (error) {
      // Fallback to localStorage
      updateScratchpadLocal(content);
      setUseLocal(true);
      showToast('Saved locally (database unavailable)');
    } finally {
      setSaving(false);
    }
  };

  const prompts = [
    "What did you learn today?",
    "What are you proud of today?",
    "What was difficult today?",
    "What do you want to improve tomorrow?",
    "What topics need more attention?",
  ];

  const insertPrompt = (prompt: string) => {
    setContent(prev => prev + (prev ? '\n\n' : '') + prompt);
  };

  return (
    <div className="page-header">
      <h1 className="page-title">Quick Scratchpad</h1>
      <p className="page-subtitle">Temporary notes and thoughts</p>

      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} style={{ color: 'var(--warm)' }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {useLocal ? 'Saving to local storage' : 'Auto-saved to your profile'}
            </span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <textarea
          className="notes-editor"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Quick notes, reminders, or temporary thoughts…
Try a prompt to get started:"
          style={{ minHeight: '400px', fontFamily: 'Inter, sans-serif' }}
        />

        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.75rem' }}>
            Writing Prompts
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {prompts.map((prompt, index) => (
              <button
                key={index}
                className="btn btn-ghost btn-sm"
                onClick={() => insertPrompt(prompt)}
                style={{ fontSize: '0.8rem' }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--parchment)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <strong>Note:</strong> This scratchpad is for temporary thoughts. For permanent notes related to specific topics, use the notes feature in each topic.
        </div>
      </div>
    </div>
  );
}
