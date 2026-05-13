const catchAsync = require('../../../utils/catchAsync');
const azureService = require('./azure.service');

const getStatus = (req, res) => {
  res.status(200).json({
    status: 'success',
    data: { enabled: azureService.isEnabled() },
  });
};

const getAuthUrl = catchAsync(async (req, res) => {
  const result = await azureService.buildAuthUrl({
    redirectUri: req.query.redirect_uri,
    audience: req.query.audience,
  });
  res.status(200).json({ status: 'success', data: result });
});

const handleCallback = catchAsync(async (req, res) => {
  const { code, state } = req.body;
  const result = await azureService.handleCallback({
    code,
    state,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { getStatus, getAuthUrl, handleCallback };
