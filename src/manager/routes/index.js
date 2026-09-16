import express from "express";
import managerAuth from "../../middleware/managerAuth.js";
import * as managerController from "../controllers/manager.controller.js";
import * as branchController from "../controllers/branch.controller.js";
import * as memberController from "../controllers/member.controller.js";
import * as transactionController from "../controllers/transaction.controller.js";
import * as vipController from "../controllers/vip.controller.js";
import * as tagController from "../controllers/tag.controller.js";
import * as couponController from "../controllers/coupon.controller.js";
import * as animalController from "../controllers/animal.controller.js";
import * as configController from "../controllers/config.controller.js";
import * as mouseController from "../controllers/mouse.controller.js";

const router = express.Router();

router.post("/login", managerController.login);
router.post("/logout", managerAuth, managerController.logout);
router.get("/me", managerAuth, managerController.me);

router.get("/branches", managerAuth, branchController.list);
router.post("/branches", managerAuth, branchController.create);
router.get("/users", managerAuth, memberController.list);
router.get("/users/:id", managerAuth, memberController.get);
router.post("/users/:id", managerAuth, memberController.update);
router.post("/users/:id/tags", managerAuth, memberController.setTags);
router.post("/users/:id/coupons", managerAuth, couponController.issue);
router.post("/user-coupons/:id/use", managerAuth, couponController.use);
router.post(
  "/transactions/import",
  managerAuth,
  transactionController.importOrders,
);
router.get("/vips", managerAuth, vipController.list);
router.post("/vips", managerAuth, vipController.create);
router.post("/vips/:id", managerAuth, vipController.update);
router.get("/tags", managerAuth, tagController.list);
router.post("/tags", managerAuth, tagController.create);
router.post("/tags/:id", managerAuth, tagController.update);
router.get("/coupons", managerAuth, couponController.list);
router.post("/coupons", managerAuth, couponController.create);
router.post("/coupons/:id", managerAuth, couponController.update);
router.get("/animals", managerAuth, animalController.list);
router.post(
  "/animal-categories",
  managerAuth,
  animalController.createCategory,
);
router.post(
  "/animal-categories/:id",
  managerAuth,
  animalController.updateCategory,
);
router.post(
  "/animal-categories/:id/delete",
  managerAuth,
  animalController.removeCategory,
);
router.post("/animals", managerAuth, animalController.create);
router.post("/animals/:id", managerAuth, animalController.update);
router.post("/animals/:id/delete", managerAuth, animalController.remove);

router.get("/config", managerAuth, configController.get);
router.post("/config", managerAuth, configController.update);

router.get("/mice/week", managerAuth, mouseController.getWeek);

export default router;
