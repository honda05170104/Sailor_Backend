import User from "../../models/User.js";
import Vip from "../../models/Vip.js";
import Transaction from "../../models/Transaction.js";
import AppError from "../../utils/AppError.js";
import { ErrorCode } from "../../constants/codes.js";
import mongoose from "mongoose";
import { applyTagIds } from "../../utils/tags.js";
import { applyAnimalIds, animalPopulate } from "../../utils/animals.js";
import { normalizeMobile } from "../../utils/orderImport.js";
import { listUserCoupons } from "./coupon.service.js";

function populateUser(query) {
  return query.populate("vip").populate("tags").populate(animalPopulate());
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function memberSearchFilter(q) {
  const keyword = String(q || "").trim();
  if (!keyword) return {};

  const clauses = [
    { displayName: { $regex: escapeRegex(keyword), $options: "i" } },
    { mobile: { $regex: escapeRegex(keyword) } },
  ];

  const digits = normalizeMobile(keyword) || keyword.replace(/\D/g, "");
  if (digits && digits !== keyword) {
    clauses.push({ mobile: { $regex: escapeRegex(digits) } });
  }

  return { $or: clauses };
}

function lineStatusFilter(line) {
  const status = String(line || "")
    .trim()
    .toLowerCase();
  if (status === "linked") {
    return { lineUserId: { $exists: true, $nin: [null, ""] } };
  }
  if (status === "unlinked") {
    return {
      $or: [
        { lineUserId: { $exists: false } },
        { lineUserId: null },
        { lineUserId: "" },
      ],
    };
  }
  return {};
}

function memberListFilter(q, line) {
  const parts = [memberSearchFilter(q), lineStatusFilter(line)].filter(
    (part) => Object.keys(part).length,
  );
  if (!parts.length) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

export async function listMembers(q, line) {
  const users = await populateUser(
    User.find(memberListFilter(q, line)).sort({ createdAt: -1 }),
  );

  return {
    users: users.map((user) => user.toSafeJSON()),
  };
}

export async function getMember(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("User not found", ErrorCode.NOT_FOUND);
  }

  const user = await populateUser(User.findById(id));
  if (!user) {
    throw new AppError("User not found", ErrorCode.NOT_FOUND);
  }

  const transactions = await Transaction.find({ user: user._id })
    .sort({ createdAt: -1 })
    .populate("branch", "name type");

  return {
    user: user.toSafeJSON(),
    transactions: transactions.map((doc) => doc.toSafeJSON()),
    coupons: await listUserCoupons(user._id),
  };
}

export async function setMemberTags(id, tagIds = []) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("User not found", ErrorCode.NOT_FOUND);
  }

  const user = await User.findById(id);
  if (!user) {
    throw new AppError("User not found", ErrorCode.NOT_FOUND);
  }

  await applyTagIds(user, tagIds);

  return {
    user: user.toSafeJSON(),
  };
}

function toNonNegativeNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError(
      { field, message: `${field} must be a number >= 0` },
      ErrorCode.BAD_REQUEST,
    );
  }
  return n;
}

export async function updateMember(id, payload = {}) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("User not found", ErrorCode.NOT_FOUND);
  }

  const user = await User.findById(id);
  if (!user) {
    throw new AppError("User not found", ErrorCode.NOT_FOUND);
  }

  if (payload.displayName !== undefined) {
    user.displayName = String(payload.displayName || "").trim();
  }

  if (payload.birthday !== undefined) {
    user.birthday = String(payload.birthday || "").trim();
  }

  if (payload.mobile !== undefined) {
    const mobile =
      normalizeMobile(payload.mobile) || String(payload.mobile || "").trim();
    if (mobile) {
      const taken = await User.findOne({ _id: { $ne: user._id }, mobile });
      if (taken) {
        throw new AppError(
          { field: "mobile", message: "mobile already in use" },
          ErrorCode.CONFLICT,
        );
      }
    }
    user.mobile = mobile;
  }

  if (payload.prepaidFeed !== undefined) {
    user.prepaidFeed = toNonNegativeNumber(payload.prepaidFeed, "prepaidFeed");
  }

  if (payload.storedCredit !== undefined) {
    user.storedCredit = toNonNegativeNumber(payload.storedCredit, "storedCredit");
  }

  if (payload.vipId !== undefined) {
    const vipId = String(payload.vipId || "").trim();
    if (!mongoose.isValidObjectId(vipId)) {
      throw new AppError(
        { field: "vipId", message: "找不到會員等級" },
        ErrorCode.BAD_REQUEST,
      );
    }
    const vip = await Vip.findById(vipId);
    if (!vip) {
      throw new AppError(
        { field: "vipId", message: "找不到會員等級" },
        ErrorCode.NOT_FOUND,
      );
    }
    user.vip = vip._id;
  }

  if (payload.tagIds !== undefined) {
    await applyTagIds(user, payload.tagIds);
  }
  if (payload.animalIds !== undefined) {
    await applyAnimalIds(user, payload.animalIds);
  }
  if (payload.tagIds === undefined && payload.animalIds === undefined) {
    await user.save();
  }
  await user.populate(["vip", "tags", animalPopulate()]);

  return {
    user: user.toSafeJSON(),
  };
}
