import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  // Add sender fields
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
    // Don't add index here - we'll add it separately if needed
  },
  senderName: String,
  senderProfileImage: String,

  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
  },
  vendorName: String,
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: [
      'general',
      'coupon_purchased',
      'coupon_claimed',
      'coupon_expired',
      'coupon_rejected',
      'coins_added',
      'coins_sent',
      'coins_received',
      'feedback_reminder',
      'feedback_submitted',
      'vendor',           // ✅ ADD THIS
      'coupon',           // ✅ ADD THIS  
      'chat_request',
      'coupon_created',
      'chat_request_accepted',
      'chat_request_declined',
      'favorite',
      'registration_bonus',
      'referral_bonus',
      'quiz_completed',
      'spin_used',
      'payment'
    ],
    default: 'general'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  delivered: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// ✅ Define indexes properly - avoid duplicates
// Compound indexes are usually sufficient
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
// If you need senderId index, add it here but check if it already exists
// notificationSchema.index({ senderId: 1 }); // Comment this out if it causes issues

export default mongoose.model('Notification', notificationSchema);