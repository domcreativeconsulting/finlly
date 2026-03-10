import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth.js';
import { perfilService } from '../services/perfil.service.js';

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Bahia',
  'America/Cuiaba',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
  'America/Noronha',
  'UTC',
  'Europe/Lisbon',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
];

const MOEDAS = [
  'BRL', 'USD', 'EUR', 'GBP', 'JPY',
  'CAD', 'AUD', 'CHF', 'MXN', 'ARS',
  'CLP', 'COP', 'PEN', 'UYU',
];

export default function PerfilPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    whatsapp: '',
    timezone: 'America/Sao_Paulo',
    moeda: 'BRL',
  });

  useEffect(() => {
    perfilService.getPerfil()
      .then((data) => {
        setForm({
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
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome || form.nome.length < 3) {
      toast.error('Nome deve ter pelo menos 3 caracteres.');
      return;
    }

    const data = {
      nome: form.nome,
      timezone: form.timezone,
      moeda: form.moeda,
    };
    if (form.whatsapp) {
      data.whatsapp = form.whatsapp;
    } else {
      data.whatsapp = null;
    }

    setSaving(true);
    try {
      await perfilService.updatePerfil(data);
      toast.success('Perfil atualizado com sucesso!');
    } catch {
      toast.error('Erro ao atualizar perfil. Tente novamente.');
    } finally {
      setSaving(false);
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
            <form onSubmit={handleSubmit} noValidate>
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="nome">Nome *</label>
                <input
                  id="nome"
                  name="nome"
                  type="text"
                  value={form.nome}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="whatsapp">WhatsApp</label>
                <input
                  id="whatsapp"
                  name="whatsapp"
                  type="text"
                  value={form.whatsapp}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="+55 11 99999-9999"
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="timezone">Fuso Horário</label>
                <select
                  id="timezone"
                  name="timezone"
                  value={form.timezone}
                  onChange={handleChange}
                  style={styles.select}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="moeda">Moeda</label>
                <select
                  id="moeda"
                  name="moeda"
                  value={form.moeda}
                  onChange={handleChange}
                  style={styles.select}
                >
                  {MOEDAS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                style={saving ? { ...styles.submitButton, ...styles.submitButtonDisabled } : styles.submitButton}
              >
                {saving ? (
                  <>
                    <span style={styles.spinnerInline} />
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
};
