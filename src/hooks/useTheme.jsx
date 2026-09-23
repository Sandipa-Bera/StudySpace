import { createContext, useContext, useEffect, useState } from 'react';
import { themes, defaultTheme } from '../themes';
import { getUserTheme, updateUserTheme } from '../services/theme.service';
import { useAuth } from './useAuth';

const ThemeContext = createContext({
  theme: defaultTheme,
  setTheme: () => {},
  currentTheme: themes[defaultTheme],
  loading: true,
});

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('studyspace-theme');
    return saved || defaultTheme;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      if (user) {
        try {
          const dbTheme = await getUserTheme(user.id);
          setThemeState(dbTheme);
          localStorage.setItem('studyspace-theme', dbTheme);
        } catch (error) {
          console.error('Error loading theme from database:', error);
        }
      }
      setLoading(false);
    };

    loadTheme();
  }, [user]);

  const setTheme = async (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('studyspace-theme', newTheme);

    if (user) {
      try {
        await updateUserTheme(user.id, newTheme);
      } catch (error) {
        console.error('Error saving theme to database:', error);
      }
    }
  };

  const currentTheme = themes[theme] || themes[defaultTheme];

  useEffect(() => {
    const root = document.documentElement;
    const colors = currentTheme.colors;

    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--secondary', colors.secondary);
    root.style.setProperty('--background', colors.background);
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--text', colors.text);
    root.style.setProperty('--text-muted', colors.textMuted);
    root.style.setProperty('--text-light', colors.textLight);
    root.style.setProperty('--border', colors.border);
    root.style.setProperty('--card-bg', colors.cardBg);
    root.style.setProperty('--success', colors.success);
    root.style.setProperty('--warning', colors.warning);
    root.style.setProperty('--error', colors.error);
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, currentTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
