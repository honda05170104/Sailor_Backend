import { getTimes } from './config.service.js';
import { presentDay } from '../../utils/mouseOrders.js';

export async function getWeek(query = {}) {
  const times = await getTimes();
  return presentDay(times, { date: query.date });
}
