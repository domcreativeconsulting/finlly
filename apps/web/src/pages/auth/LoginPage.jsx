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
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data) => {
    setServerError(null);
    try {
      await login(data.email, data.senha);
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429) {
        setServerError('Muitas tentativas. Aguarde 15 minutos.');
      } else if (status === 423) {
        setServerError('Conta bloqueada por 30 minutos.');
      } else {
        const msg = err?.response?.data?.message || 'Credenciais inválidas.';
        setServerError(msg);
      }
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Entrar</h1>
          <p style={styles.subtitle}>Bem-vindo de volta ao Finlly</p>
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
              style={{
                ...styles.input,
                ...(errors.email ? styles.inputError : {}),
              }}
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <span style={styles.errorText} role="alert">
                ⚠ {errors.email.message}
              </span>
            )}
          </div>

          <div style={styles.fieldGroup}>
            <div style={styles.labelRow}>
              <label htmlFor="senha" style={styles.label}>
                Senha
              </label>
              <Link to="/forgot-password" style={styles.linkGray}>
                Esqueci a senha
              </Link>
            </div>
            <div style={styles.passwordWrapper}>
              <input
                id="senha"
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Sua senha"
                style={{
                  ...styles.input,
                  ...styles.passwordInput,
                  ...(errors.senha ? styles.inputError : {}),
                }}
                autoComplete="current-password"
                {...register('senha')}
              />
              <button
                type="button"
                style={styles.togglePassword}
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? '🙈' : '👁'}
              </button>
            </div>
            {errors.senha && (
              <span style={styles.errorText} role="alert">
                ⚠ {errors.senha.message}
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
                <span style={styles.spinnerInline} aria-hidden="true" /> Entrando...
              </span>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <p style={styles.footer}>
          Não tem conta?{' '}
          <Link to="/register" style={styles.linkBlue}>
            Cadastre-se
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
    marginBottom: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111',
    margin: '0 0 8px',
  },
  subtitle: {
    color: '#666',
    margin: 0,
    fontSize: '14px',
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
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    transition: 'border-color 0.2s',
  },
  inputError: {
    borderColor: '#e53e3e',
  },
  passwordWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: '44px',
  },
  togglePassword: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '0',
    lineHeight: '1',
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
    color: '#666',
  },
  linkBlue: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '600',
  },
  linkGray: {
    color: '#888',
    textDecoration: 'none',
    fontSize: '13px',
  },
};
