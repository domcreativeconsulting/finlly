import { forwardRef, useState } from 'react';
import { colors, radius, typography } from '../tokens.js';

const Input = forwardRef(function Input(
  { error, style, ...props },
  ref
) {
  const [focused, setFocused] = useState(false);

  const inputStyle = {
    width: '100%',
    height: '40px',
    padding: '0 12px',
    fontSize: typography.sizes.md,
    fontFamily: typography.fontFamily,
    color: colors.neutral900,
    backgroundColor: colors.white,
    border: `1px solid ${error ? colors.error : focused ? colors.primaryLight : colors.neutral300}`,
    borderRadius: radius.md,
    outline: focused ? `2px solid ${colors.primaryLight}` : '2px solid transparent',
    outlineOffset: '0px',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, outline-color 0.15s',
    ...style,
  };

  return (
    <input
      ref={ref}
      style={inputStyle}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      {...props}
    />
  );
});

export default Input;
