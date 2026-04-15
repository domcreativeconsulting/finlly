import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faTriangleExclamation,
  faEye,
  faEyeSlash,
  faCheck,
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';

const RegisterSchema = z
  .object({
    nome: z
      .string()
      .min(3, 'Mínimo 3 caracteres')
      .max(255, 'Máximo 255 caracteres'),
    email: z.string().email('E-mail inválido'),
    senha: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter letra maiúscula')
      .regex(/[a-z]/, 'Deve conter letra minúscula')
      .regex(/[0-9]/, 'Deve conter número')
      .regex(/[!@#$%^&*]/, 'Deve conter caractere especial !@#$%^&*'),
    confirmarSenha: z.string(),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: 'As senhas não conferem',
    path: ['confirmarSenha'],
  });

function calcularForcaSenha(senha) {
  let forca = 0;
  if (senha.length >= 8) forca++;
  if (/[a-z]/.test(senha)) forca++;
  if (/[A-Z]/.test(senha)) forca++;
  if (/[0-9]/.test(senha)) forca++;
  if (/[!@#$%^&*]/.test(senha)) forca++;

  if (forca <= 2) return 'fraca';
  if (forca <= 4) return 'média';
  return 'forte';
}

const forcaConfig = {
  fraca: { label: 'Fraca', color: '#ef4444', width: '33%' },
  média: { label: 'Média', color: '#f59e0b', width: '66%' },
  forte: { label: 'Forte', color: '#22c55e', width: '100%' },
};

export default function RegisterPage() {
  const { register: authRegister } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plano = searchParams.get('plano');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [sucesso, setSucesso] = useState(false);
  const [forcaSenha, setForcaSenha] = useState('fraca');
  const [senhaValue, setSenhaValue] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm({
    resolver: zodResolver(RegisterSchema),
    mode: 'onChange',
  });

  const senhaWatched = watch('senha', '');

  useEffect(() => {
    setSenhaValue(senhaWatched || '');
    setForcaSenha(calcularForcaSenha(senhaWatched || ''));
  }, [senhaWatched]);

  useEffect(() => {
    if (sucesso) {
      const timer = setTimeout(() => {
        const dest = plano ? `/login?plano=${encodeURIComponent(plano)}` : '/login';
        navigate(dest, { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [sucesso, navigate, plano]);

  const onSubmit = async (data) => {
    setErrorMsg(null);
    try {
      await authRegister(data.nome, data.email, data.senha);
      setSucesso(true);
      toast.success('Conta criada! Verifique seu e-mail.');
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message ||
          'Erro ao criar conta. Tente novamente.',
      );
    }
  };

  const reqSenha = [
    { label: 'Mínimo 8 caracteres', ok: senhaValue.length >= 8 },
    { label: 'Letra maiúscula', ok: /[A-Z]/.test(senhaValue) },
    { label: 'Letra minúscula', ok: /[a-z]/.test(senhaValue) },
    { label: 'Número', ok: /[0-9]/.test(senhaValue) },
    { label: 'Caractere especial (!@#$%^&*)', ok: /[!@#$%^&*]/.test(senhaValue) },
  ];

  if (sucesso) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}><FontAwesomeIcon icon={faCircleCheck} /></div>
            <h2 style={styles.title}>Conta criada!</h2>
            <p style={{ color: '#6b7280', marginBottom: '8px' }}>
              Confira seu e-mail para verificar a conta.
            </p>
            <p style={{ color: '#9ca3af', fontSize: '13px' }}>
              Redirecionando para o login em 3 segundos...
            </p>
            <Link to={plano ? `/login?plano=${encodeURIComponent(plano)}` : '/login'} style={{ ...styles.link, display: 'block', marginTop: '20px' }}>
              Ir para Login agora
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
          <h1 style={styles.title}>Criar Conta</h1>
          <p style={styles.subtitle}>Junte-se ao Finlly</p>
        </div>

        {errorMsg && (
          <div style={styles.errorBox} role="alert">
            <span aria-hidden="true"><FontAwesomeIcon icon={faTriangleExclamation} /></span> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={styles.fieldGroup}>
            <label htmlFor="nome" style={styles.label}>
              Nome
            </label>
            <input
              id="nome"
              type="text"
              placeholder="Seu nome completo"
              autoComplete="name"
              style={{
                ...styles.input,
                ...(errors.nome ? styles.inputError : {}),
              }}
              {...register('nome')}
            />
            {errors.nome && (
              <span style={styles.fieldError} role="alert">
                {errors.nome.message}
              </span>
            )}
          </div>

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
            <label htmlFor="senha" style={styles.label}>
              Senha
            </label>
            <div style={styles.passwordWrapper}>
              <input
                id="senha"
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Crie uma senha forte"
                autoComplete="new-password"
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
                {mostrarSenha ? <FontAwesomeIcon icon={faEyeSlash} /> : <FontAwesomeIcon icon={faEye} />}
              </button>
            </div>

            {senhaValue && (
              <div style={{ marginTop: '8px' }}>
                <div style={styles.strengthBarWrapper}>
                  <div
                    style={{
                      ...styles.strengthBarFill,
                      width: forcaConfig[forcaSenha].width,
                      backgroundColor: forcaConfig[forcaSenha].color,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    color: forcaConfig[forcaSenha].color,
                    fontWeight: '500',
                  }}
                >
                  Senha {forcaConfig[forcaSenha].label}
                </span>
              </div>
            )}

            <ul style={styles.reqList}>
              {reqSenha.map((req) => (
                <li
                  key={req.label}
                  style={{
                    ...styles.reqItem,
                    color: req.ok ? '#22c55e' : '#9ca3af',
                  }}
                >
                  {req.ok ? <FontAwesomeIcon icon={faCheck} /> : '○'} {req.label}
                </li>
              ))}
            </ul>

            {errors.senha && (
              <span style={styles.fieldError} role="alert">
                {errors.senha.message}
              </span>
            )}
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="confirmarSenha" style={styles.label}>
              Confirmar Senha
            </label>
            <div style={styles.passwordWrapper}>
              <input
                id="confirmarSenha"
                type={mostrarConfirmar ? 'text' : 'password'}
                placeholder="Confirme sua senha"
                autoComplete="new-password"
                style={{
                  ...styles.input,
                  paddingRight: '48px',
                  ...(errors.confirmarSenha ? styles.inputError : {}),
                }}
                {...register('confirmarSenha')}
              />
              <button
                type="button"
                style={styles.eyeButton}
                onClick={() => setMostrarConfirmar((v) => !v)}
                aria-label={mostrarConfirmar ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarConfirmar ? <FontAwesomeIcon icon={faEyeSlash} /> : <FontAwesomeIcon icon={faEye} />}
              </button>
            </div>
            {errors.confirmarSenha && (
              <span style={styles.fieldError} role="alert">
                {errors.confirmarSenha.message}
              </span>
            )}
          </div>

          <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
            <FontAwesomeIcon icon={faCircleInfo} /> Você receberá um e-mail para verificar sua conta.
          </p>

          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            style={{
              ...styles.submitButton,
              ...(isSubmitting || !isValid ? styles.submitButtonDisabled : {}),
            }}
          >
            {isSubmitting ? (
              <>
                <span style={styles.spinnerInline} aria-hidden="true" />
                Criando conta...
              </>
            ) : (
              'Criar Conta'
            )}
          </button>
        </form>

        <p style={styles.footerText}>
          Já tem conta?{' '}
          <Link to="/login" style={styles.link}>
            Faça login
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
    maxWidth: '440px',
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
  strengthBarWrapper: {
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    marginBottom: '4px',
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease, background-color 0.3s ease',
  },
  reqList: {
    listStyle: 'none',
    padding: 0,
    margin: '8px 0 0',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px',
  },
  reqItem: {
    fontSize: '12px',
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
