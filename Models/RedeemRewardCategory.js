import mongoose from "mongoose";

const redeemRewardCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },

    image: {
      type: String,
      required: true
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model(
  "RedeemRewardCategory",
  redeemRewardCategorySchema
);
