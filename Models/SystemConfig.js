import mongoose from "mongoose";

const referralSettingsSchema = new mongoose.Schema(
  {
    referredUserCoupons: { type: Number, default: 2 },
    referrerUserCoupons: { type: Number, default: 2 },
    registrationCoupons: { type: Number, default: 2 },
    isReferralEnabled: { type: Boolean, default: false }
  },
  { _id: false }
);

const systemConfigSchema = new mongoose.Schema(
  {
    referralSettings: {
      type: referralSettingsSchema,
      default: () => ({})
    }
  },
  { timestamps: true }
);

export default mongoose.model("SystemConfig", systemConfigSchema);
