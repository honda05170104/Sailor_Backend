import mongoose from 'mongoose';

import { getVipById, isBaseVip } from '../data/vips.js';

const REQUIRED_PROFILE_FIELDS = ['birthday', 'mobile'];
/** 生理性別：男、女、不願透露。 */
const GENDERS = ['male', 'female', 'undisclosed'];

const userSchema = new mongoose.Schema(
  {
    lineUserId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
      default: '',
    },
    birthday: {
      type: String,
      trim: true,
      default: '',
    },
    mobile: {
      type: String,
      trim: true,
      default: '',
    },
    gender: {
      type: String,
      enum: ['', ...GENDERS],
      default: '',
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    vip: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    totalSpend: {
      type: Number,
      default: 0,
      min: 0,
    },
    prepaidFeed: {
      type: Number,
      default: 0,
      min: 0,
    },
    storedCredit: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Current VIP membership end date (spend tier 1yr, or gold-protect end). */
    vipExpiresAt: {
      type: Date,
      default: null,
    },
    /** Admin set the expiry; daily VIP sync will not overwrite it. */
    vipExpiresManual: {
      type: Boolean,
      default: false,
    },
    /** Manual expiry with no end date. */
    vipExpiresForever: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
      default: [],
    },
    interestedSpecies: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Species' }],
      default: [],
    },
    /** True after the member submits the species form, even if they leave it blank. */
    speciesFormFilled: {
      type: Boolean,
      default: false,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

userSchema.index(
  { mobile: 1 },
  { unique: true, partialFilterExpression: { mobile: { $gt: '' } } }
);

userSchema.methods.getProfileCompleteness = function getProfileCompleteness() {
  const missing = REQUIRED_PROFILE_FIELDS.filter((key) => {
    const value = this[key];
    return value == null || String(value).trim() === '';
  });

  return {
    isComplete: missing.length === 0,
    missing,
    completedCount: REQUIRED_PROFILE_FIELDS.length - missing.length,
    totalRequired: REQUIRED_PROFILE_FIELDS.length,
  };
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const vip = getVipById(this.vip);
  const vipExpiresForever = isBaseVip(vip) || Boolean(this.vipExpiresForever);
  return {
    id: this._id,
    lineUserId: this.lineUserId || '',
    lineLinked: Boolean(this.lineUserId),
    displayName: this.displayName,
    birthday: this.birthday,
    mobile: this.mobile,
    gender: this.gender || '',
    avatarUrl: this.avatarUrl,
    vip,
    totalSpend: this.totalSpend || 0,
    prepaidFeed: this.prepaidFeed || 0,
    storedCredit: this.storedCredit || 0,
    vipExpiresAt: vipExpiresForever ? null : this.vipExpiresAt || null,
    vipExpiresForever,
    tags: Array.isArray(this.tags)
      ? this.tags.map((tag) =>
          tag && typeof tag.toSafeJSON === 'function' ? tag.toSafeJSON() : tag
        )
      : [],
    interestedSpecies: Array.isArray(this.interestedSpecies)
      ? this.interestedSpecies.map((item) => {
          if (item && typeof item.toSafeJSON === 'function') {
            const species = item.toSafeJSON();
            return {
              id: species.id,
              name: species.name,
              parentId: species.parentId,
              parentName: species.parentName,
            };
          }
          return item;
        })
      : [],
    speciesFormFilled: Boolean(this.speciesFormFilled),
    profileCompleteness: this.getProfileCompleteness(),
    lastUsedAt: this.lastUsedAt || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export { REQUIRED_PROFILE_FIELDS, GENDERS };
export default mongoose.model('User', userSchema);
