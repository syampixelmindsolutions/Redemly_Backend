import mongoose from 'mongoose';

const accessModuleSchema = {
  view: { type: Boolean, default: false },
  edit: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
  create: { type: Boolean, default: false },
  approve: { type: Boolean, default: false },
  verify: { type: Boolean, default: false },
  send: { type: Boolean, default: false },
  export: { type: Boolean, default: false }
};

const staffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,  // ✅ This already creates an index
    lowercase: true,
    trim: true
  },
  mobileNumber: {
    type: String,
    required: [true, 'Mobile number is required'],
    unique: true,  // ✅ This already creates an index
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  profileImage: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  accessModules: {
    users: accessModuleSchema,
    vendors: {
      view: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      approve: { type: Boolean, default: false }
    },
    coupons: {
      view: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      approve: { type: Boolean, default: false },
      create: { type: Boolean, default: false }
    },
    categories: {
      view: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      create: { type: Boolean, default: false }
    },
    quizzes: {
      view: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      create: { type: Boolean, default: false }
    },
    funFacts: {
      view: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      create: { type: Boolean, default: false }
    },
    banners: {
      view: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      create: { type: Boolean, default: false }
    },
    payments: {
      view: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      verify: { type: Boolean, default: false }
    },
    reports: {
      view: { type: Boolean, default: false },
      export: { type: Boolean, default: false }
    },
    settings: {
      view: { type: Boolean, default: false },
      edit: { type: Boolean, default: false }
    },
    notifications: {
      view: { type: Boolean, default: false },
      send: { type: Boolean, default: false }
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  passwordChangedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// ✅ REMOVE these duplicate index declarations:
// staffSchema.index({ email: 1 });  // DELETE THIS LINE
// staffSchema.index({ mobileNumber: 1 });  // DELETE THIS LINE

// ✅ Keep only this index (if needed):
staffSchema.index({ isActive: 1 });

const Staff = mongoose.model('Staff', staffSchema);
export default Staff;