import asyncHandler from "../../middleware/asyncHandler.js";
import { success } from "../../utils/response.js";
import * as memberService from "../services/member.service.js";

export const list = asyncHandler(async (req, res) => {
  const data = await memberService.listMembers(req.query.q, req.query.line);
  return success(res, data);
});

export const get = asyncHandler(async (req, res) => {
  const data = await memberService.getMember(req.params.id);
  return success(res, data);
});

export const setTags = asyncHandler(async (req, res) => {
  const data = await memberService.setMemberTags(
    req.params.id,
    req.body?.tagIds,
  );
  return success(res, data);
});

export const update = asyncHandler(async (req, res) => {
  const data = await memberService.updateMember(req.params.id, req.body || {});
  return success(res, data);
});
