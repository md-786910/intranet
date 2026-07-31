const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const logger = require("../config/logger");

const APP_NAME = process.env.APP_NAME || "BrightNow";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
const EMPLOYEE_APP_BASE_URL =
  process.env.EMPLOYEE_APP_BASE_URL || APP_BASE_URL;

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

const templateCache = {};
function loadTemplate(name) {
  if (templateCache[name]) return templateCache[name];
  const templatePath = path.join(__dirname, "..", "emails", `${name}.html`);
  templateCache[name] = fs.readFileSync(templatePath, "utf-8");
  return templateCache[name];
}

function renderTemplate(template, vars) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value ?? "")),
    template,
  );
}

function buildAcceptUrl(token) {
  return `${EMPLOYEE_APP_BASE_URL.replace(/\/$/, "")}/invitations/${token}`;
}

function buildResetUrl(token, client = "employee") {
  const base =
    client === "admin"
      ? APP_BASE_URL.replace(/\/$/, "")
      : EMPLOYEE_APP_BASE_URL.replace(/\/$/, "");
  return `${base}/reset-password/${token}`;
}

function formatExpiresAt(expiresAt) {
  return new Date(expiresAt).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function sendEmployeeInvitation({
  to,
  firstName,
  inviterName,
  token,
  expiresAt,
}) {
  const acceptUrl = buildAcceptUrl(token);
  const html = renderTemplate(loadTemplate("employee-invitation"), {
    appName: APP_NAME,
    firstName: firstName || "there",
    inviterName: inviterName || "An administrator",
    acceptUrl,
    expiresAt: new Date(expiresAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  });

  const transport = getTransport();
  if (!transport) {
    logger.warn(
      `[email] SMTP not configured — invitation link for ${to}: ${acceptUrl}`,
    );
    return { delivered: false, acceptUrl };
  }

  const from =
    process.env.SMTP_FROM ||
    `"${APP_NAME}" <no-reply@${APP_NAME.toLowerCase()}.local>`;
  await transport.sendMail({
    from,
    to,
    subject: `You're invited to ${APP_NAME}`,
    html,
  });

  logger.info(`[email] Invitation sent to ${to}`);
  return { delivered: true, acceptUrl };
}

async function sendWelcomeUser({
  to,
  firstName,
  email,
  password,
  rolesBlock,
  companyName,
  inviterName,
}) {
  const loginUrl = EMPLOYEE_APP_BASE_URL.replace(/\/$/, "");
  const safeCompanyName = companyName || APP_NAME;
  const safeInviterName = inviterName || "Your administrator";

  const html = renderTemplate(loadTemplate("welcome-user"), {
    appName: APP_NAME,
    companyName: safeCompanyName,
    firstName: firstName || "there",
    email,
    password,
    rolesBlock: rolesBlock || "No role assigned yet — your administrator will assign one soon.",
    inviterName: safeInviterName,
    loginUrl,
  });

  const transport = getTransport();
  if (!transport) {
    logger.warn(
      `[email] SMTP not configured — welcome email for ${to} (login: ${loginUrl})`,
    );
    return { delivered: false, loginUrl };
  }

  const from =
    process.env.SMTP_FROM ||
    `"${safeCompanyName}" <no-reply@${APP_NAME.toLowerCase()}.local>`;
  await transport.sendMail({
    from,
    to,
    subject: `Welcome to ${safeCompanyName} on ${APP_NAME}`,
    html,
  });

  logger.info(`[email] Welcome email sent to ${to}`);
  return { delivered: true, loginUrl };
}

async function sendPasswordReset({ to, firstName, token, expiresAt, client = "employee" }) {
  const resetUrl = buildResetUrl(token, client);
  const html = renderTemplate(loadTemplate("password-reset"), {
    appName: APP_NAME,
    firstName: firstName || "there",
    resetUrl,
    expiresAt: formatExpiresAt(expiresAt),
  });

  const transport = getTransport();
  if (!transport) {
    logger.warn(
      `[email] SMTP not configured — password reset link for ${to}: ${resetUrl}`,
    );
    return { delivered: false, resetUrl };
  }

  const from =
    process.env.SMTP_FROM ||
    `"${APP_NAME}" <no-reply@${APP_NAME.toLowerCase()}.local>`;
  await transport.sendMail({
    from,
    to,
    subject: `Reset your ${APP_NAME} password`,
    html,
  });

  logger.info(`[email] Password reset sent to ${to}`);
  return { delivered: true, resetUrl };
}

module.exports = {
  sendEmployeeInvitation,
  sendPasswordReset,
  sendWelcomeUser,
  buildAcceptUrl,
  buildResetUrl,
};
