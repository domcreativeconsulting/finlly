import { forwardRef, useState } from 'react';
import { colors, radius, typography } from '../tokens.js';

const sizeStyles = {
  sm: { padding: '6px 12px', fontSize: typography.sizes.sm },
  md: { padding: '9px 18px', fontSize: typography.sizes.md },
  lg: { padding: '12px 24px', fontSize: typography.sizes.xl },
};

const variantStyles = {
  primary: {
    base: {
      backgroundColor: colors.primaryDark,
      color: colors.white,
      border: 'none',
    },
    hover: { backgroundColor: colors.primary },
    active: { backgroundColor: colors.primaryDark },
  },
  secondary: {
    base: {
      backgroundColor: colors.neutral100,
      color: colors.neutral700,
      border: `1px solid ${colors.neutral200}`,
    },
    hover: { backgroundColor: colors.neutral200 },
    active: { backgroundColor: colors.neutral300 },
  },
  danger: {
    base: {
      backgroundColor: colors.error,
      color: colors.white,
      border: 'none',
    },
    hover: { backgroundColor: '#b91c1c' },
    active: { backgroundColor: '#991b1b' },
  },
  ghost: {
    base: {
      backgroundColor: 'transparent',
      color: colors.neutral700,
      border: 'none',
    },
    hover: { backgroundColor: colors.neutral100 },
    active: { backgroundColor: colors.neutral200 },
  },
  outline: {
    base: {
      backgroundColor: 'transparent',
      color: colors.primary,
      border: `1px solid ${colors.primary}`,
    },
    hover: { backgroundColor: colors.primaryBg },
    active: { backgroundColor: colors.primaryBg },
  },
};

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    children,
    style,
    ...props
  },
  ref
) {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);

  const vStyle = variantStyles[variant] || variantStyles.primary;
  const isDisabled = disabled || loading;

  const computedStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    borderRadius: radius.md,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semibold,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.15s, opacity 0.15s',
    opacity: isDisabled ? 0.6 : 1,
    ...sizeStyles[size],
    ...vStyle.base,
    ...(hovered && !isDisabled ? vStyle.hover : {}),
    ...(active && !isDisabled ? vStyle.active : {}),
    ...style,
  };

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      style={computedStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      {...props}
    >
      {loading && (
        <span
          style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            border: '2px solid rgba(255,255,255,0.4)',
            borderTopColor: 'currentColor',
            borderRadius: radius.full,
            animation: 'spin 0.7s linear infinite',
          }}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
});

export default Button;
