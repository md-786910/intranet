// Azure AD (Microsoft Entra ID) sign-in service.
//
// Flow:
//   1. Frontend hits /auth/azure/login → we return Microsoft's authorization URL.
//   2. User authenticates at Microsoft, gets redirected to /auth/azure/callback with `code`.
//   3. The callback page on the frontend POSTs { code, state } to /auth/azure/callback (this server).
//   4. We exchange the code for an id_token, extract the user's email + Azure object id,
//      look up the local UserAccount, gate by invitation status, then issue our own JWT
//      via tokenService — the exact same response shape as POST /auth/login.
//
// Invariants:
//   - Never auto-creates a UserAccount (invite-only product rule).
//   - INVITED → ACTIVE transition happens on first Microsoft sign-in.
//   - azure_object_id is the durable identity link; email is only the seed.

const msal = require('@azure/msal-node');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

const azureConfig = require('../../../config/azure.config');
const ApiError = require('../../../utils/ApiError');
const tokenService = require('../../../services/token.service');
const permissionService = require('../../../services/permission.service');
const auditService = require('../../../services/audit.service');
const { assertAudienceAllowed, normalizeAudience } = require('../audience');
const azureGraphService = require('./azure-graph.service');
const logger = require('../../../config/logger');

const STATE_TTL_SECONDS = 600; // 10 minutes — enough for the user to authenticate

let msalClient = null;

function getMsalClient() {
  if (!azureConfig.enabled) {
    throw new ApiError(503, 'Microsoft sign-in is not configured on this server.');
  }
  if (msalClient) return msalClient;

  msalClient = new msal.ConfidentialClientApplication({
    auth: {
      clientId: azureConfig.clientId,
      authority: azureConfig.authority,
      clientSecret: azureConfig.clientSecret,
    },
  });
  return msalClient;
}

function signState({ redirectUri, audience }) {
  return jwt.sign(
    { nonce: uuidv4(), purpose: 'azure-sso-state', redirectUri, audience },
    process.env.JWT_SECRET,
    { expiresIn: STATE_TTL_SECONDS, issuer: 'BrightNow-intranet' },
  );
}

function verifyState(state) {
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET, {
      issuer: 'BrightNow-intranet',
    });
    if (decoded.purpose !== 'azure-sso-state') {
      throw new Error('Invalid state purpose');
    }
    return decoded;
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired sign-in session. Please try again.');
  }
}

function extractClaims(idTokenClaims) {
  const oid = idTokenClaims.oid;
  const email = (idTokenClaims.email || idTokenClaims.preferred_username || '').toLowerCase().trim();

  if (!oid) throw ApiError.unauthorized('Microsoft sign-in response missing user identifier.');
  if (!email) throw ApiError.unauthorized('Microsoft account has no email address. Contact your administrator.');

  return {
    oid,
    email,
    given_name: idTokenClaims.given_name || null,
    family_name: idTokenClaims.family_name || null,
    name: idTokenClaims.name || null,
  };
}

// Build update objects for UserAccount + PersonProfile from Azure data.
// Returns only fields where Azure provided a non-empty value so we never
// overwrite existing data with nulls.
function buildProfileUpdates({ claims, graph }) {
  const userUpdates = {};
  const profileUpdates = {};

  const firstName = graph?.givenName || claims.given_name;
  const lastName = graph?.surname || claims.family_name;
  if (firstName) userUpdates.first_name = firstName;
  if (lastName) userUpdates.last_name = lastName;

  const phone = graph?.mobilePhone || graph?.businessPhones?.[0];
  if (phone) userUpdates.phone = phone;

  if (graph?.jobTitle) profileUpdates.job_title = graph.jobTitle;
  if (graph?.department) profileUpdates.department_display = graph.department;
  if (graph?.officeLocation) profileUpdates.location = graph.officeLocation;

  return { userUpdates, profileUpdates };
}

async function syncProfileFromAzure({ user, claims, graphMe, transaction }) {
  const { PersonProfile } = require('../../../database/models');
  const { userUpdates, profileUpdates } = buildProfileUpdates({ claims, graph: graphMe });

  if (Object.keys(userUpdates).length) {
    await user.update(userUpdates, { transaction });
  }

  if (Object.keys(profileUpdates).length) {
    const [profile] = await PersonProfile.findOrCreate({
      where: { user_id: user.user_id },
      defaults: { user_id: user.user_id, ...profileUpdates },
      transaction,
    });
    if (profile) await profile.update(profileUpdates, { transaction });
  }
}

async function findUserForAzureLogin({ oid, email }) {
  const { UserAccount } = require('../../../database/models');

  // Prefer the durable object_id match (set after first successful Microsoft sign-in).
  let user = await UserAccount.findOne({ where: { azure_object_id: oid } });
  if (user) return { user, firstLink: false };

  // Fall back to email — only matches accounts a platform owner has explicitly invited.
  user = await UserAccount.findOne({ where: { email } });
  if (!user) return { user: null, firstLink: false };

  return { user, firstLink: true };
}

function assertLoginAllowed(user) {
  if (user.status === 'INACTIVE' || user.deleted_at) {
    throw ApiError.unauthorized('Account is not active. Contact your administrator.');
  }
  if (user.status === 'LOCKED') {
    throw ApiError.unauthorized('Account is locked. Contact your administrator.');
  }
  // INVITED is allowed — first Microsoft sign-in activates the account below.
}

async function activateIfInvited(user, transaction) {
  if (user.status !== 'INVITED') return;
  const { EmployeeInvitation } = require('../../../database/models');

  await user.update({
    status: 'ACTIVE',
    email_verified: true,
    failed_login_attempts: 0,
    locked_until: null,
  }, { transaction });

  // Expire any pending invitation token — it's no longer needed.
  await EmployeeInvitation.update(
    { expires_at: new Date() },
    {
      where: {
        user_id: user.user_id,
        accepted_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      transaction,
    },
  );
}

function resolveRedirectUri(requested) {
  if (!requested) return azureConfig.defaultRedirectUri;
  if (!azureConfig.isAllowedRedirectUri(requested)) {
    throw ApiError.badRequest('Redirect URI is not in the allowlist.');
  }
  return requested;
}

const azureService = {
  /**
   * Build the Microsoft authorization URL the browser should redirect to.
   * Includes a signed `state` parameter for CSRF protection.
   * The state also carries the chosen redirect URI so the callback can use
   * the *same* value when exchanging the code (Microsoft requires that).
   */
  async buildAuthUrl({ redirectUri: requestedRedirectUri, audience } = {}) {
    const client = getMsalClient();
    const redirectUri = resolveRedirectUri(requestedRedirectUri);
    const state = signState({ redirectUri, audience: normalizeAudience(audience) });

    const url = await client.getAuthCodeUrl({
      scopes: azureConfig.scopes,
      redirectUri,
      state,
      prompt: 'select_account',
    });

    return { url };
  },

  /**
   * Handle the OAuth callback: exchange code, gate on invitation status,
   * issue our app's own JWT + refresh token. Returns the same shape as
   * authService.login().
   */
  async handleCallback({ code, state, ipAddress, userAgent }) {
    const { sequelize } = require('../../../database/models');
    const client = getMsalClient();

    const decodedState = verifyState(state);
    const redirectUri = resolveRedirectUri(decodedState.redirectUri);

    let tokenResponse;
    try {
      tokenResponse = await client.acquireTokenByCode({
        code,
        scopes: azureConfig.scopes,
        redirectUri,
      });
    } catch (err) {
      logger.warn(`[azure-sso] code exchange failed: ${err.message}`);
      throw ApiError.unauthorized('Microsoft sign-in failed. Please try again.');
    }

    const claims = extractClaims(tokenResponse.idTokenClaims || {});
    const { user, firstLink } = await findUserForAzureLogin(claims);

    if (!user) {
      await auditService.log({
        action: 'AZURE_LOGIN_REJECTED',
        details: { email: claims.email, reason: 'not_invited' },
        ip_address: ipAddress,
        user_agent: userAgent,
        result: 'FAILURE',
      });
      throw ApiError.unauthorized(
        'No invitation found for this Microsoft account. Please contact your administrator.',
      );
    }

    assertLoginAllowed(user);

    // Audience gate: e.g., reject EMPLOYEE-only users at the admin panel.
    await assertAudienceAllowed(user.user_id, decodedState.audience);

    // Best-effort Graph fetch — never blocks login on failure.
    const graphMe = await azureGraphService.fetchMe(tokenResponse.accessToken);

    await sequelize.transaction(async (transaction) => {
      await activateIfInvited(user, transaction);

      const updates = { last_login_at: new Date() };
      if (firstLink) updates.azure_object_id = claims.oid;
      await user.update(updates, { transaction });

      await syncProfileFromAzure({ user, claims, graphMe, transaction });
    });

    const { accessToken } = tokenService.generateAccessToken({
      userId: user.user_id,
      email: user.email,
    });

    const familyId = uuidv4();
    const { refreshToken, tokenHash } = tokenService.generateRefreshToken();
    await tokenService.storeRefreshToken({
      userId: user.user_id,
      tokenHash,
      familyId,
      ipAddress,
      userAgent,
    });

    const permissions = await permissionService.getAllGrantedPermissions(user.user_id);

    await auditService.log({
      user_id: user.user_id,
      action: 'USER_LOGIN',
      details: { method: 'AZURE_SSO', first_link: firstLink },
      ip_address: ipAddress,
      user_agent: userAgent,
      result: 'SUCCESS',
    });

    return {
      accessToken,
      refreshToken,
      user: user.toSafeJSON(),
      permissions,
    };
  },

  isEnabled() {
    return azureConfig.enabled;
  },
};

module.exports = azureService;
