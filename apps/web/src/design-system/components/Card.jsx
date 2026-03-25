import { colors, radius, shadows } from '../tokens.js';

export default function Card({ children, padding = '24px', style }) {
  return (
    <div
      style={{
        background: colors.white,
        borderRadius: radius.lg,
        boxShadow: shadows.md,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
