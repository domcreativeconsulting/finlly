import { colors, radius, typography } from '../tokens.js';

const variantStyles = {
  success: { background: colors.successBg, color: colors.successText },
  error: { background: colors.errorBg, color: colors.errorText },
  warning: { background: colors.warningBg, color: '#854d0e' },
  neutral: { background: colors.neutral100, color: colors.neutral500 },
  primary: { background: colors.primaryBg, color: colors.primary },
  orange: { background: '#ffedd5', color: '#9a3412' },
};

export default function Badge({ variant = 'neutral', children, style }) {
  const vStyle = variantStyles[variant] || variantStyles.neutral;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: radius.full,
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        ...vStyle,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
