import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldHalved, faArrowsRotate, faBullseye } from '@fortawesome/free-solid-svg-icons';
import { billingService } from '../services/billing.service.js';
import { useAuth } from '../hooks/useAuth.js';
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
  mensal: { label: 'Mensal — R$ 39,90', price: 'R$ 39,90', value: '39,90', ciclo: 'mensal', full: 'MENSAL — R$ 39,90' },
  anual:  { label: 'Anual — R$ 399,00', price: 'R$ 399,00', value: '399,00', ciclo: 'anual', full: 'ANUAL — R$ 399,00' },
};

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

const inputCssDark = {
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

const inputCss = {
  width: '100%',
  padding: '11px 13px',
  fontSize: '15px',
  color: '#111827',
  background: '#ffffff',
  border: '1.5px solid #d1d5db',
  borderRadius: '6px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const EMAIL_DUPLICADO = 'EMAIL_DUPLICADO';
const SENHA_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { register: authRegister, login, usuario, isAuthenticated, isLoading } = useAuth();
  const initialPlan    = PLANS[searchParams.get('plano')] ? searchParams.get('plano') : 'mensal';

  // Fluxo: 1 = Dados (só validação), 2 = Pagamento (cria conta + paga), 3 = Confirmação + verificação de e-mail
  const stepParam = parseInt(searchParams.get('step') ?? '', 10);
const initialStep = Number.isInteger(stepParam) && stepParam >= 1 ? stepParam : 1;
const [step, setStep] = useState(initialStep);
  const [method, setMethod]               = useState('PIX');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [paymentLink, setPaymentLink]     = useState(null);
  const [pixQrCode, setPixQrCode]         = useState(null);
  const [pixCopiaECola, setPixCopiaECola] = useState(null);
  const [isMobile, setIsMobile]           = useState(false);
  // Polling / waiting payment state
const [waitingPayment, setWaitingPayment] = useState(false);
const [paymentPollingError, setPaymentPollingError] = useState(null);
const paymentPollRef = useRef(null);

// polling constants (ajuste se quiser)
const POLL_INTERVAL = 5000; // 5s
const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

  const [form, setForm] = useState({
    plano: initialPlan,
    nome: '', email: '', cpf: '', telefone: '', cupomCodigo: '',
    senha: '', confirmarSenha: '',
    cardName: '', cardNumber: '', cardExpiry: '', cardCvv: '',
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    let timer;
    const handleResize = () => { clearTimeout(timer); timer = setTimeout(checkMobile, 150); };
    window.addEventListener('resize', handleResize);
    return () => { clearTimeout(timer); window.removeEventListener('resize', handleResize); };
  }, []);

useEffect(() => {
  const stepParam = parseInt(searchParams.get('step') ?? '', 10);
  const wantsStep2 = Number.isInteger(stepParam) && stepParam === 2;

  // Se ainda estamos carregando info do auth, espere
  if (wantsStep2 && isLoading) return;

  // Se quer abrir o passo 2 e NÃO está autenticado -> manda pra login
  if (wantsStep2 && !isAuthenticated) {
    const next = `/checkout${window.location.search || ''}`;
    navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
  }
}, [searchParams, isAuthenticated, isLoading, navigate]);

  useEffect(() => {
  if (!usuario) return;
  setForm(prev => ({
    ...prev,
    nome: usuario.nome ?? prev.nome,
    email: usuario.email ?? prev.email,
    cpf: usuario.cpf ?? prev.cpf ?? '',
    telefone: usuario.telefone ?? prev.telefone ?? '',
  }));
}, [usuario]);

  useEffect(() => {
  return () => {
    if (paymentPollRef.current) {
      window.clearInterval(paymentPollRef.current);
      paymentPollRef.current = null;
    }
  };
}, []);

  const plan = PLANS[form.plano] ?? PLANS.mensal;

  function handleChange(e) {
    const { name, value } = e.target;
    const masks = { cpf: applyMaskCpf, telefone: applyMaskPhone, cardNumber: applyMaskCard, cardExpiry: applyMaskExpiry };
    setForm(p => ({ ...p, [name]: masks[name] ? masks[name](value) : value }));
  }

  // ─── Step 1: apenas valida os campos e avança ───────────────
  function handleNextStep(e) {
    e.preventDefault();
    setError('');
    if (!form.nome.trim())                             return setError('Nome é obrigatório.');
    if (!form.email.trim())                            return setError('E-mail é obrigatório.');
    if (form.cpf.replace(/\D/g, '').length < 11)      return setError('CPF inválido.');
    if (form.telefone.replace(/\D/g, '').length < 10) return setError('Telefone inválido.');
    if (!form.senha)                                   return setError('Senha é obrigatória.');
    if (!SENHA_REGEX.test(form.senha))                 return setError('Senha deve ter no mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 especial (!@#$%^&*).');
    if (!form.confirmarSenha)                          return setError('Confirme sua senha.');
    if (form.senha !== form.confirmarSenha)            return setError('As senhas não conferem.');
    setStep(2);
  }

  // ─── Step 2: cria conta, faz login silencioso e processa pagamento ─
async function handlePay(e) {
  e.preventDefault();
  setError('');

  

  // validações do formulário (ex.: cartão)
  if (method === 'CARTAO') {
    if (!form.cardName.trim()) return setError('Nome no cartão obrigatório.');
    if (form.cardNumber.replace(/\D/g, '').length < 16) return setError('Número do cartão inválido.');
    if (form.cardExpiry.replace(/\D/g, '').length < 4) return setError('Validade inválida.');
    if (form.cardCvv.replace(/\D/g, '').length < 3) return setError('CVV inválido.');
  }

  // evita submissão enquanto o AuthProvider ainda está resolvendo a sessão
  if (isLoading) {
    setError('Aguarde um momento enquanto verificamos sua sessão. Tente novamente em alguns segundos.');
    return;
  }

  setLoading(true);
try {
    // Se não autenticado, criar conta e logar; caso contrário pular
    if (!isAuthenticated) {
      // validação extra para evitar enviar campos vazios ao /auth/register
      if (!form.nome.trim() || !form.email.trim() || !form.senha) {
        throw new Error('Dados de cadastro incompletos. Preencha nome, e-mail e senha.');
      }
      await authRegister(form.nome.trim(), form.email.trim(), form.senha);
      await login(form.email.trim(), form.senha);
    }

    // --- Processar pagamento (igual ao que você já tinha) ---
    const expiryDigits = (form.cardExpiry || '').replace(/\D/g, '');
const payloadBase = {
  plano: form.plano,
  ciclo: plan.ciclo,
  formaPagamento: method === 'PIX' ? 'PIX' : 'CREDIT_CARD',
  nome: (form.nome || '').trim() || usuario?.nome || '',
  email: (form.email || '').trim() || usuario?.email || '',
  cpf: (form.cpf || '').replace(/\D/g, '') || usuario?.cpf || '',
  telefone: (form.telefone || '').replace(/\D/g, '') || usuario?.telefone || '',
  ...(form.cupomCodigo?.trim() ? { cupomCodigo: form.cupomCodigo.trim() } : {}),
};

  if (!payloadBase.nome || payloadBase.nome.length < 3) {
  throw new Error('Nome inválido. Por favor complete seu nome no formulário.');
}
if (!payloadBase.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payloadBase.email)) {
  throw new Error('E-mail inválido. Por favor verifique seu e-mail no formulário.');
}

    let payload = { ...payloadBase };

    if (method === 'CARTAO') {
      const creditCard = {
        holderName: form.cardName.trim(),
        number: form.cardNumber.replace(/\D/g, ''),
        expiryMonth: expiryDigits.slice(0, 2),
        expiryYear: `20${expiryDigits.slice(2, 4)}`,
        ccv: form.cardCvv.trim(),
      };
      const creditCardHolderInfo = {
        name: form.nome.trim() || usuario?.nome || '',
        email: form.email.trim() || usuario?.email || '',
        cpfCnpj: form.cpf.replace(/\D/g, '') || usuario?.cpf || '',
        phone: form.telefone.replace(/\D/g, '') || usuario?.telefone || '',
      };
      payload = { ...payload, creditCard, creditCardHolderInfo };
    }

    const res = await billingService.subscribe(payload);

// salva links/QR na UI
setPaymentLink(res.paymentLink ?? null);
setPixQrCode(res.pixQrCode ?? null);
setPixCopiaECola(res.pixCopiaECola ?? null);
toast.success('Assinatura criada com sucesso!');

// Ir para a tela de confirmação/QR
setStep(3);

// iniciar polling para aguardar confirmação do pagamento
setWaitingPayment(true);
setPaymentPollingError(null);

// limpa qualquer polling anterior
if (paymentPollRef.current) {
  window.clearInterval(paymentPollRef.current);
  paymentPollRef.current = null;
}

let elapsed = 0;
paymentPollRef.current =  window.setInterval(async () => {
  try {
    // Chame o endpoint de status da sua API. Aqui uso billingService.getStatus()
    // Ajuste se sua API precisar de subscriptionId/paymentId (ex.: billingService.getStatus(res.id))
    const statusRes = await billingService.getStatus();
    const assinanteAtual = statusRes.assinante ?? null;

    // ajuste condição conforme o formato real do backend
    const isPaid = Boolean(
      assinanteAtual &&
      (
        assinanteAtual.status === 'ativo' ||
        String(assinanteAtual.asaasStatus || '').toLowerCase().includes('pago') ||
        String(assinanteAtual.status || '').toLowerCase().includes('pago')
      )
    );

    if (isPaid) {
      window.clearInterval(paymentPollRef.current);
      paymentPollRef.current = null;
      setWaitingPayment(false);
toast.success('Pagamento confirmado! Faça login para acessar o sistema.');
navigate('/login', { replace: true });
    }

    elapsed += POLL_INTERVAL;
    if (elapsed >= PAYMENT_TIMEOUT_MS) {
      window.clearInterval(paymentPollRef.current);
      paymentPollRef.current = null;
      setWaitingPayment(false);
      setPaymentPollingError('Não foi possível confirmar o pagamento automaticamente. Verifique após alguns minutos ou entre em contato com o suporte.');
      toast.warn('Ainda sem confirmação de pagamento. Verifique seu e-mail ou tente novamente.');
    }
  } catch (err) {
    console.error('Erro no polling de pagamento:', err);
    // não cancela o polling em erros transitórios; opcionalmente marque paymentPollingError
  }
}, POLL_INTERVAL);
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || 'Erro ao processar. Verifique os dados e tente novamente.';
    setError(msg);
    toast.error(msg);
  } finally {
    setLoading(false);
  }
}

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: '"Inter", "Helvetica Neue", sans-serif' }}>

      {/* ── Left Panel ── */}
      {!isMobile && (
        <div style={{
          flex: '0 0 42%',
          background: '#0f1f3d',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '40px 48px',
          color: '#ffffff',
          overflowY: 'auto',
        }}>
          <div>
            <img src={logoImg} alt="Finlly" style={{ height: '40px' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#ffffff', lineHeight: 1.35, margin: '0 0 12px' }}>
              Gestão financeira pessoal.
            </h2>
            <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: '0 0 32px' }}>
              Contas fixas e variáveis, recebimentos, investimentos e metas — com apoio do agente.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { icon: faShieldHalved, text: 'Bloqueio automático por inadimplência' },
                { icon: faArrowsRotate, text: 'Recorrência via Asaas' },
                { icon: faBullseye,     text: 'Metas + anexos (extratos/comprovantes)' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ minWidth: '24px', display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.8)' }}>
                    <FontAwesomeIcon icon={icon} style={{ fontSize: '18px' }} />
                  </span>
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '24px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '6px' }}>
              PLANO ATUAL
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>
              {plan.full}
            </div>
          </div>
        </div>
      )}

      {/* ── Right Panel ── */}
      <div style={{
        flex: 1,
        backgroundColor: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: isMobile ? '24px 20px' : '48px 56px',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src={logoImg} alt="Finlly" style={{ height: '28px' }} />
              <span style={{ fontSize: '22px', fontWeight: '700', color: '#111827' }}>Assinatura</span>
            </div>
            {/* Indicador de etapa */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {[1, 2, 3].map(s => (
                <div key={s} style={{
                  width: s === step ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: s === step ? '#1e3a5f' : s < step ? '#c4e91f' : '#e5e7eb',
                  transition: 'all 0.3s',
                }} />
              ))}
            </div>
          </div>

          {/* Step 1 — Dados */}
          {step === 1 && (
            <StepDados
              form={form}
              handleChange={handleChange}
              handleNext={handleNextStep}
              error={error}
              plan={plan}
            />
          )}

          {/* Step 2 — Pagamento */}
          {step === 2 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', boxShadow: '0 20px 48px rgba(4,10,24,0.55)' }}>
<StepPagamento
  form={form} method={method} setMethod={setMethod}
  handlePay={handlePay} error={error} loading={loading}
  plan={plan} onBack={() => { setStep(1); setError(''); }}
  handleChange={handleChange}
  waitingPayment={waitingPayment}
/>
            </div>
          )}

          {/* Step 3 — Confirmação */}
          {step === 3 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', boxShadow: '0 20px 48px rgba(4,10,24,0.55)' }}>
<StepConfirmacao
  paymentLink={paymentLink}
  pixQrCode={pixQrCode}
  pixCopiaECola={pixCopiaECola}
  method={method}
  plan={plan}
  email={form.email}
  navigate={navigate}
  waitingPayment={waitingPayment}
  paymentPollingError={paymentPollingError}
/>
            </div>
          )}

          <p style={{ marginTop: '20px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
            🔒 Pagamento processado com segurança via Asaas · SSL
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Dados ──────────────────────────────────────────
function StepDados({ form, handleChange, handleNext, error }) {
  return (
    <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {error && (
        <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '14px' }}>
          ⚠️{' '}
          {error === EMAIL_DUPLICADO
            ? <Link to="/login" style={{ color: '#dc2626', fontWeight: '600', textDecoration: 'underline' }}>E-mail já cadastrado. Faça login para assinar.</Link>
            : error}
        </div>
      )}

      <FieldLight label="Plano">
        <div style={{ position: 'relative' }}>
          <select
            name="plano"
            value={form.plano}
            onChange={handleChange}
            style={{ ...inputCss, appearance: 'none', paddingRight: '36px', cursor: 'pointer' }}
          >
            <option value="mensal">Mensal — R$ 39,90</option>
            <option value="anual">Anual — R$ 399,00</option>
          </select>
          <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280', fontSize: '14px' }}>▾</span>
        </div>
      </FieldLight>

      <FieldLight label="Nome">
        <input name="nome" type="text" value={form.nome} onChange={handleChange} placeholder="Seu nome completo" style={inputCss} />
      </FieldLight>

      <FieldLight label="E-mail">
        <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="seu@email.com" style={inputCss} />
      </FieldLight>

      <FieldLight label="Senha">
        <input name="senha" type="password" value={form.senha} onChange={handleChange} placeholder="Mínimo 8 caracteres" style={inputCss} />
      </FieldLight>

      <FieldLight label="Confirmar Senha">
        <input name="confirmarSenha" type="password" value={form.confirmarSenha} onChange={handleChange} placeholder="Repita sua senha" style={inputCss} />
      </FieldLight>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <FieldLight label="CPF">
          <input name="cpf" type="text" inputMode="numeric" value={form.cpf} onChange={handleChange} placeholder="000.000.000-00" style={inputCss} />
        </FieldLight>
        <FieldLight label="Telefone">
          <input name="telefone" type="text" inputMode="tel" value={form.telefone} onChange={handleChange} placeholder="(11) 90000-0000" style={inputCss} />
        </FieldLight>
      </div>

      <FieldLight label="Cupom">
        <input name="cupomCodigo" type="text" value={form.cupomCodigo} onChange={handleChange} placeholder="Opcional" style={inputCss} />
        <span style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
          Se o cupom ativar <strong>teste</strong>, o acesso é <strong>liberado na hora</strong>.
        </span>
      </FieldLight>

      <button
        type="submit"
        style={{
          width: '100%', padding: '14px', fontSize: '16px', fontWeight: '600',
          color: '#ffffff',
          background: '#1e3a5f',
          border: 'none', borderRadius: '6px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginTop: '4px',
        }}
      >
        Assinar agora →
      </button>

      <button
        type="button"
        onClick={() => window.location.href = '/login'}
        style={{
          width: '100%', padding: '13px', fontSize: '15px', fontWeight: '500',
          color: '#374151', background: '#ffffff',
          border: '1.5px solid #d1d5db', borderRadius: '6px',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Já tenho acesso
      </button>

      <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', margin: 0 }}>
        O acesso é liberado após confirmação do pagamento.
      </p>
    </form>
  );
}

// ─── Step 2: Pagamento ──────────────────────────────────────
function StepPagamento({ form, method, setMethod, handlePay, error, loading, plan, onBack, handleChange, waitingPayment }) {
  return (
    <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: C.inkSoft, cursor: 'pointer', textAlign: 'left', padding: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        ← Voltar
      </button>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '700', color: C.ink }}>Pagamento</h2>
        <p style={{ margin: 0, fontSize: '13px', color: C.inkSoft }}>Escolha a forma de pagamento</p>
      </div>
      <div style={{ background: 'rgba(13,23,51,0.6)', border: `1px solid ${C.border}`, borderRadius: '14px', padding: '16px' }}>
        <div style={{ fontSize: '11px', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>Resumo</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '15px', color: C.ink, fontWeight: '600' }}>{plan.label}</span>
          <span style={{ fontSize: '20px', fontWeight: '800', color: C.accent }}>{plan.price}</span>
        </div>
        <div style={{ fontSize: '12px', color: C.inkSoft, marginTop: '4px' }}>Recorrência {plan.ciclo}</div>
      </div>
      <div>
        <div style={{ fontSize: '11px', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Forma de pagamento</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { id: 'PIX',    icon: '🔒', title: 'PIX',    sub: 'Pagamento instantâneo' },
            { id: 'CARTAO', icon: '💳', title: 'Cartão', sub: 'Crédito à vista' },
          ].map(({ id, icon, title, sub }) => (
            <button key={id} type="button" onClick={() => setMethod(id)} style={{
              padding: '16px 12px', borderRadius: '14px', cursor: 'pointer', textAlign: 'center',
              background: method === id ? 'rgba(196,233,31,0.12)' : C.input,
              border: `1.5px solid ${method === id ? C.accent : C.border}`,
              color: C.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
            }}>
              <span style={{ fontSize: '24px' }}>{icon}</span>
              <span style={{ fontWeight: '700', fontSize: '14px' }}>{title}</span>
              <span style={{ fontSize: '11px', color: C.inkSoft }}>{sub}</span>
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div style={{ padding: '12px 14px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.35)', borderRadius: '10px', color: '#fca5a5', fontSize: '13px' }}>
          ⚠️ {error === EMAIL_DUPLICADO
            ? <Link to="/login" style={{ color: '#fca5a5', fontWeight: '600', textDecoration: 'underline' }}>E-mail já cadastrado. Faça login para assinar.</Link>
            : error}
        </div>
      )}
      {method === 'CARTAO' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', background: 'rgba(13,23,51,0.5)', borderRadius: '14px', border: `1px solid ${C.border}` }}>
          <Field label="Nome no cartão"><input name="cardName" type="text" value={form.cardName} onChange={handleChange} placeholder="Como está gravado no cartão" style={inputCssDark} /></Field>
          <Field label="Número do cartão"><input name="cardNumber" type="text" inputMode="numeric" value={form.cardNumber} onChange={handleChange} placeholder="0000 0000 0000 0000" style={inputCssDark} /></Field>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Field label="Validade" style={{ flex: 1 }}><input name="cardExpiry" type="text" inputMode="numeric" value={form.cardExpiry} onChange={handleChange} placeholder="MM/AA" style={inputCssDark} /></Field>
            <Field label="CVV" style={{ flex: 1 }}><input name="cardCvv" type="text" inputMode="numeric" value={form.cardCvv} onChange={handleChange} placeholder="123" style={inputCssDark} maxLength={4} /></Field>
          </div>
        </div>
      )}
      {method === 'PIX' && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: C.inkSoft, padding: '12px 14px', background: 'rgba(196,233,31,0.06)', border: `1px solid rgba(196,233,31,0.2)`, borderRadius: '10px' }}>
          <span>ℹ️</span>
          <span>O QR Code PIX será gerado na próxima tela para você escanear ou copiar o código.</span>
        </div>
      )}
      <button type="submit" disabled={loading || Boolean(waitingPayment)} style={{
        width: '100%', padding: '14px 20px', borderRadius: '999px', border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        background: loading ? 'rgba(196,233,31,0.4)' : `linear-gradient(130deg, ${C.accent}, #d6f35d)`,
        color: '#12203f', fontWeight: '700', fontSize: '15px',
        boxShadow: loading ? 'none' : '0 10px 24px rgba(196,233,31,0.28)',
        fontFamily: 'inherit',
      }}>
        {loading
          ? method === 'PIX' ? 'Gerando QR Code...' : 'Processando pagamento...'
          : method === 'PIX' ? `🔒 Gerar QR Code PIX — ${plan.price}` : `🔒 Pagar ${plan.price} com cartão`}
      </button>
    </form>
  );
}

// ─── Step 3: Confirmação ────────────────────────────────────
// ALTERAÇÃO: recebe `email` para exibir o aviso de verificação de e-mail.
// Botão principal agora redireciona para /login (não mais /dashboard),
// pois o acesso só é liberado após PAYMENT_CONFIRMED via webhook.
function StepConfirmacao({ paymentLink, pixQrCode, pixCopiaECola, method, plan, email, navigate, waitingPayment, paymentPollingError }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!pixCopiaECola) return;
    navigator.clipboard.writeText(pixCopiaECola).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(196,233,31,0.15)', border: `2px solid ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
        {method === 'PIX' ? '🔒' : '✅'}
      </div>

      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '700', color: C.ink }}>
          {method === 'PIX' ? 'Pague via PIX' : 'Assinatura criada!'}
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: C.inkSoft }}>
          {method === 'PIX'
            ? 'Escaneie o QR Code ou copie o código para pagar.'
            : 'Seu pagamento foi enviado para processamento.'}
        </p>
      </div>

      {/* Aguardando pagamento */}
{waitingPayment && (
  <div style={{ width: '100%', marginTop: 12, padding: '12px', background: 'rgba(255,245,235,0.9)', borderRadius: 12, border: '1px solid #f5c6a5', color: '#7a3b00', textAlign: 'center' }}>
    <strong>Aguardando pagamento...</strong>
    <div style={{ fontSize: 13, marginTop: 6 }}>Assim que o pagamento for confirmado, atualizaremos seu acesso automaticamente.</div>
  </div>
)}

{paymentPollingError && (
  <div style={{ width: '100%', marginTop: 12, padding: '12px', background: 'rgba(254,226,226,0.9)', borderRadius: 12, border: '1px solid #fca5a5', color: '#991b1b', textAlign: 'center' }}>
    {paymentPollingError}
  </div>
)}

      {/* Resumo */}
      <div style={{ width: '100%', background: 'rgba(13,23,51,0.6)', border: `1px solid ${C.border}`, borderRadius: '14px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: C.inkSoft }}>{plan.label}</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: C.accent }}>{plan.price}</span>
        </div>
        <div style={{ fontSize: '12px', color: C.inkSoft, marginTop: '4px' }}>
          Recorrência {plan.ciclo} · Via {method === 'PIX' ? 'PIX' : 'Cartão'}
        </div>
      </div>

      {/* QR Code PIX */}
      {method === 'PIX' && pixQrCode && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
          <div style={{ background: '#ffffff', padding: '12px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <img
              src={`data:image/png;base64,${pixQrCode}`}
              alt="QR Code PIX"
              style={{ width: '200px', height: '200px', display: 'block' }}
            />
          </div>

          {pixCopiaECola && (
            <div style={{ width: '100%' }}>
              <div style={{
                background: 'rgba(13,23,51,0.6)',
                border: `1px solid ${C.border}`,
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '11px',
                color: C.inkSoft,
                wordBreak: 'break-all',
                textAlign: 'left',
                marginBottom: '8px',
                maxHeight: '60px',
                overflow: 'hidden',
                userSelect: 'all',
              }}>
                {pixCopiaECola}
              </div>
              <button
                onClick={handleCopy}
                style={{
                  width: '100%', padding: '13px 20px', borderRadius: '999px', border: 'none',
                  cursor: 'pointer',
                  background: copied ? 'rgba(196,233,31,0.3)' : `linear-gradient(130deg, ${C.accent}, #d6f35d)`,
                  color: '#12203f', fontWeight: '700', fontSize: '15px',
                  boxShadow: copied ? 'none' : '0 10px 24px rgba(196,233,31,0.28)',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
              >
                {copied ? '✅ Código copiado!' : '📋 Copiar código PIX'}
              </button>
            </div>
          )}

          {paymentLink && (
            <a
              href={paymentLink}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '13px', color: C.inkSoft, textDecoration: 'underline' }}
            >
              Prefere pagar pelo navegador? Clique aqui
            </a>
          )}
        </div>
      )}

      {method === 'PIX' && !pixQrCode && !pixCopiaECola && paymentLink && (
        <a href={paymentLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px 20px', borderRadius: '999px', border: 'none', cursor: 'pointer', background: `linear-gradient(130deg, ${C.accent}, #d6f35d)`, color: '#12203f', fontWeight: '700', fontSize: '15px', textDecoration: 'none' }}>
          🔒 Abrir página de pagamento PIX
        </a>
      )}

      {method === 'PIX' && !pixQrCode && !pixCopiaECola && !paymentLink && (
        <div style={{ fontSize: '13px', color: C.inkSoft, padding: '12px', background: 'rgba(196,233,31,0.06)', borderRadius: '12px', border: `1px solid rgba(196,233,31,0.2)`, width: '100%' }}>
          ⏳ Aguardando geração do QR Code...
        </div>
      )}

      {method !== 'PIX' && (
        <div style={{ fontSize: '13px', color: C.inkSoft, padding: '12px', background: 'rgba(196,233,31,0.06)', borderRadius: '12px', border: `1px solid rgba(196,233,31,0.2)`, width: '100%' }}>
          ✅ Pagamento enviado para processamento. Você receberá um e-mail de confirmação.
        </div>
      )}

      {/* ── Aviso de verificação de e-mail ── */}
      <div style={{
        width: '100%',
        padding: '16px',
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid rgba(171,192,231,0.25)`,
        borderRadius: '14px',
        textAlign: 'left',
      }}>
        <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '700', color: C.ink }}>
          ✉️ Verifique seu e-mail para ativar sua conta
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: C.inkSoft, lineHeight: 1.6 }}>
          Enviamos um link de confirmação para <strong style={{ color: C.ink }}>{email}</strong>.
          Clique no link antes de fazer login. Verifique também a pasta de spam.
        </p>
      </div>

      {/* ── Botão principal: ir para login ── */}
      {/* ALTERAÇÃO: redireciona para /login (não /dashboard).
          O acesso ao sistema só é liberado após PAYMENT_CONFIRMED via webhook Asaas. */}
      <button
        onClick={() => navigate('/dashboard', { replace: true })}
        style={{
          width: '100%', padding: '14px 20px', borderRadius: '999px', border: 'none',
          cursor: 'pointer',
          background: `linear-gradient(130deg, ${C.accent}, #d6f35d)`,
          color: '#12203f', fontWeight: '700', fontSize: '15px',
          boxShadow: '0 10px 24px rgba(196,233,31,0.28)',
          fontFamily: 'inherit',
        }}
      >
        Ir para Login →
      </button>

      <p style={{ fontSize: '11px', color: C.inkSoft, margin: 0 }}>
        Você será redirecionado automaticamente após o pagamento.
      </p>
    </div>
  );
}

// ─── Field helpers ───────────────────────────────────────────
function Field({ label, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      <label style={{ fontSize: '12px', fontWeight: '600', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
      {children}
    </div>
  );
}

function FieldLight({ label, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...style }}>
      <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>{label}</label>
      {children}
    </div>
  );
}
