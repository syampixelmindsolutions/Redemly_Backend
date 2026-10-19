// models/SpinCoin.js
import mongoose from "mongoose";

const spinCoinSchema = new mongoose.Schema(
  {
    coins: {
      type: [Number],
      required: true,
      default: []
    },
    coupons: {
      type: [Number],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const SpinCoin = mongoose.model("SpinCoin", spinCoinSchema);
export default SpinCoin;
