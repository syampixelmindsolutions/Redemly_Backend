import mongoose from 'mongoose';

const PaymentConfigSchema = new mongoose.Schema({
  pricePerCoupon: {
    type: Number,
    required: true,
    default: 1.0,
    min: 0
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  validFrom: {
    type: Date,
    default: Date.now
  },
  
  note: String,
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const PaymentConfig = mongoose.model('PaymentConfig', PaymentConfigSchema);
export default PaymentConfig;