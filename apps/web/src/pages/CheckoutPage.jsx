import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth.js';
import { billingService } from '../services/billing.service.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons';

export default function CheckoutPage() {
  useAuth();

  const [form, setForm] = useState({
    plano: 'mensal',
    ciclo: 'mensal',
    formaPagamento: 'PIX',
    cupomCodigo: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      // Ciclo defaults to match plano when plano changes
      if (name === 'plano') updated.ciclo = value;
      return updated;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = {
        plano: form.plano,
        ciclo: form.ciclo,
        formaPagamento: form.formaPagamento,
      };
      if (form.cupomCodigo.trim()) data.cupomCodigo = form.cupomCodigo.trim();
      await billingService.subscribe(data);
      toast.success('Assinatura criada com sucesso!');
      setSuccess(true);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Erro ao processar assinatura. Tente novamente.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>Finlly</h1>
        <Link to="/dashboard" style={styles.backLink}>
          ← Voltar ao painel
        </Link>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <h2 style={styles.title}>Assinar um plano</h2>
          <p style={styles.subtitle}>
            Escolha o plano ideal para o seu negócio.
          </p>

          {success ? (
            <div style={styles.successBox}>
              <p style={styles.successText}>
                <FontAwesomeIcon icon={faCircleCheck} /> Assinatura criada com sucesso!
              </p>
              <Link to="/billing/status" style={styles.statusLink}>
                Ver status da assinatura →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              {error && <div style={styles.errorBox}>{error}</div>}

              <div style={styles.field}>
                <label style={styles.label} htmlFor="plano">
                  Plano
                </label>
                <select
                  id="plano"
                  name="plano"
                  value={form.plano}
                  onChange={handleChange}
                  style={styles.select}
                >
                  <option value="mensal">Mensal — R$ 29,90/mês</option>
                  <option value="anual">Anual — R$ 287,90/ano</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="ciclo">
                  Ciclo de cobrança
                </label>
                <select
                  id="ciclo"
                  name="ciclo"
                  value={form.ciclo}
                  onChange={handleChange}
                  style={styles.select}
                >
                  <option value="mensal">Mensal</option>
                  <option value="anual">Anual</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="formaPagamento">
                  Forma de pagamento
                </label>
                <select
                  id="formaPagamento"
                  name="formaPagamento"
                  value={form.formaPagamento}
                  onChange={handleChange}
                  style={styles.select}
                >
                  <option value="PIX">PIX</option>
                  <option value="CREDIT_CARD">Cartão de crédito</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="cupomCodigo">
                  Cupom de desconto{' '}
                  <span style={styles.optional}>(opcional)</span>
                </label>
                <input
                  id="cupomCodigo"
                  name="cupomCodigo"
                  type="text"
                  value={form.cupomCodigo}
                  onChange={handleChange}
                  placeholder="Ex.: PROMO10"
                  style={styles.input}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={loading ? styles.btnDisabled : styles.btn}
              >
                {loading ? 'Processando...' : 'Assinar agora'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    padding: '12px 24px',
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
  backLink: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#2563eb',
    textDecoration: 'none',
  },
  main: {
    maxWidth: '520px',
    margin: '0 auto',
    padding: '40px 24px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 32,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 28px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  optional: {
    fontWeight: '400',
    color: '#9ca3af',
  },
  select: {
    padding: '10px 12px',
    fontSize: '14px',
    color: '#111827',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    cursor: 'pointer',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    color: '#111827',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
  },
  btn: {
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginTop: '4px',
  },
  btnDisabled: {
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: '#93c5fd',
    border: 'none',
    borderRadius: '8px',
    cursor: 'not-allowed',
    marginTop: '4px',
  },
  errorBox: {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '14px',
  },
  successBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '24px 0 8px',
    textAlign: 'center',
  },
  successText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#16a34a',
    margin: 0,
  },
  statusLink: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#2563eb',
    textDecoration: 'none',
  },
};
