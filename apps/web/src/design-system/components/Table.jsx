import { colors, typography } from '../tokens.js';

export function Table({ children, style }) {
  return (
    <div style={{ overflowX: 'auto', ...style }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: typography.fontFamily,
        }}
      >
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }) {
  return (
    <thead
      style={{
        backgroundColor: colors.neutral50,
      }}
    >
      {children}
    </thead>
  );
}

export function Th({ children, style, ...props }) {
  return (
    <th
      style={{
        padding: '10px 14px',
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.neutral700,
        textAlign: 'left',
        borderBottom: `1px solid ${colors.border}`,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...props}
    >
      {children}
    </th>
  );
}

export function Tbody({ children }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ children, style, ...props }) {
  return (
    <tr
      style={{
        borderBottom: `1px solid ${colors.border}`,
        ...style,
      }}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Td({ children, style, ...props }) {
  return (
    <td
      style={{
        padding: '12px 14px',
        fontSize: typography.sizes.md,
        color: colors.neutral800,
        verticalAlign: 'middle',
        ...style,
      }}
      {...props}
    >
      {children}
    </td>
  );
}

export default { Table, Thead, Th, Tbody, Tr, Td };
