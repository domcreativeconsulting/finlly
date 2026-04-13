import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const LOGO_URL = 'https://projects.domlabs.com.br/finlly/assets/img/logo.png';

const navLinks = [
  { label: 'Recursos', href: '#recursos' },
  { label: 'Método', href: '#metodo' },
  { label: 'Planos', href: '#planos' },
  { label: 'Dúvidas', href: '#faq' },
];

const marqueeItems = [
  { icon: 'bi-lock-fill', label: 'Histórico rastreável' },
  { icon: 'bi-journal-check', label: 'Rotina semanal automatizada' },
  { icon: 'bi-calendar-check', label: 'Proteção de dados' },
  { icon: 'bi-file-earmark-lock2', label: 'Monitoramento de metas' },
  { icon: 'bi-graph-up-arrow', label: 'Método orientado à execução' },
  { icon: 'bi-clipboard2-pulse', label: 'Criptografia em trânsito' },
  { icon: 'bi-lock-fill', label: 'Histórico rastreável' },
  { icon: 'bi-journal-check', label: 'Rotina semanal automatizada' },
  { icon: 'bi-calendar-check', label: 'Proteção de dados' },
  { icon: 'bi-file-earmark-lock2', label: 'Monitoramento de metas' },
];

const features = [
  { icon: 'bi-wallet2', title: 'Contas e vencimentos', desc: 'Centralize despesas fixas e variáveis com linha do tempo para vencer no prazo certo.' },
  { icon: 'bi-piggy-bank', title: 'Metas e aportes', desc: 'Defina objetivo, valor e prazo. A Finlly te conduz em micro-ações executáveis.' },
  { icon: 'bi-paperclip', title: 'Anexos inteligentes', desc: 'Comprovantes e extratos organizados por contexto para consulta rápida e segura.' },
  { icon: 'bi-whatsapp', title: 'Entrada pelo WhatsApp', desc: 'Você fala naturalmente, a Finlly interpreta e transforma em execução concreta.' },
  { icon: 'bi-kanban', title: 'CRM financeiro pessoal', desc: 'Histórico das decisões e tarefas para manter constância ao longo do ano.' },
  { icon: 'bi-bar-chart-line', title: 'Revisão mensal guiada', desc: 'Análise de desempenho com ajustes de rota para você continuar evoluindo.' },
];

const metodoSteps = [
  { title: 'Captura', desc: 'Você manda mensagens simples e a plataforma registra automaticamente.' },
  { title: 'Organização', desc: 'Vencimentos, metas e anexos entram em uma estrutura única.' },
  { title: 'Execução', desc: 'Lembretes e revisões te mantêm em movimento real.' },
];

const metodoCards = [
  { icon: 'bi-rocket-takeoff', title: 'Onboarding', desc: 'Primeiras contas e metas em menos de 10 minutos.' },
  { icon: 'bi-bell', title: 'Alertas', desc: 'Notificação com ação prática, sem ruído.' },
  { icon: 'bi-shield-lock', title: 'Privacidade', desc: 'Processos e camadas de segurança para dados pessoais.' },
  { icon: 'bi-graph-up', title: 'Evolução', desc: 'Ajustes táticos para bater metas sem sufoco.' },
];

const mensal = [
  'Contas, recebimentos e metas',
  'Lembretes + anexos organizados',
  'Atendimento no WhatsApp',
  'Cancelamento quando quiser',
];

const anual = [
  'Tudo do plano mensal',
  'Economia para manter consistência',
  'Foco em metas de médio e longo prazo',
  'Acompanhamento prioritário',
];

const testimonials = [
  { text: 'Saí da desorganização total. Hoje eu sei exatamente o que vence e quanto posso aportar sem estresse.', author: 'Mariana Alves', role: 'empreendedora' },
  { text: 'O grande diferencial é a rotina. A Finlly me lembra, registra e me mantém em ação sem fricção.', author: 'Rafael Monteiro', role: 'consultor comercial' },
  { text: 'Em poucos meses eu construo consistência que não consegui em anos com apps tradicionais.', author: 'Bianca Torres', role: 'gerente de projetos' },
];

const faqItems = [
  { q: 'A Finlly é apenas um bot?', a: 'Não. A Finlly é uma plataforma completa de organização financeira que usa o WhatsApp como canal de entrada. Por trás, há um sistema estruturado com metas, contas, anexos, histórico e relatórios.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim. Você pode cancelar sua assinatura a qualquer momento, sem multas ou taxas adicionais. Seu acesso continua até o fim do período pago.' },
  { q: 'Quais áreas eu consigo controlar?', a: 'Contas a pagar, recebimentos, metas de poupança, anexos de comprovantes, extrato de movimentações, categorias e relatórios mensais — tudo integrado e acessível pelo WhatsApp ou pelo painel.' },
];

const chatMessages = [
  { from: 'user', text: 'Paguei o aluguel hoje, R$ 1.800' },
  { from: 'bot', text: '✅ Registrado! Aluguel R$ 1.800 — vencimento atualizado.' },
  { from: 'user', text: 'Qual minha meta de reserva esse mês?' },
  { from: 'bot', text: '🎯 Meta: R$ 500. Você já aportou R$ 320. Faltam R$ 180.' },
  { from: 'user', text: 'Me lembra na sexta sobre o cartão' },
];

const CSS = `
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

  body {
    background:
      radial-gradient(840px 480px at 3% -12%, rgba(196, 233, 31, 0.2), transparent 68%),
      radial-gradient(820px 500px at 98% 3%, rgba(60, 92, 155, 0.3), transparent 70%),
      linear-gradient(175deg, #070d1d, #0d1733 32%, #0b1a3c 76%, #070d1d);
    min-height: 100vh;
  }

  .lp-wrap {
    color: var(--ink);
    font-family: 'IBM Plex Sans', 'Segoe UI', Arial, sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  .lp-wrap h1, .lp-wrap h2, .lp-wrap h3, .lp-wrap h4 {
    font-family: 'Sora', 'Segoe UI', Arial, sans-serif;
  }

  /* Topbar */
  .topbar {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(7, 13, 29, 0.85);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--line);
  }
  .topbar-inner {
    max-width: 1160px;
    margin: 0 auto;
    padding: 0 32px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }
  .topbar-logo img { height: 32px; display: block; }
  .nav { display: flex; gap: 28px; }
  .nav a {
    color: var(--ink-soft);
    text-decoration: none;
    font-size: 15px;
    font-weight: 500;
    transition: color 0.15s;
  }
  .nav a:hover { color: var(--secondary); }
  .topbar-ctas { display: flex; gap: 10px; align-items: center; }
  .btn-ghost {
    padding: 8px 18px;
    border: 1px solid var(--line);
    border-radius: 8px;
    color: var(--ink);
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    background: transparent;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .btn-ghost:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.3); }
  .btn-primary {
    padding: 8px 18px;
    background: var(--secondary);
    border: none;
    border-radius: 8px;
    color: #0d1117;
    text-decoration: none;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.15s;
  }
  .btn-primary:hover { filter: brightness(1.08); }
  .mobile-menu-btn {
    display: none;
    background: none;
    border: none;
    color: var(--ink);
    font-size: 22px;
    cursor: pointer;
    padding: 4px;
  }

  /* Mobile menu */
  .mobile-menu {
    position: fixed;
    top: 64px;
    left: 0; right: 0;
    z-index: 99;
    background: var(--dark-2);
    border-bottom: 1px solid var(--line);
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .mobile-menu a {
    color: var(--ink-soft);
    text-decoration: none;
    font-size: 16px;
    font-weight: 500;
  }

  /* Hero */
  .hero { padding: 120px 32px 80px; max-width: 1160px; margin: 0 auto; }
  .hero-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    align-items: center;
  }
  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(196, 233, 31, 0.1);
    border: 1px solid rgba(196, 233, 31, 0.25);
    border-radius: 100px;
    padding: 6px 14px;
    margin-bottom: 28px;
    font-size: 12px;
    font-weight: 700;
    color: var(--secondary);
    letter-spacing: 0.06em;
  }
  .hero h1 {
    font-size: clamp(28px, 5vw, 52px);
    font-weight: 800;
    line-height: 1.15;
    margin: 0 0 20px;
    letter-spacing: -1px;
    color: var(--ink);
  }
  .hero h1 span { color: var(--secondary); }
  .hero p {
    font-size: 17px;
    color: var(--ink-soft);
    line-height: 1.65;
    margin: 0 0 32px;
    max-width: 520px;
  }
  .hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 28px; }
  .btn-primary-lg {
    padding: 13px 26px;
    background: var(--secondary);
    border-radius: 10px;
    color: #0d1117;
    text-decoration: none;
    font-size: 15px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: none;
    cursor: pointer;
    transition: filter 0.15s;
  }
  .btn-primary-lg:hover { filter: brightness(1.08); }
  .btn-ghost-lg {
    padding: 13px 26px;
    border: 1.5px solid var(--line);
    border-radius: 10px;
    color: var(--ink);
    text-decoration: none;
    font-size: 15px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-ghost-lg:hover { background: rgba(255,255,255,0.06); }
  .proof-badges { display: flex; flex-wrap: wrap; gap: 16px; }
  .proof-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-soft);
  }
  .proof-badge i { color: var(--secondary); }

  /* Hero stage */
  .hero-stage {
    position: relative;
    display: flex;
    justify-content: center;
  }
  .orb {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(60px);
    opacity: 0.35;
  }
  .orb-a {
    width: 280px; height: 280px;
    background: var(--secondary);
    top: -60px; right: -40px;
    animation: drift 8s ease-in-out infinite;
  }
  .orb-b {
    width: 200px; height: 200px;
    background: var(--primary);
    bottom: -40px; left: -20px;
    animation: drift 10s ease-in-out infinite 2s;
  }
  .glass-main {
    position: relative;
    z-index: 2;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 360px;
    overflow: hidden;
    box-shadow: var(--glow);
    backdrop-filter: blur(12px);
  }
  .chat-header {
    background: rgba(7,13,29,0.8);
    padding: 14px 18px;
    border-bottom: 1px solid var(--line);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .chat-avatar {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: var(--secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: #0d1117;
  }
  .chat-name { font-weight: 700; font-size: 14px; color: var(--ink); }
  .chat-status { font-size: 11px; color: #22c55e; }
  .chat-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 260px;
  }
  .msg { display: flex; }
  .msg.user { justify-content: flex-end; }
  .msg.bot { justify-content: flex-start; }
  .bubble {
    max-width: 82%;
    padding: 9px 13px;
    font-size: 13px;
    line-height: 1.4;
  }
  .msg.user .bubble {
    background: var(--secondary);
    color: #0d1117;
    border-radius: 14px 14px 4px 14px;
    font-weight: 500;
  }
  .msg.bot .bubble {
    background: rgba(30, 45, 69, 0.9);
    color: var(--ink);
    border-radius: 14px 14px 14px 4px;
  }

  /* Stack cards */
  .stack-a, .stack-b, .stack-c {
    position: absolute;
    z-index: 3;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 10px 14px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    backdrop-filter: blur(8px);
  }
  .stack-a { top: -16px; right: -20px; min-width: 140px; animation: floatAlt 3.5s ease-in-out infinite; }
  .stack-b { bottom: 60px; right: -28px; min-width: 140px; animation: floatAlt 4s ease-in-out infinite 0.5s; }
  .stack-c { bottom: -12px; left: -20px; min-width: 160px; animation: floatAlt 3s ease-in-out infinite 1s; }
  .stack-label { font-size: 10px; color: var(--ink-soft); font-weight: 600; letter-spacing: 0.05em; margin-bottom: 4px; }
  .stack-value { font-size: 20px; font-weight: 800; color: var(--secondary); }
  .stack-value.neutral { color: var(--ink); }
  .stack-value small { font-size: 13px; color: var(--ink-soft); }

  /* Marquee */
  .marquee-wrap {
    overflow: hidden;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    padding: 14px 0;
    background: rgba(7,13,29,0.6);
  }
  .marquee-track {
    display: flex;
    gap: 0;
    animation: slide 28s linear infinite;
    width: max-content;
  }
  .marquee-track:hover { animation-play-state: paused; }
  .marquee-item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    padding: 0 28px;
    color: var(--ink-soft);
    font-size: 14px;
    font-weight: 500;
  }
  .marquee-item i { color: var(--secondary); }
  .marquee-sep { color: var(--line); font-size: 18px; }

  /* Section common */
  .section { padding: 96px 32px; }
  .section-inner { max-width: 1160px; margin: 0 auto; }
  .section-header { text-align: center; margin-bottom: 56px; }
  .section-header h2 {
    font-size: clamp(24px, 4vw, 40px);
    font-weight: 800;
    margin: 0 0 16px;
    letter-spacing: -0.5px;
    color: var(--ink);
  }
  .section-header p {
    font-size: 16px;
    color: var(--ink-soft);
    max-width: 540px;
    margin: 0 auto;
    line-height: 1.65;
  }

  /* Features */
  .features {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  .feat-card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 28px 24px;
    transition: transform 0.2s, border-color 0.2s;
    backdrop-filter: blur(8px);
  }
  .feat-card:hover {
    transform: translateY(-5px) rotate(-.3deg);
    border-color: var(--secondary);
  }
  .feat-card i { font-size: 28px; color: var(--secondary); margin-bottom: 14px; display: block; }
  .feat-card h3 { font-size: 16px; font-weight: 700; margin: 0 0 10px; color: var(--ink); }
  .feat-card p { font-size: 14px; color: var(--ink-soft); line-height: 1.6; margin: 0; }

  /* Método / Split */
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: stretch; }
  .split-left {
    background: linear-gradient(135deg, var(--dark-3), var(--dark-2));
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 36px 32px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .split-left h3 { font-size: 22px; font-weight: 800; margin: 0 0 28px; color: var(--secondary); }
  .step-row { display: flex; gap: 14px; margin-bottom: 22px; }
  .step-row i { font-size: 20px; margin-top: 2px; color: var(--secondary); }
  .step-title { font-weight: 700; font-size: 16px; margin-bottom: 4px; color: var(--ink); }
  .step-desc { font-size: 14px; color: var(--ink-soft); line-height: 1.55; }
  .micro-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .micro-card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 24px 20px;
    backdrop-filter: blur(8px);
  }
  .micro-card i { font-size: 28px; color: var(--secondary); margin-bottom: 12px; display: block; }
  .micro-card h4 { font-weight: 700; font-size: 15px; margin: 0 0 8px; color: var(--ink); }
  .micro-card p { font-size: 13px; color: var(--ink-soft); line-height: 1.55; margin: 0; }

  /* Planos */
  .pricing { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 760px; margin: 0 auto; }
  .plan {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 36px 32px;
    position: relative;
    backdrop-filter: blur(8px);
    transition: transform 0.2s;
  }
  .plan:hover { transform: translateY(-4px); }
  .plan.best { border-color: var(--secondary); box-shadow: var(--glow); }
  .plan-badge {
    position: absolute;
    top: -14px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--secondary);
    color: #0d1117;
    font-size: 11px;
    font-weight: 800;
    padding: 5px 14px;
    border-radius: 100px;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }
  .plan-name { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: var(--ink); }
  .plan-price { margin-bottom: 24px; }
  .plan-price big { font-size: 38px; font-weight: 800; color: var(--ink); font-family: 'Sora', sans-serif; }
  .plan-price sup { font-size: 20px; font-weight: 700; }
  .plan-price span { font-size: 15px; color: var(--ink-soft); }
  .plan-items { list-style: none; padding: 0; margin: 0 0 28px; }
  .plan-items li { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; font-size: 14px; color: var(--ink-soft); }
  .plan-items li i { color: var(--secondary); font-size: 16px; margin-top: 1px; }
  .btn-plan-ghost {
    display: block;
    text-align: center;
    padding: 13px;
    border: 1.5px solid var(--line);
    border-radius: 10px;
    color: var(--ink);
    text-decoration: none;
    font-weight: 700;
    font-size: 15px;
    transition: background 0.15s;
    cursor: pointer;
  }
  .btn-plan-ghost:hover { background: rgba(255,255,255,0.06); }
  .btn-plan-primary {
    display: block;
    text-align: center;
    padding: 13px;
    background: var(--secondary);
    border-radius: 10px;
    color: #0d1117;
    text-decoration: none;
    font-weight: 700;
    font-size: 15px;
    transition: filter 0.15s;
    border: none;
    cursor: pointer;
  }
  .btn-plan-primary:hover { filter: brightness(1.08); }

  /* Depoimentos */
  .testimonials { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .quote-card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 28px 24px;
    backdrop-filter: blur(8px);
  }
  .quote-card i { font-size: 24px; color: var(--secondary); margin-bottom: 14px; display: block; }
  .quote-card p { font-size: 15px; color: var(--ink); line-height: 1.65; margin: 0 0 20px; font-style: italic; }
  .quote-author { font-weight: 700; font-size: 14px; color: var(--ink); }
  .quote-role { font-size: 13px; color: var(--ink-soft); }

  /* FAQ */
  .faq-section { padding: 96px 32px; max-width: 760px; margin: 0 auto; }
  .faq-section h2 { text-align: center; font-size: clamp(22px, 4vw, 36px); font-weight: 800; margin: 0 0 48px; letter-spacing: -0.5px; color: var(--ink); }
  details { border-bottom: 1px solid var(--line); }
  summary {
    cursor: pointer;
    padding: 18px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 16px;
    font-weight: 500;
    color: var(--ink);
    list-style: none;
    transition: color 0.15s;
  }
  summary::-webkit-details-marker { display: none; }
  summary:hover { color: var(--secondary); }
  summary::after { content: '+'; color: var(--secondary); font-size: 20px; transition: transform 0.2s; }
  details[open] summary::after { content: '-'; }
  .faq-answer { font-size: 15px; color: var(--ink-soft); line-height: 1.65; padding-bottom: 18px; }

  /* CTA Final */
  .cta { padding: 80px 32px; }
  .cta-inner {
    max-width: 1100px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 40px;
    background: radial-gradient(ellipse at 20% 50%, rgba(196, 233, 31, 0.08), transparent 60%), linear-gradient(135deg, var(--dark-3), var(--dark-2));
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 56px 48px;
  }
  .cta-inner h2 { font-size: clamp(22px, 4vw, 36px); font-weight: 800; margin: 0 0 16px; letter-spacing: -0.5px; color: var(--ink); }
  .cta-inner p { font-size: 16px; color: var(--ink-soft); margin: 0; line-height: 1.65; }

  /* Footer */
  .footer {
    border-top: 1px solid var(--line);
    padding: 24px 32px;
    text-align: center;
    color: var(--ink-soft);
    font-size: 14px;
  }
  .footer p { margin: 4px 0; }

  /* Scroll reveal */
  .reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.55s ease, transform 0.55s ease; }
  .reveal.in { opacity: 1; transform: translateY(0); }

  /* Noise overlay */
  .noise {
    pointer-events: none;
    position: fixed;
    inset: 0;
    z-index: 200;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  /* Animations */
  @keyframes slide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @keyframes pop { to { opacity: 1; transform: translateY(0); } }
  @keyframes floatY { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  @keyframes floatAlt { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
  @keyframes drift { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(22px, -16px) scale(1.04); } }

  /* Responsive */
  @media (max-width: 1040px) {
    .hero-grid, .split, .cta-inner { grid-template-columns: 1fr; }
    .cta-inner { text-align: center; }
    .cta-inner .btn-primary { justify-self: center; }
    .features, .pricing, .testimonials { grid-template-columns: repeat(2, 1fr); }
    .pricing { max-width: 100%; }
  }
  @media (max-width: 760px) {
    .nav { display: none; }
    .topbar-inner .btn-ghost { display: none; }
    .mobile-menu-btn { display: flex; }
    .glass-main { position: relative; width: 100%; }
    .stack-a, .stack-b, .stack-c { position: relative; top: auto; right: auto; bottom: auto; left: auto; width: 100%; animation: none; margin-top: 8px; }
    .features, .pricing, .testimonials, .micro-grid { grid-template-columns: 1fr; }
    .hero-stage { flex-direction: column; gap: 12px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
`;

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const doubleMarquee = [...marqueeItems, ...marqueeItems];

  return (
    <div className="lp-wrap">
      <style>{CSS}</style>
      <div className="noise" aria-hidden="true" />

      {/* TOPBAR */}
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-logo">
            <a href="#"><img src={LOGO_URL} alt="Finlly" /></a>
          </div>
          <nav className="nav" aria-label="Principal">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href}>{l.label}</a>
            ))}
          </nav>
          <div className="topbar-ctas">
            <a href="#planos" className="btn-ghost">Ver planos</a>
            <Link to="/login" className="btn-primary">Acessar</Link>
          </div>
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            <i className={mobileMenuOpen ? 'bi bi-x-lg' : 'bi bi-list'} />
          </button>
        </div>
      </header>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMobileMenuOpen(false)}>{l.label}</a>
          ))}
          <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
            <a href="#planos" className="btn-ghost" onClick={() => setMobileMenuOpen(false)}>Ver planos</a>
            <Link to="/login" className="btn-primary" onClick={() => setMobileMenuOpen(false)}>Acessar</Link>
          </div>
        </div>
      )}

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="hero-grid">
            {/* Left */}
            <div>
              <div className="kicker">
                <i className="bi bi-stars" />
                Nova geração de organização financeira pessoal
              </div>
              <h1>
                Uma experiência financeira que{' '}
                <span>parece produto de banco premium.</span>
              </h1>
              <p>
                A Finlly pega sua rotina no WhatsApp e transforma em sistema vivo: contas registradas, metas em trilha, lembretes no momento certo e acompanhamento contínuo.
              </p>
              <div className="hero-ctas">
                <Link to="/checkout" className="btn-primary-lg">
                  Começar agora <i className="bi bi-arrow-right" />
                </Link>
                <a href="#recursos" className="btn-ghost-lg">
                  Ver demonstração ▶
                </a>
              </div>
              <div className="proof-badges">
                <span className="proof-badge"><i className="bi bi-shield-lock" /> Políticas LGPD</span>
                <span className="proof-badge"><i className="bi bi-whatsapp" /> Fluxo nativo no WhatsApp</span>
                <span className="proof-badge"><i className="bi bi-lightning-charge" /> Ação em segundos</span>
              </div>
            </div>

            {/* Right — Hero Stage */}
            <div className="hero-stage">
              <div className="orb orb-a" aria-hidden="true" />
              <div className="orb orb-b" aria-hidden="true" />
              <div className="glass-main">
                <div className="chat-header">
                  <div className="chat-avatar">⚡</div>
                  <div>
                    <div className="chat-name">Finlly</div>
                    <div className="chat-status">● online</div>
                  </div>
                </div>
                <div className="chat-body">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`msg ${msg.from}`}>
                      <div className="bubble">{msg.text}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="stack-a">
                <div className="stack-label">CONSISTÊNCIA SEMANAL</div>
                <div className="stack-value">+31%</div>
              </div>
              <div className="stack-b">
                <div className="stack-label">TEMPO ECONOMIZADO</div>
                <div className="stack-value neutral">4h<small>/sem</small></div>
              </div>
              <div className="stack-c">
                <div className="stack-label">CONFIANÇA OPERACIONAL</div>
                <div className="stack-value">98.2%</div>
              </div>
            </div>
          </div>
        </section>

        {/* MARQUEE */}
        <div className="marquee-wrap" aria-hidden="true">
          <div className="marquee-track">
            {doubleMarquee.map((item, i) => (
              <span key={i} className="marquee-item">
                <i className={`bi ${item.icon}`} />
                {item.label}
                <span className="marquee-sep">|</span>
              </span>
            ))}
          </div>
        </div>

        {/* RECURSOS */}
        <section id="recursos" className="section reveal">
          <div className="section-inner">
            <div className="section-header">
              <h2>Recursos desenhados para sair do caos e entrar em ritmo</h2>
              <p>Nada de planilhas perdidas e decisão no improviso. A Finlly organiza, lembra e conduz seu plano financeiro de ponta a ponta.</p>
            </div>
            <div className="features">
              {features.map((f) => (
                <article key={f.title} className="feat-card reveal">
                  <i className={`bi ${f.icon}`} />
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* MÉTODO */}
        <section id="metodo" className="section reveal" style={{ background: 'rgba(7,13,29,0.5)' }}>
          <div className="section-inner">
            <div className="section-header">
              <h2>Método Finlly em 3 passos</h2>
            </div>
            <div className="split">
              <div className="split-left">
                <h3>Método Finlly</h3>
                {metodoSteps.map((s) => (
                  <div key={s.title} className="step-row">
                    <i className="bi bi-check2-circle" />
                    <div>
                      <div className="step-title">{s.title}</div>
                      <div className="step-desc">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="micro-grid">
                {metodoCards.map((c) => (
                  <article key={c.title} className="micro-card reveal">
                    <i className={`bi ${c.icon}`} />
                    <h4>{c.title}</h4>
                    <p>{c.desc}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PLANOS */}
        <section id="planos" className="section reveal">
          <div className="section-inner">
            <div className="section-header">
              <h2>Planos para transformar intenção em resultado</h2>
              <p>Escolha seu ritmo e comece hoje com acompanhamento direto no WhatsApp.</p>
            </div>
            <div className="pricing">
              {/* Mensal */}
              <div className="plan reveal">
                <div className="plan-name">Plano Mensal</div>
                <div className="plan-price">
                  <big>R$39,90</big>
                  <span>/mês</span>
                </div>
                <ul className="plan-items">
                  {mensal.map((item) => (
                    <li key={item}><i className="bi bi-check2" />{item}</li>
                  ))}
                </ul>
                <Link to="/checkout?plano=mensal" className="btn-plan-ghost">Assinar mensal</Link>
              </div>
              {/* Anual */}
              <div className="plan best reveal">
                <div className="plan-badge">Melhor custo</div>
                <div className="plan-name">Plano Anual</div>
                <div className="plan-price">
                  <big>R$399</big>
                  <span>/ano</span>
                </div>
                <ul className="plan-items">
                  {anual.map((item) => (
                    <li key={item}><i className="bi bi-check2" />{item}</li>
                  ))}
                </ul>
                <Link to="/checkout?plano=anual" className="btn-plan-primary">Assinar anual</Link>
              </div>
            </div>
          </div>
        </section>

        {/* DEPOIMENTOS */}
        <section className="section reveal" style={{ background: 'rgba(7,13,29,0.5)' }}>
          <div className="section-inner">
            <div className="section-header">
              <h2>Quem usa, percebe confiança e velocidade de execução</h2>
            </div>
            <div className="testimonials">
              {testimonials.map((t) => (
                <article key={t.author} className="quote-card reveal">
                  <i className="bi bi-quote" />
                  <p>{t.text}</p>
                  <div className="quote-author">{t.author}</div>
                  <div className="quote-role">{t.role}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="faq-section reveal">
          <h2>Perguntas frequentes</h2>
          {faqItems.map((item, idx) => (
            <details key={idx}>
              <summary>{item.q}</summary>
              <div className="faq-answer">{item.a}</div>
            </details>
          ))}
        </section>

        {/* CTA FINAL */}
        <section className="cta reveal">
          <div className="cta-inner">
            <div>
              <h2>Pronto para surpreender sua versão financeira?</h2>
              <p>Comece hoje e receba um plano prático no WhatsApp para organizar, executar e evoluir sem improviso.</p>
            </div>
            <Link to="/checkout" className="btn-primary">
              Começar agora <i className="bi bi-arrow-right" />
            </Link>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <p>© {year} Finlly. Todos os direitos reservados.</p>
        <p>Seus dados são protegidos conforme a LGPD. Finlly não compartilha informações pessoais com terceiros.</p>
      </footer>
    </div>
  );
}