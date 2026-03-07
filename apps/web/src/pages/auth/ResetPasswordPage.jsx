import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth.js';

const ResetPasswordSchema = z
  .object({
    novaSenha: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter letra maiúscula')
      .regex(/[a-z]/, 'Deve conter letra minúscula')
      .regex(/[0-9]/, 'Deve conter número')
      .regex(/[!@#$%^&*]/, 'Deve conter caractere especial !@#$%^&*'),
    confirmarSenha: z.string(),
  })
  .refine((data) => data.novaSenha === data.confirmarSenha, {
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

const forcaColors = { fraca: '#e53e3e', média: '#d97706', forte: '#16a34a' };
const forcaLabels = { fraca: 'Fraca', média: 'Média', forte: 'Forte' };
const forcaWidths = { fraca: '33%', média: '66%', forte: '100%' };

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { resetPassword } = useAuth();

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [sucesso, setSucesso] = useState(false);
  const [senhaValue, setSenhaValue] = useState('');

  const forcaSenha = calcularForcaSenha(senhaValue);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm({
    resolver: zodResolver(ResetPasswordSchema),
    mode: 'onChange',
  });

  const senhaWatch = watch('novaSenha', '');

  if (!token) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center' }}>
            <div style={styles.errorIcon}>⚠</div>
            <h2 style={styles.title}>Link inválido</h2>
            <p style={{ color: '#555', marginBottom: '24px' }}>
              Este link de redefinição de senha é inválido ou expirou.
            </p>
            <Link to="/forgot-password" style={styles.linkBlue}>
              Solicitar novo link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const onSubmit = async (data) => {
    setServerError(null);
    try {
      await resetPassword(token, data.novaSenha);
      setSucesso(true);
      toast.success('Senha redefinida com sucesso!');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 400 || status === 401) {
        setServerError('Token inválido ou expirado. Solicite um novo link.');
      } else {
        const msg = err?.response?.data?.message || 'Erro ao redefinir senha.';
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
            <h2 style={styles.title}>Senha redefinida!</h2>
            <p style={{ color: '#555' }}>Redirecionando para o login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Redefinir Senha</h1>
          <p style={styles.subtitle}>Crie uma nova senha segura para sua conta.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={styles.fieldGroup}>
            <label htmlFor="novaSenha" style={styles.label}>
              Nova Senha
            </label>
            <div style={styles.passwordWrapper}>
              <input
                id="novaSenha"
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                style={{
                  ...styles.input,
                  ...styles.passwordInput,
                  ...(errors.novaSenha ? styles.inputError : {}),
                }}
                autoComplete="new-password"
                {...register('novaSenha', {
                  onChange: (e) => setSenhaValue(e.target.value),
                })}
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
            {errors.novaSenha && (
              <span style={styles.errorText} role="alert">
                ⚠ {errors.novaSenha.message}
              </span>
            )}
            {senhaValue.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={styles.forcaBar}>
                  <div
                    style={{
                      ...styles.forcaFill,
                      width: forcaWidths[forcaSenha],
                      backgroundColor: forcaColors[forcaSenha],
                    }}
                  />
                </div>
                <span style={{ fontSize: '12px', color: forcaColors[forcaSenha], fontWeight: '600' }}>
                  Força: {forcaLabels[forcaSenha]}
                </span>
                <ul style={styles.requirementsList}>
                  <li style={senhaWatch?.length >= 8 ? styles.reqMet : styles.reqUnmet}>
                    {senhaWatch?.length >= 8 ? '✓' : '○'} Mínimo 8 caracteres
                  </li>
                  <li style={/[A-Z]/.test(senhaWatch || '') ? styles.reqMet : styles.reqUnmet}>
                    {/[A-Z]/.test(senhaWatch || '') ? '✓' : '○'} Letra maiúscula
                  </li>
                  <li style={/[a-z]/.test(senhaWatch || '') ? styles.reqMet : styles.reqUnmet}>
                    {/[a-z]/.test(senhaWatch || '') ? '✓' : '○'} Letra minúscula
                  </li>
                  <li style={/[0-9]/.test(senhaWatch || '') ? styles.reqMet : styles.reqUnmet}>
                    {/[0-9]/.test(senhaWatch || '') ? '✓' : '○'} Número
                  </li>
                  <li style={/[!@#$%^&*]/.test(senhaWatch || '') ? styles.reqMet : styles.reqUnmet}>
                    {/[!@#$%^&*]/.test(senhaWatch || '') ? '✓' : '○'} Caractere especial
                  </li>
                </ul>
              </div>
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
                placeholder="Repita a senha"
                style={{
                  ...styles.input,
                  ...styles.passwordInput,
                  ...(errors.confirmarSenha ? styles.inputError : {}),
                }}
                autoComplete="new-password"
                {...register('confirmarSenha')}
              />
              <button
                type="button"
                style={styles.togglePassword}
                onClick={() => setMostrarConfirmar((v) => !v)}
                aria-label={mostrarConfirmar ? 'Ocultar confirmação' : 'Mostrar confirmação'}
              >
                {mostrarConfirmar ? '🙈' : '👁'}
              </button>
            </div>
            {errors.confirmarSenha && (
              <span style={styles.errorText} role="alert">
                ⚠ {errors.confirmarSenha.message}
              </span>
            )}
          </div>

          {serverError && (
            <div style={styles.errorBox} role="alert">
              <span>⚠ {serverError}</span>
              {serverError.includes('Token') && (
                <div style={{ marginTop: '8px' }}>
                  <Link to="/forgot-password" style={{ color: '#2563eb', fontSize: '13px' }}>
                    Solicitar novo link
                  </Link>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            style={{
              ...styles.submitButton,
              ...(isSubmitting || !isValid ? styles.submitButtonDisabled : {}),
            }}
          >
            {isSubmitting ? (
              <span>
                <span style={styles.spinnerInline} aria-hidden="true" /> Redefinindo...
              </span>
            ) : (
              'Redefinir Senha'
            )}
          </button>
        </form>
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
    maxWidth: '440px',
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
  fieldGroup: {
    marginBottom: '18px',
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
  forcaBar: {
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '4px',
  },
  forcaFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s, background-color 0.3s',
  },
  requirementsList: {
    listStyle: 'none',
    padding: 0,
    margin: '8px 0 0',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2px',
  },
  reqMet: {
    fontSize: '12px',
    color: '#16a34a',
  },
  reqUnmet: {
    fontSize: '12px',
    color: '#9ca3af',
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
  linkBlue: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '600',
  },
};
