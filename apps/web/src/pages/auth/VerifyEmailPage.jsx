import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { authService } from '../../services/auth.service.js';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('verificando');
  const [serverError, setServerError] = useState(null);
  const [reenvioLoading, setReenvioLoading] = useState(false);
  const [reenvioSucesso, setReenvioSucesso] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('erro');
      setServerError('Token ausente. Verifique o link enviado ao seu e-mail.');
      return;
    }

    async function verify() {
      try {
        await authService.verifyEmail(token);
        setStatus('sucesso');
        toast.success('E-mail verificado com sucesso!');
        setTimeout(() => navigate('/login'), 2000);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 400 || status === 401) {
          setStatus('expirado');
          setServerError('O link de verificação expirou ou é inválido.');
        } else {
          setStatus('erro');
          setServerError(err?.response?.data?.message || 'Erro ao verificar e-mail.');
        }
      }
    }

    verify();
  }, [token, navigate]);

  const handleReenviar = async () => {
    const email = prompt('Digite seu e-mail para reenviar o código:');
    if (!email) return;
    setReenvioLoading(true);
    try {
      await authService.resendVerificationEmail(email);
      setReenvioSucesso(true);
      toast.success('E-mail de verificação reenviado!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao reenviar e-mail.');
    } finally {
      setReenvioLoading(false);
    }
  };

  if (status === 'verificando') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center' }}>
            <div style={styles.spinner} aria-label="Verificando e-mail..." />
            <h2 style={{ ...styles.title, marginTop: '24px' }}>Verificando e-mail...</h2>
            <p style={{ color: '#888' }}>Aguarde um momento.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'sucesso') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center' }}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.title}>E-mail verificado!</h2>
            <p style={{ color: '#555', marginBottom: '16px' }}>
              Sua conta foi confirmada. Redirecionando para o login...
            </p>
            <Link to="/login" style={styles.linkBlue}>
              Ir para Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center' }}>
          <div style={styles.errorIcon}>✗</div>
          <h2 style={styles.title}>
            {status === 'expirado' ? 'Link expirado' : 'Erro na verificação'}
          </h2>
          <p style={{ color: '#555', marginBottom: '20px' }}>{serverError}</p>

          {!reenvioSucesso ? (
            <button
              onClick={handleReenviar}
              disabled={reenvioLoading}
              style={{
                ...styles.resendButton,
                ...(reenvioLoading ? styles.resendButtonDisabled : {}),
              }}
            >
              {reenvioLoading ? 'Reenviando...' : 'Reenviar código de verificação'}
            </button>
          ) : (
            <p style={{ color: '#16a34a', fontWeight: '600', marginBottom: '16px' }}>
              ✓ E-mail reenviado com sucesso!
            </p>
          )}

          <div style={{ marginTop: '16px' }}>
            <Link to="/login" style={styles.linkGray}>
              ← Voltar para Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: '16px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 16px rgba(0,0,0,0.1)',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111',
    margin: '0 0 8px',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  successIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#dcfce7',
    color: '#16a34a',
    fontSize: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    lineHeight: '64px',
  },
  errorIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#fff5f5',
    color: '#e53e3e',
    fontSize: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    lineHeight: '64px',
  },
  resendButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  resendButtonDisabled: {
    backgroundColor: '#93c5fd',
    cursor: 'not-allowed',
  },
  linkBlue: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '600',
  },
  linkGray: {
    color: '#888',
    textDecoration: 'none',
    fontSize: '14px',
  },
};
