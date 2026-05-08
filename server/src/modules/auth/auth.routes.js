const router = require("express").Router();
const controller = require("./auth.controller");
const validate = require("../../middleware/validate");
const authenticate = require("../../middleware/authenticate");
const auditLogger = require("../../middleware/auditLogger");
const { authLimiter } = require("../../middleware/rateLimiter");
const schemas = require("./auth.validation");

// POST /api/v1/auth/login
router.post(
  "/login",
  authLimiter,
  validate(schemas.loginSchema),
  auditLogger("USER_LOGIN_ATTEMPT"),
  controller.login,
);

// POST /api/v1/auth/refresh
router.post(
  "/refresh",
  authLimiter,
  validate(schemas.refreshSchema),
  controller.refresh,
);

// POST /api/v1/auth/logout
router.post(
  "/logout",
  authenticate,
  auditLogger("USER_LOGOUT"),
  controller.logout,
);

// PUT /api/v1/auth/change-password
router.put(
  "/change-password",
  authenticate,
  validate(schemas.changePasswordSchema),
  auditLogger("PASSWORD_CHANGE"),
  controller.changePassword,
);

// GET /api/v1/auth/me
router.get("/me", authenticate, controller.getMe);

// PUT /api/v1/auth/profile
router.put(
  "/profile",
  authenticate,
  validate(schemas.updateProfileSchema),
  auditLogger("PROFILE_UPDATED"),
  controller.updateProfile,
);

// GET /api/v1/auth/invitations/:token/validate (public)
router.get(
  "/invitations/:token/validate",
  authLimiter,
  validate(schemas.invitationTokenParam),
  controller.validateInvitation,
);

// POST /api/v1/auth/invitations/:token/accept (public)
router.post(
  "/invitations/:token/accept",
  authLimiter,
  validate(schemas.acceptInvitationSchema),
  auditLogger("EMPLOYEE_INVITE_ACCEPTED"),
  controller.acceptInvitation,
);

// POST /api/v1/auth/forgot-password (public)
router.post(
  "/forgot-password",
  authLimiter,
  validate(schemas.forgotPasswordSchema),
  auditLogger("PASSWORD_RESET_REQUESTED"),
  controller.forgotPassword,
);

// GET /api/v1/auth/password-resets/:token/validate (public)
router.get(
  "/password-resets/:token/validate",
  authLimiter,
  validate(schemas.resetTokenParam),
  controller.validatePasswordReset,
);

// POST /api/v1/auth/password-resets/:token/reset (public)
router.post(
  "/password-resets/:token/reset",
  authLimiter,
  validate(schemas.resetPasswordSchema),
  auditLogger("PASSWORD_RESET_COMPLETED"),
  controller.resetPassword,
);

module.exports = router;
