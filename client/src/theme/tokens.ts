/**
 * Design Tokens for WatchParty
 * Centralized theme configuration for colors, radius, fonts, transitions, and shadows.
 */

export const themeTokens = {
  colors: {
    bg: {
      primary: '#090A0F',
      secondary: '#12141F',
      card: 'rgba(23, 26, 40, 0.75)',
      cardHover: 'rgba(30, 34, 53, 0.85)',
      glass: 'rgba(255, 255, 255, 0.04)',
      glassActive: 'rgba(255, 255, 255, 0.08)',
    },
    accent: {
      violet: '#8B5CF6',
      pink: '#EC4899',
      purple: '#A855F7',
      gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
      gradientHover: 'linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)',
    },
    text: {
      primary: '#F8FAFC',
      secondary: '#94A3B8',
      muted: '#64748B',
      contrast: '#FFFFFF',
    },
    status: {
      online: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#3B82F6',
    },
    roles: {
      host: '#EC4899',
      moderator: '#8B5CF6',
      participant: '#64748B',
    },
    border: {
      subtle: 'rgba(255, 255, 255, 0.08)',
      highlight: 'rgba(139, 92, 246, 0.3)',
      pinkHighlight: 'rgba(236, 72, 153, 0.3)',
    }
  },
  radius: {
    base: '16px',
    lg: '20px',
    sm: '8px',
    pill: '9999px',
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
  },
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    spring: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  shadows: {
    glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    glow: '0 0 25px -5px rgba(236, 72, 153, 0.3)',
    card: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
  }
} as const;

export type ThemeTokens = typeof themeTokens;
