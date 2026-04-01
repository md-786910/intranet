const winston = require('winston');

// Fields to redact from log output
const SENSITIVE_FIELDS = ['password', 'password_hash', 'token', 'refreshToken', 'authorization', 'cookie'];

const redactSensitive = winston.format((info) => {
  if (info.meta && typeof info.meta === 'object') {
    const redacted = { ...info.meta };
    SENSITIVE_FIELDS.forEach((field) => {
      if (redacted[field]) {
        redacted[field] = '[REDACTED]';
      }
    });
    info.meta = redacted;
  }
  return info;
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    redactSensitive(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, stack, ...rest }) => {
            let log = `${timestamp} [${level}]: ${message}`;
            if (stack) log += `\n${stack}`;
            if (Object.keys(rest).length > 0) {
              log += ` ${JSON.stringify(rest)}`;
            }
            return log;
          })
        )
  ),
  transports: [
    new winston.transports.Console(),
  ],
  exitOnError: false,
});

// Stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

module.exports = logger;
