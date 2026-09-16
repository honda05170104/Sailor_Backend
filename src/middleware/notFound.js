import { ErrorCode } from '../constants/codes.js';
import { fail } from '../utils/response.js';

export default function notFound(_req, res) {
  return fail(res, ErrorCode.NOT_FOUND, 'Not found');
}
