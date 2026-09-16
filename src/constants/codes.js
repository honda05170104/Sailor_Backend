export const Status = Object.freeze({
  SUCCESS: 'success',
  ERROR: 'error',
});

export const SuccessCode = Object.freeze({
  OK: 200,
});

export const ErrorCode = Object.freeze({
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
});
