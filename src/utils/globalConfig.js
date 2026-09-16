import AppError from './AppError.js';
import { ErrorCode } from '../constants/codes.js';

export const GLOBAL_CONFIG_KEY = 'default';

export const DEFAULT_TIMES = {
  timezone: 'Asia/Taipei',
  mouseOrder: {
    deadlineWeekday: 2,
    deadlineTime: '18:00',
    arriveWeekday: 4,
    arriveOffsetWeeks: 0,
  },
};

const WEEKDAY_SHORT = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

export function isValidTimeZone(timeZone) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: String(timeZone) });
    return true;
  } catch {
    return false;
  }
}

export function parseClock(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || '').trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function parseWeekday(value, field) {
  const weekday = Number(value);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new AppError(
      { field, message: `${field} must be 0 (Sunday) through 6 (Saturday)` },
      ErrorCode.BAD_REQUEST
    );
  }
  return weekday;
}

export function zonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const map = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) === 24 ? 0 : Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAY_SHORT[map.weekday],
  };
}

export function ymdFromParts({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseYmd(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function addDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function zonedInstant(timeZone, year, month, day, hour = 0, minute = 0, second = 0) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const got = zonedParts(new Date(utcGuess), timeZone);
  const gotAsUtc = Date.UTC(
    got.year,
    got.month - 1,
    got.day,
    got.hour,
    got.minute,
    got.second
  );
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  return new Date(utcGuess - (gotAsUtc - wanted));
}

export function normalizeTimes(times = {}) {
  const mouseOrder = times.mouseOrder || {};
  return {
    timezone: times.timezone || DEFAULT_TIMES.timezone,
    mouseOrder: {
      deadlineWeekday:
        mouseOrder.deadlineWeekday ?? DEFAULT_TIMES.mouseOrder.deadlineWeekday,
      deadlineTime: mouseOrder.deadlineTime || DEFAULT_TIMES.mouseOrder.deadlineTime,
      arriveWeekday: mouseOrder.arriveWeekday ?? DEFAULT_TIMES.mouseOrder.arriveWeekday,
      arriveOffsetWeeks:
        mouseOrder.arriveOffsetWeeks ?? DEFAULT_TIMES.mouseOrder.arriveOffsetWeeks,
    },
  };
}

export function parseTimesPayload(payload = {}, current = DEFAULT_TIMES) {
  const source = payload.times && typeof payload.times === 'object' ? payload.times : payload;
  const next = normalizeTimes(current);

  if (source.timezone != null) {
    const timezone = String(source.timezone).trim();
    if (!timezone || !isValidTimeZone(timezone)) {
      throw new AppError(
        { field: 'times.timezone', message: 'timezone must be a valid IANA time zone' },
        ErrorCode.BAD_REQUEST
      );
    }
    next.timezone = timezone;
  }

  if (source.mouseOrder && typeof source.mouseOrder === 'object') {
    const mouse = source.mouseOrder;
    if (mouse.deadlineWeekday != null) {
      next.mouseOrder.deadlineWeekday = parseWeekday(
        mouse.deadlineWeekday,
        'times.mouseOrder.deadlineWeekday'
      );
    }
    if (mouse.arriveWeekday != null) {
      next.mouseOrder.arriveWeekday = parseWeekday(
        mouse.arriveWeekday,
        'times.mouseOrder.arriveWeekday'
      );
    }
    if (mouse.deadlineTime != null) {
      const clock = parseClock(mouse.deadlineTime);
      if (!clock) {
        throw new AppError(
          { field: 'times.mouseOrder.deadlineTime', message: 'deadlineTime must be HH:mm' },
          ErrorCode.BAD_REQUEST
        );
      }
      next.mouseOrder.deadlineTime = `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;
    }
    if (mouse.arriveOffsetWeeks != null) {
      const offset = Number(mouse.arriveOffsetWeeks);
      if (!Number.isInteger(offset) || offset < 0 || offset > 8) {
        throw new AppError(
          {
            field: 'times.mouseOrder.arriveOffsetWeeks',
            message: 'arriveOffsetWeeks must be an integer from 0 to 8',
          },
          ErrorCode.BAD_REQUEST
        );
      }
      next.mouseOrder.arriveOffsetWeeks = offset;
    }
  }

  return next;
}

export function mouseOrderWindow(timesInput, { now = new Date(), weekOf } = {}) {
  const times = normalizeTimes(timesInput);
  const timeZone = times.timezone;
  const mouse = times.mouseOrder;
  const clock = parseClock(mouse.deadlineTime) || { hour: 18, minute: 0 };

  let deadlineDay = weekOf ? parseYmd(weekOf) : null;
  if (weekOf && !deadlineDay) {
    throw new AppError(
      { field: 'weekOf', message: 'weekOf must be YYYY-MM-DD' },
      ErrorCode.BAD_REQUEST
    );
  }

  if (!deadlineDay) {
    const parts = zonedParts(now, timeZone);
    deadlineDay = addDays(parts, mouse.deadlineWeekday - parts.weekday);
    const candidate = zonedInstant(
      timeZone,
      deadlineDay.year,
      deadlineDay.month,
      deadlineDay.day,
      clock.hour,
      clock.minute
    );
    if (now.getTime() >= candidate.getTime()) {
      deadlineDay = addDays(deadlineDay, 7);
    }
  }

  const deadlineAt = zonedInstant(
    timeZone,
    deadlineDay.year,
    deadlineDay.month,
    deadlineDay.day,
    clock.hour,
    clock.minute
  );

  const arriveDelta =
    ((mouse.arriveWeekday - mouse.deadlineWeekday + 7) % 7) +
    mouse.arriveOffsetWeeks * 7;
  const arriveDay = addDays(deadlineDay, arriveDelta);
  const arrivesAt = zonedInstant(
    timeZone,
    arriveDay.year,
    arriveDay.month,
    arriveDay.day,
    0,
    0,
    0
  );

  return {
    weekOf: ymdFromParts(deadlineDay),
    deadlineAt,
    arrivesAt,
    prevWeekOf: ymdFromParts(addDays(deadlineDay, -7)),
    nextWeekOf: ymdFromParts(addDays(deadlineDay, 7)),
    isOpen: now.getTime() < deadlineAt.getTime(),
    timezone: timeZone,
  };
}
