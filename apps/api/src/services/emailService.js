import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import logger from '../logger.js';

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

export async function sendEmail({ to, subject, html }) {
  const transporter = createTransporter();
  if (!transporter) {
    logger.warn({
      msg: 'Email not sent — MAIL_HOST/MAIL_USER/MAIL_PASSWORD not configured',
      to,
      subject,
    });
    return;
  }
  try {
    await transporter.sendMail({ from: config.MAIL_FROM, to, subject, html });
    logger.info({ msg: 'Email sent', to, subject });
  } catch (err) {
    logger.error({
      msg: 'Failed to send email',
      to,
      subject,
      err: err.message,
    });
    throw err;
  }
}

function emailLayout(conteudo) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#1a3a5c;padding:28px 40px;text-align:center;">
            <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.04em;">Finlly</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            ${conteudo}
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #e2e8f0;padding:18px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:#a0aec0;">© 2026 Finlly · Gestão financeira pessoal</td>
                <td align="right" style="font-size:12px;color:#a0aec0;">noreply@finlly.com.br</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendEmailVerification({ to, verifyLink }) {
  const html = emailLayout(`
    <h1 style="font-size:20px;font-weight:600;color:#1a202c;margin:0 0 8px;">Verifique seu e-mail</h1>
    <p style="font-size:15px;color:#4a5568;line-height:1.6;margin:0 0 28px;">Olá! Para ativar sua conta no Finlly, confirme que este é o seu endereço de e-mail clicando no botão abaixo.</p>
    <a href="${verifyLink}" style="display:block;text-align:center;background:#1a3a5c;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:600;margin-bottom:24px;">Verificar e-mail</a>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7fafc;border-radius:8px;margin-bottom:28px;">
      <tr><td style="padding:14px 16px;font-size:13px;color:#718096;">
        &#9432; Este link é válido por <strong style="color:#2d3748;">24 horas</strong>. Após esse prazo, solicite um novo.
      </td></tr>
    </table>
    <p style="font-size:13px;color:#718096;line-height:1.6;margin:0;">Se você não criou uma conta no Finlly, pode ignorar este e-mail com segurança.</p>
  `);
  await sendEmail({ to, subject: 'Verificação de E-mail - Finlly', html });
}

export async function sendPasswordResetEmail({ to, resetLink }) {
  const html = emailLayout(`
    <h1 style="font-size:20px;font-weight:600;color:#1a202c;margin:0 0 8px;">Recuperar senha</h1>
    <p style="font-size:15px;color:#4a5568;line-height:1.6;margin:0 0 28px;">Recebemos uma solicitação para redefinir a senha da sua conta no Finlly. Clique no botão abaixo para criar uma nova senha.</p>
    <a href="${resetLink}" style="display:block;text-align:center;background:#1a3a5c;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:600;margin-bottom:24px;">Redefinir senha</a>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0;border-radius:8px;margin-bottom:28px;border:1px solid #fbd38d;">
      <tr><td style="padding:14px 16px;font-size:13px;color:#744210;">
        &#9888; Este link é válido por <strong>15 minutos</strong> e pode ser usado apenas uma vez.
      </td></tr>
    </table>
    <p style="font-size:13px;color:#718096;line-height:1.6;margin:0;">Se você não solicitou a recuperação de senha, ignore este e-mail. Sua senha permanece a mesma.</p>
  `);
  await sendEmail({ to, subject: 'Recuperação de Senha - Finlly', html });
}

export async function sendPasswordChangedEmail({ to }) {
  const html = emailLayout(`
    <h1 style="font-size:20px;font-weight:600;color:#1a202c;margin:0 0 8px;">Senha alterada com sucesso</h1>
    <p style="font-size:15px;color:#4a5568;line-height:1.6;margin:0 0 28px;">A senha da sua conta no Finlly foi alterada com sucesso.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fff4;border-radius:8px;margin-bottom:28px;border:1px solid #9ae6b4;">
      <tr><td style="padding:14px 16px;font-size:13px;color:#276749;">
        &#10003; Alteração realizada em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
      </td></tr>
    </table>
    <p style="font-size:13px;color:#718096;line-height:1.6;margin:0;">Se você não realizou esta alteração, entre em contato conosco imediatamente respondendo este e-mail.</p>
  `);
  await sendEmail({ to, subject: 'Senha Alterada - Finlly', html });
}
