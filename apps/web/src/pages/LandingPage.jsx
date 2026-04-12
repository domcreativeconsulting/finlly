import { useState } from 'react';
import { Link } from 'react-router-dom';

const colors = {
  bg: '#0d1117',
  bgCard: '#111827',
  bgCardAlt: '#1a2236',
  accent: '#c8f135',
  accentHover: '#b8e020',
  white: '#ffffff',
  muted: '#94a3b8',
  border: '#1e293b',
};

const tickerItems = [
  'Histórico rastreável',
  'Rotina semanal automatizada',
  'Proteção de dados',
  'Monitoramento de metas',
  'Método orientado à execução',
  'Criptografia em trânsito',
];

const features = [
  {
    icon: '💳',
    title: 'Contas e vencimentos',
    desc: 'Centralize despesas fixas e variáveis com linha do tempo para vencer no prazo certo.',
  },
  {
    icon: '🎯',
    title: 'Metas e aportes',
    desc: 'Defina objetivo, valor e prazo. A Finlly te conduz em micro-ações executáveis.',
  },
  {
    icon: '📎',
    title: 'Anexos inteligentes',
    desc: 'Comprovantes e extratos organizados por contexto para consulta rápida e segura.',
  },
  {
    icon: '💬',
    title: 'Entrada pelo WhatsApp',
    desc: 'Você fala naturalmente, a Finlly interpreta e transforma em execução concreta.',
  },
  {
    icon: '📋',
    title: 'CRM financeiro pessoal',
    desc: 'Histórico das decisões e tarefas para manter constância ao longo do ano.',
  },
  {
    icon: '📊',
    title: 'Revisão mensal guiada',
    desc: 'Análise de desempenho com ajustes de rota para você continuar evoluindo.',
  },
];

const metodoCards = [
  { icon: '🚀', title: 'Onboarding rápido', desc: 'Primeiras contas e metas em menos de 10 minutos.' },
  { icon: '🔔', title: 'Alertas acionáveis', desc: 'Notificação com ação prática, sem ruído.' },
  { icon: '🔒', title: 'Privacidade', desc: 'Processos e camadas de segurança para dados pessoais.' },
  { icon: '📈', title: 'Evolução contínua', desc: 'Ajustes táticos para bater metas sem sufoco.' },
];

const testimonials = [
  {
    text: 'Saí da desorganização total. Hoje eu sei exatamente o que vence e quanto posso aportar sem estresse.',
    author: 'Mariana Alves',
    role: 'empreendedora',
  },
  {
    text: 'O grande diferencial é a rotina. A Finlly me lembra, registra e me mantém em ação sem fricção.',
    author: 'Rafael Monteiro',
    role: 'consultor comercial',
  },
  {
    text: 'Em poucos meses eu construo consistência que não consegui em anos com apps tradicionais.',
    author: 'Bianca Torres',
    role: 'gerente de projetos',
  },
];

const faqItems = [
  {
    q: 'A Finlly é apenas um bot?',
    a: 'Não. A Finlly é uma plataforma completa de organização financeira que usa o WhatsApp como canal de entrada. Por trás, há um sistema estruturado com metas, contas, anexos, histórico e revisões mensais.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim. Você pode cancelar sua assinatura a qualquer momento, sem multas ou taxas adicionais. Seu acesso continua até o fim do período pago.',
  },
  {
    q: 'Quais áreas eu consigo controlar?',
    a: 'Contas a pagar, recebimentos, metas de poupança, anexos de comprovantes, extrato de movimentações, categorias e relatórios mensais — tudo integrado e acessível pelo WhatsApp ou pelo painel web.',
  },
];

const chatMessages = [
  { from: 'user', text: 'Paguei o aluguel hoje, R$ 1.800' },
  { from: 'bot', text: '✅ Registrado! Aluguel R$ 1.800 — vencimento atualizado.' },
  { from: 'user', text: 'Qual minha meta de reserva esse mês?' },
  { from: 'bot', text: '🎯 Meta: R$ 500. Você já aportou R$ 320. Faltam R$ 180.' },
  { from: 'user', text: 'Me lembra na sexta sobre o cartão' },
  { from: 'bot', text: '🔔 Lembrete criado para sexta-feira — Cartão de crédito.' },
];

function toAnchorId(label) {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function LandingPage() {
  const [faqOpen, setFaqOpen] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function toggleFaq(idx) {
    setFaqOpen(faqOpen === idx ? null : idx);
  }

  return (
    <div style={{ background: colors.bg, color: colors.white, fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes float1 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .ticker-track {
          display: flex;
          gap: 0;
          animation: ticker 28s linear infinite;
          width: max-content;
        }
        .ticker-track:hover { animation-play-state: paused; }
        .float-card-1 { animation: float1 3.5s ease-in-out infinite; }
        .float-card-2 { animation: float2 4s ease-in-out infinite 0.5s; }
        .float-card-3 { animation: float1 3s ease-in-out infinite 1s; }
        .nav-link:hover { color: ${colors.accent} !important; }
        .btn-outline:hover { background: rgba(255,255,255,0.08) !important; }
        .btn-accent:hover { background: ${colors.accentHover} !important; }
        .feature-card:hover { border-color: ${colors.accent} !important; transform: translateY(-3px); transition: all 0.2s; }
        .plan-card:hover { transform: translateY(-4px); transition: all 0.25s; }
        .faq-item { border-bottom: 1px solid ${colors.border}; }
        .faq-question { cursor: pointer; padding: 18px 0; display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: 500; }
        .faq-question:hover { color: ${colors.accent}; }
        @media (max-width: 768px) {
          .hero-grid { flex-direction: column !important; }
          .features-grid { grid-template-columns: 1fr 1fr !important; }
          .method-grid { flex-direction: column !important; }
          .plans-grid { flex-direction: column !important; align-items: center !important; }
          .testimonials-grid { flex-direction: column !important; }
          .nav-links-desktop { display: none !important; }
          .nav-ctas-desktop { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .plan-card { width: 100% !important; max-width: 380px; }
        }
        @media (max-width: 520px) {
          .features-grid { grid-template-columns: 1fr !important; }
          .method-small-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* NAVBAR */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(13,17,23,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: '64px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>⚡</span>
          <span style={{ fontWeight: 800, fontSize: '20px', color: colors.white, letterSpacing: '-0.5px' }}>Finlly</span>
        </div>
        <div className="nav-links-desktop" style={{ display: 'flex', gap: '28px' }}>
          {['Recursos', 'Método', 'Planos', 'Dúvidas'].map((label) => (
            <a
              key={label}
              href={`#${toAnchorId(label)}`}
              className="nav-link"
              style={{ color: colors.muted, textDecoration: 'none', fontSize: '15px', fontWeight: 500, transition: 'color 0.15s' }}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="nav-ctas-desktop" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <a href="#planos" style={{
            padding: '8px 18px', border: `1px solid rgba(255,255,255,0.3)`, borderRadius: '8px',
            color: colors.white, textDecoration: 'none', fontSize: '14px', fontWeight: 600,
            transition: 'background 0.15s',
          }} className="btn-outline">Ver planos</a>
          <Link to="/login" style={{
            padding: '8px 18px', background: colors.accent, borderRadius: '8px',
            color: '#0d1117', textDecoration: 'none', fontSize: '14px', fontWeight: 700,
            transition: 'background 0.15s',
          }} className="btn-accent">Acessar</Link>
        </div>
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'none', background: 'none', border: 'none', color: colors.white,
            fontSize: '22px', cursor: 'pointer', padding: '4px',
          }}
          aria-label="Menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed', top: '64px', left: 0, right: 0, zIndex: 99,
          background: colors.bgCard, borderBottom: `1px solid ${colors.border}`,
          padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          {['Recursos', 'Método', 'Planos', 'Dúvidas'].map((label) => (
            <a
              key={label}
              href={`#${toAnchorId(label)}`}
              onClick={() => setMobileMenuOpen(false)}
              style={{ color: colors.muted, textDecoration: 'none', fontSize: '16px', fontWeight: 500 }}
            >
              {label}
            </a>
          ))}
          <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
            <a href="#planos" onClick={() => setMobileMenuOpen(false)} style={{
              padding: '9px 18px', border: `1px solid rgba(255,255,255,0.3)`, borderRadius: '8px',
              color: colors.white, textDecoration: 'none', fontSize: '14px', fontWeight: 600,
            }}>Ver planos</a>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} style={{
              padding: '9px 18px', background: colors.accent, borderRadius: '8px',
              color: '#0d1117', textDecoration: 'none', fontSize: '14px', fontWeight: 700,
            }}>Acessar</Link>
          </div>
        </div>
      )}

      {/* HERO */}
      <section style={{ padding: '120px 32px 80px', maxWidth: '1160px', margin: '0 auto' }}>
        <div className="hero-grid" style={{ display: 'flex', gap: '48px', alignItems: 'center' }}>
          {/* Left */}
          <div style={{ flex: '1', minWidth: 0 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(200,241,53,0.1)', border: `1px solid rgba(200,241,53,0.25)`,
              borderRadius: '100px', padding: '6px 14px', marginBottom: '28px',
            }}>
              <span style={{ fontSize: '13px' }}>⚡</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: colors.accent, letterSpacing: '0.06em' }}>
                NOVA GERAÇÃO DE ORGANIZAÇÃO FINANCEIRA PESSOAL
              </span>
            </div>
            <h1 style={{
              fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: 800, lineHeight: 1.15,
              margin: '0 0 20px', letterSpacing: '-1px',
            }}>
              Uma experiência financeira que{' '}
              <span style={{ color: colors.accent }}>parece produto de banco premium.</span>
            </h1>
            <p style={{ fontSize: '17px', color: colors.muted, lineHeight: 1.65, margin: '0 0 32px', maxWidth: '520px' }}>
              A Finlly pega sua rotina no WhatsApp e transforma em sistema vivo: contas registradas, metas em trilha, lembretes no momento certo e acompanhamento contínuo.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' }}>
              <Link to="/checkout" style={{
                padding: '13px 26px', background: colors.accent, borderRadius: '10px',
                color: '#0d1117', textDecoration: 'none', fontSize: '15px', fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: '6px',
              }} className="btn-accent">
                Começar agora →
              </Link>
              <a href="#recursos" style={{
                padding: '13px 26px', border: `1.5px solid rgba(255,255,255,0.25)`, borderRadius: '10px',
                color: colors.white, textDecoration: 'none', fontSize: '15px', fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent',
              }} className="btn-outline">
                Ver demonstração ▶
              </a>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {[
                { icon: '🔒', label: 'Políticas LGPD' },
                { icon: '💬', label: 'Fluxo nativo no WhatsApp' },
                { icon: '⚡', label: 'Ação em segundos' },
              ].map(({ icon, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: colors.muted }}>
                  <span>{icon}</span>{label}
                </span>
              ))}
            </div>
          </div>

          {/* Right — chat mockup */}
          <div style={{ flex: '1', minWidth: 0, position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              background: colors.bgCardAlt, borderRadius: '20px', border: `1px solid ${colors.border}`,
              width: '100%', maxWidth: '360px', padding: '0', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}>
              {/* Chat header */}
              <div style={{
                background: '#0f172a', padding: '14px 18px', borderBottom: `1px solid ${colors.border}`,
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>⚡</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>Finlly</div>
                  <div style={{ fontSize: '11px', color: '#22c55e' }}>● online</div>
                </div>
              </div>
              {/* Messages */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '280px' }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{
                      maxWidth: '82%', padding: '9px 13px', borderRadius: msg.from === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: msg.from === 'user' ? colors.accent : '#1e2d45',
                      color: msg.from === 'user' ? '#0d1117' : colors.white,
                      fontSize: '13px', lineHeight: 1.4, fontWeight: msg.from === 'user' ? 500 : 400,
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating metric cards */}
            <div className="float-card-1" style={{
              position: 'absolute', top: '-16px', right: '-12px',
              background: colors.bgCard, border: `1px solid ${colors.border}`,
              borderRadius: '12px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              minWidth: '140px',
            }}>
              <div style={{ fontSize: '10px', color: colors.muted, fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>CONSISTÊNCIA SEMANAL</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: colors.accent }}>+31%</div>
            </div>
            <div className="float-card-2" style={{
              position: 'absolute', bottom: '60px', right: '-20px',
              background: colors.bgCard, border: `1px solid ${colors.border}`,
              borderRadius: '12px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              minWidth: '140px',
            }}>
              <div style={{ fontSize: '10px', color: colors.muted, fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>TEMPO ECONOMIZADO</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: colors.white }}>4h<span style={{ fontSize: '13px', color: colors.muted }}>/sem</span></div>
            </div>
            <div className="float-card-3" style={{
              position: 'absolute', bottom: '-12px', left: '-12px',
              background: colors.bgCard, border: `1px solid ${colors.border}`,
              borderRadius: '12px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              minWidth: '160px',
            }}>
              <div style={{ fontSize: '10px', color: colors.muted, fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>CONFIANÇA OPERACIONAL</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: colors.accent }}>98.2%</div>
            </div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div style={{ background: '#0f172a', borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}`, overflow: 'hidden', padding: '14px 0' }}>
        <div className="ticker-track">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0', whiteSpace: 'nowrap' }}>
              <span style={{ color: colors.muted, fontSize: '14px', fontWeight: 500, padding: '0 28px' }}>{item}</span>
              <span style={{ color: colors.border, fontSize: '18px' }}>|</span>
            </span>
          ))}
        </div>
      </div>

      {/* RECURSOS */}
      <section id="recursos" style={{ padding: '96px 32px', maxWidth: '1160px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.5px' }}>
            Recursos desenhados para sair do caos e entrar em ritmo
          </h2>
          <p style={{ fontSize: '16px', color: colors.muted, maxWidth: '540px', margin: '0 auto', lineHeight: 1.65 }}>
            Nada de planilhas perdidas e decisão no improviso. A Finlly organiza, lembra e conduz seu plano financeiro de ponta a ponta.
          </p>
        </div>
        <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {features.map((f) => (
            <div
              key={f.title}
              className="feature-card"
              style={{
                background: colors.bgCardAlt, border: `1px solid ${colors.border}`,
                borderRadius: '16px', padding: '28px 24px', transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '14px' }}>{f.icon}</div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 10px' }}>{f.title}</h3>
              <p style={{ fontSize: '14px', color: colors.muted, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MÉTODO */}
      <section id="metodo" style={{ padding: '80px 32px', background: '#0a0f16' }}>
        <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.5px' }}>
              Método Finlly em 3 passos
            </h2>
          </div>
          <div className="method-grid" style={{ display: 'flex', gap: '24px', alignItems: 'stretch' }}>
            {/* Left large card */}
            <div style={{
              flex: '1', background: 'linear-gradient(135deg, #1a2236, #111827)',
              border: `1px solid ${colors.border}`, borderRadius: '20px', padding: '36px 32px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 28px', color: colors.accent }}>Método Finlly</h3>
              {[
                { step: 'Captura', desc: 'Você manda mensagens simples e a plataforma registra automaticamente.' },
                { step: 'Organização', desc: 'Vencimentos, metas e anexos entram em uma estrutura única.' },
                { step: 'Execução', desc: 'Lembretes e revisões te mantêm em movimento real.' },
              ].map(({ step, desc }) => (
                <div key={step} style={{ display: 'flex', gap: '14px', marginBottom: '22px' }}>
                  <span style={{ fontSize: '20px', marginTop: '2px' }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{step}</div>
                    <div style={{ fontSize: '14px', color: colors.muted, lineHeight: 1.55 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Right 2x2 grid */}
            <div className="method-small-grid" style={{ flex: '1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {metodoCards.map((c) => (
                <div key={c.title} style={{
                  background: colors.bgCardAlt, border: `1px solid ${colors.border}`,
                  borderRadius: '16px', padding: '24px 20px',
                }}>
                  <div style={{ fontSize: '28px', marginBottom: '12px' }}>{c.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>{c.title}</div>
                  <div style={{ fontSize: '13px', color: colors.muted, lineHeight: 1.55 }}>{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" style={{ padding: '96px 32px', maxWidth: '1160px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '52px' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.5px' }}>
            Planos para transformar intenção em resultado
          </h2>
          <p style={{ fontSize: '16px', color: colors.muted, maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
            Escolha seu ritmo e comece hoje com acompanhamento direto no WhatsApp.
          </p>
        </div>
        <div className="plans-grid" style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* Mensal */}
          <div className="plan-card" style={{
            background: colors.bgCardAlt, border: `1px solid ${colors.border}`,
            borderRadius: '20px', padding: '36px 32px', width: '340px',
          }}>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Plano Mensal</div>
            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '38px', fontWeight: 800 }}>R$ 39</span>
              <span style={{ fontSize: '20px', fontWeight: 700 }}>,90</span>
              <span style={{ fontSize: '15px', color: colors.muted }}>/mês</span>
            </div>
            {[
              'Contas, recebimentos e metas',
              'Lembretes + anexos organizados',
              'Atendimento no WhatsApp',
              'Cancelamento quando quiser',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span style={{ color: colors.accent, fontSize: '16px', marginTop: '1px' }}>✅</span>
                <span style={{ fontSize: '14px', color: colors.muted }}>{item}</span>
              </div>
            ))}
            <Link to="/checkout" style={{
              display: 'block', marginTop: '28px', textAlign: 'center',
              padding: '13px', border: `1.5px solid rgba(255,255,255,0.25)`, borderRadius: '10px',
              color: colors.white, textDecoration: 'none', fontWeight: 700, fontSize: '15px',
              transition: 'background 0.15s',
            }} className="btn-outline">
              Assinar mensal
            </Link>
          </div>
          {/* Anual */}
          <div className="plan-card" style={{
            background: colors.bgCardAlt, border: `2px solid ${colors.accent}`,
            borderRadius: '20px', padding: '36px 32px', width: '340px', position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
              background: colors.accent, color: '#0d1117', fontSize: '11px', fontWeight: 800,
              padding: '5px 14px', borderRadius: '100px', letterSpacing: '0.06em', whiteSpace: 'nowrap',
            }}>
              MELHOR CUSTO
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Plano Anual</div>
            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '38px', fontWeight: 800 }}>R$ 399</span>
              <span style={{ fontSize: '15px', color: colors.muted }}>/ano</span>
            </div>
            {[
              'Tudo do plano mensal',
              'Economia para manter consistência',
              'Foco em metas de médio e longo prazo',
              'Acompanhamento prioritário',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span style={{ color: colors.accent, fontSize: '16px', marginTop: '1px' }}>✅</span>
                <span style={{ fontSize: '14px', color: colors.muted }}>{item}</span>
              </div>
            ))}
            <Link to="/checkout" style={{
              display: 'block', marginTop: '28px', textAlign: 'center',
              padding: '13px', background: colors.accent, borderRadius: '10px',
              color: '#0d1117', textDecoration: 'none', fontWeight: 700, fontSize: '15px',
              transition: 'background 0.15s',
            }} className="btn-accent">
              Assinar anual
            </Link>
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section style={{ padding: '80px 32px', background: '#0a0f16' }}>
        <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, margin: '0 0 48px', letterSpacing: '-0.5px' }}>
            Quem usa, percebe confiança e velocidade de execução
          </h2>
          <div className="testimonials-grid" style={{ display: 'flex', gap: '20px' }}>
            {testimonials.map((t) => (
              <div key={t.author} style={{
                flex: 1, background: colors.bgCardAlt, border: `1px solid ${colors.border}`,
                borderRadius: '16px', padding: '28px 24px',
              }}>
                <div style={{ fontSize: '24px', color: colors.accent, marginBottom: '14px' }}>"</div>
                <p style={{ fontSize: '15px', color: colors.white, lineHeight: 1.65, margin: '0 0 20px', fontStyle: 'italic' }}>
                  {t.text}
                </p>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{t.author}</div>
                  <div style={{ fontSize: '13px', color: colors.muted }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="duvidas" style={{ padding: '96px 32px', maxWidth: '760px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, margin: '0 0 48px', letterSpacing: '-0.5px' }}>
          Perguntas frequentes
        </h2>
        <div>
          {faqItems.map((item, idx) => (
            <div key={idx} className="faq-item">
              <div className="faq-question" onClick={() => toggleFaq(idx)} role="button" aria-expanded={faqOpen === idx}>
                <span>{item.q}</span>
                <span style={{ color: colors.accent, fontSize: '20px', fontWeight: 400, transition: 'transform 0.2s', transform: faqOpen === idx ? 'rotate(45deg)' : 'none', display: 'inline-block' }}>+</span>
              </div>
              {faqOpen === idx && (
                <div style={{ fontSize: '15px', color: colors.muted, lineHeight: 1.65, paddingBottom: '18px' }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: '80px 32px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1a2236 50%, #0f172a 100%)',
            border: `1px solid ${colors.border}`, borderRadius: '24px',
            padding: '56px 40px', textAlign: 'center',
            boxShadow: '0 0 80px rgba(200,241,53,0.06)',
          }}>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.5px' }}>
              Pronto para surpreender sua versão financeira?
            </h2>
            <p style={{ fontSize: '16px', color: colors.muted, margin: '0 0 32px', lineHeight: 1.65 }}>
              Comece hoje e receba um plano prático no WhatsApp para organizar, executar e evoluir sem improviso.
            </p>
            <Link to="/checkout" style={{
              display: 'inline-block', padding: '14px 32px', background: colors.accent,
              borderRadius: '10px', color: '#0d1117', textDecoration: 'none',
              fontSize: '16px', fontWeight: 700, transition: 'background 0.15s',
            }} className="btn-accent">
              Quero começar agora →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: `1px solid ${colors.border}`,
        padding: '24px 32px', textAlign: 'center',
        color: colors.muted, fontSize: '14px',
      }}>
        © 2026 Finlly. Todos os direitos reservados.
      </footer>
    </div>
  );
}
