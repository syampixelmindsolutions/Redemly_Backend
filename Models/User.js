import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String },
  email: { type: String, lowercase: true, unique: true, sparse: true },
  phone: { type: String, unique: true },
  city: { type: String },
  zipcode: { type: String },
  dateOfBirth: { type: String },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: null },
  ageGroup: { type: String, enum: ['15-20','20-25','30-35','40-45','50-55','60-65','70-75','80-85'], default: null },
  password: { type: String, required: false },
  isUserConfirmed: { type: Boolean, default: false },
  emailVerificationOtp: String,
  emailVerificationOtpExpiry: Date,
  passwordResetOtp: String,
  passwordResetOtpExpiry: Date,
  passwordResetVerified: { type: Boolean, default: false },
  otp: String,
  otpExpiry: Date,
  googleId: { type: String, unique: true, sparse: true },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  isEmailVerified: { type: Boolean, default: false },
  coins: { type: Number, default: 0 },
  coupons: { type: Number, default: 0 },
  couponHistory: [{
    type: { type: String },
    code: { type: String },
    message: { type: String },
    date: { type: Date, default: Date.now }
  }],
  steps: [{
    date: Date,
    day: String,
    stepsCount: Number,
    distance: Number,
    kcal: Number,
    timeSpent: String
  }],
  profileImage: { type: String, default: '' },
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number]
  },
  coinHistory: [{
    type: { type: String, enum: ['received', 'sent', 'added'], required: true },
    amount: Number,
    message: String,
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
  }],
  claimedCoupons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' }],
  MyChatMembers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['Pending', 'Accepted'], default: 'Pending' }
  }],
  notifications: [{
    message: String,
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName: String,
    vendorLogo: String,
    type: { type: String, enum: ['survey', 'chat', 'order', 'general', 'infoRequest', 'infoRequestAccepted', 'infoRequestRejected'], default: 'general' },
    read: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'unread'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  }],
  onlineStatus: { type: Boolean, default: false },
  MyCoupons: [{
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    status: { type: String, enum: ['Active', 'Inactive', 'Used', 'Redeemed', 'Expired'], default: 'Inactive' },
    claimedAt: { type: Date, default: Date.now },
    expiresAt: Date,
    purchasedAt: Date,
    activatedAt: Date,
    usedAt: Date,
    isClaimed: { type: Boolean, default: false },
    canBeClaimed: { type: Boolean, default: true },
    claimVerified: { type: Boolean, default: false },
    claimAttempts: { type: Number, default: 0 },
    lastClaimAttempt: Date,
    vendorLocation: String,
    transactionId: String,
    transactionAmount: Number,
    couponCode: String,
    discountPercentage: Number,
    couponCodeType: { type: String, enum: ['%', 'flat'] },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName: String,
    vendorLogo: String,
    redeemedWith: { type: String, enum: ['coins', 'coupons'] },
    downloadedCount: { type: Number, default: 0 }
  }],
  couponCode: { type: String, unique: true },
  transferCoins: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number,
    date: { type: Date, default: Date.now }
  }],
  transferCoinsHistory: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number,
    date: { type: Date, default: Date.now },
    transactionType: { type: String, enum: ['sent', 'received'] }
  }],
  totalTransferCoins: { type: Number, default: 0 },
  favoriteCoupons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' }],
  spinCountToday: { type: Number, default: 0 },
  lastSpinDate: Date,
  dailySpinUsed: { type: Boolean, default: false },
  categoryTimeSpend: [{
    categoryName: String,
    timeSpent: { type: Number, default: 0 },
    sessions: [{
      startTime: Date,
      endTime: Date,
      duration: Number
    }],
    lastUpdated: { type: Date, default: Date.now }
  }],
  seenQuizzes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }],
  seenFacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FunFact' }],
  quizCompletionHistory: [{
    category: String,
    completedAt: Date,
    completedCount: Number
  }],
  factCompletionHistory: [{
    category: String,
    completedAt: Date,
    completedCount: Number
  }],
  firstLoginPopup: { type: String, default: 'pending' },
  hasCompletedFirstLogin: { type: Boolean, default: false },
  viewHistory: [{
    contentId: { type: mongoose.Schema.Types.ObjectId },
    contentType: { type: String, enum: ['fact',"funFacts", 'news', 'quiz', 'quiz_question', 'steps'] },
    timeSpent: { type: Number, default: 0 },
    viewedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Create index for better query performance
userSchema.index({ 'viewHistory.viewedAt': -1 });
userSchema.index({ 'coinHistory.timestamp': -1 });

const User = mongoose.model('User', userSchema);
export default User;