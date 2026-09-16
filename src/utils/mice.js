import AppError from './AppError.js';
import { ErrorCode } from '../constants/codes.js';
import {
  MOUSE_FORMS,
  MOUSE_SIZES,
  MOUSE_SPECS,
  MOUSE_FORM_LABELS,
  MOUSE_SIZE_LABELS,
  MOUSE_SPEC_LABELS,
  MOUSE_AGE_DAYS,
  MOUSE_PACKS,
  MouseSpec,
  mouseCatalog,
  isAllowedSpec,
} from '../constants/mice.js';

export {
  MOUSE_FORMS,
  MOUSE_SIZES,
  MOUSE_SPECS,
  MOUSE_FORM_LABELS,
  MOUSE_SIZE_LABELS,
  MOUSE_SPEC_LABELS,
  MOUSE_AGE_DAYS,
  MOUSE_PACKS,
  MouseSpec,
  mouseCatalog,
  isAllowedSpec,
};

function inSet(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new AppError(
      { field, message: `${field} must be one of: ${allowed.join(', ')}` },
      ErrorCode.BAD_REQUEST
    );
  }
  return value;
}

export function parsePacks(value) {
  const packs = Number(value);
  if (
    !Number.isInteger(packs) ||
    packs < MOUSE_PACKS.min ||
    packs > MOUSE_PACKS.max
  ) {
    throw new AppError(
      {
        field: 'packs',
        message: `packs must be an integer from ${MOUSE_PACKS.min} to ${MOUSE_PACKS.max}`,
      },
      ErrorCode.BAD_REQUEST
    );
  }
  return packs;
}

export function parseMouseLine(payload = {}) {
  const form = inSet(String(payload.form || ''), MOUSE_FORMS, 'form');
  const size = inSet(String(payload.size || ''), MOUSE_SIZES, 'size');
  const spec = String(payload.spec || '');
  if (!isAllowedSpec(form, size, spec)) {
    throw new AppError(
      { field: 'spec', message: 'spec is not available for this form and size' },
      ErrorCode.BAD_REQUEST
    );
  }
  const packs = parsePacks(payload.packs);

  let ageDays = null;
  if (spec === MouseSpec.AGED) {
    const days = Number(payload.ageDays);
    if (
      !Number.isInteger(days) ||
      days < MOUSE_AGE_DAYS.min ||
      days > MOUSE_AGE_DAYS.max
    ) {
      throw new AppError(
        {
          field: 'ageDays',
          message: `ageDays is required for 日齡 and must be ${MOUSE_AGE_DAYS.min}–${MOUSE_AGE_DAYS.max}`,
        },
        ErrorCode.BAD_REQUEST
      );
    }
    ageDays = days;
  }

  return { form, size, spec, ageDays, packs };
}

export function parseMouseItems(payload = {}) {
  if (!Array.isArray(payload.items)) {
    throw new AppError(
      { field: 'items', message: 'items must be an array' },
      ErrorCode.BAD_REQUEST
    );
  }

  if (payload.items.length > 50) {
    throw new AppError(
      { field: 'items', message: 'items cannot exceed 50' },
      ErrorCode.BAD_REQUEST
    );
  }

  return summarizeLines(payload.items.map((item) => parseMouseLine(item)));
}

export function summarizeLines(lines = []) {
  const map = new Map();

  for (const line of lines) {
    const ageDays = line.ageDays ?? null;
    const key = `${line.form}|${line.size}|${line.spec}|${ageDays ?? ''}`;
    const current = map.get(key);
    if (current) {
      current.packs += line.packs || 0;
    } else {
      map.set(key, {
        form: line.form,
        size: line.size,
        spec: line.spec,
        ageDays,
        packs: line.packs || 0,
      });
    }
  }

  const order = {
    form: Object.fromEntries(MOUSE_FORMS.map((item, index) => [item, index])),
    size: Object.fromEntries(MOUSE_SIZES.map((item, index) => [item, index])),
    spec: Object.fromEntries(MOUSE_SPECS.map((item, index) => [item, index])),
  };

  return [...map.values()].sort((a, b) => {
    return (
      (order.form[a.form] ?? 0) - (order.form[b.form] ?? 0) ||
      (order.size[a.size] ?? 0) - (order.size[b.size] ?? 0) ||
      (order.spec[a.spec] ?? 0) - (order.spec[b.spec] ?? 0) ||
      (a.ageDays || 0) - (b.ageDays || 0)
    );
  });
}
