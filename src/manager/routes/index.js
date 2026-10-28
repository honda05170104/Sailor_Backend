import express from "express";
import managerAuth from "../../middleware/managerAuth.js";
import * as managerController from "../controllers/manager.controller.js";
import * as branchController from "../controllers/branch.controller.js";
import * as memberController from "../controllers/member.controller.js";
import * as transactionController from "../controllers/transaction.controller.js";
import * as vipController from "../controllers/vip.controller.js";
import * as tagController from "../controllers/tag.controller.js";
import * as couponController from "../controllers/coupon.controller.js";
import * as configController from "../controllers/config.controller.js";
import * as promotionController from "../controllers/promotion.controller.js";
import * as speciesController from "../controllers/species.controller.js";
import * as messageController from "../controllers/message.controller.js";
import * as dashboardController from "../controllers/dashboard.controller.js";
import * as importedOrderController from "../controllers/imported-order.controller.js";

const router = express.Router();

router.post("/login", managerController.login);
router.post("/logout", managerAuth, managerController.logout);
router.get("/me", managerAuth, managerController.me);
router.get("/dashboard", managerAuth, dashboardController.get);

router.get("/branches", managerAuth, branchController.list);
router.get("/imported-orders", managerAuth, importedOrderController.list);
router.get("/imported-orders/:id", managerAuth, importedOrderController.get);
router.get("/users", managerAuth, memberController.list);
router.get("/users/:id", managerAuth, memberController.get);
router.post("/users/:id", managerAuth, memberController.update);
router.post("/users/:id/tags", managerAuth, memberController.setTags);
router.post("/users/:id/coupons", managerAuth, couponController.issue);
router.post("/user-coupons/:id/use", managerAuth, couponController.use);
router.post(
  "/transactions/import",
  managerAuth,
  transactionController.uploadImportFile,
  transactionController.importOrders,
);
router.get("/vips", managerAuth, vipController.list);
router.get("/tags", managerAuth, tagController.list);
router.post("/tags", managerAuth, tagController.create);
router.post("/tags/:id", managerAuth, tagController.update);
router.get("/coupons", managerAuth, couponController.list);
router.post("/coupons", managerAuth, couponController.create);
router.post("/coupons/:id", managerAuth, couponController.update);
router.post("/coupons/:id/delete", managerAuth, couponController.remove);

router.get("/config", managerAuth, configController.get);
router.post("/config", managerAuth, configController.update);

router.get("/species", managerAuth, speciesController.list);
router.post("/species", managerAuth, speciesController.create);
router.get("/species/reviews", managerAuth, speciesController.listReviews);
router.post("/species/reviews/:id/approve", managerAuth, speciesController.approveReview);
router.post("/species/reviews/:id/reject", managerAuth, speciesController.rejectReview);
router.post("/species/:id/delete", managerAuth, speciesController.remove);
router.post("/species/:id", managerAuth, speciesController.update);

router.get("/promotions", managerAuth, promotionController.list);
router.post("/promotions/:id", managerAuth, promotionController.update);

router.post("/messages/broadcast", managerAuth, messageController.broadcast);
router.post("/messages/broadcast-coupon", managerAuth, messageController.broadcastCoupon);

export default router;
