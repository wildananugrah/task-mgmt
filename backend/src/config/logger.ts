import winston from 'winston';
import LokiTransport from 'winston-loki';
import config from './index';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...metadata } = info;
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata, null, 2)}`;
    }
    return msg;
  })
);

// Define which level to log based on environment
const level = () => {
  const env = config.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Define transports
const transports = [];

// Console transport for development
if (config.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: level(),
    })
  );
} else {
  // Simple console for production
  transports.push(
    new winston.transports.Console({
      format,
      level: level(),
    })
  );
}

// File transport for errors
transports.push(
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  })
);

// File transport for all logs
transports.push(
  new winston.transports.File({
    filename: 'logs/combined.log',
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  })
);

// Loki transport for centralized logging
if (config.LOKI_URL) {
  transports.push(
    new LokiTransport({
      host: config.LOKI_URL,
      labels: {
        app: 'be-api-generic',
        env: config.NODE_ENV || 'development',
      },
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      onConnectionError: (err) => {
        console.error('Loki connection error:', err);
      },
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream for HTTP logs (for middleware)
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;