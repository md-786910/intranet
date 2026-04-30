const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const APP_NAME = process.env.APP_NAME || 'Brighthouse';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

let cachedTransport = null;
function getTransport() {
  if (cachedTransport) return cachedTransport;
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) return null;

  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return cachedTransport;
}

let cachedInvitationTemplate = null;
function loadInvitationTemplate() {
  if (cachedInvitationTemplate) return cachedInvitationTemplate;
  const templatePath = path.join(__dirname, '..', 'emails', 'employee-invitation.html');
  cachedInvitationTemplate = fs.readFileSync(templatePath, 'utf-8');
  return cachedInvitationTemplate;
}

function renderTemplate(template, vars) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value ?? '')),
    template,
  );
}

function buildAcceptUrl(token) {
  return `${APP_BASE_URL.replace(/\/$/, '')}/invitations/${token}`;
}

async function sendEmployeeInvitation({ to, firstName, inviterName, token, expiresAt }) {
  const acceptUrl = buildAcceptUrl(token);
  const html = renderTemplate(loadInvitationTemplate(), {
    appName: APP_NAME,
    firstName: firstName || 'there',
    inviterName: inviterName || 'An administrator',
    acceptUrl,
    expiresAt: new Date(expiresAt).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    }),
  });

  const transport = getTransport();
  if (!transport) {
    logger.warn(`[email] SMTP not configured — invitation link for ${to}: ${acceptUrl}`);
    return { delivered: false, acceptUrl };
  }

  const from = process.env.SMTP_FROM || `"${APP_NAME}" <no-reply@${APP_NAME.toLowerCase()}.local>`;
  await transport.sendMail({
    from,
    to,
    subject: `You're invited to ${APP_NAME}`,
    html,
  });

  logger.info(`[email] Invitation sent to ${to}`);
  return { delivered: true, acceptUrl };
}

module.exports = {
  sendEmployeeInvitation,
  buildAcceptUrl,
};
