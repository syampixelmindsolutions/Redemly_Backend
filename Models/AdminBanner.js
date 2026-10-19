// In your AdminBanner model file (Models/AdminBanner.js)
import mongoose from "mongoose";

const adminBannerImageSchema = new mongoose.Schema(
  {
    url: String,
    public_id: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true } // Ensure each image gets its own _id
);

const adminBannerSchema = new mongoose.Schema(
  {
    images: [adminBannerImageSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("AdminBanner", adminBannerSchema);