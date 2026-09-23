import User from "../../models/User.js";
import Transaction from "../../models/Transaction.js";
import AppError from "../../utils/AppError.js";
import { ErrorCode } from "../../constants/codes.js";
import mongoose from "mongoose";
import { applyTagIds } from "../../services/tags.js";
import { applyAnimalIds, animalPopulate } from "./animal.service.js";
import { normalizeMobile } from "../../services/orderImport.js";
import { listUserCoupons } from "./coupon.service.js";
import { requireStore, defaultStore } from "../../data/stores.js";
import { requireVip } from "../../data/vips.js";
import {
  DEFAULT_TRANSACTION_ORDER_STATUS,
  generateTxnNo,
} from "../../services/transactions.js";

function populateUser(query) {
  return query.populate("tags").populate(animalPopulate());
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
    User.find(memberListFilter(q, line)).sort({ lastUsedAt: -1, createdAt: -1 }),
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

  const transactions = await Transaction.find({ user: user._id }).sort({
    createdAt: -1,
  });

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

async function requireBranch(branchId) {
  const id = String(branchId || "").trim();
  if (id) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(
        { field: "branchId", message: "找不到分店" },
        ErrorCode.NOT_FOUND,
      );
    }
    const branch = requireStore(id);
    if (!branch) {
      throw new AppError(
        { field: "branchId", message: "找不到分店" },
        ErrorCode.NOT_FOUND,
      );
    }
    return branch;
  }

  // Default: 台北店
  const fallback = defaultStore();
  if (!fallback) {
    throw new AppError(
      { field: "branchId", message: "找不到分店" },
      ErrorCode.NOT_FOUND,
    );
  }
  return fallback;
}

async function recordBalanceAdjustment(user, before, { branchId, staff }) {
  const creditDelta = (user.storedCredit || 0) - before.storedCredit;
  if (creditDelta === 0) return null;

  const branch = await requireBranch(branchId);
  const txnNo = generateTxnNo();
  const externalOrderId = `adjust-${txnNo}`;
  const signed =
    creditDelta > 0 ? `+${creditDelta}` : String(creditDelta);

  return Transaction.create({
    user: user._id,
    branch: branch._id,
    txnNo,
    orderNo: "",
    customerName: user.displayName || "",
    customerMobile: user.mobile || "",
    source: "後台調整",
    orderStatus: DEFAULT_TRANSACTION_ORDER_STATUS,
    staff: staff || "",
    note: `點數 ${signed}（${before.storedCredit} → ${user.storedCredit}）`,
    externalOrderId,
    items: [
      {
        name: creditDelta > 0 ? "點數增加" : "點數扣除",
        quantity: 1,
        unitPrice: creditDelta,
        subtotal: creditDelta,
      },
    ],
    totalAmount: creditDelta,
    importedAt: new Date(),
  });
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

function toFiniteNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new AppError(
      { field, message: `${field} must be a number` },
      ErrorCode.BAD_REQUEST,
    );
  }
  return n;
}

export async function updateMember(id, payload = {}, manager) {
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

  const beforeBalance = {
    prepaidFeed: user.prepaidFeed || 0,
    storedCredit: user.storedCredit || 0,
  };

  if (payload.prepaidFeed !== undefined) {
    user.prepaidFeed = toNonNegativeNumber(payload.prepaidFeed, "prepaidFeed");
  }

  if (payload.storedCreditDelta !== undefined) {
    const delta = toFiniteNumber(payload.storedCreditDelta, "storedCreditDelta");
    if (delta === 0) {
      throw new AppError(
        { field: "storedCreditDelta", message: "調整金額不可為 0" },
        ErrorCode.BAD_REQUEST,
      );
    }
    const next = (user.storedCredit || 0) + delta;
    if (next < 0) {
      throw new AppError(
        { field: "storedCreditDelta", message: "點數不足，無法扣除" },
        ErrorCode.BAD_REQUEST,
      );
    }
    user.storedCredit = next;
  } else if (payload.storedCredit !== undefined) {
    user.storedCredit = toNonNegativeNumber(payload.storedCredit, "storedCredit");
  }

  if (payload.vipId !== undefined) {
    const vip = requireVip(payload.vipId);
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

  const creditChanged =
    (user.storedCredit || 0) !== beforeBalance.storedCredit;
  if (creditChanged) {
    try {
      await recordBalanceAdjustment(user, beforeBalance, {
        branchId: payload.branchId,
        staff: manager?.name || manager?.username || "",
      });
    } catch (error) {
      user.prepaidFeed = beforeBalance.prepaidFeed;
      user.storedCredit = beforeBalance.storedCredit;
      await user.save();
      throw error;
    }
  }

  await user.populate(["tags", animalPopulate()]);

  return {
    user: user.toSafeJSON(),
  };
}
