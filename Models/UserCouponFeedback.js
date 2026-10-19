// models/UserCouponFeedback.js
import mongoose from 'mongoose';

const userCouponFeedbackSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true
  },
  userCouponId: {  // ✅ ADD THIS - links to specific MyCoupon entry
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User.MyCoupons',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  vendorRating: {
    type: Number,
    min: 1,
    max: 5
  },
  vendorComment: {
    type: String,
    trim: true,
    maxlength: 500
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ✅ MODIFIED: Allow multiple feedbacks per user-coupon, but unique per userCouponId
userCouponFeedbackSchema.index({ userCouponId: 1 }, { unique: true });

const UserCouponFeedback = mongoose.model('UserCouponFeedback', userCouponFeedbackSchema);
export default UserCouponFeedback;