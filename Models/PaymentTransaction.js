// Models/PaymentTransaction.js
import mongoose from 'mongoose';

const PaymentTransactionSchema = new mongoose.Schema({
  orderId: {
    type: String,
    
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
 
    index: true
  },
  vendorName: {
    type: String
  },
  amountUSD: {
    type: Number,
    
  },
  amountINR: {
    type: Number,
    
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['created', 'attempted', 'paid', 'failed'],
    default: 'created',
    index: true
  },
  periodType: {
    type: String,
    enum: ['monthly', 'weekly']
  },
  month: {
    type: String
  },
  periodLabel: {
    type: String
  },
  recordIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentRecord'
  }],
  paymentMethod: {
    type: String,
    default: 'online'
  },
  paymentDetails: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Compound index for vendor + status queries
PaymentTransactionSchema.index({ vendorId: 1, status: 1 });

// REMOVED: PaymentTransactionSchema.index({ orderId: 1 });
// (The unique constraint already creates this index)

const PaymentTransaction = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
export default PaymentTransaction;