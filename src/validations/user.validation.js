const { z } = require("zod");
const { REGEX, GENDER } = require("../constants");

const updateProfileValidation = {
  body: z.object({
    firstName: z.string().min(1, "First name cannot be empty").max(50).optional(),
    lastName: z.string().min(1, "Last name cannot be empty").max(50).optional(),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30)
      .toLowerCase()
      .optional(),
    bio: z.string().max(150, "Bio cannot exceed 150 characters").optional(),
    gender: z.enum(Object.values(GENDER)).optional(),
    city: z.string().max(50, "City name cannot exceed 50 characters").optional(),
    profilePic: z.string().optional(),
  }),
};

const getPublicProfileValidation = {
  params: z.object({
    userId: z.string().regex(REGEX.MONGODB_ID, "Invalid User ID format"),
  }),
};

module.exports = {
  updateProfileValidation,
  getPublicProfileValidation,
};