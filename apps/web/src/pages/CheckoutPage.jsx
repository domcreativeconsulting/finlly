import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { billingService } from '../services/billing.service.js';

const PLANS = {
  mensal: { label: 'MENSAL', price: 'R$ 39,90', ciclo: 'mensal' },
  anual: { label: 'ANUAL', price: 'R$ 399,00', ciclo: 'anual' },
};

function applyMaskCpf(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function applyMaskPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const planCode = useMemo(() => Math.random().toString(16).slice(2, 18).padEnd(16, '0'), []);

  const [form, setForm] = useState({
    plano: 'mensal',
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    cupomCodigo: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === 'cpf') {
      setForm((prev) => ({ ...prev, cpf: applyMaskCpf(value) }));
    } else if (name === 'telefone') {
      setForm((prev) => ({ ...prev, telefone: applyMaskPhone(value) }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.nome.trim()) {
      setError('Nome é obrigatório.');
      return;
    }
    if (!form.email.trim()) {
      setError('E-mail é obrigatório.');
      return;
    }
    if (form.cpf.replace(/\D/g, '').length < 11) {
      setError('CPF inválido.');
      return;
    }
    if (form.telefone.replace(/\D/g, '').length < 10) {
      setError('Telefone inválido.');
      return;
    }

    setLoading(true);
    try {
      const plan = PLANS[form.plano];
      const data = {
        plano: form.plano,
        ciclo: plan.ciclo,
        formaPagamento: 'PIX',
        nome: form.nome.trim(),
        email: form.email.trim(),
        cpf: form.cpf.replace(/\D/g, ''),
        telefone: form.telefone.replace(/\D/g, ''),
      };
      if (form.cupomCodigo.trim()) data.cupomCodigo = form.cupomCodigo.trim();
      await billingService.subscribe(data);
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

  const selectedPlan = PLANS[form.plano];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        minHeight: '100vh',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Left panel */}
      <div
        style={{
          flex: isMobile ? 'none' : '0 0 42%',
          background: 'linear-gradient(160deg, #1e3a5f 0%, #162d4a 100%)',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          padding: isMobile ? '40px 28px 32px' : '52px 48px 40px',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
          <span style={{ fontSize: '28px' }}>🤖</span>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.3px' }}>Finlly</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '1px' }}>
              Gestão financeira pessoal
            </div>
          </div>
        </div>

        {/* Main copy */}
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontSize: isMobile ? '26px' : '30px',
              fontWeight: '700',
              lineHeight: '1.25',
              margin: '0 0 16px',
              letterSpacing: '-0.5px',
            }}
          >
            Gestão financeira pessoal.
          </h1>
          <p
            style={{
              fontSize: '15px',
              color: 'rgba(255,255,255,0.75)',
              lineHeight: '1.6',
              margin: '0 0 40px',
            }}
          >
            Contas fixas e variáveis, recebimentos, investimentos e metas — com apoio do agente.
          </p>

          {/* Features */}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {[
              { icon: '🛡️', text: 'Bloqueio automático por inadimplência' },
              { icon: '🔄', text: 'Recorrência via Asaas' },
              { icon: '🎯', text: 'Metas + anexos (extratos/comprovantes)' },
            ].map(({ icon, text }) => (
              <li key={text} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)' }}>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Plan footer */}
        <div
          style={{
            marginTop: '48px',
            borderTop: '1px solid rgba(255,255,255,0.15)',
            paddingTop: '20px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
            Plano atual
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
            {selectedPlan.label} — {selectedPlan.price}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
            Código: {planCode}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div
        style={{
          flex: 1,
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          padding: isMobile ? '32px 24px 40px' : '52px 56px 48px',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: '40px',
          }}
        >
          <span style={{ fontSize: '20px', marginRight: '8px' }}>🤖</span>
          <span style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>Assinatura</span>
          <span
            style={{
              position: 'absolute',
              right: 0,
              fontSize: '12px',
              color: '#9ca3af',
              fontFamily: 'monospace',
            }}
          >
            v5.2.2
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '440px', width: '100%', margin: '0 auto' }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}

          {/* Plano */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }} htmlFor="plano">
              Plano
            </label>
            <select
              id="plano"
              name="plano"
              value={form.plano}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value="mensal">Mensal — R$ 39,90</option>
              <option value="anual">Anual — R$ 399,00</option>
            </select>
          </div>

          {/* Nome */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }} htmlFor="nome">
              Nome
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              value={form.nome}
              onChange={handleChange}
              placeholder="Seu nome completo"
              style={inputStyle}
            />
          </div>

          {/* E-mail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }} htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="seu@email.com"
              style={inputStyle}
            />
          </div>

          {/* CPF + Telefone */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }} htmlFor="cpf">
                CPF
              </label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                inputMode="numeric"
                value={form.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }} htmlFor="telefone">
                Telefone
              </label>
              <input
                id="telefone"
                name="telefone"
                type="text"
                inputMode="tel"
                value={form.telefone}
                onChange={handleChange}
                placeholder="(11) 90000-0000"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Cupom */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }} htmlFor="cupomCodigo">
              Cupom
            </label>
            <input
              id="cupomCodigo"
              name="cupomCodigo"
              type="text"
              value={form.cupomCodigo}
              onChange={handleChange}
              placeholder="Opcional"
              style={inputStyle}
            />
            <span style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.5' }}>
              Se o cupom ativar <strong>teste</strong>, o acesso é <strong>liberado na hora</strong>.
            </span>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '13px 24px',
              fontSize: '15px',
              fontWeight: '600',
              color: '#ffffff',
              backgroundColor: loading ? '#93c5fd' : '#1e3a5f',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              width: '100%',
              marginTop: '4px',
            }}
          >
            {loading ? 'Processando...' : 'Assinar agora'}
          </button>

          <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', margin: '0' }}>
            Sem cupom, o acesso é liberado após confirmação do pagamento.
          </p>

          {/* Already have access */}
          <Link
            to="/login"
            style={{
              display: 'block',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#1e3a5f',
              border: '1.5px solid #1e3a5f',
              borderRadius: '8px',
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            Já tenho acesso
          </Link>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: '10px 12px',
  fontSize: '14px',
  color: '#111827',
  backgroundColor: '#ffffff',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};
