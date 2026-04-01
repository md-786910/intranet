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

module.exports = router;
