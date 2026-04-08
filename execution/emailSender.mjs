import nodemailer from 'nodemailer';

function smtpConfigFromEnv() {
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    return {
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    };
  }

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return {
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    };
  }

  return null;
}

export function canSendEmail() {
  return Boolean(smtpConfigFromEnv());
}

export async function sendEmail({ to, subject, body }) {
  const transportConfig = smtpConfigFromEnv();
  if (!transportConfig) {
    throw new Error('Missing SMTP credentials. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS or EMAIL_USER/EMAIL_PASS.');
  }

  const fromAddress = process.env.EMAIL_FROM ?? process.env.EMAIL_USER ?? process.env.SMTP_USER;
  const transporter = nodemailer.createTransport(transportConfig);

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text: body,
  });

  console.log(`[EMAIL] Sent message ${info.messageId ?? 'unknown-id'} to ${to}`);
  return info;
}
