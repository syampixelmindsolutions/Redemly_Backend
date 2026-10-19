// Models/PaymentRecord.js
import mongoose from 'mongoose';

const PaymentRecordSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pricePerCoupon: {
    type: Number,
    required: true,
    default: 1.0
  },
  month: {
    type: String,
    required: true,
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['pending', 'online', 'offline', 'cash'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'verified', 'failed'],
    default: 'pending',
    index: true
  },
  claimedAt: {
    type: Date,
    default: Date.now
  },
  paidAt: {
    type: Date
  },
  couponName: String,
  couponCode: String,
  vendorName: String,
  transactionId: String,
  paymentDetails: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Indexes for faster queries
PaymentRecordSchema.index({ vendorId: 1, month: 1 });
PaymentRecordSchema.index({ vendorId: 1, paymentStatus: 1 });
PaymentRecordSchema.index({ claimedAt: -1 });

const PaymentRecord = mongoose.model('PaymentRecord', PaymentRecordSchema);
export default PaymentRecord;