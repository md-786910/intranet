const Joi = require('joi');

const loginSchema = {
  body: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .lowercase()
      .trim()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
      }),
    password: Joi.string()
      .min(8)
      .max(128)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'any.required': 'Password is required',
      }),
  }),
};

const refreshSchema = {
  body: Joi.object({
    refreshToken: Joi.string()
      .required()
      .messages({
        'any.required': 'Refresh token is required',
      }),
  }),
};

const passwordPattern = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/)
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.pattern.base': 'Password must contain at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character',
  });

const changePasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'any.required': 'Current password is required',
      }),
    newPassword: passwordPattern.required().messages({
      'any.required': 'New password is required',
    }),
  }),
};

const invitationTokenParam = {
  params: Joi.object({
    token: Joi.string().hex().length(64).required(),
  }),
};

const acceptInvitationSchema = {
  params: Joi.object({
    token: Joi.string().hex().length(64).required(),
  }),
  body: Joi.object({
    password: passwordPattern.required(),
  }),
};

const forgotPasswordSchema = {
  body: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .lowercase()
      .trim()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
      }),
  }),
};

const resetTokenParam = {
  params: Joi.object({
    token: Joi.string().hex().length(64).required(),
  }),
};

const resetPasswordSchema = {
  params: Joi.object({
    token: Joi.string().hex().length(64).required(),
  }),
  body: Joi.object({
    password: passwordPattern.required(),
  }),
};

const updateProfileSchema = {
  body: Joi.object({
    first_name: Joi.string().max(100).required().messages({
      'string.max': 'First name cannot exceed 100 characters',
      'any.required': 'First name is required',
    }),
    last_name: Joi.string().max(100).required().messages({
      'string.max': 'Last name cannot exceed 100 characters',
      'any.required': 'Last name is required',
    }),
    phone: Joi.string().max(20).allow('', null).messages({
      'string.max': 'Phone number cannot exceed 20 characters',
    }),
  }),
};

module.exports = {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  invitationTokenParam,
  acceptInvitationSchema,
  forgotPasswordSchema,
  resetTokenParam,
  resetPasswordSchema,
  updateProfileSchema,
};
