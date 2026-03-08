import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

export default function VerifyEmailPage() {
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('verificando');
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!token) {
      setStatus('erro');
      setErrorMsg('Token de verificação não encontrado na URL.');
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        await verifyEmail(token);
        if (!cancelled) {
          setStatus('sucesso');
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 2000);
        }
      } catch (err) {
        if (!cancelled) {
          const status = err.response?.status;
          if (status === 410 || status === 400) {
            setStatus('expirado');
            setErrorMsg('O link de verificação expirou ou é inválido.');
          } else {
            setStatus('erro');
            setErrorMsg(
              err.response?.data?.message ||
                'Erro ao verificar e-mail. Tente novamente.',
            );
          }
        }
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [token, verifyEmail, navigate]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {status === 'verificando' && (
          <div style={{ textAlign: 'center' }}>
            <div style={styles.spinner} aria-label="Verificando e-mail..." />
            <h2 style={{ ...styles.title, marginTop: '24px' }}>
              Verificando e-mail...
            </h2>
            <p style={{ color: '#6b7280' }}>
              Por favor, aguarde enquanto confirmamos seu e-mail.
            </p>
          </div>
        )}

        {status === 'sucesso' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={styles.title}>E-mail verificado!</h2>
            <p style={{ color: '#6b7280', marginBottom: '16px' }}>
              Sua conta foi verificada com sucesso. Redirecionando...
            </p>
            <Link to="/login" style={styles.link}>
              Ir para Login
            </Link>
          </div>
        )}

        {(status === 'erro' || status === 'expirado') && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
            <h2 style={styles.title}>
              {status === 'expirado' ? 'Link expirado' : 'Erro na verificação'}
            </h2>
            {errorMsg && (
              <p style={{ color: '#dc2626', marginBottom: '16px' }}>
                {errorMsg}
              </p>
            )}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <Link to="/login" style={styles.link}>
                Voltar para Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: '16px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 12px',
  },
  spinner: {
    display: 'inline-block',
    width: '48px',
    height: '48px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '500',
  },
};
