const { z } = require("zod");

const updateProfileValidation = z.object({
  bio: z.string().max(150).optional(),

  gender: z
    .enum(["male", "female", "other"])
    .optional(),

//   city: z.string().max(50).optional(),

  profilePic: z.string().optional(),
});

module.exports = {
  updateProfileValidation,
};