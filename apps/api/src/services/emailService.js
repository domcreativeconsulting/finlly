import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import logger from '../logger.js';

/**
 * Creates a nodemailer transporter if email is configured, otherwise returns null.
 * @returns {import('nodemailer').Transporter | null}
 */
function createTransporter() {
  if (!config.MAIL_HOST || !config.MAIL_USER || !config.MAIL_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.MAIL_HOST,
    port: config.MAIL_PORT,
    secure: config.MAIL_PORT === 465,
    auth: {
      user: config.MAIL_USER,
      pass: config.MAIL_PASSWORD,
    },
  });
}

/**
 * Sends an email. Logs a warning and skips silently if email is not configured.
 * @param {{ to: string, subject: string, html: string }} options
 */
export async function sendEmail({ to, subject, html }) {
  const transporter = createTransporter();

  if (!transporter) {
    logger.warn({ msg: 'Email not sent — MAIL_HOST/MAIL_USER/MAIL_PASSWORD not configured', to, subject });
    return;
  }

  try {
    await transporter.sendMail({
      from: config.MAIL_FROM,
      to,
      subject,
      html,
    });
    logger.info({ msg: 'Email sent', to, subject });
  } catch (err) {
    logger.error({ msg: 'Failed to send email', to, subject, err: err.message });
    throw err;
  }
}

/**
 * Sends a password reset email.
 * @param {{ to: string, resetLink: string }} options
 */
export async function sendPasswordResetEmail({ to, resetLink }) {
  const html = `
    <h1>Recuperar Senha</h1>
    <p>Clique no link abaixo para redefinir sua senha.</p>
    <p>Este link é válido por 15 minutos.</p>
    <a href="${resetLink}">Redefinir Senha</a>
    <p>Se você não solicitou, ignore este e-mail.</p>
  `;

  await sendEmail({ to, subject: 'Recuperação de Senha - Finlly', html });
}

/**
 * Sends an email verification email.
 * @param {{ to: string, verifyLink: string }} options
 */
export async function sendEmailVerification({ to, verifyLink }) {
  const html = `
    <h1>Verificação de E-mail</h1>
    <p>Clique no link abaixo para verificar seu e-mail.</p>
    <p>Este link é válido por 24 horas.</p>
    <a href="${verifyLink}">Verificar E-mail</a>
    <p>Se você não se cadastrou no Finlly, ignore este e-mail.</p>
  `;

  await sendEmail({ to, subject: 'Verificação de E-mail - Finlly', html });
}

/**
 * Sends a password change confirmation email.
 * @param {{ to: string }} options
 */
export async function sendPasswordChangedEmail({ to }) {
  const html = `
    <h1>Senha Alterada com Sucesso</h1>
    <p>Sua senha foi alterada com sucesso.</p>
    <p>Se você não realizou esta ação, entre em contato conosco imediatamente.</p>
  `;

  await sendEmail({ to, subject: 'Senha Alterada - Finlly', html });
}
