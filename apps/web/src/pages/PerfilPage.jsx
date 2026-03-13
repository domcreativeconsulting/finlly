import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth.js';
import { perfilService } from '../services/perfil.service.js';
import AppSidebar from '../components/AppSidebar.jsx';

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

const MOEDAS_LABELS = {
  BRL: 'BRL (R$)',
  USD: 'USD ($)',
  EUR: 'EUR (€)',
  GBP: 'GBP (£)',
  JPY: 'JPY (¥)',
  CAD: 'CAD (CA$)',
  AUD: 'AUD (A$)',
  CHF: 'CHF (Fr)',
  MXN: 'MXN (MX$)',
  ARS: 'ARS (AR$)',
  CLP: 'CLP (CL$)',
  COP: 'COP (CO$)',
  PEN: 'PEN (S/.)',
  UYU: 'UYU ($U)',
};

const TIMEZONE_LABELS = {
  'America/Sao_Paulo': 'Brasília (UTC-3)',
  'America/Manaus': 'Manaus (UTC-4)',
  'America/Belem': 'Belém (UTC-3)',
  'America/Fortaleza': 'Fortaleza (UTC-3)',
  'America/Recife': 'Recife (UTC-3)',
  'America/Maceio': 'Maceió (UTC-3)',
  'America/Bahia': 'Bahia (UTC-3)',
  'America/Cuiaba': 'Cuiabá (UTC-4)',
  'America/Porto_Velho': 'Porto Velho (UTC-4)',
  'America/Boa_Vista': 'Boa Vista (UTC-4)',
  'America/Rio_Branco': 'Rio Branco (UTC-5)',
  'America/Noronha': 'Fernando de Noronha (UTC-2)',
  'America/Araguaina': 'Araguaína (UTC-3)',
  UTC: 'UTC (UTC+0)',
  'Europe/Lisbon': 'Lisboa (UTC+0/+1)',
  'Europe/London': 'Londres (UTC+0/+1)',
  'America/New_York': 'Nova York (UTC-5/-4)',
  'America/Chicago': 'Chicago (UTC-6/-5)',
  'America/Denver': 'Denver (UTC-7/-6)',
  'America/Los_Angeles': 'Los Angeles (UTC-8/-7)',
  'America/Toronto': 'Toronto (UTC-5/-4)',
  'America/Mexico_City': 'Cidade do México (UTC-6/-5)',
  'America/Argentina/Buenos_Aires': 'Buenos Aires (UTC-3)',
  'America/Lima': 'Lima (UTC-5)',
  'America/Bogota': 'Bogotá (UTC-5)',
  'America/Santiago': 'Santiago (UTC-4/-3)',
  'Europe/Berlin': 'Berlim (UTC+1/+2)',
  'Europe/Paris': 'Paris (UTC+1/+2)',
  'Europe/Madrid': 'Madri (UTC+1/+2)',
  'Europe/Rome': 'Roma (UTC+1/+2)',
  'Asia/Tokyo': 'Tóquio (UTC+9)',
  'Asia/Shanghai': 'Xangai (UTC+8)',
  'Asia/Kolkata': 'Calcutá (UTC+5:30)',
  'Asia/Dubai': 'Dubai (UTC+4)',
  'Australia/Sydney': 'Sydney (UTC+10/+11)',
  'Pacific/Auckland': 'Auckland (UTC+12/+13)',
};

const MIN_PASSWORD_LENGTH = 8;

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

const SenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual.'),
    novaSenha: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
        'Use maiúsculas, minúsculas e números'
      ),
    confirmarSenha: z.string(),
  })
  .refine((data) => data.novaSenha === data.confirmarSenha, {
    message: 'A nova senha e a confirmação não coincidem.',
    path: ['confirmarSenha'],
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
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [emailValue, setEmailValue] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const {
    register: registerSenha,
    handleSubmit: handleSubmitSenha,
    reset: resetSenha,
    setError: setSenhaRootError,
    formState: { errors: senhaErrors, isSubmitting: isSavingSenha },
  } = useForm({
    resolver: zodResolver(SenhaSchema),
    mode: 'onChange',
  });

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

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  async function onSubmit(data) {
    setErrorMsg(null);
    setSuccessMsg(null);
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
      setSuccessMsg('Perfil atualizado com sucesso!');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        'Erro ao atualizar perfil. Tente novamente.';
      setErrorMsg(msg);
    }
  }

  async function handleSenha(data) {
    try {
      await perfilService.updateSenha({
        senhaAtual: data.senhaAtual,
        novaSenha: data.novaSenha,
      });
      toast.success('Senha alterada com sucesso!');
      resetSenha();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        'Erro ao alterar senha. Tente novamente.';
      setSenhaRootError('root', { message: msg });
    }
  }

  const initials = getInitials(usuario?.nome);

  function handleMenuNavigate(path) {
    setDropdownOpen(false);
    navigate(path);
  }

  return (
    <div style={s.pageWrapper}>
      <div style={s.page}>
        {/* Sidebar */}
        <AppSidebar sidebarOpen={sidebarOpen} currentPath="/perfil" onHoverChange={setSidebarExpanded} />

        {/* Main area */}
        <div
          style={{
            ...s.mainArea,
            marginLeft: !sidebarOpen ? '0px' : sidebarExpanded ? '236px' : '108px',
            transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
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
              <div style={s.pageTitleIcon} aria-hidden="true">
                👤
              </div>
              <div>
                <div style={s.pageTitleRow}>
                  <h1 style={s.pageTitle}>Meu perfil</h1>
                  <span style={s.pageTitleChip}>
                    Configurações da sua conta
                  </span>
                </div>
                <p style={s.pageSubtitle}>
                  Ajuste seus dados pessoais, número de WhatsApp e credenciais
                  de acesso.
                </p>
              </div>
            </div>
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                style={{
                  ...s.avatar,
                  cursor: 'pointer',
                  border: 'none',
                  outline: 'none',
                  boxShadow: dropdownOpen ? '0 0 0 3px rgba(37,99,235,0.25)' : 'none',
                }}
                title={usuario?.nome || ''}
                aria-label={`Menu do usuário ${usuario?.nome || ''}`}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                {initials}
              </button>

              {dropdownOpen && (
                <div style={s.userDropdown}>
                  {/* User info header */}
                  <div style={s.userDropdownHeader}>
                    <div style={s.userDropdownName}>{usuario?.nome || 'Usuário'}</div>
                    <div style={s.userDropdownEmail}>{emailValue || usuario?.email || ''}</div>
                  </div>

                  <hr style={s.userDropdownDivider} />

                  {/* Assinatura */}
                  <button
                    style={s.userDropdownItem}
                    onClick={() => handleMenuNavigate('/assinatura')}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span style={s.userDropdownIcon}>💳</span>
                    Assinatura
                  </button>

                  {/* Perfil */}
                  <button
                    style={s.userDropdownItem}
                    onClick={() => handleMenuNavigate('/perfil')}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span style={s.userDropdownIcon}>👤</span>
                    Perfil
                  </button>

                  <hr style={s.userDropdownDivider} />

                  {/* Sair */}
                  <button
                    style={{ ...s.userDropdownItem, color: '#dc2626' }}
                    onClick={() => { setDropdownOpen(false); logout(); }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span style={s.userDropdownIcon}>🚪</span>
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
          <hr style={s.divider} />

          {/* Inline alerts */}
          {successMsg && (
            <div style={s.alertSuccess} role="alert">
              <span>✓ {successMsg}</span>
              <button
                style={s.alertClose}
                onClick={() => setSuccessMsg(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
          )}
          {errorMsg && (
            <div style={s.alertDanger} role="alert">
              <span>⚠ {errorMsg}</span>
              <button
                style={s.alertClose}
                onClick={() => setErrorMsg(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
          )}

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
              <div style={{ ...s.card, height: '100%' }}>
                <div style={s.cardHeader}>
                  <h2 style={s.cardTitle}>Dados da conta</h2>
                  {createdAt && (
                    <span style={s.cardMeta}>
                      usando desde {formatDate(createdAt)}
                    </span>
                  )}
                </div>

                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                  <div style={s.fieldGroup}>
                    <label style={s.label} htmlFor="nome">
                      Nome completo *
                    </label>
                    <input
                      id="nome"
                      type="text"
                      placeholder="Seu nome completo"
                      autoComplete="name"
                      style={{
                        ...s.input,
                        ...(errors.nome ? s.inputError : {}),
                      }}
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

                  <div style={s.formRow}>
                    <div style={{ ...s.fieldGroup, gridColumn: 'span 2' }}>
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
                        Esse número será usado para identificar você quando
                        falar com o agente no WhatsApp.
                      </span>
                    </div>
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
                            {MOEDAS_LABELS[m] || m}
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
                            {TIMEZONE_LABELS[tz] || tz}
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
              <div style={{ ...s.card, height: '100%' }}>
                <div style={s.cardHeader}>
                  <h2 style={s.cardTitle}>Segurança e senha</h2>
                </div>

                <form onSubmit={handleSubmitSenha(handleSenha)} noValidate>
                  {senhaErrors.root && (
                    <div style={s.errorBox} role="alert">
                      <span aria-hidden="true">⚠️</span>{' '}
                      {senhaErrors.root.message}
                    </div>
                  )}

                  <div style={s.fieldGroup}>
                    <label style={s.label} htmlFor="senhaAtual">
                      Senha atual
                    </label>
                    <input
                      id="senhaAtual"
                      type="password"
                      style={{
                        ...s.input,
                        ...(senhaErrors.senhaAtual ? s.inputError : {}),
                      }}
                      autoComplete="current-password"
                      {...registerSenha('senhaAtual')}
                    />
                    {senhaErrors.senhaAtual && (
                      <span style={s.fieldError} role="alert">
                        {senhaErrors.senhaAtual.message}
                      </span>
                    )}
                  </div>

                  <div style={s.twoCol}>
                    <div style={s.fieldGroup}>
                      <label style={s.label} htmlFor="novaSenha">
                        Nova senha
                      </label>
                      <input
                        id="novaSenha"
                        type="password"
                        style={{
                          ...s.input,
                          ...(senhaErrors.novaSenha ? s.inputError : {}),
                        }}
                        autoComplete="new-password"
                        {...registerSenha('novaSenha')}
                      />
                      {senhaErrors.novaSenha && (
                        <span style={s.fieldError} role="alert">
                          {senhaErrors.novaSenha.message}
                        </span>
                      )}
                    </div>
                    <div style={s.fieldGroup}>
                      <label style={s.label} htmlFor="confirmarSenha">
                        Confirmar nova senha
                      </label>
                      <input
                        id="confirmarSenha"
                        type="password"
                        style={{
                          ...s.input,
                          ...(senhaErrors.confirmarSenha ? s.inputError : {}),
                        }}
                        autoComplete="new-password"
                        {...registerSenha('confirmarSenha')}
                      />
                      {senhaErrors.confirmarSenha && (
                        <span style={s.fieldError} role="alert">
                          {senhaErrors.confirmarSenha.message}
                        </span>
                      )}
                    </div>
                  </div>

                  <p style={s.senhaHint}>
                    A senha deve ter no mínimo {MIN_PASSWORD_LENGTH} caracteres
                    e obrigatoriamente conter letras maiúsculas, minúsculas e
                    números.
                  </p>

                  <div style={{ textAlign: 'right' }}>
                    <button
                      type="submit"
                      disabled={isSavingSenha}
                      style={
                        isSavingSenha
                          ? { ...s.btnSecondary, ...s.btnSecondaryDisabled }
                          : s.btnSecondary
                      }
                    >
                      {isSavingSenha ? (
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
        </div>
      </div>

      <footer style={s.footer}>
        Finlly • painel financeiro pessoal — {new Date().getFullYear()}
      </footer>
    </div>
  );
}

const s = {
  pageWrapper: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    width: '100%',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },

  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    width: '100%',
    backgroundColor: '#ffffff',
  },

  /* Sidebar */
  sidebar: {
    position: 'fixed',
    top: '16px',
    left: '16px',
    bottom: '16px',
    width: '92px',
    backgroundColor: '#33528a',
    borderRadius: '20px',
    boxShadow: 'rgba(51, 82, 138, 0.22) 0px 10px 35px 0px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '15px',
    paddingBottom: '15px',
    overflowX: 'hidden',
    overflowY: 'auto',
    zIndex: 1030,
    flexShrink: 0,
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  sidebarHidden: {
    width: '0',
    paddingTop: 0,
    paddingBottom: 0,
    overflow: 'hidden',
  },

  /* Main area */
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    marginLeft: '124px',
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
  pageTitleIcon: {
    fontSize: '28px',
    lineHeight: 1,
    flexShrink: 0,
  },
  pageTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#111827',
    margin: 0,
    lineHeight: 1.2,
  },
  pageTitleChip: {
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: '500',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '20px',
    padding: '2px 10px',
    whiteSpace: 'nowrap',
  },
  pageSubtitle: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '4px 0 0',
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

  /* Inline alerts */
  alertSuccess: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: '16px 32px 0',
    padding: '12px 16px',
    borderRadius: '8px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#15803d',
    fontSize: '14px',
    fontWeight: '500',
  },
  alertDanger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: '16px 32px 0',
    padding: '12px 16px',
    borderRadius: '8px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    fontSize: '14px',
    fontWeight: '500',
  },
  alertClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    color: 'inherit',
    opacity: 0.7,
    padding: '0 0 0 8px',
  },

  /* Cards grid */
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: '24px',
    padding: '24px 32px 40px',
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
  } /* Form elements */,
  fieldGroup: {
    marginBottom: '16px',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr',
    gap: '12px',
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
    borderRadius: '20px',
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
    borderRadius: '20px',
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
    paddingLeft: '124px',
    paddingRight: '32px',
    paddingTop: '18px',
    paddingBottom: '18px',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: '500',
    backgroundColor: '#1a2744',
    color: '#ffffff',
    boxSizing: 'border-box',
    flexShrink: 0,
  },

  userDropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '230px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.13)',
    border: '1px solid #e5e7eb',
    zIndex: 1050,
    overflow: 'hidden',
    padding: '4px 0',
  },
  userDropdownHeader: {
    padding: '14px 16px 12px',
  },
  userDropdownName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '2px',
  },
  userDropdownEmail: {
    fontSize: '12px',
    color: '#6b7280',
  },
  userDropdownDivider: {
    margin: '4px 0',
    border: 'none',
    borderTop: '1px solid #f3f4f6',
  },
  userDropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.15s',
  },
  userDropdownIcon: {
    fontSize: '16px',
    flexShrink: 0,
  },
};
