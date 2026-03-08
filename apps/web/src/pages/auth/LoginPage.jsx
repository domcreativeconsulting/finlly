import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth.js';

const LoginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Senha obrigatória'),
});

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data) => {
    setErrorMsg(null);
    try {
      await login(data.email, data.senha);
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setErrorMsg('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else if (status === 423) {
        setErrorMsg('Conta bloqueada por 30 minutos. Entre em contato com o suporte.');
      } else {
        setErrorMsg(err.response?.data?.message || 'E-mail ou senha incorretos.');
      }
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Entrar</h1>
          <p style={styles.subtitle}>Acesse sua conta Finlly</p>
        </div>

        {errorMsg && (
          <div style={styles.errorBox} role="alert">
            <span style={styles.errorIcon} aria-hidden="true">⚠️</span>
            {errorMsg}
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

          <div style={styles.fieldGroup}>
            <div style={styles.labelRow}>
              <label htmlFor="senha" style={styles.label}>
                Senha
              </label>
              <Link to="/forgot-password" style={styles.forgotLink}>
                Esqueci minha senha
              </Link>
            </div>
            <div style={styles.passwordWrapper}>
              <input
                id="senha"
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Sua senha"
                autoComplete="current-password"
                style={{
                  ...styles.input,
                  paddingRight: '48px',
                  ...(errors.senha ? styles.inputError : {}),
                }}
                {...register('senha')}
              />
              <button
                type="button"
                style={styles.eyeButton}
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? '🙈' : '👁️'}
              </button>
            </div>
            {errors.senha && (
              <span style={styles.fieldError} role="alert">
                {errors.senha.message}
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
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <p style={styles.footerText}>
          Não tem conta?{' '}
          <Link to="/register" style={styles.link}>
            Cadastre-se
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
  errorIcon: {
    flexShrink: 0,
  },
  fieldGroup: {
    marginBottom: '20px',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
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
  passwordWrapper: {
    position: 'relative',
  },
  eyeButton: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '4px',
    lineHeight: 1,
  },
  forgotLink: {
    fontSize: '13px',
    color: '#9ca3af',
    textDecoration: 'none',
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
    color: '#6b7280',
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '500',
  },
};
