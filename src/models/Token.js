import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    issuedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Manager',
      default: null,
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

tokenSchema.pre('validate', function validateOwner(next) {
  const hasUser = Boolean(this.user);
  const hasManager = Boolean(this.manager);

  if (hasUser === hasManager) {
    next(new Error('Token must belong to either a user or a manager'));
    return;
  }

  next();
});

export default mongoose.model('Token', tokenSchema);
