import mongoose from 'mongoose';
import { DEFAULT_TIMES } from '../utils/globalConfig.js';

const mouseOrderTimeSchema = new mongoose.Schema(
  {
    deadlineWeekday: {
      type: Number,
      min: 0,
      max: 6,
      default: DEFAULT_TIMES.mouseOrder.deadlineWeekday,
    },
    deadlineTime: {
      type: String,
      default: DEFAULT_TIMES.mouseOrder.deadlineTime,
    },
    arriveWeekday: {
      type: Number,
      min: 0,
      max: 6,
      default: DEFAULT_TIMES.mouseOrder.arriveWeekday,
    },
    arriveOffsetWeeks: {
      type: Number,
      min: 0,
      default: DEFAULT_TIMES.mouseOrder.arriveOffsetWeeks,
    },
  },
  { _id: false }
);

const timesSchema = new mongoose.Schema(
  {
    timezone: {
      type: String,
      trim: true,
      default: DEFAULT_TIMES.timezone,
    },
    mouseOrder: {
      type: mouseOrderTimeSchema,
      default: () => ({ ...DEFAULT_TIMES.mouseOrder }),
    },
  },
  { _id: false }
);

const globalConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
    },
    times: {
      type: timesSchema,
      default: () => ({
        timezone: DEFAULT_TIMES.timezone,
        mouseOrder: { ...DEFAULT_TIMES.mouseOrder },
      }),
    },
  },
  { timestamps: true, versionKey: false, collection: 'globalConfig' }
);

globalConfigSchema.methods.toSafeJSON = function toSafeJSON() {
  const times = this.times || {};
  const mouseOrder = times.mouseOrder || {};

  return {
    id: this._id,
    times: {
      timezone: times.timezone || DEFAULT_TIMES.timezone,
      mouseOrder: {
        deadlineWeekday: mouseOrder.deadlineWeekday ?? DEFAULT_TIMES.mouseOrder.deadlineWeekday,
        deadlineTime: mouseOrder.deadlineTime || DEFAULT_TIMES.mouseOrder.deadlineTime,
        arriveWeekday: mouseOrder.arriveWeekday ?? DEFAULT_TIMES.mouseOrder.arriveWeekday,
        arriveOffsetWeeks: mouseOrder.arriveOffsetWeeks ?? DEFAULT_TIMES.mouseOrder.arriveOffsetWeeks,
      },
    },
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('GlobalConfig', globalConfigSchema);
