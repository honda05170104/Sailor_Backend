import { Status, SuccessCode, ErrorCode } from '../constants/codes.js';

export function normalizeErrorItems(errors) {
  if (!errors) {
    return [{ field: null, message: 'Error' }];
  }

  if (typeof errors === 'string') {
    return [{ field: null, message: errors }];
  }

  if (Array.isArray(errors)) {
    return errors.map((item) => {
      if (typeof item === 'string') {
        return { field: null, message: item };
      }

      return {
        field: item.field ?? null,
        message: item.message || 'Error',
      };
    });
  }

  if (typeof errors === 'object') {
    return [
      {
        field: errors.field ?? null,
        message: errors.message || 'Error',
      },
    ];
  }

  return [{ field: null, message: 'Error' }];
}

export function success(res, data = null, code = SuccessCode.OK) {
  return res.status(code).json({
    status: Status.SUCCESS,
    code,
    data,
  });
}

export function fail(res, code = ErrorCode.BAD_REQUEST, errors = 'Error') {
  return res.status(code).json({
    status: Status.ERROR,
    code,
    error: {
      data: normalizeErrorItems(errors),
    },
  });
}
