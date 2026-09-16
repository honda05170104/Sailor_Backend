import { ErrorCode } from '../constants/codes.js';
import { fail } from '../utils/response.js';

export default function methodGuard(req, res, next) {
  const allowed = ['GET', 'POST'];

  if (!allowed.includes(req.method)) {
    return fail(
      res,
      ErrorCode.METHOD_NOT_ALLOWED,
      `Method ${req.method} is not allowed`
    );
  }

  return next();
}
