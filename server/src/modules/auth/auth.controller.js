const catchAsync = require('../../utils/catchAsync');
const authService = require('./auth.service');
const employeesService = require('../employees/employees.service');

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(
    email,
    password,
    req.ip,
    req.headers['user-agent']
  );

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

const refresh = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await authService.refresh(
    refreshToken,
    req.ip,
    req.headers['user-agent']
  );

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

const logout = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  // Decode the access token to get expiry for blacklist TTL
  const jwt = require('jsonwebtoken');
  const authHeader = req.headers.authorization;
  const token = authHeader.split(' ')[1];
  const decoded = jwt.decode(token);

  await authService.logout(
    req.user.user_id,
    req.user.jti,
    decoded.exp,
    refreshToken
  );

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  await authService.changePassword(
    req.user.user_id,
    currentPassword,
    newPassword
  );

  res.status(200).json({
    status: 'success',
    message: 'Password changed successfully. Please log in again.',
  });
});

const getMe = catchAsync(async (req, res) => {
  const result = await authService.getMe(req.user.user_id);

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

const updateProfile = catchAsync(async (req, res) => {
  const result = await authService.updateProfile(req.user.user_id, req.body);

  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: result,
  });
});

const validateInvitation = catchAsync(async (req, res) => {
  const result = await employeesService.validateInvitation(req.params.token);
  res.status(200).json({ status: 'success', data: result });
});

const acceptInvitation = catchAsync(async (req, res) => {
  const result = await employeesService.acceptInvitation(
    req.params.token,
    req.body.password,
    req.ip,
    req.headers['user-agent'],
  );
  res.status(200).json({ status: 'success', data: result });
});

const forgotPassword = catchAsync(async (req, res) => {
  await authService.forgotPassword(
    req.body.email,
    req.ip,
    req.headers['user-agent'],
  );
  // Generic response — never reveal whether the account exists
  res.status(200).json({
    status: 'success',
    message: 'If that email is registered, a reset link has been sent.',
  });
});

const validatePasswordReset = catchAsync(async (req, res) => {
  const result = await authService.validatePasswordResetToken(req.params.token);
  res.status(200).json({ status: 'success', data: result });
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.params.token, req.body.password);
  res.status(200).json({
    status: 'success',
    message: 'Password reset. Please log in with your new password.',
  });
});

module.exports = {
  login,
  refresh,
  logout,
  changePassword,
  getMe,
  updateProfile,
  validateInvitation,
  acceptInvitation,
  forgotPassword,
  validatePasswordReset,
  resetPassword,
};
