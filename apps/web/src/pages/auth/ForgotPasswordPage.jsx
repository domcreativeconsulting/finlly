import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

const ForgotSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

function mascararEmail(email) {
  const [user, domain] = email.split('@');
  const visivel = user.slice(0, 2);
  return `${visivel}***@${domain}`;
}

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [sucesso, setSucesso] = useState(false);
  const [emailMascarado, setEmailMascarado] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(ForgotSchema),
  });

  const onSubmit = async (data) => {
    setErrorMsg(null);
    try {
      await forgotPassword(data.email);
      setEmailMascarado(mascararEmail(data.email));
      setSucesso(true);
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setErrorMsg('Limite de tentativas atingido. Aguarde 1 hora antes de tentar novamente.');
      } else {
        setErrorMsg(
          err.response?.data?.message ||
            'Erro ao enviar e-mail. Tente novamente.',
        );
      }
    }
  };

  if (sucesso) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}><FontAwesomeIcon icon={faCircleCheck} /></div>
            <h2 style={styles.title}>Link enviado!</h2>
            <p style={{ color: '#374151', marginBottom: '8px' }}>
              Enviamos o link de recuperação para{' '}
              <strong>{emailMascarado || getValues('email')}</strong>
            </p>
            <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '24px' }}>
              Verifique sua caixa de entrada. O link é válido por 15 minutos.
            </p>
            <Link to="/login" style={styles.link}>
              ← Voltar para Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Recuperar Senha</h1>
          <p style={styles.subtitle}>
            Informe seu e-mail e enviaremos um link para redefinir sua senha.
          </p>
        </div>

        {errorMsg && (
          <div style={styles.errorBox} role="alert">
            <span aria-hidden="true"><FontAwesomeIcon icon={faTriangleExclamation} /></span> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={styles.fieldGroup}>
            <label htmlFor="email" style={styles.label}>
              E-mail
            </label>
            <input
              id="email"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              style={{
                ...styles.input,
                ...(errors.email ? styles.inputError : {}),
              }}
              {...register('email')}
            />
            {errors.email && (
              <span style={styles.fieldError} role="alert">
                {errors.email.message}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              ...styles.submitButton,
              ...(isSubmitting ? styles.submitButtonDisabled : {}),
            }}
          >
            {isSubmitting ? (
              <>
                <span style={styles.spinnerInline} aria-hidden="true" />
                Enviando...
              </>
            ) : (
              'Enviar Link de Recuperação'
            )}
          </button>
        </form>

        <p style={styles.footerText}>
          <Link to="/login" style={styles.backLink}>
            ← Voltar para Login
          </Link>
        </p>
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
  header: {
    marginBottom: '28px',
    textAlign: 'center',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 8px',
  },
  subtitle: {
    color: '#6b7280',
    margin: 0,
    fontSize: '15px',
    lineHeight: '1.5',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#dc2626',
    marginBottom: '20px',
    fontSize: '14px',
  },
  fieldGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '15px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#f87171',
  },
  fieldError: {
    display: 'block',
    marginTop: '4px',
    fontSize: '13px',
    color: '#dc2626',
  },
  submitButton: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '13px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'background-color 0.2s',
  },
  submitButtonDisabled: {
    backgroundColor: '#93c5fd',
    cursor: 'not-allowed',
  },
  spinnerInline: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  footerText: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '14px',
  },
  backLink: {
    color: '#9ca3af',
    textDecoration: 'none',
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '500',
  },
};
