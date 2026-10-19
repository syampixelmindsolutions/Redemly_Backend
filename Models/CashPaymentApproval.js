import mongoose from 'mongoose';

const CashPaymentApprovalSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  
  vendorName: {
    type: String,
    required: true
  },
  
  amountUSD: {
    type: Number,
    required: true,
    min: 0
  },
  
  amountINR: {
    type: Number,
    required: true,
    min: 0
  },
  
  month: {
    type: String,
    required: true,
    index: true
  },
  
  periodLabel: {
    type: String,
    default: ''
  },
  
  periodType: {
    type: String,
    enum: ['monthly', 'weekly', 'custom'],
    default: 'monthly'
  },
  
  description: {
    type: String,
    default: ''
  },
  
  paymentProof: {
    type: String,
    default: ''
  },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  
  adminNotes: {
    type: String,
    default: ''
  },
  
  recordIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentRecord'
  }],
  
  submittedAt: {
    type: Date,
    default: Date.now
  },
  
  reviewedAt: {
    type: Date
  },
  
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Compound index for vendor + month + status
CashPaymentApprovalSchema.index({ vendorId: 1, month: 1, status: 1 });

const CashPaymentApproval = mongoose.model('CashPaymentApproval', CashPaymentApprovalSchema);
export default CashPaymentApproval;