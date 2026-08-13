const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const logger = require("../config/logger");
const organisationContextService = require("./organisation-context.service");

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

/**
 * Prefer organisation.name from DB, then optional caller override, then APP_NAME.
 */
async function resolveCompanyName(override) {
  const trimmedOverride = override && String(override).trim() ? String(override).trim() : null;
  try {
    const organisation = await organisationContextService.getCurrentOrganisation();
    const fromDb = organisation?.name && String(organisation.name).trim();
    if (fromDb) return fromDb;
  } catch (err) {
    logger.warn(`[email] Could not resolve organisation name: ${err.message}`);
  }
  return trimmedOverride || APP_NAME;
}

async function sendEmployeeInvitation({
  to,
  firstName,
  inviterName,
  token,
  expiresAt,
  companyName,
}) {
  const acceptUrl = buildAcceptUrl(token);
  const safeCompanyName = await resolveCompanyName(companyName);
  const html = renderTemplate(loadTemplate("employee-invitation"), {
    appName: APP_NAME,
    companyName: safeCompanyName,
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
    `"${safeCompanyName}" <no-reply@${APP_NAME.toLowerCase()}.local>`;
  await transport.sendMail({
    from,
    to,
    subject: `You're invited to ${safeCompanyName}`,
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
  const safeCompanyName = await resolveCompanyName(companyName);
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

async function sendPasswordReset({
  to,
  firstName,
  token,
  expiresAt,
  client = "employee",
  companyName,
}) {
  const resetUrl = buildResetUrl(token, client);
  const safeCompanyName = await resolveCompanyName(companyName);
  const html = renderTemplate(loadTemplate("password-reset"), {
    appName: APP_NAME,
    companyName: safeCompanyName,
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
    `"${safeCompanyName}" <no-reply@${APP_NAME.toLowerCase()}.local>`;
  await transport.sendMail({
    from,
    to,
    subject: `Reset your ${safeCompanyName} password`,
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
