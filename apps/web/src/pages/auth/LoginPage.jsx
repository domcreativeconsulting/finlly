import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth.js';
import logo from '../../assets/logo.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTriangleExclamation,
  faEnvelope,
  faLock,
  faEye,
  faEyeSlash,
} from '@fortawesome/free-solid-svg-icons';

const LoginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Senha obrigatória'),
});

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    let timer;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(checkMobile, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

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
        setErrorMsg(
          'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
        );
      } else if (status === 423) {
        setErrorMsg(
          'Conta bloqueada por 30 minutos. Entre em contato com o suporte.'
        );
      } else {
        setErrorMsg(
          err.response?.data?.message || 'E-mail ou senha incorretos.'
        );
      }
    }
  };

  return (
    <div style={styles.page}>
      {/* Painel Esquerdo */}
      {!isMobile && (
        <div style={styles.leftPanel}>
          <div style={styles.leftContent}>
            <div style={styles.logoRow}>
              <img src={logo} alt="Finlly Logo" className={styles.logoImage} />
            </div>
            <h2 style={styles.leftHeadline}>
              Sua gestão financeira, simplificada.
            </h2>
            <p style={styles.leftDescription}>
              Acesse a plataforma para ter controle total sobre suas finanças.
            </p>
          </div>
        </div>
      )}

      {/* Painel Direito */}
      <div style={isMobile ? styles.rightPanelMobile : styles.rightPanel}>
        <div style={styles.formCard}>
          <h1 style={styles.formTitle}>Acesse sua conta</h1>

          {errorMsg && (
            <div style={styles.errorBox} role="alert">
              <span style={styles.errorIcon} aria-hidden="true">
                <FontAwesomeIcon icon={faTriangleExclamation} />
              </span>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Campo de e-mail */}
            <div style={styles.fieldGroup}>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon} aria-hidden="true">
                  <FontAwesomeIcon icon={faEnvelope} />
                </span>
                <input
                  id="email"
                  type="email"
                  placeholder="Seu e-mail de cadastro."
                  autoComplete="email"
                  style={{
                    ...styles.input,
                    paddingLeft: '42px',
                    ...(errors.email ? styles.inputError : {}),
                  }}
                  {...register('email')}
                />
              </div>
              {errors.email ? (
                <span style={styles.fieldError} role="alert">
                  {errors.email.message}
                </span>
              ) : (
                <span style={styles.hintText}>Seu e-mail de cadastro.</span>
              )}
            </div>

            {/* Campo de senha */}
            <div style={styles.fieldGroup}>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon} aria-hidden="true">
                  <FontAwesomeIcon icon={faLock} />
                </span>
                <input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Sua senha de acesso."
                  autoComplete="current-password"
                  style={{
                    ...styles.input,
                    paddingLeft: '42px',
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
                  {mostrarSenha ? <FontAwesomeIcon icon={faEyeSlash} /> : <FontAwesomeIcon icon={faEye} />}
                </button>
              </div>
              {errors.senha ? (
                <span style={styles.fieldError} role="alert">
                  {errors.senha.message}
                </span>
              ) : (
                <span style={styles.hintText}>Sua senha de acesso.</span>
              )}
            </div>

            {/* Linha lembrar-me + assinar */}
            <div style={styles.rememberRow}>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" style={styles.checkbox} />
                Lembrar-me
              </label>
              <Link to="/register" style={styles.assinarLink}>
                Assinar agora
              </Link>
            </div>

            {/* Botão de submit */}
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
                <>
                  <span style={styles.submitIcon} aria-hidden="true">
                    →
                  </span>
                  Entrar
                </>
              )}
            </button>
          </form>

          <p style={styles.footerText}>
            Ainda não tem uma conta?{' '}
            <Link to="/register" style={styles.link}>
              Fale conosco
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  leftPanel: {
    flex: '0 0 55%',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '48px',
  },
  leftContent: {
    maxWidth: '420px',
    color: '#ffffff',
  },

  logoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '32px',
  },

  logoImage: {
    width: '48px',
    height: '48px',
  },

  leftHeadline: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 1.3,
    margin: '0 0 16px',
    textAlign: 'center',
  },

  leftDescription: {
    fontSize: '15px',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 1.6,
    margin: 0,
    textAlign: 'center',
  },
  rightPanel: {
    flex: '0 0 45%',
    backgroundColor: '#ffffff',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
    overflowY: 'auto',
  },
  rightPanelMobile: {
    flex: 1,
    backgroundColor: '#ffffff',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '24px',
    overflowY: 'auto',
  },
  formCard: {
    width: '100%',
    maxWidth: '380px',
    padding: '8px 0',
  },
  formTitle: {
    fontSize: '30px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 28px',
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
    marginBottom: '18px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    fontSize: '16px',
    lineHeight: 1,
    pointerEvents: 'none',
    zIndex: 1,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '15px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box',
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
  hintText: {
    display: 'block',
    marginTop: '4px',
    fontSize: '13px',
    color: '#9ca3af',
  },
  eyeButton: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '4px',
    lineHeight: 1,
    zIndex: 1,
  },
  rememberRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  assinarLink: {
    fontSize: '14px',
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '500',
  },
  submitButton: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: '#1e3a5f',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '24px',
  },
  submitButtonDisabled: {
    backgroundColor: '#6b8ab5',
    cursor: 'not-allowed',
  },
  submitIcon: {
    fontSize: '18px',
    lineHeight: 1,
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
    textAlign: 'center',
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '500',
  },
};
