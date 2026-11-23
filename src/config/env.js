const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '3000', 10),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'buildmore_inventory',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  companyName: process.env.COMPANY_NAME || 'Buildmore Ventures LLP',
};

if (env.isProduction && (!process.env.JWT_SECRET || env.jwt.secret.length < 32)) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
}

module.exports = env;
