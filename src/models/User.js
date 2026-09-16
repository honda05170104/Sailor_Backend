import mongoose from 'mongoose';

const REQUIRED_PROFILE_FIELDS = ['birthday', 'mobile'];

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
    avatarUrl: {
      type: String,
      default: '',
    },
    vip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vip',
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
    tags: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
      default: [],
    },
    animals: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Animal' }],
      default: [],
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
  return {
    id: this._id,
    lineUserId: this.lineUserId || '',
    lineLinked: Boolean(this.lineUserId),
    displayName: this.displayName,
    birthday: this.birthday,
    mobile: this.mobile,
    avatarUrl: this.avatarUrl,
    vip:
      this.vip && typeof this.vip.toSafeJSON === 'function'
        ? this.vip.toSafeJSON()
        : this.vip || null,
    totalSpend: this.totalSpend || 0,
    prepaidFeed: this.prepaidFeed || 0,
    storedCredit: this.storedCredit || 0,
    tags: Array.isArray(this.tags)
      ? this.tags.map((tag) =>
          tag && typeof tag.toSafeJSON === 'function' ? tag.toSafeJSON() : tag
        )
      : [],
    animals: Array.isArray(this.animals)
      ? this.animals.map((animal) =>
          animal && typeof animal.toSafeJSON === 'function'
            ? animal.toSafeJSON()
            : animal
        )
      : [],
    profileCompleteness: this.getProfileCompleteness(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export { REQUIRED_PROFILE_FIELDS };
export default mongoose.model('User', userSchema);
