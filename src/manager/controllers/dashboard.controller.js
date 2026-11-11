import asyncHandler from "../../middleware/asyncHandler.js";
import { success } from "../../utils/response.js";
import * as dashboardService from "../services/dashboard.service.js";

export const get = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboard({
    from: req.query.from,
    to: req.query.to,
  });
  return success(res, data);
});
