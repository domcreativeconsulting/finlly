import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { billingService } from '../services/billing.service.js';

const PLANS = [
  { value: 'mensal', label: 'Mensal — R$ 39,90', price: 'R$ 39,90', cycle: '/mês' },
  { value: 'anual', label: 'Anual — R$ 399,00', price: 'R$ 399,00', cycle: '/ano' },
];

function formatCPF(value) {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Random-looking code based on timestamp
function genCode() {
  return Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    plano: 'mensal',
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    cupom: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [code] = useState(() => genCode());

  const selectedPlan = PLANS.find((p) => p.value === form.plano) || PLANS[0];

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === 'cpf') {
      setForm((prev) => ({ ...prev, cpf: formatCPF(value) }));
    } else if (name === 'telefone') {
      setForm((prev) => ({ ...prev, telefone: formatPhone(value) }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.nome.trim()) return setError('Informe seu nome.');
    if (!form.email.trim()) return setError('Informe seu e-mail.');
    if (!form.cpf.trim()) return setError('Informe seu CPF.');
    if (!form.telefone.trim()) return setError('Informe seu telefone.');

    setLoading(true);
    try {
      const payload = {
        plano: form.plano,
        ciclo: form.plano,
        nome: form.nome.trim(),
        email: form.email.trim(),
        cpf: form.cpf.replace(/\D/g, ''),
        telefone: form.telefone.replace(/\D/g, ''),
      };
      if (form.cupom.trim()) payload.cupomCodigo = form.cupom.trim();
      await billingService.subscribe(payload);
      toast.success('Assinatura criada com sucesso!');
      navigate('/billing/status');
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
    <div style={s.page}>
      <div style={s.wrapper}>
        {/* ── LEFT PANEL ── */}
        <aside style={s.left}>
          {/* Logo */}
          <div style={s.logoRow}>
            <span style={s.logoIcon}>🤖</span>
            <div>
              <span style={s.logoName}>Finlly</span>
              <span style={s.logoSub}> Finlly</span>
              <div style={s.logoTagline}>Gestão financeira pessoal</div>
            </div>
          </div>

          <h2 style={s.leftTitle}>Gestão financeira pessoal.</h2>
          <p style={s.leftDesc}>
            Contas fixas e variáveis, recebimentos, investimentos e metas — com apoio do agente.
          </p>

          <ul style={s.featureList}>
            {[
              { icon: '🛡️', text: 'Bloqueio automático por inadimplência' },
              { icon: '🔄', text: 'Recorrência via Asaas' },
              { icon: '🎯', text: 'Metas + anexos (extratos/comprovantes)' },
            ].map(({ icon, text }) => (
              <li key={text} style={s.featureItem}>
                <span style={s.featureIcon}>{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          {/* Plan summary at bottom */}
          <div style={s.planSummary}>
            <div style={s.planSummaryLabel}>Plano atual</div>
            <div style={s.planSummaryValue}>
              {selectedPlan.value.toUpperCase()} — {selectedPlan.price}
            </div>
            <div style={s.planSummaryCode}>Código: <strong>{code}</strong></div>
          </div>
        </aside>

        {/* ── RIGHT PANEL ── */}
        <main style={s.right}>
          {/* Header */}
          <div style={s.rightHeader}>
            <span style={s.rightHeaderIcon}>🤖</span>
            <span style={s.rightHeaderTitle}>Assinatura</span>
            <span style={s.rightHeaderVersion}>v5.2.2</span>
          </div>

          <form onSubmit={handleSubmit} style={s.form}>
            {error && <div style={s.errorBox}>{error}</div>}

            {/* Plano */}
            <div style={s.field}>
              <label style={s.label}>Plano</label>
              <select name="plano" value={form.plano} onChange={handleChange} style={s.input}>
                {PLANS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Nome */}
            <div style={s.field}>
              <label style={s.label}>Nome</label>
              <input
                name="nome"
                type="text"
                value={form.nome}
                onChange={handleChange}
                autoComplete="name"
                style={s.input}
              />
            </div>

            {/* E-mail */}
            <div style={s.field}>
              <label style={s.label}>E-mail</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                style={s.input}
              />
            </div>

            {/* CPF + Telefone */}
            <div style={s.row}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>CPF</label>
                <input
                  name="cpf"
                  type="text"
                  value={form.cpf}
                  onChange={handleChange}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  style={s.input}
                />
              </div>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Telefone</label>
                <input
                  name="telefone"
                  type="text"
                  value={form.telefone}
                  onChange={handleChange}
                  placeholder="(11) 90000-0000"
                  inputMode="tel"
                  style={s.input}
                />
              </div>
            </div>

            {/* Cupom */}
            <div style={s.field}>
              <label style={s.label}>Cupom</label>
              <input
                name="cupom"
                type="text"
                value={form.cupom}
                onChange={handleChange}
                placeholder="Opcional"
                style={s.input}
              />
              <span style={s.cupomHint}>
                Se o cupom ativar <strong>teste</strong>, o acesso é <strong>liberado na hora</strong>.
              </span>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} style={loading ? s.btnDisabled : s.btn}>
              {loading ? 'Processando...' : 'Assinar agora'}
            </button>

            <p style={s.paymentHint}>Sem cupom, o acesso é liberado após confirmação do pagamento.</p>

            {/* Already have access */}
            <Link to="/login" style={s.alreadyBtn}>
              Já tenho acesso
            </Link>
          </form>
        </main>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#e8edf2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: '24px',
    boxSizing: 'border-box',
  },
  wrapper: {
    display: 'flex',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
    maxWidth: '900px',
    width: '100%',
    minHeight: '560px',
  },
  /* LEFT */
  left: {
    flex: '0 0 42%',
    background: 'linear-gradient(160deg, #1e3a5f 0%, #243b6e 100%)',
    color: '#ffffff',
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '28px',
  },
  logoIcon: {
    fontSize: '28px',
    marginTop: '2px',
  },
  logoName: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#ffffff',
  },
  logoSub: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
    marginLeft: '6px',
  },
  logoTagline: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '2px',
  },
  leftTitle: {
    fontSize: '22px',
    fontWeight: 800,
    margin: '0 0 10px',
    color: '#ffffff',
    lineHeight: 1.3,
  },
  leftDesc: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.6,
    margin: '0 0 24px',
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    color: 'rgba(255,255,255,0.88)',
  },
  featureIcon: {
    fontSize: '16px',
    flexShrink: 0,
  },
  planSummary: {
    marginTop: '32px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255,255,255,0.15)',
  },
  planSummaryLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  planSummaryValue: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#ffffff',
    marginBottom: '6px',
  },
  planSummaryCode: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.6)',
  },
  /* RIGHT */
  right: {
    flex: 1,
    background: '#ffffff',
    padding: '32px 36px',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  rightHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f0f0f0',
  },
  rightHeaderIcon: {
    fontSize: '22px',
  },
  rightHeaderTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#1a1a2e',
    flex: 1,
  },
  rightHeaderVersion: {
    fontSize: '12px',
    color: '#9ca3af',
    fontWeight: 500,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    flex: 1,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  row: {
    display: 'flex',
    gap: '14px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    color: '#111827',
    background: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    appearance: 'auto',
  },
  cupomHint: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '2px',
  },
  btn: {
    padding: '13px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#1e3a5f',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    marginTop: '4px',
    letterSpacing: '0.01em',
  },
  btnDisabled: {
    padding: '13px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#93a8c4',
    border: 'none',
    borderRadius: '10px',
    cursor: 'not-allowed',
    marginTop: '4px',
  },
  paymentHint: {
    fontSize: '12px',
    color: '#6b7280',
    textAlign: 'center',
    margin: '0',
  },
  alreadyBtn: {
    display: 'block',
    textAlign: 'center',
    padding: '11px',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    color: '#374151',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 600,
    background: '#ffffff',
  },
  errorBox: {
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '13px',
  },
};
