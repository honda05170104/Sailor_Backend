import mongoose from 'mongoose';
import Tag from '../models/Tag.js';
import AppError from '../utils/AppError.js';
import { ErrorCode } from '../constants/codes.js';

export async function listTagOptions() {
  const tags = await Tag.find().sort({ name: 1 });
  return tags.map((tag) => tag.toSafeJSON());
}

export async function applyTagIds(user, tagIds = []) {
  const ids = [...new Set((Array.isArray(tagIds) ? tagIds : []).filter(Boolean))];

  for (const tagId of ids) {
    if (!mongoose.isValidObjectId(tagId)) {
      throw new AppError(
        { field: 'tagIds', message: 'tagIds contains an invalid id' },
        ErrorCode.BAD_REQUEST
      );
    }
  }

  if (ids.length) {
    const count = await Tag.countDocuments({ _id: { $in: ids } });
    if (count !== ids.length) {
      throw new AppError(
        { field: 'tagIds', message: 'tag not found' },
        ErrorCode.NOT_FOUND
      );
    }
  }

  user.tags = ids;
  await user.save();
  await user.populate('tags');
  return user;
}
