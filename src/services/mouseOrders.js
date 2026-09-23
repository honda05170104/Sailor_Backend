import MouseOrderLine from '../models/MouseOrderLine.js';
import MouseOrderWeek from '../models/MouseOrderWeek.js';
import AppError from '../utils/AppError.js';
import { ErrorCode } from '../constants/codes.js';
import { mouseOrderWindow, parseYmd, zonedInstant, addDays, ymdFromParts } from './globalConfig.js';
import { mouseCatalog, parseMouseItems, summarizeLines } from './mice.js';

export async function loadOrBuildWeek(times, { weekOf, persist = false } = {}) {
  const window = mouseOrderWindow(times, { weekOf });
  let week = await MouseOrderWeek.findOne({ weekOf: window.weekOf });

  if (!week && persist) {
    try {
      week = await MouseOrderWeek.create({
        weekOf: window.weekOf,
        deadlineAt: window.deadlineAt,
        arrivesAt: window.arrivesAt,
        status: 'open',
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      week = await MouseOrderWeek.findOne({ weekOf: window.weekOf });
    }
  }

  if (week && week.status === 'open') {
    const dirty =
      week.deadlineAt.getTime() !== window.deadlineAt.getTime() ||
      week.arrivesAt.getTime() !== window.arrivesAt.getTime();
    if (dirty && persist) {
      week.deadlineAt = window.deadlineAt;
      week.arrivesAt = window.arrivesAt;
      await week.save();
    }
  }

  return { window, week };
}

export function presentWindow(times, window, week, { isCurrent } = {}) {
  const submitted = week?.status && week.status !== 'open';
  const deadlineAt = submitted ? week.deadlineAt : window.deadlineAt;
  const arrivesAt = submitted ? week.arrivesAt : window.arrivesAt;
  const status = week?.status || 'open';
  const isOpen = Date.now() < new Date(deadlineAt).getTime();

  return {
    weekOf: window.weekOf,
    deadlineAt,
    arrivesAt,
    prevWeekOf: window.prevWeekOf,
    nextWeekOf: window.nextWeekOf,
    isOpen,
    canOrder: Boolean(isOpen && status === 'open'),
    isCurrent: Boolean(isCurrent),
    status,
    timezone: times.timezone,
    mouseOrder: times.mouseOrder,
    submittedAt: week?.submittedAt || null,
  };
}

function groupOrders(items) {
  const map = new Map();

  for (const item of items) {
    const json = item.toSafeJSON();
    const key = String(json.userId || 'unknown');
    if (!map.has(key)) {
      map.set(key, {
        user: json.user,
        items: [],
        totalPacks: 0,
      });
    }
    const order = map.get(key);
    order.items.push(json);
    order.totalPacks += json.packs;
  }

  return [...map.values()];
}

function windowForDate(times, date) {
  if (!date) return mouseOrderWindow(times);

  const parts = parseYmd(date);
  if (!parts) {
    throw new AppError(
      { field: 'date', message: 'date must be YYYY-MM-DD' },
      ErrorCode.BAD_REQUEST
    );
  }

  const timeZone = times.timezone || 'Asia/Taipei';
  const noon = zonedInstant(timeZone, parts.year, parts.month, parts.day, 12, 0, 0);
  return mouseOrderWindow(times, { now: noon });
}

export async function presentDay(times, { date } = {}) {
  const window = windowForDate(times, date);
  const current = mouseOrderWindow(times);
  const startDay = addDays(parseYmd(window.prevWeekOf), 1);
  const items = await MouseOrderLine.find({ weekOf: window.weekOf })
    .sort({ createdAt: 1 })
    .populate('user', 'displayName mobile');

  return {
    date: window.weekOf,
    startsOn: ymdFromParts(startDay),
    endsOn: window.weekOf,
    prevDate: window.prevWeekOf,
    nextDate: window.nextWeekOf,
    isToday: window.weekOf === current.weekOf,
    timezone: times.timezone,
    deadlineAt: window.deadlineAt,
    arrivesAt: window.arrivesAt,
    orders: groupOrders(items),
  };
}

export async function presentUserMouseOrder(times, user) {
  const { window, week } = await loadOrBuildWeek(times);
  const items = await MouseOrderLine.find({
    weekOf: window.weekOf,
    user: user._id,
  }).sort({ createdAt: 1 });
  const summary = summarizeLines(items);

  return {
    window: presentWindow(times, window, week, { isCurrent: true }),
    options: mouseCatalog(),
    items: items.map((item) => {
      const json = item.toSafeJSON();
      return {
        id: json.id,
        weekOf: json.weekOf,
        form: json.form,
        size: json.size,
        spec: json.spec,
        ageDays: json.ageDays,
        packs: json.packs,
        createdAt: json.createdAt,
        updatedAt: json.updatedAt,
      };
    }),
    summary,
    totalPacks: summary.reduce((sum, item) => sum + item.packs, 0),
  };
}

export async function setUserMouseOrder(times, user, payload = {}) {
  const { window, week } = await loadOrBuildWeek(times, { persist: true });
  const presented = presentWindow(times, window, week, { isCurrent: true });

  if (!presented.canOrder) {
    throw new AppError('Mouse order window is closed', ErrorCode.CONFLICT);
  }

  const items = parseMouseItems(payload);

  await MouseOrderLine.deleteMany({ weekOf: window.weekOf, user: user._id });
  if (items.length) {
    await MouseOrderLine.insertMany(
      items.map((item) => ({
        weekOf: window.weekOf,
        user: user._id,
        form: item.form,
        size: item.size,
        spec: item.spec,
        ageDays: item.ageDays,
        packs: item.packs,
      }))
    );
  }

  return presentUserMouseOrder(times, user);
}
