import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth.js';

const ForgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  const masked = '*'.repeat(Math.max(local.length - 2, 3));
  return `${visible}${masked}@${domain}`;
}

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [sucesso, setSucesso] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState('');
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  const onSubmit = async (data) => {
    setServerError(null);
    try {
      await forgotPassword(data.email);
      setEmailEnviado(data.email);
      setSucesso(true);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429) {
        setServerError('Muitas tentativas. Tente novamente em 1 hora.');
      } else {
        const msg = err?.response?.data?.message || 'Erro ao enviar e-mail.';
        setServerError(msg);
      }
    }
  };

  if (sucesso) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center' }}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.title}>Link enviado!</h2>
            <p style={{ color: '#555', marginBottom: '8px' }}>
              Enviamos um link de recuperação para:
            </p>
            <p style={{ fontWeight: '700', color: '#2563eb', marginBottom: '16px' }}>
              {maskEmail(emailEnviado)}
            </p>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
              Verifique sua caixa de entrada. O link é válido por 15 minutos.
            </p>
            <Link to="/login" style={styles.linkGray}>
              ← Voltar para Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Recuperar Senha</h1>
          <p style={styles.subtitle}>
            Digite seu e-mail e enviaremos um link para redefinir sua senha.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={styles.fieldGroup}>
            <label htmlFor="email" style={styles.label}>
              E-mail
            </label>
            <input
              id="email"
              type="email"
              placeholder="seu@email.com"
              style={{ ...styles.input, ...(errors.email ? styles.inputError : {}) }}
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <span style={styles.errorText} role="alert">
                ⚠ {errors.email.message}
              </span>
            )}
          </div>

          {serverError && (
            <div style={styles.errorBox} role="alert">
              <span>⚠ {serverError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              ...styles.submitButton,
              ...(isSubmitting ? styles.submitButtonDisabled : {}),
            }}
          >
            {isSubmitting ? (
              <span>
                <span style={styles.spinnerInline} aria-hidden="true" /> Enviando...
              </span>
            ) : (
              'Enviar Link de Recuperação'
            )}
          </button>
        </form>

        <p style={styles.footer}>
          <Link to="/login" style={styles.linkGray}>
            ← Voltar para Login
          </Link>
        </p>
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
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  title: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#111',
    margin: '0 0 8px',
  },
  subtitle: {
    color: '#666',
    margin: 0,
    fontSize: '14px',
    lineHeight: '1.5',
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
  fieldGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '15px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  inputError: {
    borderColor: '#e53e3e',
  },
  errorText: {
    display: 'block',
    color: '#e53e3e',
    fontSize: '12px',
    marginTop: '4px',
  },
  errorBox: {
    backgroundColor: '#fff5f5',
    border: '1px solid #fed7d7',
    borderRadius: '6px',
    padding: '12px',
    color: '#c53030',
    fontSize: '14px',
    marginBottom: '16px',
  },
  submitButton: {
    width: '100%',
    padding: '13px',
    fontSize: '16px',
    fontWeight: '600',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  submitButtonDisabled: {
    backgroundColor: '#93c5fd',
    cursor: 'not-allowed',
  },
  spinnerInline: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.5)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    verticalAlign: 'middle',
    marginRight: '6px',
  },
  footer: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '14px',
  },
  linkGray: {
    color: '#888',
    textDecoration: 'none',
    fontSize: '14px',
  },
};
