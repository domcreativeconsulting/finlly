import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth.js';
import { perfilService } from '../services/perfil.service.js';

const TIMEZONES = [
  'America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza',
  'America/Recife', 'America/Maceio', 'America/Bahia', 'America/Cuiaba',
  'America/Porto_Velho', 'America/Boa_Vista', 'America/Rio_Branco',
  'America/Noronha', 'America/Araguaina',
  'UTC', 'Europe/Lisbon', 'Europe/London', 'America/New_York',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Mexico_City', 'America/Argentina/Buenos_Aires',
  'America/Lima', 'America/Bogota', 'America/Santiago',
  'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Europe/Rome',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
  'Australia/Sydney', 'Pacific/Auckland',
];

const MOEDAS = ['BRL', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU'];

const PerfilSchema = z.object({
  nome: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(255, 'Máximo 255 caracteres'),
  whatsapp: z
    .string()
    .max(20, 'Máximo 20 caracteres')
    .regex(/^\+?[\d\s\-(). ]+$/, 'Número inválido. Use formato: +55 11 99999-9999')
    .optional()
    .or(z.literal('')),
  timezone: z
    .string()
    .refine((tz) => TIMEZONES.includes(tz), {
      message: 'Fuso horário inválido',
    }),
  moeda: z
    .string()
    .length(3, 'Código de moeda deve ter 3 letras')
    .refine((m) => MOEDAS.includes(m.toUpperCase()), {
      message: 'Moeda inválida',
    }),
});

export default function PerfilPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

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
    perfilService.getPerfil()
      .then((data) => {
        reset({
          nome: data.nome || '',
          whatsapp: data.whatsapp || '',
          timezone: data.timezone || 'America/Sao_Paulo',
          moeda: data.moeda || 'BRL',
        });
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
      whatsapp: data.whatsapp && data.whatsapp.trim() !== '' ? data.whatsapp.trim() : null,
    };
    try {
      await perfilService.updatePerfil(payload);
      toast.success('Perfil atualizado com sucesso!');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao atualizar perfil. Tente novamente.';
      setErrorMsg(msg);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>Finlly</h1>
        <span style={styles.headerUser}>{usuario?.nome || ''}</span>
      </header>

      <main style={styles.main}>
        <button
          onClick={() => navigate('/dashboard')}
          style={styles.backButton}
        >
          ← Voltar ao Dashboard
        </button>

        <h2 style={styles.title}>Meu Perfil</h2>
        <p style={styles.subtitle}>Edite suas informações e preferências.</p>

        {loading ? (
          <div style={styles.loadingWrapper}>
            <span style={styles.spinner} />
            <span style={{ color: '#6b7280', marginLeft: '12px' }}>Carregando...</span>
          </div>
        ) : (
          <div style={styles.card}>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {errorMsg && (
                <div style={styles.errorBox} role="alert">
                  <span aria-hidden="true">⚠️</span> {errorMsg}
                </div>
              )}

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="nome">Nome *</label>
                <input
                  id="nome"
                  type="text"
                  placeholder="Seu nome completo"
                  autoComplete="name"
                  style={{ ...styles.input, ...(errors.nome ? styles.inputError : {}) }}
                  {...register('nome')}
                />
                {errors.nome && (
                  <span style={styles.fieldError} role="alert">{errors.nome.message}</span>
                )}
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="whatsapp">WhatsApp <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span></label>
                <input
                  id="whatsapp"
                  type="text"
                  placeholder="+55 11 99999-9999"
                  style={{ ...styles.input, ...(errors.whatsapp ? styles.inputError : {}) }}
                  {...register('whatsapp')}
                />
                {errors.whatsapp && (
                  <span style={styles.fieldError} role="alert">{errors.whatsapp.message}</span>
                )}
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="timezone">Fuso Horário</label>
                <select
                  id="timezone"
                  style={{ ...styles.select, ...(errors.timezone ? styles.inputError : {}) }}
                  {...register('timezone')}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
                {errors.timezone && (
                  <span style={styles.fieldError} role="alert">{errors.timezone.message}</span>
                )}
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="moeda">Moeda</label>
                <select
                  id="moeda"
                  style={{ ...styles.select, ...(errors.moeda ? styles.inputError : {}) }}
                  {...register('moeda')}
                >
                  {MOEDAS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {errors.moeda && (
                  <span style={styles.fieldError} role="alert">{errors.moeda.message}</span>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={isSubmitting ? { ...styles.submitButton, ...styles.submitButtonDisabled } : styles.submitButton}
              >
                {isSubmitting ? (
                  <>
                    <span style={styles.spinnerInline} aria-hidden="true" />
                    {' '}Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    padding: '16px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#2563eb',
    margin: 0,
  },
  headerUser: {
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500',
  },
  main: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '40px 24px',
  },
  backButton: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 8px',
  },
  subtitle: {
    color: '#6b7280',
    marginBottom: '32px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    padding: '32px',
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
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
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
  loadingWrapper: {
    display: 'flex',
    alignItems: 'center',
    padding: '32px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
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
    padding: '12px 16px',
    color: '#dc2626',
    marginBottom: '20px',
    fontSize: '14px',
  },
};
