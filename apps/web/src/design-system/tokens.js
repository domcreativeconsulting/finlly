/**
 * Design tokens espelhados em JS para uso em inline styles.
 * A fonte da verdade é o arquivo index.css (CSS custom properties).
 * Este arquivo deve ser mantido em sincronia com o CSS.
 */

export const tokens = {
  // Tipografia
  fontFamily: "'Inter', sans-serif",
  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '14px',
    md: '15px',
    lg: '16px',
    xl: '18px',
    '2xl': '20px',
    '3xl': '24px',
    '4xl': '28px',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Cores — Primária
  color: {
    primary: '#33528a',
    primaryDark: '#1e3a5f',
    primaryLight: '#2563eb',
    primaryBg: '#eff6ff',
    primaryDisabled: '#93c5fd',

    // Sucesso
    success: '#16a34a',
    successBg: '#dcfce7',
    successText: '#166534',
    successBorder: '#bbf7d0',

    // Erro
    error: '#dc2626',
    errorBg: '#fef2f2',
    errorBorder: '#fecaca',
    errorText: '#991b1b',
    errorLight: '#f87171',

    // Aviso
    warning: '#f59e0b',
    warningBg: '#fef9c3',
    warningText: '#854d0e',
    warningBorder: '#fde68a',

    // Info
    info: '#0369a1',
    infoBg: '#e0f2fe',
    infoText: '#0369a1',

    // Neutros
    neutral50: '#f8fafc',
    neutral100: '#f3f4f6',
    neutral200: '#e5e7eb',
    neutral300: '#d1d5db',
    neutral400: '#9ca3af',
    neutral500: '#6b7280',
    neutral600: '#4b5563',
    neutral700: '#374151',
    neutral800: '#1e293b',
    neutral900: '#111827',

    // Superfície
    bg: '#f3f4f6',
    surface: '#ffffff',
    surfaceHover: '#f0f9ff',
    border: '#e5e7eb',
    borderFocus: '#2563eb',

    // Texto
    text: '#111827',
    textMuted: '#6b7280',
    textSubtle: '#9ca3af',
    textInverse: '#ffffff',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.45)',
    overlayLight: 'rgba(255, 255, 255, 0.18)',
  },

  // Espaçamento
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    7: '28px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },

  // Bordas
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '20px',
    full: '999px',
  },

  // Sombras
  shadow: {
    xs: '0 1px 2px rgba(0,0,0,0.05)',
    sm: '0 1px 3px rgba(0,0,0,0.08)',
    md: '0 1px 4px rgba(0,0,0,0.07)',
    lg: '0 4px 24px rgba(0,0,0,0.08)',
    xl: '0 8px 30px rgba(0,0,0,0.13)',
    '2xl': '0 20px 60px rgba(0,0,0,0.2)',
  },

  // Transições
  transition: {
    fast: '0.15s ease',
    base: '0.2s ease',
    slow: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Z-index
  zIndex: {
    dropdown: 100,
    sticky: 200,
    modalBackdrop: 1000,
    modal: 1050,
    toast: 2000,
  },
};

export default tokens;

// Backward-compatible named exports (kept for existing page imports)
export const colors = {
  primary: tokens.color.primary,
  primaryDark: tokens.color.primaryDark,
  primaryLight: tokens.color.primaryLight,
  primaryBg: tokens.color.primaryBg,

  secondary: '#f1f5f9',
  secondaryText: '#475569',

  success: tokens.color.success,
  successBg: tokens.color.successBg,
  successText: tokens.color.successText,

  error: tokens.color.error,
  errorBg: tokens.color.errorBg,
  errorBorder: tokens.color.errorBorder,
  errorText: tokens.color.errorText,

  warning: tokens.color.warning,
  warningBg: tokens.color.warningBg,

  neutral50: tokens.color.neutral50,
  neutral100: tokens.color.neutral100,
  neutral200: tokens.color.neutral200,
  neutral300: tokens.color.neutral300,
  neutral400: tokens.color.neutral400,
  neutral500: tokens.color.neutral500,
  neutral600: tokens.color.neutral600,
  neutral700: tokens.color.neutral700,
  neutral800: tokens.color.neutral800,
  neutral900: tokens.color.neutral900,

  white: '#ffffff',
  black: '#000000',

  bg: tokens.color.bg,
  surface: tokens.color.surface,
  border: tokens.color.border,

  sidebar: tokens.color.primaryDark,
  sidebarHover: tokens.color.overlayLight,
};

export const typography = {
  fontFamily: tokens.fontFamily,
  weights: {
    regular: tokens.fontWeight.regular,
    medium: tokens.fontWeight.medium,
    semibold: tokens.fontWeight.semibold,
    bold: tokens.fontWeight.bold,
    extrabold: 800,
  },
  sizes: {
    xs: tokens.fontSize.xs,
    sm: tokens.fontSize.sm,
    base: '13px',
    md: tokens.fontSize.base,
    lg: tokens.fontSize.md,
    xl: tokens.fontSize.lg,
    '2xl': tokens.fontSize.xl,
    '3xl': tokens.fontSize['2xl'],
    '4xl': '22px',
    '5xl': tokens.fontSize['3xl'],
    '6xl': tokens.fontSize['4xl'],
    '7xl': '32px',
  },
};

export const spacing = tokens.spacing;

export const radius = {
  sm: tokens.radius.sm,
  md: tokens.radius.md,
  lg: tokens.radius.lg,
  xl: tokens.radius.xl,
  full: tokens.radius.full,
};

export const shadows = {
  sm: tokens.shadow.sm,
  md: tokens.shadow.md,
  lg: tokens.shadow.xl,
  xl: tokens.shadow['2xl'],
};
