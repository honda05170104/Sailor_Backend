import crypto from 'crypto';
import Manager from '../../models/Manager.js';
import Token from '../../models/Token.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';

async function issueManagerToken(manager) {
  await Token.deleteMany({ manager: manager._id });

  const tokenDoc = await Token.create({
    token: crypto.randomBytes(32).toString('hex'),
    issuedAt: new Date(),
    manager: manager._id,
  });

  return tokenDoc.token;
}

export async function ensureBootstrapManager() {
  const count = await Manager.countDocuments();
  if (count > 0) return;

  const username = (process.env.MANAGER_BOOTSTRAP_USERNAME || 'admin').toLowerCase();
  const password = process.env.MANAGER_BOOTSTRAP_PASSWORD || 'admin123';

  const manager = new Manager({
    username,
    name: 'Superuser',
    type: 'superuser',
  });
  manager.setPassword(password);
  await manager.save();

  console.log(`Bootstrap manager created: ${username}`);
}

export async function login({ username, password } = {}) {
  if (!username) {
    throw new AppError(
      { field: 'username', message: 'username is required' },
      ErrorCode.BAD_REQUEST
    );
  }

  if (!password) {
    throw new AppError(
      { field: 'password', message: 'password is required' },
      ErrorCode.BAD_REQUEST
    );
  }

  const manager = await Manager.findOne({ username: String(username).trim().toLowerCase() }).select(
    '+passwordHash'
  );

  if (!manager || !manager.verifyPassword(password)) {
    throw new AppError('Invalid username or password', ErrorCode.UNAUTHORIZED);
  }

  const token = await issueManagerToken(manager);

  return {
    token,
    manager: manager.toSafeJSON(),
  };
}

export async function logout(manager, token) {
  if (token) {
    await Token.deleteOne({ token, manager: manager._id });
  } else {
    await Token.deleteMany({ manager: manager._id });
  }
  return null;
}

export async function getMe(manager) {
  return {
    manager: manager.toSafeJSON(),
  };
}
