import { ErrorCode } from '../constants/codes.js';
import { fail } from '../utils/response.js';

export default function errorHandler(err, _req, res, _next) {
  console.error(err);

  if (err.isOperational) {
    return fail(res, err.code || ErrorCode.BAD_REQUEST, err.errors);
  }

  return fail(
    res,
    ErrorCode.INTERNAL_SERVER_ERROR,
    'Internal server error'
  );
}
