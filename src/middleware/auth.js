import User from '../models/User.js';
import Token from '../models/Token.js';
import AppError from '../utils/AppError.js';
import { ErrorCode } from '../constants/codes.js';
import asyncHandler from './asyncHandler.js';
import { animalPopulate } from '../utils/animals.js';

const AUTH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;

  return token;
}

function isTokenExpired(issuedAt) {
  if (!issuedAt) return true;
  return Date.now() - new Date(issuedAt).getTime() > AUTH_TOKEN_TTL_MS;
}

const auth = asyncHandler(async (req, _res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    throw new AppError('Unauthorized', ErrorCode.UNAUTHORIZED);
  }

  const tokenDoc = await Token.findOne({ token, user: { $ne: null } });
  if (!tokenDoc) {
    throw new AppError('Unauthorized', ErrorCode.UNAUTHORIZED);
  }

  if (isTokenExpired(tokenDoc.issuedAt)) {
    await tokenDoc.deleteOne();
    throw new AppError('Unauthorized', ErrorCode.UNAUTHORIZED);
  }

  const user = await User.findById(tokenDoc.user)
    .populate('vip')
    .populate('tags')
    .populate(animalPopulate());
  if (!user) {
    await tokenDoc.deleteOne();
    throw new AppError('Unauthorized', ErrorCode.UNAUTHORIZED);
  }

  req.user = user;
  req.token = token;
  next();
});

export default auth;
