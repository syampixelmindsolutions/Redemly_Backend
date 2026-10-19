// Models/VendorMonthlyPayment.js
import mongoose from 'mongoose';

const VendorMonthlyPaymentSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  month: {
    type: String,
    required: true,
    index: true
  },
  totalCouponsClaimed: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  amountPending: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partially_paid', 'fully_paid'],
    default: 'pending'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Single unique index on vendorId and month
VendorMonthlyPaymentSchema.index({ vendorId: 1, month: 1 }, { unique: true });

const VendorMonthlyPayment = mongoose.model('VendorMonthlyPayment', VendorMonthlyPaymentSchema);
export default VendorMonthlyPayment;