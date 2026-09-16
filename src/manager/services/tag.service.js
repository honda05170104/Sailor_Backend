import Tag from '../../models/Tag.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';

export async function listTags() {
  const tags = await Tag.find().sort({ name: 1 });

  return {
    tags: tags.map((tag) => tag.toSafeJSON()),
  };
}

export async function createTag({ name, description } = {}) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new AppError(
      { field: 'name', message: 'name is required' },
      ErrorCode.BAD_REQUEST
    );
  }

  try {
    const tag = await Tag.create({
      name: trimmedName,
      description: String(description || '').trim(),
    });

    return {
      tag: tag.toSafeJSON(),
    };
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(
        { field: 'name', message: 'name already exists' },
        ErrorCode.CONFLICT
      );
    }
    throw error;
  }
}

export async function updateTag(id, { name, description } = {}) {
  if (!id) {
    throw new AppError('Tag not found', ErrorCode.NOT_FOUND);
  }

  const tag = await Tag.findById(id);
  if (!tag) {
    throw new AppError('Tag not found', ErrorCode.NOT_FOUND);
  }

  const trimmedName = String(name ?? tag.name).trim();
  if (!trimmedName) {
    throw new AppError(
      { field: 'name', message: 'name is required' },
      ErrorCode.BAD_REQUEST
    );
  }

  tag.name = trimmedName;
  if (description !== undefined) {
    tag.description = String(description || '').trim();
  }

  try {
    await tag.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(
        { field: 'name', message: 'name already exists' },
        ErrorCode.CONFLICT
      );
    }
    throw error;
  }

  return {
    tag: tag.toSafeJSON(),
  };
}
