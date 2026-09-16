import mongoose from 'mongoose';
import crypto from 'crypto';

const MANAGER_TYPES = ['superuser', 'owner', 'staff'];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;

  const [salt, hash] = stored.split(':');
  const next = crypto.scryptSync(password, salt, 64).toString('hex');

  if (hash.length !== next.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
}

const managerSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      enum: MANAGER_TYPES,
      required: true,
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

managerSchema.methods.setPassword = function setPassword(password) {
  this.passwordHash = hashPassword(password);
};

managerSchema.methods.verifyPassword = function verifyPasswordFn(password) {
  return verifyPassword(password, this.passwordHash);
};

managerSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    username: this.username,
    name: this.name,
    type: this.type,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export { MANAGER_TYPES };
export default mongoose.model('Manager', managerSchema);
