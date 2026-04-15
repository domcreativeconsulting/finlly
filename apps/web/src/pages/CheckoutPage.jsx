import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { billingService } from '../services/billing.service.js';
import logoImg from '../assets/logo.png';

// ─── helpers ────────────────────────────────────────────────
function applyMaskCpf(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function applyMaskPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}
function applyMaskCard(v) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
}
function applyMaskExpiry(v) {
  return v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d{1,2})/, '$1/$2');
}

const PLANS = {
  mensal: { label: 'Plano Mensal', price: 'R$ 39,90', value: '39,90', ciclo: 'mensal' },
  anual:  { label: 'Plano Anual',  price: 'R$ 399,00', value: '399,00', ciclo: 'anual'  },
};

// ─── design tokens ──────────────────────────────────────────
const C = {
  bg:       '#070d1d',
  card:     'rgba(19,34,68,0.82)',
  border:   'rgba(171,192,231,0.18)',
  accent:   '#c4e91f',
  accentDk: '#a8cc15',
  ink:      '#dbe7ff',
  inkSoft:  '#9fb2d7',
  input:    'rgba(13,23,51,0.78)',
};

const inputCss = {
  width: '100%',
  padding: '12px 14px',
  fontSize: '14px',
  color: C.ink,
  background: C.input,
  border: `1px solid ${C.border}`,
  borderRadius: '12px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

// ─── main component ─────────────────────────────────────────
export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const initialPlan    = PLANS[searchParams.get('plano')] ? searchParams.get('plano') : 'mensal';

  const [step, setStep]         = useState(1); // 1 = dados, 2 = pagamento, 3 = confirmação
  const [method, setMethod]     = useState('PIX'); // 'PIX' | 'CARTAO'
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [paymentLink, setPaymentLink] = useState(null);

  const [form, setForm] = useState({
    plano: initialPlan,
    nome: '', email: '', cpf: '', telefone: '', cupomCodigo: '',
    cardName: '', cardNumber: '', cardExpiry: '', cardCvv: '',
  });

  const plan = PLANS[form.plano];

  function handleChange(e) {
    const { name, value } = e.target;
    const masks = { cpf: applyMaskCpf, telefone: applyMaskPhone, cardNumber: applyMaskCard, cardExpiry: applyMaskExpiry };
    setForm(p => ({ ...p, [name]: masks[name] ? masks[name](value) : value }));
  }

  // Step 1 → Step 2
  function handleNextStep(e) {
    e.preventDefault();
    setError('');
    if (!form.nome.trim())                          return setError('Nome é obrigatório.');
    if (!form.email.trim())                         return setError('E-mail é obrigatório.');
    if (form.cpf.replace(/\D/g, '').length < 11)   return setError('CPF inválido.');
    if (form.telefone.replace(/\D/g, '').length < 10) return setError('Telefone inválido.');
    setStep(2);
  }

  // Step 2 → confirmar pagamento
  async function handlePay(e) {
    e.preventDefault();
    setError('');

    if (method === 'CARTAO') {
      if (!form.cardName.trim())                           return setError('Nome no cartão obrigatório.');
      if (form.cardNumber.replace(/\D/g, '').length < 16) return setError('Número do cartão inválido.');
      if (form.cardExpiry.replace(/\D/g, '').length < 4)  return setError('Validade inválida.');
      if (form.cardCvv.replace(/\D/g, '').length < 3)     return setError('CVV inválido.');
    }

    setLoading(true);
    try {
      const expiryDigits = form.cardExpiry.replace(/\D/g, '');
      const expiryMonth  = expiryDigits.slice(0, 2);
      const expiryYear   = expiryDigits.length >= 4
        ? `20${expiryDigits.slice(2, 4)}`
        : '';

      const payload = {
        plano:          form.plano,
        ciclo:          plan.ciclo,
        formaPagamento: method === 'PIX' ? 'PIX' : 'CREDIT_CARD',
        nome:           form.nome.trim(),
        email:          form.email.trim(),
        cpf:            form.cpf.replace(/\D/g, ''),
        telefone:       form.telefone.replace(/\D/g, ''),
        ...(form.cupomCodigo.trim() ? { cupomCodigo: form.cupomCodigo.trim() } : {}),
        ...(method === 'CARTAO' ? {
          creditCard: {
            holderName:  form.cardName.trim(),
            number:      form.cardNumber.replace(/\D/g, ''),
            expiryMonth,
            expiryYear,
            ccv:         form.cardCvv.trim(),
          },
          creditCardHolderInfo: {
            name:    form.nome.trim(),
            email:   form.email.trim(),
            cpfCnpj: form.cpf.replace(/\D/g, ''),
            phone:   form.telefone.replace(/\D/g, ''),
          },
        } : {}),
      };

      const res = await billingService.subscribe(payload);
      setPaymentLink(res.paymentLink ?? null);
      toast.success('Assinatura criada com sucesso!');
      setStep(3);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Erro ao processar assinatura.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── render ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: '"IBM Plex Sans", sans-serif', color: C.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 64px' }}>

      {/* Logo */}
      <div style={{ marginBottom: '32px' }}>
        <img src={logoImg} alt="Finlly" style={{ height: '36px' }} />
      </div>

      {/* Stepper */}
      <Stepper step={step} />

      {/* Card */}
      <div style={{ width: '100%', maxWidth: '520px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '24px', padding: '32px', boxShadow: '0 24px 56px rgba(4,10,24,0.65)', marginTop: '28px' }}>

        {step === 1 && <StepDados form={form} handleChange={handleChange} handleNext={handleNextStep} error={error} plan={plan} />}
        {step === 2 && <StepPagamento form={form} method={method} setMethod={setMethod} handlePay={handlePay} error={error} loading={loading} plan={plan} onBack={() => { setStep(1); setError(''); }} handleChange={handleChange} />}
        {step === 3 && <StepConfirmacao paymentLink={paymentLink} method={method} plan={plan} navigate={navigate} />}

      </div>

      {/* Footer */}
      <p style={{ marginTop: '24px', fontSize: '12px', color: C.inkSoft, textAlign: 'center' }}>
        🔒 Pagamento processado com segurança via Asaas · SSL
      </p>
    </div>
  );
}

// ─── Stepper ────────────────────────────────────────────────
function Stepper({ step }) {
  const steps = ['Dados', 'Pagamento', 'Confirmação'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '4px' }}>
      {steps.map((label, i) => {
        const idx   = i + 1;
        const done  = idx < step;
        const active = idx === step;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '700', fontSize: '13px',
                background: done ? C.accent : active ? C.accent : 'rgba(19,34,68,0.9)',
                color: done || active ? '#12203f' : C.inkSoft,
                border: done || active ? 'none' : `1px solid ${C.border}`,
              }}>
                {done ? '✓' : idx}
              </div>
              <span style={{ fontSize: '11px', color: active ? C.accent : C.inkSoft, fontWeight: active ? '700' : '400' }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: '60px', height: '1px', background: i + 1 < step ? C.accent : C.border, margin: '0 8px', marginBottom: '20px' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Dados ──────────────────────────────────────────
function StepDados({ form, handleChange, handleNext, error, plan }) {
  return (
    <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '700', color: C.ink }}>Seus dados</h2>
        <p style={{ margin: 0, fontSize: '13px', color: C.inkSoft }}>Preencha para criar sua conta e assinatura</p>
      </div>

      {error && <ErrorBox msg={error} />}

      {/* Plano */}
      <Field label="Plano">
        <select name="plano" value={form.plano} onChange={handleChange} style={{ ...inputCss, appearance: 'none' }}>
          <option value="mensal">Mensal — R$ 39,90/mês</option>
          <option value="anual">Anual — R$ 399,00/ano</option>
        </select>
      </Field>

      {/* Nome */}
      <Field label="Nome completo">
        <input name="nome" type="text" value={form.nome} onChange={handleChange} placeholder="Seu nome completo" style={inputCss} />
      </Field>

      {/* Email */}
      <Field label="E-mail">
        <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="seu@email.com" style={inputCss} />
      </Field>

      {/* CPF + Telefone */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <Field label="CPF" style={{ flex: 1 }}>
          <input name="cpf" type="text" inputMode="numeric" value={form.cpf} onChange={handleChange} placeholder="000.000.000-00" style={inputCss} />
        </Field>
        <Field label="Telefone" style={{ flex: 1 }}>
          <input name="telefone" type="text" inputMode="tel" value={form.telefone} onChange={handleChange} placeholder="(11) 90000-0000" style={inputCss} />
        </Field>
      </div>

      {/* Cupom */}
      <Field label="Cupom (opcional)">
        <input name="cupomCodigo" type="text" value={form.cupomCodigo} onChange={handleChange} placeholder="Código do cupom" style={inputCss} />
      </Field>

      <BtnPrimary type="submit">
        Continuar → Pagamento
      </BtnPrimary>

      <a href="https://app.finlly.com.br/login" style={{ display: 'block', textAlign: 'center', fontSize: '13px', color: C.inkSoft, textDecoration: 'none', marginTop: '-6px' }}>
        Já tenho uma conta
      </a>
    </form>
  );
}

// ─── Step 2: Pagamento ──────────────────────────────────────
function StepPagamento({ form, method, setMethod, handlePay, error, loading, plan, onBack, handleChange }) {
  return (
    <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Back */}
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', textAlign: 'left', padding: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        ← Voltar
      </button>

      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '700', color: C.ink }}>Pagamento</h2>
        <p style={{ margin: 0, fontSize: '13px', color: C.inkSoft }}>Escolha a forma de pagamento</p>
      </div>

      {/* Resumo do plano */}
      <div style={{ background: 'rgba(13,23,51,0.6)', border: `1px solid ${C.border}`, borderRadius: '14px', padding: '16px' }}>
        <div style={{ fontSize: '11px', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>Resumo</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '15px', color: C.ink, fontWeight: '600' }}>{plan.label}</span>
          <span style={{ fontSize: '20px', fontWeight: '800', color: C.accent, fontFamily: '"Sora", sans-serif' }}>{plan.price}</span>
        </div>
        <div style={{ fontSize: '12px', color: C.inkSoft, marginTop: '4px' }}>Recorrência {plan.ciclo}</div>
      </div>

      {/* Método */}
      <div>
        <div style={{ fontSize: '11px', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Forma de pagamento</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { id: 'PIX',    icon: '🔒', title: 'PIX',    sub: 'Pagamento instantâneo' },
            { id: 'CARTAO', icon: '💳', title: 'Cartão', sub: 'Crédito à vista' },
          ].map(({ id, icon, title, sub }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMethod(id)}
              style={{
                padding: '16px 12px', borderRadius: '14px', cursor: 'pointer', textAlign: 'center',
                background: method === id ? 'rgba(196,233,31,0.12)' : C.input,
                border: `1.5px solid ${method === id ? C.accent : C.border}`,
                color: C.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                transition: 'all .2s',
              }}
            >
              <span style={{ fontSize: '24px' }}>{icon}</span>
              <span style={{ fontWeight: '700', fontSize: '14px' }}>{title}</span>
              <span style={{ fontSize: '11px', color: C.inkSoft }}>{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBox msg={error} />}

      {/* Cartão fields */}
      {method === 'CARTAO' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', background: 'rgba(13,23,51,0.5)', borderRadius: '14px', border: `1px solid ${C.border}` }}>
          <Field label="Nome no cartão">
            <input name="cardName" type="text" value={form.cardName} onChange={handleChange} placeholder="Como está gravado no cartão" style={inputCss} />
          </Field>
          <Field label="Número do cartão">
            <input name="cardNumber" type="text" inputMode="numeric" value={form.cardNumber} onChange={handleChange} placeholder="0000 0000 0000 0000" style={inputCss} />
          </Field>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Field label="Validade" style={{ flex: 1 }}>
              <input name="cardExpiry" type="text" inputMode="numeric" value={form.cardExpiry} onChange={handleChange} placeholder="MM/AA" style={inputCss} />
            </Field>
            <Field label="CVV" style={{ flex: 1 }}>
              <input name="cardCvv" type="text" inputMode="numeric" value={form.cardCvv} onChange={handleChange} placeholder="123" style={inputCss} maxLength={4} />
            </Field>
          </div>
        </div>
      )}

      {/* PIX hint */}
      {method === 'PIX' && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: C.inkSoft, padding: '12px 14px', background: 'rgba(196,233,31,0.06)', border: `1px solid rgba(196,233,31,0.2)`, borderRadius: '12px' }}>
          <span>ℹ️</span>
          <span>Você receberá um QR Code para pagar pelo app do seu banco.</span>
        </div>
      )}

      <BtnPrimary type="submit" disabled={loading}>
        {loading ? 'Processando...' : method === 'PIX' ? `🔒 Gerar QR Code PIX — ${plan.price}` : `🔒 Pagar ${plan.price} com cartão`}
      </BtnPrimary>
    </form>
  );
}

// ─── Step 3: Confirmação ────────────────────────────────────
function StepConfirmacao({ paymentLink, method, plan, navigate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(196,233,31,0.15)', border: `2px solid ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
        ✓
      </div>

      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '700', color: C.ink }}>
          {method === 'PIX' ? 'Quase lá! Pague via PIX' : 'Assinatura criada!'}
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: C.inkSoft }}>
          {method === 'PIX'
            ? 'Clique no botão abaixo para abrir a página de pagamento PIX gerada pela Asaas.'
            : 'Seu pagamento foi enviado para processamento. Você receberá um e-mail de confirmação.'}
        </p>
      </div>

      {/* Resumo */}
      <div style={{ width: '100%', background: 'rgba(13,23,51,0.6)', border: `1px solid ${C.border}`, borderRadius: '14px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: C.inkSoft }}>{plan.label}</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: C.accent }}>{plan.price}</span>
        </div>
        <div style={{ fontSize: '12px', color: C.inkSoft, marginTop: '4px' }}>Recorrência {plan.ciclo} · Via {method === 'PIX' ? 'PIX' : 'Cartão'}</div>
      </div>

      {method === 'PIX' && paymentLink && (
        <a
          href={paymentLink}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            width: '100%', padding: '14px 20px', borderRadius: '999px',
            background: `linear-gradient(130deg, ${C.accent}, #d6f35d)`,
            color: '#12203f', fontWeight: '700', fontSize: '15px', textDecoration: 'none',
            boxShadow: '0 10px 24px rgba(196,233,31,0.28)',
          }}
        >
          🔒 Abrir página de pagamento PIX
        </a>
      )}

      {method === 'PIX' && !paymentLink && (
        <div style={{ fontSize: '13px', color: C.inkSoft, padding: '12px', background: 'rgba(196,233,31,0.06)', borderRadius: '12px', border: `1px solid rgba(196,233,31,0.2)` }}>
          ⏳ Aguardando geração do link de pagamento...
        </div>
      )}

      <button
        onClick={() => navigate('/login')}
        style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px 24px', color: C.inkSoft, cursor: 'pointer', fontSize: '13px', width: '100%' }}
      >
        Já paguei — Acessar minha conta
      </button>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────
function Field({ label, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      <label style={{ fontSize: '12px', fontWeight: '600', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
      {children}
    </div>
  );
}

function BtnPrimary({ children, ...props }) {
  return (
    <button
      {...props}
      style={{
        width: '100%', padding: '14px 20px', borderRadius: '999px', border: 'none', cursor: props.disabled ? 'not-allowed' : 'pointer',
        background: props.disabled ? 'rgba(196,233,31,0.4)' : `linear-gradient(130deg, ${C.accent}, #d6f35d)`,
        color: '#12203f', fontWeight: '700', fontSize: '15px',
        boxShadow: props.disabled ? 'none' : '0 10px 24px rgba(196,233,31,0.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        transition: 'all .2s',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{ padding: '12px 14px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.35)', borderRadius: '10px', color: '#fca5a5', fontSize: '13px' }}>
      ⚠️ {msg}
    </div>
  );
}
