import { forwardRef, useState } from 'react';
import { colors, radius, typography } from '../tokens.js';

const Select = forwardRef(function Select(
  { error, style, children, ...props },
  ref
) {
  const [focused, setFocused] = useState(false);

  const selectStyle = {
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
    cursor: 'pointer',
    transition: 'border-color 0.15s, outline-color 0.15s',
    appearance: 'auto',
    ...style,
  };

  return (
    <select
      ref={ref}
      style={selectStyle}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      {...props}
    >
      {children}
    </select>
  );
});

export default Select;
