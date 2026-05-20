const express = require("express");

const router = express.Router();

const {
  getMyProfile,
  getPublicProfile,
  updateProfile,
} = require("../../controllers/user.controller");

const optionalAuthMiddleware =
  require("../../middlewares/optionalAuth.middleware");

const userAuthMiddleware =
  require("../../middlewares/userAuth.middleware");

const validate =
  require("../../middlewares/validate.middleware");

const {
  updateProfileValidation,
} = require("../../validations/user.validation");

router.get(
  "/me/profile",
  userAuthMiddleware,
  getMyProfile
);

router.get(
  "/:userId/profile",
  optionalAuthMiddleware,
  getPublicProfile
);

router.patch(
  "/profile",
  userAuthMiddleware,
  validate(updateProfileValidation),
  updateProfile
);

module.exports = router;