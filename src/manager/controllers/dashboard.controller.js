import asyncHandler from "../../middleware/asyncHandler.js";
import { success } from "../../utils/response.js";
import * as dashboardService from "../services/dashboard.service.js";

export const get = asyncHandler(async (_req, res) => {
  const data = await dashboardService.getDashboard();
  return success(res, data);
});
