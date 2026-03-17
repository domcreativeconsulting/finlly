import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

/**
 * Guard component that shows an inadimplência alert when the authenticated
 * user has status `bloqueado_inadimplencia`. Otherwise renders children normally.
 */
export function InadimplenteGuard({ children }) {
  const { usuario } = useAuth();

  if (usuario?.status === 'bloqueado_inadimplencia') {
    return (
      <div>
        <div style={styles.banner} role="alert">
          <p style={styles.message}>
            <strong>Sua assinatura está inadimplente.</strong>{' '}
            Regularize seu pagamento para continuar usando o serviço.
          </p>
          <Link to="/billing/status" style={styles.link}>
            Regularizar pagamento
          </Link>
        </div>
        {children}
      </div>
    );
  }

  return children;
}

const styles = {
  banner: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '16px 24px',
    margin: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  message: {
    margin: 0,
    color: '#b91c1c',
    fontSize: '14px',
  },
  link: {
    display: 'inline-block',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: '#dc2626',
    border: 'none',
    borderRadius: '6px',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
};
