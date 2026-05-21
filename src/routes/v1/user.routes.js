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

const lockRequest =
  require("../../middlewares/lockRequest.middleware");

const validate =
  require("../../middlewares/validate.middleware");

const {
  updateProfileValidation,
  getPublicProfileValidation,
} = require("../../validations/user.validation");

router.get(
  "/me/profile",
  userAuthMiddleware,
  getMyProfile
);

router.get(
  "/:userId/profile",
  optionalAuthMiddleware,
  validate(getPublicProfileValidation),
  getPublicProfile
);

router.patch(
  "/me/profile",
  userAuthMiddleware,
  lockRequest, // Prevent concurrent duplicate updates & storage purge race conditions
  validate(updateProfileValidation),
  updateProfile
);

module.exports = router;


