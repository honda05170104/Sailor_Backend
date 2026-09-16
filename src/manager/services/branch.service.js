import Branch, { BRANCH_TYPES } from '../../models/Branch.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';

export async function listBranches() {
  const branches = await Branch.find().sort({ createdAt: -1 });

  return {
    branches: branches.map((branch) => branch.toSafeJSON()),
  };
}

export async function defaultBranch() {
  const existing = await Branch.findOne().sort({ createdAt: 1 });
  if (existing) return existing;

  return Branch.create({
    name: '預設分店',
    type: 'Directly',
  });
}

export async function createBranch({ name, type } = {}) {
  const trimmedName = String(name || '').trim();

  if (!trimmedName) {
    throw new AppError(
      { field: 'name', message: 'name is required' },
      ErrorCode.BAD_REQUEST
    );
  }

  if (!type) {
    throw new AppError(
      { field: 'type', message: 'type is required' },
      ErrorCode.BAD_REQUEST
    );
  }

  if (!BRANCH_TYPES.includes(type)) {
    throw new AppError(
      { field: 'type', message: 'type must be Directly, Corporate, or Department' },
      ErrorCode.BAD_REQUEST
    );
  }

  const branch = await Branch.create({
    name: trimmedName,
    type,
  });

  return {
    branch: branch.toSafeJSON(),
  };
}
