import mongoose from "mongoose";

const spinConfigSchema = new mongoose.Schema(
  {
    dailySpinLimit: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

export default mongoose.model("SpinConfig", spinConfigSchema);
