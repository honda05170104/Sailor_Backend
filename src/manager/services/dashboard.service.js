import User from "../../models/User.js";
import { getTimes } from "./config.service.js";
import {
  addDays,
  ymdFromParts,
  zonedInstant,
  zonedParts,
} from "../../services/globalConfig.js";

export async function getDashboard() {
  const times = await getTimes();
  const timeZone = times.timezone || "Asia/Taipei";
  const today = zonedParts(new Date(), timeZone);
  const next = addDays(today, 1);
  const start = zonedInstant(timeZone, today.year, today.month, today.day);
  const end = zonedInstant(timeZone, next.year, next.month, next.day);

  const newMembersToday = await User.countDocuments({
    createdAt: { $gte: start, $lt: end },
  });

  return {
    date: ymdFromParts(today),
    timezone: timeZone,
    newMembersToday,
  };
}
