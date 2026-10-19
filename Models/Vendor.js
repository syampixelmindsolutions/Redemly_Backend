import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema({
  // Personal Information
  firstName: {
    type: String,
    required: true,
  },
  
  lastName: {
    type: String,
    required: true,
  },
  
  name: {
    type: String,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  phone: {
    type: String,
    required: true,
    unique: true,
  },

  tillNumber: {
    type: String,
    required: true,
    unique: true,
  },
  acceptTerms: {
    type: Boolean,
    required: true,
    default: false
  },

  // Business Information
  businessName: String,
  businessLogo: {
    type: String,
    required: true,
  },

  note: String,

  // Location Information
  addresses: [{
    street: String,
    city: String,
    zipcode: String,
    country: String,
    state: String
  }],

  location: {
    type: { type: String, default: 'Point' },
    coordinates: {
      type: [Number],
      index: '2dsphere',
    },
  },

  // Authentication
  password: {
    type: String,
    default: null,
  },

  isApproved: {
    type: Boolean,
    default: false,
  },

  // OTP Verification
  otp: String,
  otpExpiry: Date,

  // Feedback (keeping existing structure)
  MyFeedback: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      stars: Number,
      tellUsAboutExperience: String,
      createdAt: { type: Date, default: Date.now },
    }
  ],

  // Documents (keeping existing structure)
  documents: [
    {
      type: { type: String },
      url: { type: String },
      uploadedAt: { type: Date, default: Date.now },
    }
  ],

}, { timestamps: true });

// Combine first and last name before saving
vendorSchema.pre('save', function(next) {
  if (this.firstName && this.lastName && !this.name) {
    this.name = `${this.firstName} ${this.lastName}`;
  }
  next();
});

const Vendor = mongoose.model('Vendor', vendorSchema);

export default Vendor;