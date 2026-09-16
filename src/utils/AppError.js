import { ErrorCode } from '../constants/codes.js';
import { normalizeErrorItems } from './response.js';

export default class AppError extends Error {
  constructor(errors, code = ErrorCode.BAD_REQUEST) {
    const items = normalizeErrorItems(errors);
    super(items.map((item) => item.message).join('; '));
    this.code = code;
    this.errors = items;
    this.isOperational = true;
  }
}
