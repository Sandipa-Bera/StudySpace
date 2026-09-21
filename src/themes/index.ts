export interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    accent: string;
    text: string;
    textMuted: string;
    textLight: string;
    border: string;
    cardBg: string;
    success: string;
    warning: string;
    error: string;
  };
}

export const themes: Record<string, Theme> = {
  'warm-brown': {
    id: 'warm-brown',
    name: 'Warm Brown',
    colors: {
      primary: '#7B5C3C',
      secondary: '#C8A882',
      background: '#FDF6EE',
      accent: '#C47E79',
      text: '#2C1A0E',
      textMuted: '#8C7261',
      textLight: '#B49B86',
      border: '#E0CDB8',
      cardBg: '#FFFFFF',
      success: '#6B8E23',
      warning: '#DAA520',
      error: '#CD5C5C',
    },
  },
  'dusty-pink': {
    id: 'dusty-pink',
    name: 'Dusty Pink',
    colors: {
      primary: '#C47E79',
      secondary: '#E8A9A3',
      background: '#FEF7F7',
      accent: '#D4A5A0',
      text: '#3E2723',
      textMuted: '#8B6F6A',
      textLight: '#B89590',
      border: '#E8C8C4',
      cardBg: '#FFFFFF',
      success: '#6B8E23',
      warning: '#DAA520',
      error: '#CD5C5C',
    },
  },
  'sage': {
    id: 'sage',
    name: 'Sage',
    colors: {
      primary: '#6B8E6B',
      secondary: '#8FB88F',
      background: '#F6F9F6',
      accent: '#9DBF9D',
      text: '#2C3E2C',
      textMuted: '#5A6E5A',
      textLight: '#8A9A8A',
      border: '#C8D4C8',
      cardBg: '#FFFFFF',
      success: '#5A8A5A',
      warning: '#B8A050',
      error: '#C46B6B',
    },
  },
  'lavender': {
    id: 'lavender',
    name: 'Lavender',
    colors: {
      primary: '#9B8FB8',
      secondary: '#B8A8D4',
      background: '#F7F5FA',
      accent: '#C8B8E0',
      text: '#2E273E',
      textMuted: '#6A5F7A',
      textLight: '#9A8FAA',
      border: '#D4C8E0',
      cardBg: '#FFFFFF',
      success: '#6B8E6B',
      warning: '#DAA520',
      error: '#C46B6B',
    },
  },
  'blue': {
    id: 'blue',
    name: 'Blue',
    colors: {
      primary: '#5B7FA8',
      secondary: '#8FB8D4',
      background: '#F5F7FA',
      accent: '#7BA8C8',
      text: '#1E2E3E',
      textMuted: '#5A6E7A',
      textLight: '#8A9AAA',
      border: '#C8D4E0',
      cardBg: '#FFFFFF',
      success: '#5A8A5A',
      warning: '#B8A050',
      error: '#C46B6B',
    },
  },
  'peach': {
    id: 'peach',
    name: 'Peach',
    colors: {
      primary: '#D4A57A',
      secondary: '#E8C4A0',
      background: '#FEF7F2',
      accent: '#E0B890',
      text: '#3E2E27',
      textMuted: '#8A7A6A',
      textLight: '#B8A890',
      border: '#E8D4C0',
      cardBg: '#FFFFFF',
      success: '#6B8E6B',
      warning: '#DAA520',
      error: '#C46B6B',
    },
  },
  'monochrome': {
    id: 'monochrome',
    name: 'Monochrome',
    colors: {
      primary: '#2C2C2C',
      secondary: '#6B6B6B',
      background: '#FFFFFF',
      accent: '#4A4A4A',
      text: '#1A1A1A',
      textMuted: '#5A5A5A',
      textLight: '#8A8A8A',
      border: '#D0D0D0',
      cardBg: '#FAFAFA',
      success: '#3A3A3A',
      warning: '#6A6A3A',
      error: '#4A2A2A',
    },
  },
};

export const defaultTheme = 'warm-brown';
