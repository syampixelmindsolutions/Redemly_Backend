import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true
    },

    name: { type: String },
    category: { type: String },
    discountPercentage: { type: Number },

    // 🔒 ADMIN CONTROLS
    requiredCoins: {
      type: Number,
      default: 0
    },

    limitForSameUser: {
      type: Number,
      default: 1
    },

    maxUsage: {
      type: Number,
      default: 1000
    },

    usedCount: {
      type: Number,
      default: 0
    },

    // ADD THESE FIELDS:
    downloaded: {  // Track total downloads
      type: Number,
      default: 0
    },

    couponCode: {
      type: String,
      unique: true,
      required: true
    },

    validityDate: {
      type: Date,
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "expired", "used",'delete_requested',"deleted"],
      default: "pending"
    },

    couponCodeType: {
      type: String,
      enum: ["%", "flat"],
      default: "%"
    },

    couponImage: {
      type: String
    },
    
    // ADD THESE FIELDS FOR COUPON DETAILS:
    description: { type: String },  // Optional: coupon description
    
    terms: { type: String },  // Terms and conditions
    
    // Already exists:
    isDeleted: {
      type: Boolean,
      default: false
    },
    
    deleteRequested: {
      type: Boolean,
      default: false,
    },
    deleteRequestedAt: Date,

  },
  { timestamps: true }
);

export default mongoose.model("Coupon", couponSchema);
