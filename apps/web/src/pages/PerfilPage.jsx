import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth.js';
import { perfilService } from '../services/perfil.service.js';

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Maceio',
  'America/Bahia',
  'America/Cuiaba',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
  'America/Noronha',
  'America/Araguaina',
  'UTC',
  'Europe/Lisbon',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Mexico_City',
  'America/Argentina/Buenos_Aires',
  'America/Lima',
  'America/Bogota',
  'America/Santiago',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Rome',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const MOEDAS = [
  'BRL',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'CHF',
  'MXN',
  'ARS',
  'CLP',
  'COP',
  'PEN',
  'UYU',
];

const MIN_PASSWORD_LENGTH = 6;

const PerfilSchema = z.object({
  nome: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(255, 'Máximo 255 caracteres'),
  whatsapp: z
    .string()
    .max(20, 'Máximo 20 caracteres')
    .regex(
      /^\+?[\d\s\-(). ]+$/,
      'Número inválido. Use formato: +55 11 99999-9999'
    )
    .optional()
    .or(z.literal('')),
  timezone: z.string().refine((tz) => TIMEZONES.includes(tz), {
    message: 'Fuso horário inválido',
  }),
  moeda: z
    .string()
    .length(3, 'Código de moeda deve ter 3 letras')
    .refine((m) => MOEDAS.includes(m.toUpperCase()), {
      message: 'Moeda inválida',
    }),
});

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

export default function PerfilPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [emailValue, setEmailValue] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [senhaError, setSenhaError] = useState('');
  const [savingSenha, setSavingSenha] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(PerfilSchema),
    mode: 'onChange',
    defaultValues: {
      nome: '',
      whatsapp: '',
      timezone: 'America/Sao_Paulo',
      moeda: 'BRL',
    },
  });

  useEffect(() => {
    perfilService
      .getPerfil()
      .then((data) => {
        reset({
          nome: data.nome || '',
          whatsapp: data.whatsapp || '',
          timezone: data.timezone || 'America/Sao_Paulo',
          moeda: data.moeda || 'BRL',
        });
        setEmailValue(data.email || '');
        setCreatedAt(data.created_at || '');
      })
      .catch(() => {
        toast.error('Erro ao carregar perfil.');
      })
      .finally(() => setLoading(false));
  }, [reset]);

  async function onSubmit(data) {
    setErrorMsg(null);
    const payload = {
      nome: data.nome.trim(),
      timezone: data.timezone,
      moeda: data.moeda.toUpperCase(),
      whatsapp:
        data.whatsapp && data.whatsapp.trim() !== ''
          ? data.whatsapp.trim()
          : null,
    };
    try {
      await perfilService.updatePerfil(payload);
      toast.success('Perfil atualizado com sucesso!');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        'Erro ao atualizar perfil. Tente novamente.';
      setErrorMsg(msg);
    }
  }

  async function handleSenha(e) {
    e.preventDefault();
    setSenhaError('');
    if (!senhaAtual) {
      setSenhaError('Informe a senha atual.');
      return;
    }
    if (novaSenha.length < MIN_PASSWORD_LENGTH) {
      setSenhaError(
        `A nova senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`
      );
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setSenhaError('A nova senha e a confirmação não coincidem.');
      return;
    }
    setSavingSenha(true);
    try {
      await perfilService.updateSenha({ senhaAtual, novaSenha });
      toast.success('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        'Erro ao alterar senha. Tente novamente.';
      setSenhaError(msg);
    } finally {
      setSavingSenha(false);
    }
  }

  const initials = getInitials(usuario?.nome);

  const navItems = [
    { icon: '⊞', label: 'Dashboard', path: '/dashboard' },
    { icon: '↕', label: 'Transações', path: '/transacoes' },
    { icon: '📊', label: 'Relatórios', path: '/relatorios' },
    { icon: '⚙', label: 'Configurações', path: '/perfil', active: true },
  ];

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <nav
        style={{ ...s.sidebar, ...(sidebarOpen ? {} : s.sidebarHidden) }}
        aria-label="Navegação principal"
      >
        <div style={s.sidebarLogo}>
          <span style={s.sidebarLogoIcon}>F</span>
        </div>
        <ul style={s.navList}>
          {navItems.map((item) => (
            <li key={item.path}>
              <button
                onClick={() => navigate(item.path)}
                style={
                  item.active ? { ...s.navBtn, ...s.navBtnActive } : s.navBtn
                }
                title={item.label}
                aria-label={item.label}
                aria-current={item.active ? 'page' : undefined}
              >
                <span style={s.navIcon}>{item.icon}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Main area */}
      <div style={s.mainArea}>
        {/* Header */}
        <div style={s.topBar}>
          <div style={s.topBarLeft}>
            <button
              style={s.hamburger}
              aria-label="Menu"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              ☰
            </button>
            <div>
              <h1 style={s.pageTitle}>Meu perfil</h1>
              <p style={s.pageSubtitle}>Configurações da sua conta</p>
            </div>
          </div>
          <div
            style={s.avatar}
            title={usuario?.nome || ''}
            aria-label={`Avatar de ${usuario?.nome || 'usuário'}`}
          >
            {initials}
          </div>
        </div>
        <hr style={s.divider} />

        {/* Sub-header */}
        <div style={s.subHeader}>
          <div style={s.avatarSmall} aria-hidden="true">
            <span style={{ fontSize: '18px' }}>👤</span>
          </div>
          <p style={s.subHeaderText}>
            Ajuste seus dados pessoais, número de WhatsApp e credenciais de
            acesso.
          </p>
        </div>

        {loading ? (
          <div style={s.loadingWrapper}>
            <span style={s.spinner} aria-hidden="true" />
            <span style={{ color: '#6b7280', marginLeft: '12px' }}>
              Carregando...
            </span>
          </div>
        ) : (
          <div style={s.cardsGrid}>
            {/* Card: Dados da conta */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.cardTitle}>Dados da conta</h2>
                {createdAt && (
                  <span style={s.cardMeta}>
                    usando desde {formatDate(createdAt)}
                  </span>
                )}
              </div>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                {errorMsg && (
                  <div style={s.errorBox} role="alert">
                    <span aria-hidden="true">⚠️</span> {errorMsg}
                  </div>
                )}

                <div style={s.fieldGroup}>
                  <label style={s.label} htmlFor="nome">
                    Nome completo *
                  </label>
                  <input
                    id="nome"
                    type="text"
                    placeholder="Seu nome completo"
                    autoComplete="name"
                    style={{ ...s.input, ...(errors.nome ? s.inputError : {}) }}
                    {...register('nome')}
                  />
                  {errors.nome && (
                    <span style={s.fieldError} role="alert">
                      {errors.nome.message}
                    </span>
                  )}
                </div>

                <div style={s.fieldGroup}>
                  <label style={s.label} htmlFor="email">
                    E-mail de acesso *
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={emailValue}
                    readOnly
                    style={{ ...s.input, ...s.inputReadOnly }}
                    autoComplete="email"
                  />
                  <span style={s.helperText}>
                    Usado para login e comunicações importantes.
                  </span>
                </div>

                <div style={s.fieldGroup}>
                  <label style={s.label} htmlFor="whatsapp">
                    WhatsApp (para lembretes e agente)
                  </label>
                  <input
                    id="whatsapp"
                    type="text"
                    placeholder="+55 11 99999-9999"
                    style={{
                      ...s.input,
                      ...(errors.whatsapp ? s.inputError : {}),
                    }}
                    {...register('whatsapp')}
                  />
                  {errors.whatsapp && (
                    <span style={s.fieldError} role="alert">
                      {errors.whatsapp.message}
                    </span>
                  )}
                  <span style={s.helperText}>
                    Esse número será usado para identificar você quando falar
                    com o agente no WhatsApp.
                  </span>
                </div>

                <div style={s.twoCol}>
                  <div style={s.fieldGroup}>
                    <label style={s.label} htmlFor="moeda">
                      Moeda padrão
                    </label>
                    <select
                      id="moeda"
                      style={{
                        ...s.select,
                        ...(errors.moeda ? s.inputError : {}),
                      }}
                      {...register('moeda')}
                    >
                      {MOEDAS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    {errors.moeda && (
                      <span style={s.fieldError} role="alert">
                        {errors.moeda.message}
                      </span>
                    )}
                  </div>
                  <div style={s.fieldGroup}>
                    <label style={s.label} htmlFor="timezone">
                      Fuso horário
                    </label>
                    <select
                      id="timezone"
                      style={{
                        ...s.select,
                        ...(errors.timezone ? s.inputError : {}),
                      }}
                      {...register('timezone')}
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                    {errors.timezone && (
                      <span style={s.fieldError} role="alert">
                        {errors.timezone.message}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={
                      isSubmitting
                        ? { ...s.btnPrimary, ...s.btnPrimaryDisabled }
                        : s.btnPrimary
                    }
                  >
                    {isSubmitting ? (
                      <>
                        <span style={s.spinnerInline} aria-hidden="true" />{' '}
                        Salvando...
                      </>
                    ) : (
                      '✓ Salvar alterações'
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Card: Segurança e senha */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.cardTitle}>Segurança e senha</h2>
              </div>

              <form onSubmit={handleSenha} noValidate>
                {senhaError && (
                  <div style={s.errorBox} role="alert">
                    <span aria-hidden="true">⚠️</span> {senhaError}
                  </div>
                )}

                <div style={s.fieldGroup}>
                  <label style={s.label} htmlFor="senhaAtual">
                    Senha atual
                  </label>
                  <input
                    id="senhaAtual"
                    type="password"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    style={s.input}
                    autoComplete="current-password"
                  />
                </div>

                <div style={s.twoCol}>
                  <div style={s.fieldGroup}>
                    <label style={s.label} htmlFor="novaSenha">
                      Nova senha
                    </label>
                    <input
                      id="novaSenha"
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      style={s.input}
                      autoComplete="new-password"
                    />
                  </div>
                  <div style={s.fieldGroup}>
                    <label style={s.label} htmlFor="confirmarSenha">
                      Confirmar nova senha
                    </label>
                    <input
                      id="confirmarSenha"
                      type="password"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      style={s.input}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <p style={s.senhaHint}>
                  Use uma senha forte. No mínimo {MIN_PASSWORD_LENGTH}{' '}
                  caracteres, idealmente com letras maiúsculas, minúsculas,
                  números e símbolos.
                </p>

                <div style={{ textAlign: 'right' }}>
                  <button
                    type="submit"
                    disabled={savingSenha}
                    style={
                      savingSenha
                        ? { ...s.btnSecondary, ...s.btnSecondaryDisabled }
                        : s.btnSecondary
                    }
                  >
                    {savingSenha ? (
                      <>
                        <span
                          style={{
                            ...s.spinnerInline,
                            borderColor: 'rgba(37,99,235,0.3)',
                            borderTopColor: '#2563eb',
                          }}
                          aria-hidden="true"
                        />{' '}
                        Alterando...
                      </>
                    ) : (
                      '🔒 Alterar senha'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Footer */}
        <footer style={s.footer}>
          Finlly • painel financeiro pessoal — {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}

const s = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    backgroundColor: '#ffffff',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },

  /* Sidebar */
  sidebar: {
    width: '64px',
    minWidth: '64px',
    backgroundColor: '#1a2744',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '0',
    flexShrink: 0,
  },
  sidebarLogo: {
    width: '64px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    marginBottom: '8px',
  },
  sidebarLogoIcon: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-1px',
  },
  navList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '100%',
    alignItems: 'center',
  },
  navBtn: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '18px',
    transition: 'background 0.15s, color 0.15s',
  },
  navBtnActive: {
    backgroundColor: 'rgba(37,99,235,0.25)',
    color: '#93c5fd',
  },
  navIcon: {
    lineHeight: 1,
  },

  sidebarHidden: {
    display: 'none',
  },

  /* Main area */
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
  },

  /* Top bar */
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 32px 16px',
    backgroundColor: '#ffffff',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  hamburger: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: '#374151',
    padding: '4px',
    lineHeight: 1,
  },
  pageTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#111827',
    margin: 0,
    lineHeight: 1.2,
  },
  pageSubtitle: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '2px 0 0',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '700',
    flexShrink: 0,
    cursor: 'default',
    userSelect: 'none',
  },
  divider: {
    margin: '0 32px',
    border: 'none',
    borderTop: '1px solid #e5e7eb',
  },

  /* Sub-header */
  subHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 32px',
  },
  avatarSmall: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  subHeaderText: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },

  /* Cards grid */
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: '24px',
    padding: '0 32px 40px',
    flex: 1,
    alignItems: 'start',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    padding: '28px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: '20px',
    gap: '8px',
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#111827',
    margin: 0,
  },
  cardMeta: {
    fontSize: '12px',
    color: '#9ca3af',
    whiteSpace: 'nowrap',
  },

  /* Form elements */
  fieldGroup: {
    marginBottom: '16px',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '5px',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  inputReadOnly: {
    backgroundColor: '#f9fafb',
    color: '#6b7280',
    cursor: 'default',
  },
  select: {
    width: '100%',
    padding: '9px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    color: '#111827',
  },
  helperText: {
    display: 'block',
    marginTop: '4px',
    fontSize: '12px',
    color: '#9ca3af',
  },
  senhaHint: {
    fontSize: '13px',
    color: '#9ca3af',
    margin: '0 0 16px',
    lineHeight: '1.5',
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
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#dc2626',
    marginBottom: '16px',
    fontSize: '13px',
  },

  /* Buttons */
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 20px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '7px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  btnPrimaryDisabled: {
    backgroundColor: '#93c5fd',
    cursor: 'not-allowed',
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 20px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#2563eb',
    backgroundColor: '#ffffff',
    border: '1.5px solid #2563eb',
    borderRadius: '7px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  btnSecondaryDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  spinnerInline: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  loadingWrapper: {
    display: 'flex',
    alignItems: 'center',
    margin: '0 32px',
    padding: '32px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  },
  spinner: {
    display: 'inline-block',
    width: '24px',
    height: '24px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },

  footer: {
    width: '100%', // Garante que ocupe toda a largura
    margin: '20px 0 20px 0', // Empurra para o fim da página se o conteúdo for pouco
    padding: '20px', // Aumenta o "tamanho" vertical (espaço interno)
    textAlign: 'center',
    fontSize: '14.4px', // Tamanho de fonte padrão para rodapés modernos
    backgroundColor: 'rgb(51, 82, 138)',
    color: '#ffffff',
    borderRadius: '20px 20px 16px 16px',
  },
};
