import { useEffect } from 'react';

const CSS = `
  html, body, #root {
    margin: 0;
    padding: 0;
    min-height: 100%;
    background:
      radial-gradient(840px 480px at 3% -12%, rgba(196, 233, 31, 0.2), transparent 68%),
      radial-gradient(820px 500px at 98% 3%, rgba(60, 92, 155, 0.3), transparent 70%),
      linear-gradient(175deg, #070d1d, #0d1733 32%, #0b1a3c 76%, #070d1d);
    background-attachment: fixed;
    background-color: #070d1d;
  }

  :root {
    --primary: #33528a;
    --secondary: #c4e91f;
    --dark-1: #070d1d;
    --dark-2: #0d1733;
    --dark-3: #132449;
    --ink: #dbe7ff;
    --ink-soft: #9fb2d7;
    --line: rgba(171, 192, 231, 0.24);
    --card: rgba(19, 34, 68, 0.68);
    --radius-lg: 24px;
    --radius-md: 16px;
    --glow: 0 0 0 1px rgba(196, 233, 31, 0.24), 0 24px 55px rgba(4, 10, 24, 0.65);
  }

  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }

  body {
    margin: 0;
    font-family: "IBM Plex Sans", sans-serif;
    color: var(--ink);
    overflow-x: hidden;
  }

  .container {
    width: min(1180px, calc(100% - 2.4rem));
    margin: 0 auto;
  }

  .noise {
    position: fixed;
    inset: 0;
    pointer-events: none;
    opacity: .22;
    z-index: 0;
    background-image:
      radial-gradient(rgba(255, 255, 255, 0.08) 0.5px, transparent 0.5px),
      radial-gradient(rgba(255, 255, 255, 0.08) 0.5px, transparent 0.5px);
    background-size: 3px 3px, 5px 5px;
    background-position: 0 0, 2px 1px;
    mix-blend-mode: soft-light;
  }

  .site { position: relative; z-index: 2; }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    backdrop-filter: blur(10px);
    background: rgba(7, 13, 29, 0.72);
    border-bottom: 1px solid rgba(159, 178, 215, 0.14);
  }
  .topbar-inner {
    min-height: 82px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }
  .brand { display: inline-flex; align-items: center; text-decoration: none; gap: 10px; }
  .brand img { height: 34px; width: auto; display: block; filter: drop-shadow(0 8px 20px rgba(0,0,0,0.4)); }
  .nav { display: flex; gap: 18px; align-items: center; }
  .nav a { text-decoration: none; color: #b6c9ef; font-size: 14px; font-weight: 600; letter-spacing: .2px; }
  .nav a:hover { color: #f3f8ff; }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border-radius: 12px;
    text-decoration: none;
    font-weight: 700;
    padding: 10px 15px;
    border: 1px solid transparent;
    transition: transform .2s ease, box-shadow .2s ease, background .2s ease;
  }
  .btn-primary {
    color: #12203f;
    background: linear-gradient(130deg, #c4e91f, #d6f35d);
    box-shadow: 0 14px 30px rgba(196, 233, 31, 0.3);
  }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 36px rgba(196, 233, 31, 0.34); }
  .btn-ghost { color: #d4e2ff; border-color: rgba(171, 192, 231, 0.3); background: rgba(19, 34, 68, 0.42); }
  .btn-ghost:hover { transform: translateY(-1px); background: rgba(31, 49, 90, 0.52); }

  .hero {
    padding: 26px 0 34px;
    min-height: calc(100vh - 82px);
    display: grid;
    align-items: center;
  }
  .hero-grid {
    display: grid;
    grid-template-columns: 1.12fr .88fr;
    gap: 28px;
    align-items: center;
  }
  .hero-copy { position: relative; }
  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .4px;
    text-transform: uppercase;
    color: #e2edff;
    border: 1px solid rgba(171, 192, 231, 0.3);
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(19, 34, 68, 0.48);
  }
  .kicker i { color: var(--secondary); }
  h1, h2, h3 { margin: 0; font-family: "Sora", sans-serif; letter-spacing: -0.5px; }
  h1 {
    margin-top: 14px;
    font-size: clamp(34px, 4.8vw, 66px);
    line-height: 1.02;
    color: #f4f8ff;
    max-width: 12ch;
  }
  .hero p {
    margin: 16px 0 22px;
    color: var(--ink-soft);
    max-width: 52ch;
    font-size: 18px;
    line-height: 1.56;
  }
  .hero-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .inline-proof {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    color: #bfd0f2;
    font-size: 13px;
    font-weight: 600;
  }
  .inline-proof span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid rgba(171, 192, 231, 0.2);
    background: rgba(19, 34, 68, 0.35);
  }
  .inline-proof i { color: var(--secondary); }

  .hero-stage { position: relative; min-height: 560px; }
  .orb {
    position: absolute;
    border-radius: 999px;
    pointer-events: none;
    filter: blur(18px);
    opacity: .7;
    animation: drift 12s ease-in-out infinite;
  }
  .orb.o1 { width: 240px; height: 240px; background: rgba(196, 233, 31, 0.32); top: 0; right: 14%; }
  .orb.o2 { width: 320px; height: 320px; background: rgba(76, 113, 183, 0.35); bottom: 4%; left: -8%; animation-delay: -3s; animation-duration: 16s; }
  .glass-main {
    position: absolute;
    right: 0;
    top: 26px;
    width: min(460px, 100%);
    background: linear-gradient(150deg, rgba(18, 33, 67, 0.9), rgba(14, 24, 49, 0.84));
    border: 1px solid rgba(171, 192, 231, 0.22);
    border-radius: 26px;
    padding: 16px;
    box-shadow: var(--glow);
    overflow: hidden;
    animation: floatY 7s ease-in-out infinite;
  }
  .glass-main::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, rgba(255,255,255,0.08), transparent 34%);
    pointer-events: none;
  }
  .main-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    color: #dbe7ff;
    font-size: 12px;
    font-weight: 700;
  }
  .status-dot {
    width: 9px; height: 9px;
    border-radius: 999px;
    background: #33d06b;
    box-shadow: 0 0 0 6px rgba(51, 208, 107, 0.2);
    display: inline-block;
    margin-right: 7px;
    vertical-align: middle;
  }
  .chat { display: grid; gap: 8px; font-size: 13px; line-height: 1.45; }
  .msg {
    max-width: 86%;
    border-radius: 14px;
    border: 1px solid rgba(171, 192, 231, 0.2);
    background: rgba(35, 56, 102, 0.38);
    color: #e5efff;
    padding: 10px 12px;
    opacity: 0;
    transform: translateY(6px);
    animation: pop .5s ease forwards;
  }
  .msg:nth-child(1) { animation-delay: .15s; }
  .msg:nth-child(2) { animation-delay: .4s; }
  .msg:nth-child(3) { animation-delay: .7s; }
  .msg:nth-child(4) { animation-delay: 1s; }
  .msg:nth-child(5) { animation-delay: 1.2s; }
  .msg.user {
    margin-left: auto;
    background: rgba(196, 233, 31, 0.14);
    color: #f7ffe0;
    border-color: rgba(196, 233, 31, 0.28);
  }
  .stack-card {
    position: absolute;
    border-radius: 18px;
    border: 1px solid rgba(171, 192, 231, 0.2);
    background: rgba(13, 23, 51, 0.78);
    box-shadow: 0 16px 34px rgba(5, 11, 25, 0.6);
    backdrop-filter: blur(10px);
    padding: 12px;
    animation: floatAlt 9s ease-in-out infinite;
  }
  .stack-card small { color: #9cb0d8; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
  .stack-card strong { display: block; margin-top: 5px; color: #eef4ff; font-size: 20px; font-family: "Sora", sans-serif; }
  .stack-card i { color: var(--secondary); margin-right: 7px; }
  .stack-a { left: 0; top: 80px; width: 190px; }
  .stack-b { left: 20px; bottom: 90px; width: 220px; animation-delay: -3s; }
  .stack-c { right: 14px; bottom: 16px; width: 210px; animation-delay: -5s; }

  .marquee-wrap {
    margin-top: 18px;
    border-top: 1px solid rgba(171, 192, 231, 0.18);
    border-bottom: 1px solid rgba(171, 192, 231, 0.18);
    background: rgba(6, 12, 27, 0.5);
    overflow: hidden;
    padding: 12px 0;
  }
  .marquee { display: flex; gap: 14px; width: max-content; animation: slide 22s linear infinite; }
  .marquee span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgba(171, 192, 231, 0.24);
    color: #d6e3ff;
    font-size: 12px;
    font-weight: 700;
    background: rgba(19, 34, 68, 0.52);
  }
  .marquee i { color: var(--secondary); }

  section.block { padding: 56px 0 6px; }
  .section-head { max-width: 700px; margin-bottom: 22px; }
  .section-head h2 { font-size: clamp(28px, 3.2vw, 44px); line-height: 1.06; color: #edf3ff; margin-bottom: 10px; }
  .section-head p { margin: 0; color: #9eb2d8; font-size: 17px; line-height: 1.58; }

  .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .feature {
    border: 1px solid rgba(171, 192, 231, 0.22);
    border-radius: 18px;
    padding: 18px;
    background: linear-gradient(165deg, rgba(19, 34, 68, 0.8), rgba(10, 18, 40, 0.84));
    box-shadow: 0 14px 28px rgba(5, 10, 24, 0.44);
    position: relative;
    overflow: hidden;
    transition: transform .25s ease, border-color .25s ease;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .feature:hover { transform: translateY(-5px) rotate(-.3deg); border-color: rgba(196, 233, 31, 0.4); }
  .feature .icon {
    width: 50px; height: 50px; border-radius: 14px;
    display: grid; place-items: center;
    font-size: 22px; color: #12203f;
    background: linear-gradient(145deg, var(--secondary), #dbf76a);
    box-shadow: 0 10px 24px rgba(196, 233, 31, 0.25);
    flex-shrink: 0;
  }
  .feature h3 { font-size: 17px; margin: 0 0 5px; color: #f1f6ff; }
  .feature p { margin: 0; color: #9db0d7; font-size: 14px; line-height: 1.52; }

  .split { display: grid; grid-template-columns: .95fr 1.05fr; gap: 14px; margin-top: 14px; }
  .panel {
    border-radius: 20px;
    border: 1px solid rgba(171, 192, 231, 0.22);
    background: linear-gradient(170deg, rgba(18, 33, 67, 0.82), rgba(8, 16, 35, 0.84));
    padding: 20px;
    box-shadow: 0 14px 30px rgba(4, 9, 21, 0.5);
  }
  .checklist { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
  .checklist li { display: flex; gap: 10px; color: #c8d7f4; font-weight: 600; line-height: 1.42; font-size: 15px; }
  .checklist i { color: var(--secondary); margin-top: 2px; flex-shrink: 0; font-size: 18px; }
  .micro-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .micro { border: 1px solid rgba(171, 192, 231, 0.2); border-radius: 14px; padding: 14px; background: rgba(19, 34, 68, 0.46); }
  .micro strong { display: flex; align-items: center; gap: 6px; color: #f2f7ff; font-family: "Sora", sans-serif; margin-bottom: 6px; font-size: 15px; }
  .micro strong i { color: var(--secondary); }
  .micro span { color: #9db0d6; font-size: 13px; line-height: 1.5; }

  .pricing { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 10px; }
  .price {
    border-radius: 22px;
    border: 1px solid rgba(171, 192, 231, 0.23);
    background: linear-gradient(170deg, rgba(19, 34, 68, 0.82), rgba(9, 17, 36, 0.86));
    padding: 28px;
    box-shadow: 0 16px 34px rgba(4, 9, 21, 0.5);
    position: relative;
  }
  .price.best { border-color: rgba(196, 233, 31, 0.52); box-shadow: 0 0 0 1px rgba(196, 233, 31, 0.32), 0 20px 42px rgba(4, 9, 21, 0.54); }
  .pill { position: absolute; right: 20px; top: -14px; background: #d7f45b; color: #16295a; border-radius: 999px; font-size: 11px; padding: 6px 14px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; }
  .price h3 { color: #eff5ff; font-size: 20px; margin-bottom: 6px; }
  .value { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 18px; }
  .value strong { font-family: "Sora", sans-serif; font-size: 48px; line-height: .95; color: #dff97d; font-weight: 800; }
  .value span { color: #a4b6da; font-weight: 600; margin-bottom: 6px; font-size: 15px; }
  .list { margin: 0 0 22px; padding: 0; list-style: none; display: grid; gap: 10px; }
  .list li { color: #c9d8f5; font-size: 14px; display: flex; gap: 10px; align-items: flex-start; line-height: 1.4; }
  .list i { color: var(--secondary); margin-top: 2px; flex-shrink: 0; }
  .btn-plan {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 13px 20px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 15px;
    text-decoration: none;
    cursor: pointer;
    border: none;
    transition: filter .2s ease, transform .2s ease;
    background: linear-gradient(130deg, #c4e91f, #d6f35d);
    color: #12203f;
    box-shadow: 0 10px 24px rgba(196, 233, 31, 0.28);
  }
  .btn-plan:hover { filter: brightness(1.08); transform: translateY(-2px); }

  .testimonials { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 6px; }
  .quote { border-radius: 16px; border: 1px solid rgba(171, 192, 231, 0.2); background: rgba(19, 34, 68, 0.56); padding: 20px; box-shadow: 0 12px 26px rgba(4, 9, 21, 0.42); }
  .quote p { margin: 0 0 14px; color: #cad9f5; line-height: 1.6; font-size: 14px; }
  .quote strong { display: block; color: #f2f7ff; font-size: 13px; font-weight: 700; letter-spacing: .2px; }

  .faq-box { border: 1px solid rgba(171, 192, 231, 0.2); border-radius: 18px; background: rgba(19, 34, 68, 0.52); overflow: hidden; }
  details { border-bottom: 1px solid rgba(171, 192, 231, 0.16); padding: 14px 16px; }
  details:last-child { border-bottom: 0; }
  summary { list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 8px; cursor: pointer; color: #eef4ff; font-weight: 700; font-size: 15px; }
  summary::-webkit-details-marker { display: none; }
  summary::after { content: "+"; font-size: 22px; color: var(--secondary); }
  details[open] summary::after { content: "-"; }
  details p { margin: 10px 0 2px; color: #9cb0d8; line-height: 1.55; font-size: 14px; }

  .cta {
    margin-top: 38px;
    border-radius: 24px;
    border: 1px solid rgba(171, 192, 231, 0.26);
    padding: 32px;
    background:
      radial-gradient(480px 260px at 16% 0%, rgba(196, 233, 31, 0.2), transparent 68%),
      linear-gradient(130deg, #12224a, #1a3166 58%, #1f3a79);
    display: grid;
    grid-template-columns: 1.2fr .8fr;
    gap: 12px;
    align-items: center;
    box-shadow: 0 16px 34px rgba(4, 9, 21, 0.55);
  }
  .cta h2 { font-size: clamp(22px, 3vw, 36px); color: #f4f9ff; margin-bottom: 8px; }
  .cta p { margin: 0; color: #c7d7f4; font-size: 15px; line-height: 1.55; }
  .cta-action { display: flex; justify-content: flex-end; }

  footer {
    padding: 28px 0 44px;
    color: #90a6d1;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 13px;
  }

  .reveal { opacity: 0; transform: translateY(16px); transition: opacity .7s ease, transform .7s ease; }
  .reveal.in { opacity: 1; transform: translateY(0); }

  @keyframes slide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @keyframes pop { to { opacity: 1; transform: translateY(0); } }
  @keyframes floatY { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  @keyframes floatAlt { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
  @keyframes drift { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(22px, -16px) scale(1.04); } }

  @media (max-width: 1040px) {
    .hero-grid, .split, .cta { grid-template-columns: 1fr; }
    .cta .cta-action { justify-content: flex-start; }
    .features, .pricing, .testimonials { grid-template-columns: repeat(2, 1fr); }
    .hero-stage { min-height: 620px; }
  }

  @media (max-width: 760px) {
    .nav { display: none; }
    .topbar-inner .btn-ghost { display: none; }
    .hero { min-height: auto; padding: 22px 0 26px; }
    h1 { max-width: none; }
    .hero-stage { min-height: 680px; }
    .glass-main { position: relative; width: 100%; top: auto; right: auto; }
    .stack-a, .stack-b, .stack-c { position: relative; left: auto; right: auto; top: auto; bottom: auto; width: 100%; margin-top: 8px; animation: none; }
    .features, .pricing, .testimonials, .micro-grid { grid-template-columns: 1fr; }
    .marquee { animation-duration: 28s; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
`;

export default function LandingPage() {
  const year = new Date().getFullYear();

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div className="noise"></div>

      <div className="site">
        <header className="topbar">
          <div className="container topbar-inner">
            <a className="brand" href="#">
              <img
                src="https://projects.domlabs.com.br/finlly/assets/img/logo.png"
                alt="Finlly"
              />
            </a>
            <nav className="nav">
              <a href="#recursos">Recursos</a>
              <a href="#metodo">Método</a>
              <a href="#planos">Planos</a>
              <a href="#faq">Dúvidas</a>
            </nav>
            <div style={{ display: 'flex', gap: '8px' }}>
              <a className="btn btn-ghost" href="#planos">
                Ver planos
              </a>
              <a className="btn btn-primary" href="https://app.finlly.com.br/login">
                Acessar
              </a>
            </div>
          </div>
        </header>

        <main className="container">
          <section className="hero">
            <div className="hero-grid">
              <article className="hero-copy reveal">
                <span className="kicker">
                  <i className="bi bi-stars"></i> Nova geração de organização
                  financeira pessoal
                </span>
                <h1>
                  Uma experiência financeira que parece produto de banco
                  premium.
                </h1>
                <p>
                  A Finlly pega sua rotina no WhatsApp e transforma em sistema
                  vivo: contas registradas, metas em trilha, lembretes no
                  momento certo e acompanhamento contínuo.
                </p>
                <div className="hero-actions">
                  <a className="btn btn-primary" href="https://app.finlly.com.br/checkout?plano=mensal">
                    Começar agora <i className="bi bi-arrow-right"></i>
                  </a>
                  <a className="btn btn-ghost" href="#recursos">
                    Ver demonstração <i className="bi bi-play-circle"></i>
                  </a>
                </div>
                <div className="inline-proof">
                  <span>
                    <i className="bi bi-shield-lock"></i> Políticas LGPD
                  </span>
                  <span>
                    <i className="bi bi-whatsapp"></i> Fluxo nativo no WhatsApp
                  </span>
                  <span>
                    <i className="bi bi-lightning-charge"></i> Ação em segundos
                  </span>
                </div>
              </article>

              <aside
                className="hero-stage reveal"
                aria-label="Painel visual da Finlly"
              >
                <div className="orb o1"></div>
                <div className="orb o2"></div>
                <div className="glass-main">
                  <div className="main-top">
                    <span>
                      <span className="status-dot"></span>Finlly online
                    </span>
                    <span>Consultora no WhatsApp</span>
                  </div>
                  <div className="chat">
                    <div className="msg">
                      Me passe suas contas fixas e eu monto seu plano em 2
                      minutos.
                    </div>
                    <div className="msg user">
                      Aluguel dia 05, cartao dia 12, escola dia 10.
                    </div>
                    <div className="msg">
                      Perfeito. Lembretes ativados e prioridades do mes
                      definidas.
                    </div>
                    <div className="msg user">
                      Meta de R$ 10 mil ate dezembro.
                    </div>
                    <div className="msg">
                      Dividi em aportes semanais. Vou te lembrar e ajustar no
                      caminho.
                    </div>
                  </div>
                </div>
                <div className="stack-card stack-a">
                  <small>
                    <i className="bi bi-activity"></i>Consistência semanal
                  </small>
                  <strong>+31%</strong>
                </div>
                <div className="stack-card stack-b">
                  <small>
                    <i className="bi bi-clock-history"></i>Tempo economizado
                  </small>
                  <strong>4h/sem</strong>
                </div>
                <div className="stack-card stack-c">
                  <small>
                    <i className="bi bi-shield-check"></i>Confiança operacional
                  </small>
                  <strong>98.2%</strong>
                </div>
              </aside>
            </div>
          </section>
        </main>

        <div className="marquee-wrap">
          <div className="marquee">
            <span>
              <i className="bi bi-lock-fill"></i> Criptografia em trânsito
            </span>
            <span>
              <i className="bi bi-journal-check"></i> Histórico rastreável
            </span>
            <span>
              <i className="bi bi-calendar-check"></i> Rotina semanal
              automatizada
            </span>
            <span>
              <i className="bi bi-file-earmark-lock2"></i> Proteção de dados
            </span>
            <span>
              <i className="bi bi-graph-up-arrow"></i> Monitoramento de metas
            </span>
            <span>
              <i className="bi bi-clipboard2-pulse"></i> Método orientado à
              execução
            </span>
            <span>
              <i className="bi bi-lock-fill"></i> Criptografia em trânsito
            </span>
            <span>
              <i className="bi bi-journal-check"></i> Histórico rastreável
            </span>
            <span>
              <i className="bi bi-calendar-check"></i> Rotina semanal
              automatizada
            </span>
            <span>
              <i className="bi bi-file-earmark-lock2"></i> Proteção de dados
            </span>
          </div>
        </div>

        <main className="container">
          <section id="recursos" className="block">
            <div className="section-head reveal">
              <h2>Recursos desenhados para sair do caos e entrar em ritmo</h2>
              <p>
                Nada de planilhas perdidas e decisão no improviso. A Finlly
                organiza, lembra e conduz seu plano financeiro de ponta a ponta.
              </p>
            </div>
            <div className="features">
              <article className="feature reveal">
                <div className="icon">
                  <i className="bi bi-wallet2"></i>
                </div>
                <div>
                  <h3>Contas e vencimentos</h3>
                  <p>
                    Centralize despesas fixas e variáveis com linha do tempo
                    para vencer no prazo certo.
                  </p>
                </div>
              </article>
              <article className="feature reveal">
                <div className="icon">
                  <i className="bi bi-piggy-bank"></i>
                </div>
                <div>
                  <h3>Metas e aportes</h3>
                  <p>
                    Defina objetivo, valor e prazo. A Finlly te conduz em
                    micro-ações executáveis.
                  </p>
                </div>
              </article>
              <article className="feature reveal">
                <div className="icon">
                  <i className="bi bi-paperclip"></i>
                </div>
                <div>
                  <h3>Anexos inteligentes</h3>
                  <p>
                    Comprovantes e extratos organizados por contexto para
                    consulta rápida e segura.
                  </p>
                </div>
              </article>
              <article className="feature reveal">
                <div className="icon">
                  <i className="bi bi-whatsapp"></i>
                </div>
                <div>
                  <h3>Entrada pelo WhatsApp</h3>
                  <p>
                    Você fala naturalmente, a Finlly interpreta e transforma em
                    execução concreta.
                  </p>
                </div>
              </article>
              <article className="feature reveal">
                <div className="icon">
                  <i className="bi bi-kanban"></i>
                </div>
                <div>
                  <h3>CRM financeiro pessoal</h3>
                  <p>
                    Histórico das decisões e tarefas para manter constância ao
                    longo do ano.
                  </p>
                </div>
              </article>
              <article className="feature reveal">
                <div className="icon">
                  <i className="bi bi-bar-chart-line"></i>
                </div>
                <div>
                  <h3>Revisão mensal guiada</h3>
                  <p>
                    Análise de desempenho com ajustes de rota para você
                    continuar evoluindo.
                  </p>
                </div>
              </article>
            </div>
          </section>

          <section id="metodo" className="block">
            <div className="split">
              <article className="panel reveal">
                <div className="section-head" style={{ marginBottom: '18px' }}>
                  <h2 style={{ fontSize: 'clamp(24px, 2.6vw, 34px)' }}>
                    Método Finlly em 3 passos
                  </h2>
                </div>
                <ul className="checklist">
                  <li>
                    <i className="bi bi-check2-circle"></i>
                    <span>
                      <strong>Captura:</strong> você manda mensagens simples e a
                      plataforma registra automaticamente.
                    </span>
                  </li>
                  <li>
                    <i className="bi bi-check2-circle"></i>
                    <span>
                      <strong>Organização:</strong> vencimentos, metas e anexos
                      entram em uma estrutura única.
                    </span>
                  </li>
                  <li>
                    <i className="bi bi-check2-circle"></i>
                    <span>
                      <strong>Execução:</strong> lembretes e revisões te mantêm
                      em movimento real.
                    </span>
                  </li>
                </ul>
              </article>
              <article className="panel reveal">
                <div className="micro-grid">
                  <div className="micro">
                    <strong>
                      <i className="bi bi-rocket-takeoff"></i> Onboarding rápido
                    </strong>
                    <span>
                      Primeiras contas e metas em menos de 10 minutos.
                    </span>
                  </div>
                  <div className="micro">
                    <strong>
                      <i className="bi bi-bell"></i> Alertas acionáveis
                    </strong>
                    <span>Notificação com ação prática, sem ruído.</span>
                  </div>
                  <div className="micro">
                    <strong>
                      <i className="bi bi-shield-lock"></i> Privacidade
                    </strong>
                    <span>
                      Processos e camadas de segurança para dados pessoais.
                    </span>
                  </div>
                  <div className="micro">
                    <strong>
                      <i className="bi bi-graph-up"></i> Evolução contínua
                    </strong>
                    <span>Ajustes táticos para bater metas sem sufoco.</span>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section id="planos" className="block">
            <div className="section-head reveal">
              <h2>Planos para transformar intenção em resultado</h2>
              <p>
                Escolha seu ritmo e comece hoje com acompanhamento direto no
                WhatsApp.
              </p>
            </div>
            <div className="pricing">
              <article className="price reveal">
                <h3>Plano Mensal</h3>
                <div className="value">
                  <strong>39,90</strong>
                  <span>R$/mês</span>
                </div>
                <ul className="list">
                  <li>
                    <i className="bi bi-check2-circle"></i>Contas, recebimentos
                    e metas
                  </li>
                  <li>
                    <i className="bi bi-check2-circle"></i>Lembretes + anexos
                    organizados
                  </li>
                  <li>
                    <i className="bi bi-check2-circle"></i>Atendimento no
                    WhatsApp
                  </li>
                  <li>
                    <i className="bi bi-check2-circle"></i>Cancelamento quando
                    quiser
                  </li>
                </ul>
                <a className="btn-plan" href="https://app.finlly.com.br/checkout?plano=mensal">
                  Assinar mensal
                </a>
              </article>
              <article className="price best reveal">
                <span className="pill">Melhor custo</span>
                <h3>Plano Anual</h3>
                <div className="value">
                  <strong>399</strong>
                  <span>R$/ano</span>
                </div>
                <ul className="list">
                  <li>
                    <i className="bi bi-check2-circle"></i>Tudo do plano mensal
                  </li>
                  <li>
                    <i className="bi bi-check2-circle"></i>Economia para manter
                    consistência
                  </li>
                  <li>
                    <i className="bi bi-check2-circle"></i>Foco em metas de
                    médio e longo prazo
                  </li>
                  <li>
                    <i className="bi bi-check2-circle"></i>Acompanhamento
                    prioritário
                  </li>
                </ul>
                <a className="btn-plan" href="https://app.finlly.com.br/checkout?plano=anual">
                  Assinar anual
                </a>
              </article>
            </div>
          </section>

          <section className="block">
            <div className="section-head reveal">
              <h2>Quem usa, percebe confiança e velocidade de execução</h2>
            </div>
            <div className="testimonials">
              <article className="quote reveal">
                <p>
                  &ldquo;Saí da desorganização total. Hoje eu sei exatamente o
                  que vence e quanto posso aportar sem estresse.&rdquo;
                </p>
                <strong>Mariana Alves, empreendedora</strong>
              </article>
              <article className="quote reveal">
                <p>
                  &ldquo;O grande diferencial é a rotina. A Finlly me lembra,
                  registra e me mantém em ação sem fricção.&rdquo;
                </p>
                <strong>Rafael Monteiro, consultor comercial</strong>
              </article>
              <article className="quote reveal">
                <p>
                  &ldquo;Em poucos meses eu construo consistência que não
                  consegui em anos com apps tradicionais.&rdquo;
                </p>
                <strong>Bianca Torres, gerente de projetos</strong>
              </article>
            </div>
          </section>

          <section id="faq" className="block">
            <div className="section-head reveal">
              <h2>Perguntas frequentes</h2>
            </div>
            <div className="faq-box reveal">
              <details>
                <summary>A Finlly é apenas um bot?</summary>
                <p>
                  Não. É uma consultora digital de execução que estrutura sua
                  rotina financeira e cria acompanhamento contínuo.
                </p>
              </details>
              <details>
                <summary>Posso cancelar quando quiser?</summary>
                <p>
                  Sim, no plano mensal você pode cancelar a qualquer momento. O
                  plano anual segue o período contratado.
                </p>
              </details>
              <details>
                <summary>Quais áreas eu consigo controlar?</summary>
                <p>
                  Contas fixas e variáveis, metas, recebimentos, investimentos,
                  anexos e histórico de tarefas.
                </p>
              </details>
            </div>

            <div className="cta reveal">
              <div>
                <h2>Pronto para surpreender sua versão financeira?</h2>
                <p>
                  Comece hoje e receba um plano prático no WhatsApp para
                  organizar, executar e evoluir sem improviso.
                </p>
              </div>
              <div className="cta-action">
                <a className="btn btn-primary" href="https://app.finlly.com.br/checkout?plano=mensal">
                  Quero começar agora <i className="bi bi-arrow-right"></i>
                </a>
              </div>
            </div>
          </section>

          <footer>
            <span>© {year} Finlly. Todos os direitos reservados.</span>
            <span>
              LGPD | Criptografia em trânsito | Atendimento via WhatsApp
            </span>
          </footer>
        </main>
      </div>
    </>
  );
}
