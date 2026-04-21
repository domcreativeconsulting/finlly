import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { ALLOWED_STATUSES } from '../config/subscriptionPolicy.js';
import { setBillingBlocked } from '../services/api.js';

export function InadimplenteGuard({ children }) {
  const { usuario } = useAuth();

  const isBlocked =
    usuario?.status === 'bloqueado_inadimplencia' ||
    (usuario != null && !ALLOWED_STATUSES.includes(usuario.status));

  useEffect(() => {
    setBillingBlocked(isBlocked);
    return () => setBillingBlocked(false);
  }, [isBlocked]);

  if (isBlocked && usuario?.status === 'bloqueado_inadimplencia') {
    return (
      <div style={styles.wrapper}>
        <div style={styles.banner} role="alert">
          <p style={styles.message}>
            <strong>Acesso indisponível — pagamento pendente.</strong>{' '}
            Regularize seu pagamento para continuar usando o serviço.
          </p>
          <Link to="/billing/status" style={styles.link}>
            Regularizar pagamento
          </Link>
        </div>
        <div style={styles.placeholder}>
          <p style={styles.placeholderText}>
            O conteúdo desta página estará disponível após a regularização do
            plano.
          </p>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.banner} role="alert">
          <p style={styles.message}>
            <strong>Acesso indisponível</strong> — ative sua conta para acessar
            todas as funcionalidades.
          </p>
          <Link to="/assinatura" style={styles.link}>
            Ativar conta
          </Link>
        </div>
        <div style={styles.placeholder}>
          <p style={styles.placeholderText}>
            O conteúdo desta página estará disponível após a ativação de um
            plano.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

const styles = {
  wrapper: {
    padding: '24px',
  },
  banner: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '24px',
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
  placeholder: {
    backgroundColor: '#f9fafb',
    border: '1px dashed #d1d5db',
    borderRadius: '12px',
    padding: '64px 24px',
    textAlign: 'center',
  },
  placeholderText: {
    margin: 0,
    color: '#6b7280',
    fontSize: '15px',
  },
};
