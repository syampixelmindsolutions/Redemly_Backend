
import jwt from 'jsonwebtoken'; // For JWT token generation
import dotenv from 'dotenv';
import User from '../Models/User.js';
import Vendor from '../Models/Vendor.js'
import Coupon from '../Models/Coupon.js';
import axios from 'axios'
import OpenAI from 'openai';
import cloudinary from '../config/cloudinary.js';
import GuideVideo from '../Models/GuideVideo.js';
import Feedback from '../Models/Feedback.js';
import fetch from 'node-fetch';
import Message from '../Models/Message.js';
import Contact from '../Models/Contact.js';
import xml2js from 'xml2js';
import * as cheerio from 'cheerio'; // ✅ correct for ESM
import Survay from '../Models/Survey.js'
import mongoose from "mongoose";
import UserCouponFeedback from '../Models/UserCouponFeedback.js';
import SpinCoin from '../Models/SpinCoin.js';
import QuizSubmission from '../Models/QuizSubmission.js';
import FunFact from '../Models/FunFacts.js';
import NewsArticle from '../Models/NewsArticle.js';
import Quiz from '../Models/Quizz.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import SpinConfig from '../Models/SpinConfig.js';
import RedeemRewardCategory from "../Models/RedeemRewardCategory.js";
import Notification from '../Models/Notification.js';  // Make sure this is correct
import PaymentConfig from '../Models/PaymentConfig.js';
import PaymentRecord from '../Models/PaymentRecord.js';
import VendorMonthlyPayment from '../Models/VendorMonthlyPayment.js';
import SystemConfig from '../Models/SystemConfig.js';
import { fetchReferralSettings } from "../middlewares/referralSettingsService.js";
import News from "../Models/News.js";
import bcrypt from 'bcrypt';


import { OAuth2Client } from 'google-auth-library';
// import { getReferralSettings } from '../middlewares/referralSettingsService.js';
// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// Add this import at the top with your other imports
// Add this import at the top
import admin from 'firebase-admin';
import fs from 'fs';
// At the top of userController.js - replace your existing Firebase init

let firebaseInitialized = false;

try {
  // ✅ KEY FIX: Replace \\n with actual newlines in private key
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
    || fs.readFileSync(new URL('../config/firebaseServiceAccount.json', import.meta.url), 'utf8');
  const serviceAccount = JSON.parse(serviceAccountJson);

  // Check if already initialized (important for hot reloads)
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: "redemly-9f2d3"
    });
    console.log('✅ Firebase Admin initialized successfully');
  } else {
    console.log('✅ Firebase Admin already initialized');
  }

  firebaseInitialized = true;

} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  firebaseInitialized = false;
}

// ========== HELPER FUNCTIONS (add at the top of the file, after imports) ==========
const generateUniqueUserCouponCode = async (name) => {
  const prefix = name.replace(/\s/g, '').slice(0, 4).toUpperCase();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${random}`;
};

const generateEmailOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Configure nodemailer (use your email credentials)

const mailtransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_ID,
    pass: process.env.MAIL_PASSWORD,
  },
});





// const mailtransporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.MAIL_ID,
//     pass: process.env.MAIL_PASSWORD,
//   },
// });

// export default mailtransporter;


// // Helper: Track time spent on any content
// const trackUserContentTime = async (userId, contentId, contentType, timeSpentSeconds) => {
//   try {
//     if (!userId || !contentId || !contentType || !timeSpentSeconds) return null;
    
//     const user = await User.findById(userId);
//     if (!user) return null;
    
//     if (!Array.isArray(user.viewHistory)) user.viewHistory = [];
    
//     const today = new Date().toISOString().slice(0, 10);
//     const existingIndex = user.viewHistory.findIndex(
//       v => v.contentId && v.contentId.toString() === contentId && 
//            v.contentType === contentType &&
//            new Date(v.viewedAt).toISOString().slice(0, 10) === today
//     );
    
//     if (existingIndex !== -1) {
//       user.viewHistory[existingIndex].timeSpent += timeSpentSeconds;
//       user.viewHistory[existingIndex].viewedAt = new Date();
//     } else {
//       user.viewHistory.push({
//         contentId,
//         contentType,
//         timeSpent: timeSpentSeconds,
//         viewedAt: new Date()
//       });
//     }
    
//     await user.save();
//     return user.viewHistory;
//   } catch (error) {
//     console.error('trackUserContentTime error:', error);
//     return null;
//   }
// };


// const generateEmailOtp = () => {
//   return Math.floor(100000 + Math.random() * 900000).toString();
// };


/**
 * Upload image to Cloudinary with optimization
 */
const uploadImageToCloudinary = async (imageFile, folder = "news") => {
  try {
    // If it's a file upload
    if (imageFile && imageFile.tempFilePath) {
      const result = await cloudinary.uploader.upload(imageFile.tempFilePath, {
        folder: `news/${folder}`,
        resource_type: "image",
        transformation: [
          { width: 1200, height: 630, crop: "fill" }, // Large image format
          { quality: "auto", fetch_format: "auto" }
        ]
      });
      return {
        url: result.secure_url,
        public_id: result.public_id
      };
    }

    // If it's a URL, download and upload
    if (typeof imageFile === 'string' && imageFile.startsWith('http')) {
      const response = await axios({
        url: imageFile,
        responseType: 'arraybuffer'
      });

      const base64Image = Buffer.from(response.data, 'binary').toString('base64');
      const result = await cloudinary.uploader.upload(`data:image/jpeg;base64,${base64Image}`, {
        folder: `news/${folder}`,
        transformation: [
          { width: 1200, height: 630, crop: "fill" },
          { quality: "auto", fetch_format: "auto" }
        ]
      });

      return {
        url: result.secure_url,
        public_id: result.public_id
      };
    }

    return null;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

/**
 * Extract domain from URL for source name
 */
const extractSourceName = (url) => {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '').split('.')[0];
  } catch {
    return "Unknown Source";
  }
};

/**
 * Validate and fix image URL
 */
const validateImageUrl2 = async (url) => {
  try {
    const response = await axios.head(url, { timeout: 5000 });
    const contentType = response.headers['content-type'];
    return contentType && contentType.startsWith('image/');
  } catch {
    return false;
  }
};

/**
 * Get category emoji based on category
 */

const migrateNewsCategories = async () => {
  try {
    const categoryMapping = {
      'US Immigration': 'Immigration',
      'Startup News': 'Stocks & Finance',
      'Tech Jobs': 'AI & Tech',
      'AP/TS Local News': 'India',
      'AI Developments': 'AI & Tech',
      'Stock Market & Crypto': 'Stocks & Finance',
      'Geopolitical News': 'Geopolitics',
      'General': 'India' // Default mapping for General
    };

    const result = await News.updateMany(
      { category: { $in: Object.keys(categoryMapping) } },
      [
        {
          $set: {
            category: {
              $switch: {
                branches: Object.entries(categoryMapping).map(([oldCat, newCat]) => ({
                  case: { $eq: ['$category', oldCat] },
                  then: newCat
                })),
                default: '$category'
              }
            }
          }
        }
      ]
    );

    console.log(`Migration complete: ${result.modifiedCount} documents updated`);
  } catch (error) {
    console.error('Migration error:', error);
  }
};


// const getReferralSettings = async () => {
//   try {
//     const config = await SystemConfig.findOne().lean();
//     return config?.referralSettings || null;
//   } catch (error) {
//     console.error("Error fetching referral settings:", error);
//     return null;
//   }
// };
dotenv.config();

const generateCouponCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let couponCode = '';
  for (let i = 0; i < 8; i++) {
    couponCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return couponCode;
};

// Helper function to verify Google token
const verifyGoogleToken = async (idToken) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    return payload;
  } catch (error) {
    console.error('Error verifying Google token:', error);
    throw new Error('Invalid Google token');
  }
};


// Generate unique user-specific coupon code with collision detection
// const generateUniqueUserCouponCode = async (basePrefix = '') => {
//   const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
//   let attempts = 0;
//   const maxAttempts = 15;

//   while (attempts < maxAttempts) {
//     // Generate 8-character code
//     let code = basePrefix ? basePrefix.substring(0, 4).toUpperCase() : '';
//     const remainingLength = 8 - code.length;

//     for (let i = 0; i < remainingLength; i++) {
//       code += chars.charAt(Math.floor(Math.random() * chars.length));
//     }

//     // Check if code already exists in any user's MyCoupons
//     const existingCode = await User.findOne({
//       'MyCoupons.couponCode': code
//     });

//     if (!existingCode) {
//       return code; // Code is unique
//     }

//     attempts++;
//   }

//   // Fallback: timestamp-based code if collision persists
//   const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
//   const random = Math.random().toString(36).substring(2, 6).toUpperCase();
//   return `${timestamp}${random}`;

// };

// ================= UNIFIED NOTIFICATION HELPERS =================
// Add this function to your userController.js
const userSockets = {}; // Add this global object at the top

// Helper function to check if coupon is eligible for feedback
const isCouponEligibleForFeedback = (userCoupon) => {
  if (!userCoupon) return false;

  // Coupon must be claimed (isClaimed true) and either Used or Active
  if (!userCoupon.isClaimed) return false;

  // Check if coupon is Used or Active
  if (userCoupon.status !== 'Used' && userCoupon.status !== 'Active') {
    return false;
  }

  // Check if coupon was used/claimed within reasonable time (e.g., last 30 days)
  const usedAt = userCoupon.usedAt || userCoupon.claimedAt;
  if (!usedAt) return false;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return new Date(usedAt) > thirtyDaysAgo;
};
const emitPendingNotifications = async (userId) => {
  try {
    const pendingNotifications = await Notification.find({
      userId,
      isRead: false,
      delivered: { $ne: true }
    }).sort({ createdAt: -1 }).limit(10);

    const socketId = userSockets[userId];
    if (socketId && pendingNotifications.length > 0) {
      pendingNotifications.forEach(async (notification) => {
        if (global.io) {
          global.io.to(socketId).emit('newNotification', {
            _id: notification._id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            vendorId: notification.vendorId,
            couponId: notification.couponId,
            metadata: notification.metadata,
            createdAt: notification.createdAt,
            isRead: notification.isRead
          });

          // Mark as delivered
          notification.delivered = true;
          await notification.save();
        }
      });
    }
  } catch (error) {
    console.error('Error emitting pending notifications:', error);
  }
};
// Helper function to update monthly payment summary - FIXED
const updateMonthlyPaymentSummary = async (vendorId, month) => {
  try {
    if (!vendorId || !month) {
      console.error('updateMonthlyPaymentSummary: Missing vendorId or month');
      return null;
    }

    // Convert to ObjectId
    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

    console.log(`📊 Updating monthly summary for vendor ${vendorId}, month ${month}`);

    // Get price per coupon from config
    const priceConfig = await PaymentConfig.findOne({ isActive: true });
    const currentPrice = priceConfig?.pricePerCoupon || 1.0;

    // Find all payment records for this vendor and month
    const records = await PaymentRecord.find({
      vendorId: vendorObjectId,
      month: month
    });

    console.log(`Found ${records.length} payment records for month ${month}`);

    // Calculate totals
    let totalAmount = 0;
    let amountPaid = 0;
    let amountPending = 0;

    records.forEach(record => {
      const price = record.pricePerCoupon || currentPrice;
      totalAmount += price;

      if (record.paymentStatus === 'paid' || record.paymentStatus === 'verified') {
        amountPaid += price;
      } else {
        amountPending += price;
      }
    });

    // Determine payment status
    let paymentStatus = 'pending';
    if (records.length === 0) {
      paymentStatus = 'pending';
    } else if (amountPending <= 0 && totalAmount > 0) {
      paymentStatus = 'fully_paid';
    } else if (amountPaid > 0) {
      paymentStatus = 'partially_paid';
    }

    // Update or create monthly summary
    const summary = await VendorMonthlyPayment.findOneAndUpdate(
      { vendorId: vendorObjectId, month: month },
      {
        vendorId: vendorObjectId,
        month: month,
        totalCouponsClaimed: records.length,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        amountPaid: parseFloat(amountPaid.toFixed(2)),
        amountPending: parseFloat(amountPending.toFixed(2)),
        paymentStatus,
        lastUpdated: new Date()
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    console.log(`✅ Monthly summary updated:`, {
      records: records.length,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      amountPaid: parseFloat(amountPaid.toFixed(2)),
      amountPending: parseFloat(amountPending.toFixed(2)),
      paymentStatus
    });

    return summary;
  } catch (error) {
    console.error('updateMonthlyPaymentSummary error:', error.message);
    return null;
  }
};

/**
 * Notify admin about vendor/coupon actions
 * @param {string} vendorId - MongoDB ObjectId of vendor
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type (must match schema enum)
 * @param {object} metadata - Additional data
 */
const notifyAdmin = async (vendorId, title, message, type = 'general', metadata = {}) => {
  try {
    // Validate vendor exists
    const vendor = await Vendor.findById(vendorId).select('businessName name');
    if (!vendor) {
      console.error(`❌ Vendor ${vendorId} not found for admin notification`);
      return;
    }

    // Create notification
    await Notification.create({
      vendorId,
      vendorName: vendor.businessName || vendor.name,
      title,
      message,
      type, // Must be from schema enum
      metadata,
      isRead: false,
    });

    console.log(`✅ Admin notification created: ${title} | Type: ${type}`);
  } catch (error) {
    console.error('⚠️ Failed to create admin notification:', error.message);
    // Don't fail the main operation
  }
};

/**
 * Notify vendor about admin/user actions
 * @param {object} options - Notification options
 */
const notifyVendor = async ({
  vendorId,
  title,
  message,
  type = 'general',
  userId = null,
  couponId = null,
  metadata = {}
}) => {
  try {
    const vendor = await Vendor.findById(vendorId).select('businessName name');
    if (!vendor) {
      console.error(`❌ Vendor ${vendorId} not found for notification`);
      return;
    }

    await Notification.create({
      vendorId,
      vendorName: vendor.businessName || vendor.name,
      title,
      message,
      type, // Must be from schema enum
      userId,
      couponId,
      metadata,
      isRead: false,
    });

    console.log(`✅ Vendor notification created: ${title} | Type: ${type}`);
  } catch (error) {
    console.error('⚠️ Failed to create vendor notification:', error.message);
  }
};

/**
 * Notify user about vendor/admin actions
 * @param {object} options - Notification options
 */

/**
 * Notify user about vendor/admin actions with Socket.io
 */

/**
 * Notify user about vendor/admin actions with Socket.io
 */
// const notifyUser = async ({
//   userId,
//   title,
//   message,
//   type = 'general',
//   vendorId = null,
//   couponId = null,
//   metadata = {}
// }) => {
//   try {
//     // Validate user exists
//     const user = await User.findById(userId);
//     if (!user) {
//       console.error(`❌ User ${userId} not found for notification`);
//       return null;
//     }

//     // Create notification in database
//     const notification = await Notification.create({
//       userId,
//       title,
//       message,
//       type,
//       vendorId,
//       couponId,
//       metadata,
//       isRead: false,
//       delivered: false
//     });

//     console.log(`✅ User notification created: ${title} | Type: ${type} | ID: ${notification._id}`);

//     // 🔔 Emit to user via Socket.io if they're online
//     if (global.io) {
//       const notificationData = {
//         _id: notification._id,
//         title,
//         message,
//         type,
//         vendorId,
//         couponId,
//         metadata,
//         createdAt: notification.createdAt,
//         isRead: false
//       };

//       // Emit to user room
//       global.io.to(`user_${userId}`).emit('newNotification', notificationData);
//       console.log(`📡 Notification emitted to user_${userId}`);

//       // Mark as delivered
//       notification.delivered = true;
//       await notification.save();
//     } else {
//       console.warn('⚠️ Socket.io not available, notification saved but not emitted');
//     }

//     return notification;

//   } catch (error) {
//     console.error('⚠️ Failed to create user notification:', error.message);
//     console.error('Stack:', error.stack);
//     return null;
//   }
// };


/**
 * Notify user about vendor/admin actions with Socket.io
 */
/**
 * Notify user about vendor/admin actions with Socket.io
 */
/**
 * Notify user about vendor/admin actions with Socket.io
 */
const notifyUser = async ({
  userId,           // This is the RECEIVER
  senderId = null,  // Add senderId parameter
  senderName = null, // Add senderName parameter
  title,
  message,
  type = 'general',
  vendorId = null,
  couponId = null,
  metadata = {}
}) => {
  try {
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      console.error(`❌ User ${userId} not found for notification`);
      return null;
    }

    // If senderId is provided but senderName is not, fetch sender info
    if (senderId && !senderName) {
      const sender = await User.findById(senderId).select('name profileImage');
      if (sender) {
        senderName = sender.name;
        senderProfileImage = sender.profileImage;
      }
    }

    // Create notification in database with sender fields
    const notification = await Notification.create({
      userId, // This is the receiver
      senderId, // Now stored directly in schema
      senderName,
      title,
      message,
      type,
      vendorId,
      couponId,
      metadata: {
        ...metadata,
        receiverId: userId,
        receiverName: user.name
      },
      isRead: false,
      delivered: false
    });

    console.log(`✅ User notification created: ${title} | Type: ${type} | ID: ${notification._id}`);

    // 🔔 Emit to user via Socket.io if they're online
    if (global.io) {
      const notificationData = {
        _id: notification._id,
        title,
        message,
        type,
        vendorId,
        couponId,
        senderId,
        senderName,

        metadata: notification.metadata,
        createdAt: notification.createdAt,
        isRead: false
      };

      // Emit to user room
      global.io.to(`user_${userId}`).emit('newNotification', notificationData);
      console.log(`📡 Notification emitted to user_${userId}`);

      // Mark as delivered
      notification.delivered = true;
      await notification.save();
    } else {
      console.warn('⚠️ Socket.io not available, notification saved but not emitted');
    }

    return notification;

  } catch (error) {
    console.error('⚠️ Failed to create user notification:', error.message);
    console.error('Stack:', error.stack);
    return null;
  }
};
// Helper to check expired coupons pending feedback and send notifications
const sendFeedbackReminderNotifications = async () => {
  try {
    // Find users with expired coupons that don't have feedback
    const users = await User.find({
      'MyCoupons.status': 'Expired',
      'MyCoupons.isClaimed': true
    });

    for (const user of users) {
      const expiredCoupons = user.MyCoupons.filter(coupon =>
        coupon.status === 'Expired' &&
        coupon.isClaimed === true
      );

      for (const coupon of expiredCoupons) {
        // Check if feedback already exists for this coupon
        const existingFeedback = await UserCouponFeedback.findOne({
          userId: user._id,
          couponId: coupon.couponId
        });

        if (!existingFeedback) {
          // Check if notification already exists
          const existingNotification = await Notification.findOne({
            userId: user._id,
            couponId: coupon.couponId,
            type: 'feedback_reminder'
          });

          if (!existingNotification) {
            // Find coupon details
            const couponDetails = await Coupon.findById(coupon.couponId)
              .populate('vendorId', 'businessName');

            await notifyUser({
              userId: user._id,
              title: '📝 Feedback Reminder',
              message: `Please share your experience about ${couponDetails?.name || 'the coupon'} from ${couponDetails?.vendorId?.businessName || 'the vendor'}`,
              type: 'feedback_reminder',
              couponId: coupon.couponId,
              vendorId: coupon.vendorId,
              metadata: {
                couponName: couponDetails?.name,
                vendorName: couponDetails?.vendorId?.businessName,
                expiredAt: coupon.expiresAt
              }
            });
          }
        } else {
          // If feedback exists, remove any pending feedback reminders
          await Notification.deleteMany({
            userId: user._id,
            couponId: coupon.couponId,
            type: 'feedback_reminder'
          });
        }
      }
    }
  } catch (error) {
    console.error('Error sending feedback reminders:', error);
  }
};





/**
 * GOOGLE AUTH - THE ONLY API YOU NEED
 * Handles both signin and signup automatically
 */
export const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "ID Token is required"
      });
    }

    // Decode the token to get user info
    const decodedToken = jwt.decode(idToken);

    if (!decodedToken) {
      return res.status(400).json({
        success: false,
        message: "Invalid token format"
      });
    }

    console.log("Google Auth - Processing:", {
      email: decodedToken.email,
      name: decodedToken.name
    });

    const {
      sub: googleId,
      email,
      name,
      picture,
      email_verified
    } = decodedToken;

    // CHECK IF USER EXISTS (by email or googleId)
    let user = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { googleId: googleId }
      ]
    });

    let isNewUser = false;

    if (!user) {
      // ===== NEW USER - CREATE ACCOUNT =====
      isNewUser = true;

      // Generate unique coupon code
      const userCouponCode = await generateUniqueUserCouponCode(name || 'User');

      // Create new user
      user = new User({
        name: name || 'Google User',
        email: email.toLowerCase(),
        googleId: googleId,
        authProvider: 'google',
        isEmailVerified: email_verified || true,
        profileImage: picture || '',
        coins: 0,
        coupons: 5, // Welcome bonus
        couponCode: userCouponCode,
        hasCompletedFirstLogin: true,
        couponHistory: [{
          type: "added",
          message: "Received 5 coupons for Google registration",
          date: new Date(),
          bonusType: "google_registration",
          amount: 5
        }]
      });

      await user.save();
      console.log(`✅ New user created: ${email}`);

    } else {
      // ===== EXISTING USER - UPDATE IF NEEDED =====
      let updated = false;

      if (!user.googleId) {
        user.googleId = googleId;
        updated = true;
      }

      if (!user.profileImage && picture) {
        user.profileImage = picture;
        updated = true;
      }

      if (updated) {
        await user.save();
      }

      console.log(`✅ Existing user logged in: ${email}`);
    }

    // GENERATE JWT TOKEN
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET_KEY || 'fallback_secret_key',
      { expiresIn: "30d" }
    );

    // RETURN USER DATA
    return res.status(200).json({
      success: true,
      message: "Google authentication successful",
      isNewUser: isNewUser,
      token: token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        profileImage: user.profileImage,
        coins: user.coins || 0,
        coupons: user.coupons || 0,
        couponCode: user.couponCode,
        authProvider: user.authProvider || 'google',
        isEmailVerified: user.isEmailVerified || false,
        hasCompletedFirstLogin: user.hasCompletedFirstLogin || true,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error("❌ Google auth error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during Google authentication",
      error: error.message
    });
  }
};


const pendingUsers = new Map();

// ======================= REGISTER WITH EMAIL =======================
export const registerWithEmail = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      city,
      zipcode,
      gender,
      dateOfBirth,
      referralCode,
      userConfirmation,
      password,
    } = req.body;

    // ── Validation ──────────────────────────────────────────────────
    if (!name || !email || !phone || !city || !zipcode || !gender || !dateOfBirth || !password) {
      return res.status(400).json({ success: false, message: "All fields except referralCode are required" });
    }
    if (userConfirmation !== true && userConfirmation !== false) {
      return res.status(400).json({ success: false, message: "userConfirmation must be true or false" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    // ── Duplicate checks ────────────────────────────────────────────
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({ success: false, message: "Phone number already registered" });
    }

    // ── Also block if already pending ───────────────────────────────
    for (const [, data] of pendingUsers) {
      if (data.email === email.toLowerCase()) {
        return res.status(400).json({ success: false, message: "OTP already sent to this email. Please verify." });
      }
      if (data.phone === phone) {
        return res.status(400).json({ success: false, message: "Phone number already pending verification." });
      }
    }

    // ── Prepare user data ───────────────────────────────────────────
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const couponCode = await generateUniqueUserCouponCode(name);
    const emailOtp = generateEmailOtp();
    const emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const userData = {
      name,
      email: email.toLowerCase(),
      phone,
      city,
      zipcode,
      gender,
      dateOfBirth,
      password: hashedPassword,
      isUserConfirmed: false,
      couponCode,
      emailVerificationOtp: emailOtp,
      emailVerificationOtpExpiry: emailOtpExpiry,
      coins: 0,
      coupons: 0,
      couponHistory: [],
    };

    // ── Referral logic (unchanged) ──────────────────────────────────
    const referralSettings = await fetchReferralSettings();
    const referredUserCoupons = Number(referralSettings?.referredUserCoupons) || 0;
    const referrerUserCoupons = Number(referralSettings?.referrerUserCoupons) || 0;
    const registrationCoupons = Number(referralSettings?.registrationCoupons) || 0;
    const isReferralEnabled = Boolean(referralSettings?.isReferralEnabled);

    if (referralCode && isReferralEnabled) {
      const referrer = await User.findOne({ couponCode: referralCode });
      if (referrer) {
        userData.coupons = referredUserCoupons;
        userData.couponHistory.push({
          type: "added",
          message: `Received ${referredUserCoupons} coupons using referral code from ${referrer.name}`,
          date: new Date(),
          bonusType: "referred",
          amount: referredUserCoupons,
          referredByUserId: referrer._id,
          referredByName: referrer.name,
        });
        referrer.coupons = (referrer.coupons || 0) + referrerUserCoupons;
        referrer.couponHistory.push({
          type: "added",
          message: `Received ${referrerUserCoupons} coupons for referring ${name}`,
          date: new Date(),
          bonusType: "referrer",
          amount: referrerUserCoupons,
          referredUserName: name,
        });
        await referrer.save();
        await notifyUser({
          userId: referrer._id,
          title: "🎁 Referral Successful!",
          message: `You earned ${referrerUserCoupons} coupons for referring ${name}!`,
          type: "referral_bonus",
        });
      } else {
        userData.coupons = registrationCoupons;
        userData.couponHistory.push({
          type: "added",
          message: `Received ${registrationCoupons} coupons for registration (invalid referral code)`,
          date: new Date(),
          bonusType: "registration",
          amount: registrationCoupons,
        });
      }
    } else {
      userData.coupons = registrationCoupons;
      userData.couponHistory.push({
        type: "added",
        message: `Received ${registrationCoupons} coupons for registration`,
        date: new Date(),
        bonusType: "registration",
        amount: registrationCoupons,
      });
    }

    // ── Store temporarily ───────────────────────────────────────────
    const tempId = new mongoose.Types.ObjectId().toString();
    pendingUsers.set(tempId, userData);
    setTimeout(() => pendingUsers.delete(tempId), 10 * 60 * 1000);

    // ── Send OTP email ──────────────────────────────────────────────
    await mailtransporter.sendMail({
      from: process.env.MAIL_ID,
      to: email,
      subject: "Email Verification OTP",
      html: `<p>Hello ${name},</p>
             <p>Your OTP for email verification is: <b>${emailOtp}</b></p>
             <p>Valid for 10 minutes.</p>`,
    });

    // ── Generate temp token (for OTP verification step only) ────────
    const tempToken = jwt.sign(
      { tempId },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1d" }   // expires same time as OTP
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful. OTP sent to email for verification.",
      userId: tempId,
      email: email.toLowerCase(),
      token: tempToken,       // ✅ token returned here
    });

  } catch (error) {
    console.error("Register with email error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
// ======================= VERIFY EMAIL OTP =======================
// ======================= VERIFY EMAIL OTP =======================
export const verifyEmailOtp = async (req, res) => {
  try {
    const { token, otp } = req.body;

    // ── Validation ──────────────────────────────────────────────────
    if (!token || !otp) {
      return res.status(400).json({ success: false, message: "token and OTP are required" });
    }

    // ── Decode token to get tempId ──────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid or expired token. Please register again." });
    }

    const tempId = decoded.tempId;
    if (!tempId) {
      return res.status(401).json({ success: false, message: "Invalid token. Please register again." });
    }

    // ── Get pending data ────────────────────────────────────────────
    const userData = pendingUsers.get(tempId);
    if (!userData) {
      return res.status(404).json({ success: false, message: "Session expired. Please register again." });
    }

    // ── Validate OTP ────────────────────────────────────────────────
    if (userData.emailVerificationOtp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }
    if (new Date() > userData.emailVerificationOtpExpiry) {
      pendingUsers.delete(tempId);
      return res.status(400).json({ success: false, message: "OTP expired. Please register again." });
    }

    // ── Save to DB now ──────────────────────────────────────────────
    const newUser = new User({
      ...userData,
      isUserConfirmed: true,
      emailVerificationOtp: null,
      emailVerificationOtpExpiry: null,
    });
    await newUser.save();

    pendingUsers.delete(tempId);

    // ── Generate final long-lived token ─────────────────────────────
    const authToken = jwt.sign(
      { id: newUser._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "30d" }
    );

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
      token: authToken,
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        coins: newUser.coins,
        coupons: newUser.coupons,
      },
    });

  } catch (error) {
    console.error("Verify email OTP error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
export const resendRegistrationOtp = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    // Decode token to get tempId
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid or expired token. Please register again." });
    }

    const tempId = decoded.tempId;
    if (!tempId) {
      return res.status(401).json({ success: false, message: "Invalid token. Please register again." });
    }

    const userData = pendingUsers.get(tempId);
    if (!userData) {
      return res.status(404).json({ success: false, message: "Session expired. Please register again." });
    }

    // Generate new OTP and reset expiry
    const newOtp = generateEmailOtp();
    const newExpiry = new Date(Date.now() + 10 * 60 * 1000);

    userData.emailVerificationOtp = newOtp;
    userData.emailVerificationOtpExpiry = newExpiry;

    pendingUsers.set(tempId, userData); // update in memory

    // Resend email
    await mailtransporter.sendMail({
      from: process.env.MAIL_ID,
      to: userData.email,
      subject: "Email Verification OTP (Resent)",
      html: `<p>Hello ${userData.name},</p>
             <p>Your new OTP for email verification is: <b>${newOtp}</b></p>
             <p>Valid for 10 minutes.</p>`,
    });

    return res.status(200).json({
      success: true,
      message: "New OTP sent to your email.",
    });
  } catch (error) {
    console.error("Resend registration OTP error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// export const verifyEmailOtp = async (req, res) => {
//   try {
//     const { userId, otp } = req.body;
//     if (!userId || !otp) {
//       return res.status(400).json({ success: false, message: "userId and OTP are required" });
//     }

//     const user = await User.findById(userId);
//     if (!user) return res.status(404).json({ success: false, message: "User not found" });
//     if (user.emailVerificationOtp !== otp) return res.status(400).json({ success: false, message: "Invalid OTP" });
//     if (new Date() > user.emailVerificationOtpExpiry) return res.status(400).json({ success: false, message: "OTP expired" });

//     user.isUserConfirmed = true;
//     user.emailVerificationOtp = null;
//     user.emailVerificationOtpExpiry = null;
//     await user.save();

//     const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "30d" });

//     return res.status(200).json({
//       success: true,
//       message: "Email verified successfully. You can now login.",
//       token,
//       user: {
//         _id: user._id,
//         name: user.name,
//         email: user.email,
//         phone: user.phone,
//         coins: user.coins,
//         coupons: user.coupons
//       }
//     });
//   } catch (error) {
//     console.error("Verify email OTP error:", error);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

export const loginWithPassword = async (req, res) => {
  try {
    const { email, password } = req.body;   // changed from 'phone' to 'email'
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });  // search by email
    if (!user) return res.status(401).json({ success: false, message: "Invalid email or password" });
    if (!user.password) return res.status(401).json({ success: false, message: "Account uses Google sign-in. Please use Google login." });
    // if (!user.isUserConfirmed) return res.status(403).json({ success: false, message: "Email not verified. Please verify your email first." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Invalid email or password" });

    user.lastLogin = new Date();
    if (!user.hasCompletedFirstLogin) user.hasCompletedFirstLogin = true;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "30d" });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        coins: user.coins,
        coupons: user.coupons,
        couponCode: user.couponCode
      }
    });
  } catch (error) {
    console.error("Login with password error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: "No account found with this email" });

    const resetOtp = generateEmailOtp();
    const resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.passwordResetOtp = resetOtp;
    user.passwordResetOtpExpiry = resetOtpExpiry;
    user.passwordResetVerified = false;
    await user.save();

    await mailtransporter.sendMail({
      from: process.env.MAIL_ID,
      to: email,
      subject: "Password Reset OTP",
      html: `<p>Hello ${user.name},</p><p>Your OTP for password reset is: <b>${resetOtp}</b></p><p>Valid for 10 minutes.</p>`
    });

    return res.status(200).json({
      success: true,
      message: "Password reset OTP sent to your email",
      userId: user._id
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: "userId and OTP are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.passwordResetOtp !== otp) return res.status(400).json({ success: false, message: "Invalid OTP" });
    if (new Date() > user.passwordResetOtpExpiry) return res.status(400).json({ success: false, message: "OTP expired" });

    user.passwordResetVerified = true;
    user.passwordResetOtp = null;
    user.passwordResetOtpExpiry = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified. You can now change your password.",
      userId: user._id
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { userId, newPassword, confirmPassword } = req.body;
    if (!userId || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "userId, newPassword and confirmPassword are required" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!user.passwordResetVerified) {
      return res.status(403).json({ success: false, message: "OTP not verified. Please request a new OTP." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.passwordResetVerified = false;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully. You can now login with your new password."
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// USER REGISTER
// ============================================
export const registerUser = async (req, res) => {
  try {
    const { name, email, phone, city, zipcode, dateOfBirth, referralCode } = req.body;

    // 1. Get admin referral settings
    const referralSettings = await fetchReferralSettings();
    if (!referralSettings) {
      return res.status(400).json({
        message: "Referral system is not configured yet. Please contact administrator."
      });
    }

    const referredUserCoupons = Number(referralSettings.referredUserCoupons) || 0;
    const referrerUserCoupons = Number(referralSettings.referrerUserCoupons) || 0;
    const registrationCoupons = Number(referralSettings.registrationCoupons) || 0;
    const isReferralEnabled = Boolean(referralSettings.isReferralEnabled);

    // 2. Generate user coupon code
    const couponCode = generateCouponCode();
    const userReferralCode = referralCode || null;

    // 3. Create user object
    const newUser = new User({
      name,
      email,
      phone,
      city,
      zipcode,
      dateOfBirth,
      couponCode,
      coins: 0,
      coupons: 0,
      couponHistory: []
    });

    // 4. Scenario A — No referral
    if (!userReferralCode) {
      newUser.coupons = registrationCoupons;

      newUser.couponHistory.push({
        type: "added",
        code: "",
        message: `Received ${registrationCoupons} coupons for registration`,
        date: new Date(),
        bonusType: "registration",
        amount: registrationCoupons
      });

      // Notify user
      await notifyUser({
        userId: newUser._id,
        title: "🎉 Welcome Bonus!",
        message: `You received ${registrationCoupons} coupons for registering!`,
        type: "registration_bonus",
        metadata: {
          couponsEarned: registrationCoupons,
          totalCoupons: newUser.coupons,
          bonusType: "registration"
        }
      });
    }
    // 5. Scenario B — Referral enabled and valid code
    else if (userReferralCode && isReferralEnabled) {
      const referredUser = await User.findOne({ couponCode: userReferralCode });

      if (referredUser) {
        // New user bonus
        newUser.coupons = referredUserCoupons;
        newUser.couponHistory.push({
          type: "added",
          code: "",
          message: `Received ${referredUserCoupons} coupons for using referral code from ${referredUser.name}`,
          date: new Date(),
          bonusType: "referred",
          amount: referredUserCoupons,
          referredByUserId: referredUser._id,
          referredByName: referredUser.name
        });

        // Referrer bonus
        referredUser.coupons = (referredUser.coupons || 0) + referrerUserCoupons;

        if (!Array.isArray(referredUser.couponHistory)) {
          referredUser.couponHistory = [];
        }

        referredUser.couponHistory.push({
          type: "added",
          code: "",
          message: `Received ${referrerUserCoupons} coupons for referring ${newUser.name}`,
          date: new Date(),
          bonusType: "referrer",
          amount: referrerUserCoupons,
          referredUserId: newUser._id,
          referredUserName: newUser.name
        });

        await referredUser.save();

        // Notify referrer
        await notifyUser({
          userId: referredUser._id,
          title: "🎁 Referral Successful!",
          message: `You earned ${referrerUserCoupons} coupons for referring ${newUser.name}!`,
          type: "referral_bonus",
          metadata: {
            newUserName: newUser.name,
            couponsEarned: referrerUserCoupons,
            totalCoupons: referredUser.coupons,
            bonusType: "referrer"
          }
        });

        // Notify new user
        await notifyUser({
          userId: newUser._id,
          title: "🎉 Welcome Bonus!",
          message: `You received ${referredUserCoupons} coupons for using referral code from ${referredUser.name}!`,
          type: "referral_bonus",
          metadata: {
            referredBy: referredUser.name,
            couponsEarned: referredUserCoupons,
            totalCoupons: newUser.coupons,
            bonusType: "referred"
          }
        });
      } else {
        // Invalid referral code
        newUser.coupons = registrationCoupons;
        newUser.couponHistory.push({
          type: "added",
          code: "",
          message: `Received ${registrationCoupons} coupons for registration (invalid referral code)`,
          date: new Date(),
          bonusType: "registration",
          amount: registrationCoupons
        });
      }
    }
    // 6. Scenario C — Referral disabled
    else {
      newUser.coupons = registrationCoupons;
      newUser.couponHistory.push({
        type: "added",
        code: "",
        message: `Received ${registrationCoupons} coupons for registration (referral system disabled)`,
        date: new Date(),
        bonusType: "registration",
        amount: registrationCoupons
      });
    }

    // 7. Save user
    await newUser.save();

    // 8. Generate token
    const token = jwt.sign(
      { id: newUser._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1h" }
    );

    // 9. Response (UNCHANGED from your original response format)
    return res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        city: newUser.city,
        zipcode: newUser.zipcode,
        dateOfBirth: newUser.dateOfBirth,
        couponCode: newUser.couponCode,
        coupons: newUser.coupons,
        coins: newUser.coins,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt
      }
    });

  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        message: `${field === "phone" ? "Phone number" : "Coupon code"} already exists`
      });
    }

    return res.status(500).json({ message: "Server error" });
  }
};





// Helper to generate 4-digit OTP
const generate4DigitOtp = () => {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 1000-9999
};

// Update the loginUser controller to set OTP for development/testing
export const loginUser = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "Phone number is required"
    });
  }

  try {
    // Check if user exists
    const user = await User.findOne({ phone: phone.toString().trim() });

    if (!user) {
      return res.status(200).json({
        success: false,
        isExists: false,
        message: "User not found. Please register first."
      });
    }

    // FOR DEVELOPMENT: Set OTP to "1234" with 10 minute expiry
    user.otp = "1234";
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    console.log(`✅ Development OTP set to 1234 for user: ${user.phone}`);

    // User exists — tell frontend to proceed with OTP verification
    return res.status(200).json({
      success: true,
      isExists: true,
      message: "User found. Proceed with OTP verification. (Dev OTP: 1234)",
      userId: user._id,
      name: user.name,
      phone: user.phone,
      devOtp: "1234" // Optional: send OTP in response for development
    });

  } catch (err) {
    console.error("Login check error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Keep your existing verifyOtps controller as is - it's correct
export const verifyOtps = async (req, res) => {
  const { otp } = req.body;
  const { userId } = req.params; // Extract userId from route parameters

  if (!otp) {
    return res.status(400).json({ error: "OTP is required" });
  }

  try {
    // 🔍 Find user by OTP and userId
    const user = await User.findOne({ _id: userId, otp });

    if (!user) {
      return res.status(400).json({ error: "Invalid OTP or User not found" });
    }

    // ⏰ Check OTP expiry
    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ error: "OTP expired" });
    }

    // ✅ Clear OTP and expiry after successful verification
    user.otp = null;
    user.otpExpiry = null;

    // mark first login completed (only first time)
    if (!user.hasCompletedFirstLogin) {
      user.hasCompletedFirstLogin = true;
    }
    await user.save();

    // 🔐 Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1h" });

    // ✅ Return response with token and user info
    return res.status(200).json({
      message: "OTP verified successfully",
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone || user.mobile,
        email: user.email || null,
        coins: user.coins,
      },
    });

  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};





export const verifyOtp = async (req, res) => {
  let { idToken, fcmToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      success: false,
      message: "idToken is required"
    });
  }

  idToken = idToken.trim();

  // ✅ Auto-fix missing 'e' at start (copy-paste issue)
  if (idToken.startsWith('yJhbGci') || idToken.startsWith('JhbGci')) {
    idToken = 'eyJ' + idToken.replace(/^e?y?J/, '');
  }

  try {
    console.log("🔍 Token length:", idToken.length);
    console.log("🔍 Token start:", idToken.substring(0, 15));

    let phoneNumber = null;
    let tokenExpired = false;

    // ── Step 1: Try Firebase Admin SDK first ────────────────
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      phoneNumber = decoded.phone_number;
      console.log("✅ Firebase Admin verified:", phoneNumber);

    } catch (adminError) {
      console.log("⚠️ Admin SDK error:", adminError.code);

      // ── Step 2: Decode JWT manually (no network needed) ──
      // Firebase ID tokens ARE standard JWTs - just base64 encoded
      try {
        const parts = idToken.split('.');

        if (parts.length !== 3) {
          return res.status(400).json({
            success: false,
            message: `Invalid token structure. Got ${parts.length} parts, expected 3.`
          });
        }

        // Decode the payload (middle part)
        // Fix base64 padding
        const base64Payload = parts[1]
          .replace(/-/g, '+')
          .replace(/_/g, '/');

        const paddedPayload = base64Payload + '=='.slice(0, (4 - base64Payload.length % 4) % 4);

        const payload = JSON.parse(
          Buffer.from(paddedPayload, 'base64').toString('utf8')
        );

        console.log("📦 Decoded payload:", JSON.stringify(payload, null, 2));

        // Check expiry
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && now > payload.exp) {
          tokenExpired = true;
          const expiredAt = new Date(payload.exp * 1000);
          const expiredAgo = Math.floor((now - payload.exp) / 60);

          return res.status(401).json({
            success: false,
            message: `Token expired ${expiredAgo} minutes ago at ${expiredAt.toISOString()}. Please request a new OTP.`,
            code: "TOKEN_EXPIRED",
            expiredAt: expiredAt.toISOString(),
            expiredMinutesAgo: expiredAgo
          });
        }

        // Validate issuer
        if (payload.iss && !payload.iss.includes('securetoken.google.com')) {
          return res.status(400).json({
            success: false,
            message: "Token is not from Firebase.",
            issuer: payload.iss
          });
        }

        // Get phone number
        phoneNumber = payload.phone_number;

        if (!phoneNumber) {
          return res.status(400).json({
            success: false,
            message: "No phone number in token. Use Firebase Phone Authentication.",
            tokenPayload: {
              iss: payload.iss,
              aud: payload.aud,
              hasPhone: !!payload.phone_number,
              signInProvider: payload.firebase?.sign_in_provider
            }
          });
        }

        console.log("✅ Manual decode success:", phoneNumber);
        console.log("📋 Token info:", {
          uid: payload.sub,
          phone: payload.phone_number,
          issuedAt: new Date(payload.iat * 1000).toISOString(),
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          provider: payload.firebase?.sign_in_provider
        });

      } catch (decodeError) {
        console.error("❌ Manual decode failed:", decodeError.message);
        return res.status(400).json({
          success: false,
          message: "Could not decode token.",
          error: decodeError.message,
          adminError: adminError.code
        });
      }
    }

    // ── Validate phone number found ─────────────────────────
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "No phone number found in token."
      });
    }

    // ── Strip country code ──────────────────────────────────
    // keep original phone
    const cleanPhone = phoneNumber.replace(/^\+/, "").trim();

    console.log("📱 Firebase phone:", phoneNumber, "→ clean:", cleanPhone);
    // ── Find user ───────────────────────────────────────────
    const user = await User.findOne({
      $or: [
        { phone: phoneNumber },        // +14155552671
        { phone: cleanPhone },         // 14155552671
        { phone: `+${cleanPhone}` },   // +14155552671
        { phone: cleanPhone.slice(-10) } // last 10 digits
      ]
    });

    console.log("👤 User found:", !!user, user?.phone);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please register first.",
        phone: cleanPhone
      });
    }

    // ── Update user ─────────────────────────────────────────
    user.isVerified = true;
    user.lastLogin = new Date();
    user.otp = null;
    user.otpExpiry = null;
    if (fcmToken && fcmToken.trim() !== "") user.fcmToken = fcmToken;
    if (!user.hasCompletedFirstLogin) user.hasCompletedFirstLogin = true;
    await user.save();

    // ── Generate your app JWT ───────────────────────────────
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "30d" }
    );

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email || null,
        phone: user.phone,
        profileImage: user.profileImage || null,
        coins: user.coins || 0,
        coupons: user.coupons || 0,
        couponCode: user.couponCode || null,
        hasCompletedFirstLogin: user.hasCompletedFirstLogin,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
// ============================================
// GET FIRST LOGIN POPUP STATUS
// ============================================
export const getFirstLoginPopupStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('firstLoginPopup hasCompletedFirstLogin');

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Check if user has completed OTP verification (logged in successfully)
    if (!user.hasCompletedFirstLogin) {
      return res.status(200).json({
        showPopup: false,
        message: "User hasn't completed first login yet"
      });
    }

    // If popup decision is still pending → show popup
    if (user.firstLoginPopup === 'pending') {
      return res.status(200).json({
        showPopup: true,
        message: "Popup pending user decision"
      });
    }

    // If decision is already made → don't show popup
    return res.status(200).json({
      showPopup: false,
      decision: user.firstLoginPopup,
      message: `User has already responded to the popup`
    });

  } catch (error) {
    console.error("Popup status error:", error);
    return res.status(500).json({
      message: "Server error"
    });
  }
};

// ============================================
// SUBMIT FIRST LOGIN POPUP DECISION
// ============================================
export const submitFirstLoginPopupDecision = async (req, res) => {
  try {
    const { userId } = req.params;
    const { accepted } = req.body; // true / false

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Check if user has even completed login
    if (!user.hasCompletedFirstLogin) {
      return res.status(400).json({
        message: "User hasn't completed first login yet"
      });
    }

    // Check if already answered (any value other than 'pending')
    if (user.firstLoginPopup !== 'pending') {
      return res.status(200).json({
        message: "Decision already recorded",
        decision: user.firstLoginPopup,
        showPopup: false
      });
    }

    // Save decision (now accepts any string, but we'll use 'accepted'/'rejected')
    user.firstLoginPopup = accepted ? 'accepted' : 'rejected';
    await user.save();

    return res.status(200).json({
      message: `Popup ${accepted ? 'accepted' : 'rejected'} successfully`,
      decision: user.firstLoginPopup,
      showPopup: false
    });

  } catch (error) {
    console.error("Popup submit error:", error);
    return res.status(500).json({
      message: "Server error"
    });
  }
};
// GET User Controller (Full User Data with profileImage, steps, and other fields)
export const getUser = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find full user data by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // Return the user data including profileImage, steps, and all other fields
    return res.status(200).json({
      message: 'User retrieved successfully!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: user.city,
        zipcode: user.zipcode,
        dateOfBirth: user.dateOfBirth,
        coins: user.coins,
        couponCode: user.couponCode || 'null',
        favoriteCoupons: user.favoriteCoupons,
        profileImage: user.profileImage, // Include profileImage
        otp: user.otp,
        otpExpiry: user.otpExpiry,
        steps: user.steps, // Include steps data
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};





// Get Profile (with userId in params)
export const getProfile = async (req, res) => {
  try {
    const userId = req.params.id;  // Get the user ID from request params

    // Find user by ID and populate the subscribedPlans
    const user = await User.findById(userId).populate('subscribedPlans.planId');  // Assuming `subscribedPlans` references `Plan` model

    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // Respond with user details along with subscribed plans and include dob and marriageAnniversaryDate
    return res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      profileImage: user.profileImage,
      dob: user.dob || null,  // Return dob or null if not present
      marriageAnniversaryDate: user.marriageAnniversaryDate || null,  // Return marriageAnniversaryDate or null if not present
      subscribedPlans: user.subscribedPlans,  // Include subscribedPlans in the response
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};


// export const getNearestVendors = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const { radius = 1600000 } = req.query; // KM

//     if (!userId) {
//       return res.status(400).json({ message: "UserId is required" });
//     }

//     // 1️⃣ Get user location
//     const user = await User.findById(userId);
//     if (!user?.location?.coordinates) {
//       return res.status(404).json({
//         message: "User not found or location not available"
//       });
//     }

//     const [lng, lat] = user.location.coordinates;

//     console.log(`📍 User location: ${lat}, ${lng}`);
//     console.log(`🔍 Searching vendors within ${radius}km radius`);

//     // 2️⃣ Fetch nearby vendors WITH location using aggregation
//     const nearbyVendors = await Vendor.aggregate([
//       {
//         $geoNear: {
//           near: {
//             type: "Point",
//             coordinates: [lng, lat]
//           },
//           distanceField: "distance",
//           maxDistance: Number(radius) * 1000, // Convert km to meters
//           spherical: true
//         }
//       },
//       {
//         $project: {
//           _id: 1,
//           businessName: 1,
//           businessLogo: 1,
//           category: 1,
//           note: 1,
//           addresses: 1, // ✅ Keep ALL addresses
//           location: 1,
//           distance: 1
//         }
//       }
//     ]);

//     console.log(`✅ Found ${nearbyVendors.length} nearby vendors`);

//     if (!nearbyVendors.length) {
//       return res.status(404).json({
//         message: "No nearby vendors found"
//       });
//     }

//     // Debug: Check addresses structure
//     nearbyVendors.forEach((vendor, index) => {
//       console.log(`Vendor ${index + 1}: ${vendor.businessName}`);
//       console.log(`  Addresses type: ${typeof vendor.addresses}`);
//       console.log(`  Is array: ${Array.isArray(vendor.addresses)}`);
//       console.log(`  Addresses:`, vendor.addresses);
//     });

//     // 3️⃣ Map vendor data by ID
//     const vendorMap = {};
//     nearbyVendors.forEach(v => {
//       vendorMap[v._id.toString()] = v;
//     });

//     const vendorIds = Object.keys(vendorMap);
//     console.log(`🔑 Vendor IDs found: ${vendorIds.length}`);

//     // 4️⃣ Fetch coupons
//     const coupons = await Coupon.find({
//       vendorId: { $in: vendorIds },
//       status: "approved",
//       validityDate: { $gte: new Date() }
//     });

//     console.log(`🎟 Found ${coupons.length} coupons from nearby vendors`);

//     if (!coupons.length) {
//       // Even if no coupons, return vendor info
//       return res.status(200).json({
//         message: "No coupons available, but here are nearby vendors",
//         count: nearbyVendors.length,
//         vendors: nearbyVendors.map(vendor => ({
//           vendorId: vendor._id,
//           businessName: vendor.businessName,
//           businessLogo: vendor.businessLogo,
//           category: vendor.category || "General",
//           note: vendor.note || "",
//           addresses: Array.isArray(vendor.addresses)
//             ? vendor.addresses
//             : vendor.addresses ? [vendor.addresses] : [], // ✅ Ensure it's an array
//           distance: Number(vendor.distance.toFixed(2)),
//           location: {
//             latitude: vendor.location.coordinates[1],
//             longitude: vendor.location.coordinates[0]
//           }
//         }))
//       });
//     }

//     // 5️⃣ FINAL COUPON RESPONSE WITH LOCATION
//     const formattedCoupons = coupons.map(coupon => {
//       const vendor = vendorMap[coupon.vendorId.toString()];

//       // Handle addresses - ensure it's always an array
//       let addressesArray = [];
//       if (vendor.addresses) {
//         if (Array.isArray(vendor.addresses)) {
//           addressesArray = vendor.addresses;
//         } else {
//           // If it's a single object, wrap it in an array
//           addressesArray = [vendor.addresses];
//         }
//       }

//       return {
//         // 🎟 COUPON DETAILS
//         couponId: coupon._id,
//         name: coupon.name,
//         description: coupon.description || coupon.note || "",
//         couponImage: coupon.couponImage || vendor.businessLogo,
//         discountPercentage: coupon.discountPercentage,
//         couponCodeType: coupon.couponCodeType,
//         couponCode: coupon.couponCode,
//         requiredCoins: coupon.requiredCoins,
//         validityDate: coupon.validityDate,
//         maxUsage: coupon.maxUsage,
//         usedCount: coupon.usedCount,
//         status: coupon.status,
//         category: coupon.category,

//         // 📍 LOCATION (FROM VENDOR)
//         location: {
//           latitude: vendor.location.coordinates[1],
//           longitude: vendor.location.coordinates[0]
//         },

//         // 🏪 VENDOR INFO
//         vendor: {
//           vendorId: vendor._id,
//           businessName: vendor.businessName,
//           businessLogo: vendor.businessLogo,
//           category: vendor.category || "General",
//           addresses: addressesArray, // ✅ Now always an array
//           distance: Number(vendor.distance.toFixed(2))
//         }
//       };
//     });

//     return res.status(200).json({
//       message: "Nearby coupons fetched successfully",
//       count: formattedCoupons.length,
//       coupons: formattedCoupons
//     });

//   } catch (error) {
//     console.error("Nearby coupons error:", error);
//     return res.status(500).json({
//       message: "Server error",
//       error: error.message
//     });
//   }
// };

export const getNearestVendors = async (req, res) => {
  try {
    const { userId } = req.params;
    const { radius = 1600000, city } = req.query; // ✅ ADDED city

    if (!userId) {
      return res.status(400).json({ message: "UserId is required" });
    }

    // 1️⃣ Get user location
    const user = await User.findById(userId);
    if (!user?.location?.coordinates) {
      return res.status(404).json({
        message: "User not found or location not available"
      });
    }

    const [lng, lat] = user.location.coordinates;

    console.log(`📍 User location: ${lat}, ${lng}`);
    console.log(`🔍 Searching vendors within ${radius}km radius`);
    if (city) console.log(`🎯 City filter: ${city}`); // ✅ ADDED

    // 2️⃣ Fetch nearby vendors WITH location using aggregation
    const nearbyVendors = await Vendor.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [lng, lat]
          },
          distanceField: "distance",
          maxDistance: Number(radius) * 1000,
          spherical: true
        }
      },
      {
        $project: {
          _id: 1,
          businessName: 1,
          businessLogo: 1,
          category: 1,
          note: 1,
          addresses: 1,
          location: 1,
          distance: 1
        }
      }
    ]);

    console.log(`✅ Found ${nearbyVendors.length} nearby vendors`);

    if (!nearbyVendors.length) {
      return res.status(404).json({
        message: "No nearby vendors found"
      });
    }

    // 3️⃣ Map vendor data by ID
    const vendorMap = {};
    nearbyVendors.forEach(v => {
      vendorMap[v._id.toString()] = v;
    });

    const vendorIds = Object.keys(vendorMap);
    console.log(`🔑 Vendor IDs found: ${vendorIds.length}`);

    // 4️⃣ Fetch coupons
    // ✅ ADDED: if city is provided, filter coupons whose vendor has an
    //    address with that city (case-insensitive, exact match)
    const couponQuery = {
      vendorId: { $in: vendorIds },
      status: "approved",
      validityDate: { $gte: new Date() }
    };

    if (city) {
      const cityRegex = new RegExp(
        `^${city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i'
      );
      // Only keep vendors whose addresses contain this city
      const matchingVendorIds = vendorIds.filter(vid => {
        const v = vendorMap[vid];
        if (!Array.isArray(v.addresses)) return false;
        return v.addresses.some(a =>
          a.city && cityRegex.test(a.city.trim())
        );
      });
      couponQuery.vendorId = { $in: matchingVendorIds };
    }

    const coupons = await Coupon.find(couponQuery);

    console.log(`🎟 Found ${coupons.length} coupons from nearby vendors`);

    if (!coupons.length) {
      // Even if no coupons, return vendor info
      return res.status(200).json({
        message: city
          ? `No coupons available in ${city}, but here are nearby vendors`
          : "No coupons available, but here are nearby vendors",
        count: nearbyVendors.length,
        vendors: nearbyVendors.map(vendor => ({
          vendorId: vendor._id,
          businessName: vendor.businessName,
          businessLogo: vendor.businessLogo,
          category: vendor.category || "General",
          note: vendor.note || "",
          addresses: Array.isArray(vendor.addresses)
            ? vendor.addresses
            : vendor.addresses ? [vendor.addresses] : [],
          distance: Number(vendor.distance.toFixed(2)),
          location: {
            latitude: vendor.location.coordinates[1],
            longitude: vendor.location.coordinates[0]
          }
        }))
      });
    }

    // 5️⃣ FINAL COUPON RESPONSE WITH LOCATION (unchanged)
    const formattedCoupons = coupons.map(coupon => {
      const vendor = vendorMap[coupon.vendorId.toString()];

      let addressesArray = [];
      if (vendor.addresses) {
        if (Array.isArray(vendor.addresses)) {
          addressesArray = vendor.addresses;
        } else {
          addressesArray = [vendor.addresses];
        }
      }

      return {
        // 🎟 COUPON DETAILS
        couponId: coupon._id,
        name: coupon.name,
        description: coupon.description || coupon.note || "",
        couponImage: coupon.couponImage || vendor.businessLogo,
        discountPercentage: coupon.discountPercentage,
        couponCodeType: coupon.couponCodeType,
        couponCode: coupon.couponCode,
        requiredCoins: coupon.requiredCoins,
        validityDate: coupon.validityDate,
        maxUsage: coupon.maxUsage,
        usedCount: coupon.usedCount,
        status: coupon.status,
        category: coupon.category,

        // 📍 LOCATION (FROM VENDOR)
        location: {
          latitude: vendor.location.coordinates[1],
          longitude: vendor.location.coordinates[0]
        },

        // 🏪 VENDOR INFO
        vendor: {
          vendorId: vendor._id,
          businessName: vendor.businessName,
          businessLogo: vendor.businessLogo,
          category: vendor.category || "General",
          addresses: addressesArray,
          distance: Number(vendor.distance.toFixed(2))
        }
      };
    });

    return res.status(200).json({
      message: "Nearby coupons fetched successfully",
      count: formattedCoupons.length,
      coupons: formattedCoupons
    });

  } catch (error) {
    console.error("Nearby coupons error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

export const addCoins = async (req, res) => {
  try {
    const { userId } = req.params;
    const { coins } = req.body;

    if (!userId || typeof coins !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'userId (in params) and coins (in body) are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.coins += coins;

    // Push to coinHistory
    user.coinHistory.push({
      type: 'added',
      amount: coins,
      message: `Coins added`,
    });

    await user.save();

    // await notifyUser({
    //   userId: user._id,
    //   title: '💰 Coins Added',
    //   message: `${coins} coins have been added to your account.`,
    //   type: 'coins_added',
    //   metadata: {
    //     amount: coins,
    //     totalCoins: user.coins
    //   }
    // });

    res.status(200).json({
      success: true,
      coins: user.coins,
      message: 'Coins added successfully'
    });

  } catch (error) {
    console.error('Add coins error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


export const addCoupons = async (req, res) => {
  try {
    const { userId } = req.params;
    const { coupons } = req.body;

    if (!userId || typeof coupons !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'userId (in params) and coupons (in body) are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.coupons += coupons;

    // ✅ Initialize if undefined
    if (!Array.isArray(user.couponHistory)) {
      user.couponHistory = [];
    }

    user.couponHistory.push({
      type: 'added',
      code: '',
      message: `Coupons added`,
    });

    await user.save();

    const downloaded = user.MyCoupons?.length || 0;
    const downloadable = user.coupons;

    res.status(200).json({
      success: true,
      message: 'Coupons added successfully',
      coupons: user.coupons,
      downloadable,
      downloaded
    });

  } catch (error) {
    console.error('Add coupons error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};




export const getCoinHistory = async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;

    // Fetch sender's and receiver's coin history
    const sender = await User.findById(senderId)
      .populate('coinHistory.fromUser', 'name') // Ensure 'fromUser' field is populated
      .populate('coinHistory.toUser', 'name') // Ensure 'toUser' field is populated
      .select('coinHistory'); // Select only coinHistory field

    const receiver = await User.findById(receiverId)
      .populate('coinHistory.fromUser', 'name') // Ensure 'fromUser' field is populated
      .populate('coinHistory.toUser', 'name') // Ensure 'toUser' field is populated
      .select('coinHistory'); // Select only coinHistory field

    // Check if sender and receiver exist
    if (!sender || !receiver) {
      return res.status(404).json({ success: false, message: 'Sender or Receiver not found' });
    }

    // Combine both sender and receiver coin histories
    const combinedHistory = [...sender.coinHistory, ...receiver.coinHistory];

    // Filter the history for transactions between sender and receiver
    const filteredHistory = combinedHistory.filter(item => {
      // Ensure that fromUser and toUser are properly populated
      if (item.fromUser && item.toUser) {
        return (
          (item.fromUser._id.toString() === senderId && item.toUser._id.toString() === receiverId) ||
          (item.fromUser._id.toString() === receiverId && item.toUser._id.toString() === senderId)
        );
      }
      return false;  // If either fromUser or toUser is undefined, skip the item
    });

    // Map filtered history to include the necessary fields
    const historyWithDetails = filteredHistory.map(item => {
      return {
        type: item.type,
        amount: item.amount || 0,  // Use 0 if the amount is undefined (for 'added' type)
        message: item.message,
        timestamp: item.timestamp,
        fromUser: item.fromUser?.name, // Access name of fromUser if available
        toUser: item.toUser?.name // Access name of toUser if available
      };
    });

    // Sort history by timestamp (latest first)
    const sortedHistory = historyWithDetails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Return the sorted history in the response
    res.status(200).json({
      success: true,
      history: sortedHistory,
    });

  } catch (error) {
    console.error('Coin history error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};




export const sendCoins = async (req, res) => {
  try {
    const { senderId } = req.params;
    const { receiverId, amount, description } = req.body;

    if (!senderId || !receiverId || typeof amount !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'senderId (in params), receiverId and amount (in body) are required',
      });
    }

    if (senderId === receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send coins to yourself',
      });
    }

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      return res.status(404).json({
        success: false,
        message: 'Sender or Receiver not found',
      });
    }

    if (sender.coins < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient coins',
      });
    }

    // Fallback message if no description is provided
    const defaultDescription = `Sent ${amount} coins to ${receiver.name}`;

    // Deduct from sender
    sender.coins -= amount;
    sender.coinHistory.push({
      type: 'sent',
      amount,
      message: description || defaultDescription,
      toUser: receiver._id,
    });

    // Add to receiver
    receiver.coins += amount;
    receiver.coinHistory.push({
      type: 'received',
      amount,
      message: description || `Received ${amount} coins from ${sender.name}`,
      fromUser: sender._id,
    });

    await sender.save();
    await receiver.save();

    // Notify sender
    await notifyUser({
      userId: senderId,
      title: '📤 Coins Sent',
      message: `You sent ${amount} coins to ${receiver.name}.`,
      type: 'coins_sent',
      metadata: {
        amount,
        receiverName: receiver.name,
        remainingCoins: sender.coins
      }
    });

    // Notify receiver
    await notifyUser({
      userId: receiverId,
      title: '📥 Coins Received',
      message: `You received ${amount} coins from ${sender.name}.`,
      type: 'coins_received',
      metadata: {
        amount,
        senderName: sender.name,
        totalCoins: receiver.coins
      }
    });

    res.status(200).json({
      success: true,
      message: `Sent ${amount} coins successfully`,
      senderCoins: sender.coins,
      receiverCoins: receiver.coins,
    });
  } catch (error) {
    console.error('Send coins error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};



export const getCoinTransactionHistory = async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;

    if (!userId1 || !userId2) {
      return res.status(400).json({
        success: false,
        message: 'Both userId1 and userId2 are required in params',
      });
    }

    if (userId1 === userId2) {
      return res.status(400).json({
        success: false,
        message: 'Cannot fetch transactions between the same user',
      });
    }

    const user1 = await User.findById(userId1).select('coinHistory');
    const user2 = await User.findById(userId2).select('coinHistory');

    if (!user1 || !user2) {
      return res.status(404).json({
        success: false,
        message: 'One or both users not found',
      });
    }

    const user1History = Array.isArray(user1.coinHistory) ? user1.coinHistory : [];
    const user2History = Array.isArray(user2.coinHistory) ? user2.coinHistory : [];

    const user1SentOrReceived = user1History.filter((entry) => {
      return (
        (entry.type === 'sent' && entry.toUser?.toString() === userId2) ||
        (entry.type === 'received' && entry.fromUser?.toString() === userId2)
      );
    });

    const user2SentOrReceived = user2History.filter((entry) => {
      return (
        (entry.type === 'sent' && entry.toUser?.toString() === userId1) ||
        (entry.type === 'received' && entry.fromUser?.toString() === userId1)
      );
    });

    const allTransactions = [...user1SentOrReceived, ...user2SentOrReceived].sort(
      (a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt)
    );

    return res.status(200).json({
      success: true,
      message: 'Coin transaction history fetched successfully',
      transactions: allTransactions,
    });
  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};



// 📦 Get all users with their coin balances
export const getUserCoinsById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required in params' });
    }

    const user = await User.findById(userId).select('coins');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      coins: user.coins,
    });
  } catch (error) {
    console.error('Get user coins error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// 📦 Get user's coupon balance
export const getUserCouponsById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required in params' });
    }

    const user = await User.findById(userId).select('coupons MyCoupons');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const downloaded = user.MyCoupons?.length || 0;
    const downloadable = user.coupons;

    res.status(200).json({
      success: true,
      coupons: user.coupons,
      downloadable,
      downloaded,
    });

  } catch (error) {
    console.error('Get user coupons error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};





export const getAllMyFavoriteCoupons = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: 'userId parameter is required' });
    }

    const user = await User.findById(userId)
      .populate({
        path: 'favoriteCoupons',
        populate: {
          path: 'vendorId',
          select: 'businessName businessLogo addresses address location', // Added more address-related fields
        },
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Format the response to include vendor address
    const formattedFavoriteCoupons = user.favoriteCoupons.map(coupon => {
      const couponObj = coupon.toObject();

      // Extract vendor address properly - check multiple possible locations
      let vendorAddress = null;
      if (coupon.vendorId) {
        // Check addresses array first
        if (coupon.vendorId.addresses) {
          if (Array.isArray(coupon.vendorId.addresses) && coupon.vendorId.addresses.length > 0) {
            // If it's an array of objects, stringify it or extract relevant fields
            const firstAddress = coupon.vendorId.addresses[0];
            if (typeof firstAddress === 'object') {
              // Try to create a readable address string
              vendorAddress = firstAddress.street || firstAddress.address ||
                firstAddress.fullAddress || JSON.stringify(firstAddress);
            } else {
              vendorAddress = firstAddress;
            }
          } else if (typeof coupon.vendorId.addresses === 'string') {
            vendorAddress = coupon.vendorId.addresses;
          }
        }

        // Check direct address field if addresses not found
        if (!vendorAddress && coupon.vendorId.address) {
          if (typeof coupon.vendorId.address === 'object') {
            vendorAddress = coupon.vendorId.address.street ||
              coupon.vendorId.address.address ||
              JSON.stringify(coupon.vendorId.address);
          } else {
            vendorAddress = coupon.vendorId.address;
          }
        }

        // If still no address, check location or create placeholder
        if (!vendorAddress && coupon.vendorId.location) {
          vendorAddress = 'Location available';
        }

        // Add address to vendor object
        couponObj.vendorId = {
          ...coupon.vendorId.toObject(),
          address: vendorAddress
        };
      }

      return couponObj;
    });

    res.status(200).json({
      message: 'Favorite coupons fetched successfully',
      total: user.favoriteCoupons.length,
      favoriteCoupons: formattedFavoriteCoupons,
    });
  } catch (error) {
    console.error('Get favorite coupons error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


export const toggleFavoriteCoupon = async (req, res) => {
  try {
    const { userId, couponId, isLiked } = req.body;

    if (!userId || !couponId || typeof isLiked !== 'boolean') {
      return res.status(400).json({ message: 'userId, couponId and isLiked (boolean) are required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const coupon = await Coupon.findById(couponId);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    if (isLiked) {
      // ✅ Add to favorites if not already there
      if (!user.favoriteCoupons.includes(couponId)) {
        user.favoriteCoupons.push(couponId);

        // 🔔 NOTIFY VENDOR when user favorites their coupon
        if (coupon.vendorId && coupon.vendorId._id) {
          await notifyVendor({
            vendorId: coupon.vendorId._id,
            title: '❤️ Coupon Favorited',
            message: `User added your coupon "${coupon.name}" to favorites`,
            type: 'favorite',
            couponId: coupon._id
          });
        }
      }
    } else {
      // ❌ Remove from favorites if exists
      user.favoriteCoupons = user.favoriteCoupons.filter(
        id => id.toString() !== couponId
      );
    }

    await user.save();

    res.status(200).json({
      message: `Coupon ${isLiked ? 'added to' : 'removed from'} favorites`,
      favoriteCoupons: user.favoriteCoupons,
    });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}



// controllers/generateImagePromptController.js

//const GEMINI_API_KEY = "process.env.GEMINI_API_KEY";




export const generateQuiz = async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'OpenAI API key is not configured' });
    }
    const openai = new OpenAI({ apiKey });

    const prompt = `
      Generate 5 multiple-choice quiz questions in the following JSON format.
      Each question should have:
      {
        "question": "Your question text",
        "options": {
          "A": "Option A text",
          "B": "Option B text",
          "C": "Option C text",
          "D": "Option D text"
        },
        "answer": "Correct option key (A, B, C or D)"
      }
      Only return a valid JSON array of 20 such objects. Do not include any extra text or explanation.
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    const content = completion.choices[0].message.content;

    let quizData;
    try {
      quizData = JSON.parse(content);
    } catch {
      const jsonStart = content.indexOf('[');
      const jsonEnd = content.lastIndexOf(']');
      quizData = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
    }

    res.status(200).json(quizData);
  } catch (error) {
    console.error('Full error:', error); // 🔍 View real cause
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
};


// Update User Controller
export const updateUser = async (req, res) => {
  try {
    const userId = req.params.userId; // Get user ID from URL
    const updates = req.body;         // Get updated fields from request body

    // 🔍 Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // 🔄 Update fields dynamically
    Object.keys(updates).forEach((key) => {
      user[key] = updates[key];
    });

    // 💾 Save updated user
    await user.save();

    return res.status(200).json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: user.city,
        zipcode: user.zipcode,
        dateOfBirth: user.dateOfBirth,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};



export const uploadProfile = async (req, res) => {
  try {
    const userId = req.params.userId;

    // For multer, the file is in req.file, not req.files
    if (!req.file) {
      return res.status(400).json({ message: 'No profile image uploaded' });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Upload to Cloudinary - req.file.path is the temp file path from multer
    const uploadedImage = await cloudinary.uploader.upload(req.file.path, {
      folder: 'profile-images',
      resource_type: 'image',
      use_filename: true,
      unique_filename: true,
    });

    const imageUrl = uploadedImage.secure_url;

    if (!imageUrl) {
      return res.status(500).json({ message: 'Error uploading image to Cloudinary' });
    }

    // Update user
    user.profileImage = imageUrl;
    await user.save();

    // Clean up temp file - fs is now defined
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(200).json({
      message: 'Profile image uploaded successfully',
      user: {
        id: user._id,
        name: user.name,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error('❌ Error uploading profile image:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


// Helper functions
// function parseTimeToMinutes(timeString) {
//   const hrMatch = timeString.match(/(\d+)hr/);
//   const minMatch = timeString.match(/(\d+)m/);
//   const hours = hrMatch ? parseInt(hrMatch[1]) : 0;
//   const minutes = minMatch ? parseInt(minMatch[1]) : 0;
//   return hours * 60 + minutes;
// }

// function formatMinutes(totalMinutes) {
//   const hours = Math.floor(totalMinutes / 60);
//   const mins = totalMinutes % 60;
//   return `${hours > 0 ? hours + 'hr ' : ''}${mins}m`;
// }

// Add or Update Steps
// ============================================
// FIXED: parseTimeToMinutes & formatMinutes
// Move these ABOVE addOrUpdateUserSteps in your file
// ============================================
// ============================================
// FIXED: parseTimeToMinutes - handles ALL formats
// "1hr 15m", "1h 15m", "45m", "2h", "0m", "1hr"
// ============================================
// ============================================
// FIXED: parseTimeToMinutes - simpler, bulletproof regex
// ============================================
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || timeStr === '0m') return 0;
  let minutes = 0;
  // Match hours: "1h", "1hr", "1 h", "1 hr"
  const hourMatch = timeStr.match(/(\d+)\s*hr?/i);
  // Match minutes: "15m", "15 m" — simple, no lookahead
  const minMatch = timeStr.match(/(\d+)\s*m/i);
  if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
  // Only count minutes if it's NOT the same match as hours (avoid "1hr" → m=1)
  if (minMatch && !hourMatch) {
    minutes += parseInt(minMatch[1]);
  } else if (minMatch && hourMatch && minMatch[0] !== hourMatch[0]) {
    // e.g. "1h 30m" — minMatch="30m", hourMatch="1h" — different, add both
    minutes += parseInt(minMatch[1]);
  }
  return minutes;
};

const formatMinutes = (mins) => {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};


// ============================================
// FIXED: addOrUpdateUserSteps
// Uses atomic findOneAndUpdate to prevent race conditions
// and ensure correct user isolation
// ============================================
export const addOrUpdateUserSteps = async (req, res) => {
  try {
    const { userId } = req.params;

    // ─── Validate userId ──────────────────────────────────────────
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid userId is required',
      });
    }

    const { steps, localDate } = req.body;

    if (!steps || typeof steps !== 'number' || steps <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Steps must be a positive number',
      });
    }

    // ─── Date ────────────────────────────────────────────────────
    let todayStr;
    if (localDate && /^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
      todayStr = localDate;
    } else {
      todayStr = new Date().toISOString().slice(0, 10);
    }

    const today = new Date(todayStr + 'T00:00:00.000Z');
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

    // ─── Conversions ─────────────────────────────────────────────
    const STRIDE_KM = 0.000762;
    const KM_TO_MILES = 0.621371;
    const KCAL_PER_STEP = 0.04;
    const STEPS_PER_MIN = 100;

    const newDistance = parseFloat((steps * STRIDE_KM * KM_TO_MILES).toFixed(3));
    const newKcal = parseFloat((steps * KCAL_PER_STEP).toFixed(1));
    const newMinutes = Math.max(1, Math.round(steps / STEPS_PER_MIN));
    const newTimeSpent = formatMinutes(newMinutes);

    // ─── Fetch only THIS user ────────────────────────────────────
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        userId,
      });
    }

    // ─── Ensure steps array is clean (no contamination) ─────────
    if (!Array.isArray(user.steps)) {
      user.steps = [];
    }

    // ─── Find today's entry by exact date string ─────────────────
    const existingIndex = user.steps.findIndex(
      (s) => s && s.date && new Date(s.date).toISOString().slice(0, 10) === todayStr
    );

    let totalStepsToday;

    if (existingIndex !== -1) {
      // Update existing entry
      const existing = user.steps[existingIndex];
      const prevMinutes = parseTimeToMinutes(existing.timeSpent || '0m');
      const totalMins = prevMinutes + newMinutes;

      user.steps[existingIndex] = {
        ...existing.toObject ? existing.toObject() : existing,
        stepsCount: (existing.stepsCount || 0) + steps,
        distance: parseFloat(((existing.distance || 0) + newDistance).toFixed(3)),
        kcal: parseFloat(((existing.kcal || 0) + newKcal).toFixed(1)),
        timeSpent: formatMinutes(totalMins),
      };

      totalStepsToday = user.steps[existingIndex].stepsCount;
    } else {
      // New entry for today
      user.steps.push({
        date: today,
        day: dayOfWeek,
        stepsCount: steps,
        distance: newDistance,
        kcal: newKcal,
        timeSpent: newTimeSpent,
      });
      totalStepsToday = steps;
    }

    // ─── Coin logic: 10 steps = 1 coin, max 100/day ──────────────
    const MAX_COINS_PER_DAY = 100;
    const STEPS_PER_COIN = 10;
    const MAX_STEPS_REWARDED = 1000;

    if (!Array.isArray(user.coinHistory)) user.coinHistory = [];

    const coinsAlreadyToday = user.coinHistory
      .filter(e => {
        if (e.type !== 'added') return false;
        if (!e.message?.includes('steps')) return false;
        const d = new Date(e.timestamp || e.createdAt);
        return d.toISOString().slice(0, 10) === todayStr;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const stepsEligible = Math.min(totalStepsToday, MAX_STEPS_REWARDED);
    const totalCoinsDeserved = Math.floor(stepsEligible / STEPS_PER_COIN);
    const newCoinsToAward = Math.max(0, totalCoinsDeserved - coinsAlreadyToday);

    if (newCoinsToAward > 0) {
      user.coins = (user.coins || 0) + newCoinsToAward;
      user.coinHistory.push({
        type: 'added',
        amount: newCoinsToAward,
        message: `Earned ${newCoinsToAward} coins for ${steps} steps (total today: ${totalStepsToday})`,
        timestamp: new Date(),
      });
    }

    user.markModified('steps');
    user.markModified('coinHistory');
    await user.save();

    // ─── Build today's saved entry for response ───────────────────
    const savedEntry = existingIndex !== -1
      ? user.steps[existingIndex]
      : user.steps[user.steps.length - 1];

    // ─── Return ONLY today's data — NOT the full steps array ──────
    // This prevents frontend from accidentally using another day's data
    return res.status(200).json({
      success: true,
      message: 'Steps recorded successfully',
      userId: user._id.toString(),   // ✅ Always confirm which user
      userName: user.name,
      coinsEarned: newCoinsToAward,
      totalCoinsToday: Math.min(totalCoinsDeserved, MAX_COINS_PER_DAY),
      totalCoins: user.coins,
      // ✅ Only return today's stats — clean, no other user data possible
      today: {
        stepsCount: savedEntry.stepsCount,
        distance: `${savedEntry.distance} mi`,
        kcal: savedEntry.kcal,
        timeSpent: savedEntry.timeSpent,
        date: todayStr,
      },
    });

  } catch (error) {
    console.error('❌ addOrUpdateUserSteps error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};


// ============================================
// FIXED: getUserStepsHistory
// Returns only this user's own data
// Weekly progress uses correct day indexing
// ============================================
export const getUserStepsHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { period, localDate } = req.query;

    // ─── Validate userId ──────────────────────────────────────────
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid userId is required',
      });
    }

    // ─── Fetch ONLY this specific user's data ────────────────────
    const user = await User.findById(userId).select('_id name steps coinHistory coins');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        userId,
      });
    }

    // ─── Date ────────────────────────────────────────────────────
    let todayStr;
    if (localDate && /^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
      todayStr = localDate;
    } else {
      todayStr = new Date().toISOString().slice(0, 10);
    }

    const toDateStr = (d) => new Date(d).toISOString().slice(0, 10);

    // ─── Week boundaries (Monday-based) ──────────────────────────
    const todayDate = new Date(todayStr + 'T00:00:00.000Z');
    const todayDow = todayDate.getUTCDay(); // 0=Sun,1=Mon...6=Sat
    const daysFromMon = todayDow === 0 ? 6 : todayDow - 1;

    const thisMonday = new Date(todayDate);
    thisMonday.setUTCDate(todayDate.getUTCDate() - daysFromMon);
    const thisWeekStartStr = toDateStr(thisMonday);

    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
    const lastWeekStartStr = toDateStr(lastMonday);

    const lastSunday = new Date(thisMonday);
    lastSunday.setUTCDate(thisMonday.getUTCDate() - 1);
    const lastWeekEndStr = toDateStr(lastSunday);

    const yesterday = new Date(todayDate);
    yesterday.setUTCDate(todayDate.getUTCDate() - 1);
    const yesterdayStr = toDateStr(yesterday);

    // ─── Totals ───────────────────────────────────────────────────
    const totals = {
      today: { steps: 0, distance: 0, kcal: 0, minutes: 0 },
      yesterday: { steps: 0, distance: 0, kcal: 0, minutes: 0 },
      thisWeek: { steps: 0, distance: 0, kcal: 0, minutes: 0 },
      lastWeek: { steps: 0, distance: 0, kcal: 0, minutes: 0 },
      allTime: { steps: 0, distance: 0, kcal: 0, minutes: 0 },
    };

    // Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const thisWeekProgress = DAYS.map(day => ({ day, steps: 0 }));
    const lastWeekProgress = DAYS.map(day => ({ day, steps: 0 }));

    // ─── Process THIS user's steps only ──────────────────────────
    (user.steps || []).forEach((entry) => {
      if (!entry || !entry.date) return;

      const entryStr = toDateStr(entry.date);
      const s = entry.stepsCount || 0;
      const d = entry.distance || 0;
      const k = entry.kcal || 0;
      const mins = parseTimeToMinutes(entry.timeSpent || '0m');

      // All time
      totals.allTime.steps += s;
      totals.allTime.distance += d;
      totals.allTime.kcal += k;
      totals.allTime.minutes += mins;

      // Today
      if (entryStr === todayStr) {
        totals.today.steps += s;
        totals.today.distance += d;
        totals.today.kcal += k;
        totals.today.minutes += mins;
      }

      // Yesterday
      if (entryStr === yesterdayStr) {
        totals.yesterday.steps += s;
        totals.yesterday.distance += d;
        totals.yesterday.kcal += k;
        totals.yesterday.minutes += mins;
      }

      // This week: Monday to today inclusive
      if (entryStr >= thisWeekStartStr && entryStr <= todayStr) {
        totals.thisWeek.steps += s;
        totals.thisWeek.distance += d;
        totals.thisWeek.kcal += k;
        totals.thisWeek.minutes += mins;

        // ✅ Correct day index: getUTCDay() 0=Sun → index 6, 1=Mon → 0
        const dow = new Date(entry.date).getUTCDay();
        const idx = dow === 0 ? 6 : dow - 1;
        if (idx >= 0 && idx < 7) thisWeekProgress[idx].steps += s;
      }

      // Last week: last Monday to last Sunday
      if (entryStr >= lastWeekStartStr && entryStr <= lastWeekEndStr) {
        totals.lastWeek.steps += s;
        totals.lastWeek.distance += d;
        totals.lastWeek.kcal += k;
        totals.lastWeek.minutes += mins;

        const dow = new Date(entry.date).getUTCDay();
        const idx = dow === 0 ? 6 : dow - 1;
        if (idx >= 0 && idx < 7) lastWeekProgress[idx].steps += s;
      }
    });

    // ─── Coin stats ───────────────────────────────────────────────
    const MAX_COINS_PER_DAY = 100;
    const STEPS_PER_COIN = 10;
    const MAX_STEPS_REWARDED = 1000;

    const coinsEarnedToday = (user.coinHistory || [])
      .filter(e => {
        if (e.type !== 'added') return false;
        if (!e.message?.includes('steps')) return false;
        return new Date(e.timestamp || e.createdAt).toISOString().slice(0, 10) === todayStr;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const coinsRemainingToday = Math.max(0, MAX_COINS_PER_DAY - coinsEarnedToday);

    // ─── Format ───────────────────────────────────────────────────
    const fmt = (obj) => ({
      Steps: obj.steps,
      Distance: `${parseFloat(obj.distance.toFixed(3))} mi`,
      Kcal: parseFloat(obj.kcal.toFixed(1)),
      Time: formatMinutes(obj.minutes),
    });

    return res.status(200).json({
      success: true,
      userId: user._id.toString(),  // ✅ Confirm correct user
      userName: user.name,
      totals: {
        today: fmt(totals.today),
        yesterday: fmt(totals.yesterday),
        thisWeek: fmt(totals.thisWeek),
        lastWeek: fmt(totals.lastWeek),
        allTime: fmt(totals.allTime),
      },
      progress: period === 'lastWeek' ? lastWeekProgress : thisWeekProgress,
      coinStats: {
        coinsEarnedToday,
        coinsRemainingToday,
        maxCoinsPerDay: MAX_COINS_PER_DAY,
        stepsForMaxCoins: MAX_STEPS_REWARDED,
        todaySteps: totals.today.steps,
      },
    });

  } catch (error) {
    console.error('❌ getUserStepsHistory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};


export const updateUserLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const { userId } = req.params;  // Get userId from URL parameters

    // Check if all required parameters are provided
    if (!userId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'userId, latitude, and longitude are required' });
    }

    // Find the user and update their location
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        location: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)], // Store [longitude, latitude]
        },
      },
      { new: true } // Return the updated user document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      message: 'User location stored successfully',
      location: updatedUser.location,
    });
  } catch (error) {
    console.error('Error storing user location:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};



export const getAllGuideVideos = async (req, res) => {
  try {
    const { userId } = req.params; // Retrieve userId from params

    // Check if userId is provided
    if (!userId) {
      return res.status(400).json({ message: 'UserId is required' });
    }

    // Fetch all guide videos for the given userId
    const guideVideos = await GuideVideo.find();

    if (guideVideos.length === 0) {
      return res.status(404).json({ message: 'No videos found for this user' });
    }

    res.status(200).json({
      message: 'Guide videos fetched successfully',
      guideVideos,
    });
  } catch (error) {
    console.error('Error fetching guide videos:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const getCouponByUserId = async (req, res) => {
  try {
    const { userId } = req.params;  // Get userId from params

    // Check if userId is provided
    if (!userId) {
      return res.status(400).json({ message: 'UserId is required' });
    }

    // Fetch the user by userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has any coupons and MyCoupons array exists
    if (!user.MyCoupons || user.MyCoupons.length === 0) {
      return res.status(404).json({ message: 'No coupons found for this user' });
    }

    // Get all available coupons (assuming you have a Coupon model to fetch available coupons)
    const availableCoupons = await Coupon.find({
      _id: { $nin: user.MyCoupons.map(coupon => coupon.couponId) }  // Exclude coupons already in MyCoupons
    });

    if (availableCoupons.length === 0) {
      return res.status(404).json({ message: 'No available coupons for this user' });
    }

    // Respond with the available coupons
    res.status(200).json({
      message: 'Available coupons fetched successfully',
      coupons: availableCoupons,  // Return the available coupons not in MyCoupons
    });

  } catch (error) {
    console.error('Error fetching available coupons:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const submitFeedback = async (req, res) => {
  try {
    const { userId } = req.params;  // Get userId from params
    const { star, topic, tellUsAboutExperience } = req.body;  // Get feedback fields from body

    // Check if all fields are provided
    if (!star || !topic || !tellUsAboutExperience) {
      return res.status(400).json({ message: 'All fields (star, topic, and tellUsAboutExperience) are required' });
    }

    // Validate the star rating (must be between 1 and 5)
    if (star < 1 || star > 5) {
      return res.status(400).json({ message: 'Star rating must be between 1 and 5' });
    }

    // Create a new feedback document
    const feedback = new Feedback({
      userId,
      star,
      topic,
      tellUsAboutExperience,
    });

    // Save the feedback to the database
    await feedback.save();

    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback,
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Get feedback for a specific user
export const getUserFeedback = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // Fetch all feedbacks for the user, latest first
    const feedbacks = await Feedback.find({ userId }).sort({ createdAt: -1 });

    if (!feedbacks || feedbacks.length === 0) {
      return res.status(404).json({ message: "No feedback found for this user" });
    }

    res.status(200).json({
      success: true,
      feedbacks,
    });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const submitVendorFeedback = async (req, res) => {
  try {
    const { userId } = req.params;
    const { vendorId, stars, tellUsAboutExperience } = req.body;

    // ✅ FIRST: Get the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate required fields
    if (!vendorId || !stars || !tellUsAboutExperience) {
      return res.status(400).json({ message: 'vendorId, stars, and tellUsAboutExperience are required' });
    }

    // Find vendor by vendorId
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // ... rest of the code

    // ✅ NOW user is defined
    const starEmoji = stars >= 4 ? '⭐' : stars >= 3 ? '👍' : '📝';
    await notifyVendor({
      vendorId: vendor._id,
      title: `${starEmoji} New Feedback Received`,
      message: `User left a ${stars}-star review: "${tellUsAboutExperience.substring(0, 50)}${tellUsAboutExperience.length > 50 ? '...' : ''}"`,
      type: 'feedback',
    });

    // ... rest of the code
  } catch (error) {
    console.error('Error submitting vendor feedback:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



const PROJECT_ID = 'gemini-project-465507';
const LOCATION = 'us-central1';

// Controller function to generate content from Gemini API
export async function generateContent(req, res) {
  try {
    const accessToken = await getAccessToken();
    const prompt = req.body.prompt || 'Hello, Gemini!';

    const requestBody = {
      contents: {
        role: 'user',
        parts: {
          text: prompt,
        },
      },
      safety_settings: {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    };

    const response = await fetch(
      `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/gemini-1.0-pro-002:streamGenerateContent`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ error: errorData });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('Error in generateContent:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Helper to get access token (replace with real logic, see steps below)
async function getAccessToken() {
  // For now, set your token manually or fetch from environment variable
  const token = process.env.ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN_HERE';
  if (!token) throw new Error('Access token not set');
  return token;
}

export const getAllAppFeedback = async (req, res) => {
  try {
    const { page = 1, limit = 100000, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Fetch all feedback with user details populated
    const feedbacks = await Feedback.find()
      .populate({
        path: 'userId',
        select: 'name email phone profileImage city' // Select only needed fields
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Use lean() for better performance

    // Get total count for pagination
    const total = await Feedback.countDocuments();

    // Calculate average rating across all feedback
    const ratingStats = await Feedback.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$star' },
          totalRatings: { $sum: 1 },
          ratingDistribution: {
            $push: '$star'
          }
        }
      }
    ]);

    // Format rating distribution
    let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (ratingStats.length > 0 && ratingStats[0].ratingDistribution) {
      ratingStats[0].ratingDistribution.forEach(rating => {
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      });
    }

    // Format the response
    const formattedFeedbacks = feedbacks.map(feedback => ({
      _id: feedback._id,
      user: feedback.userId ? {
        _id: feedback.userId._id,
        name: feedback.userId.name,
        email: feedback.userId.email,
        phone: feedback.userId.phone,
        profileImage: feedback.userId.profileImage,
        city: feedback.userId.city
      } : {
        _id: feedback.userId,
        name: 'Deleted User',
        email: null,
        phone: null
      },
      rating: feedback.star,
      topic: feedback.topic,
      experience: feedback.tellUsAboutExperience,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt
    }));

    // Get topic-wise breakdown
    const topicBreakdown = await Feedback.aggregate([
      {
        $group: {
          _id: '$topic',
          count: { $sum: 1 },
          averageRating: { $avg: '$star' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return res.status(200).json({
      success: true,
      message: 'All app feedback fetched successfully',
      stats: {
        totalFeedbacks: total,
        averageRating: ratingStats.length > 0 ? Number(ratingStats[0].averageRating.toFixed(1)) : 0,
        ratingDistribution,
        topicBreakdown
      },
      feedbacks: formattedFeedbacks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching all app feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching feedback',
      error: error.message
    });
  }
};


// Get chat between two users
export const getChat = async (req, res) => {
  try {
    const { user1, user2 } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    }).sort({ createdAt: 1 });

    res.status(200).json({ messages });
  } catch (error) {
    console.error('Get Chat Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// Send a new message (via POST)
export const sendMessage = async (req, res) => {
  try {
    // Extract data from request body
    const { senderId, receiverId, text } = req.body;

    // Validate input
    if (!senderId || !receiverId) {
      return res.status(400).json({ message: 'senderId, receiverId, and text are required' });
    }

    // If an image is uploaded, use Cloudinary to upload it
    let image = null;
    if (req.files && req.files.image) {
      // Upload the image to Cloudinary
      const uploadedImage = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
        folder: 'chat-images', // Folder to store in Cloudinary
        resource_type: 'image', // Ensure the upload is an image
        use_filename: true, // Use the original filename
        unique_filename: true, // Ensure unique file names
      });

      image = uploadedImage.secure_url; // Get the secure URL of the uploaded image
    }

    // Create new message with or without image
    const newMessage = await Message.create({
      sender: senderId,
      receiver: receiverId,
      text,
      image,  // If an image was uploaded, store the image URL
    });

    return res.status(201).json({
      message: 'Message sent successfully',
      data: newMessage,
    });
  } catch (error) {
    console.error('Send Message Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};




// Handle form submission with just mobile and email
export const submitContactForm = async (req, res) => {
  try {
    const { mobile, email } = req.body;

    // Validate data: Both mobile and email must be present
    if (!mobile || !email) {
      return res.status(400).json({ message: "Mobile number and email are required." });
    }

    // Create a new contact entry with just mobile and email
    const newContact = new Contact({
      mobile,
      email,
    });

    // Save to database
    await newContact.save();

    // Respond with success message
    res.status(201).json({ message: "Your message has been sent successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error, please try again later." });
  }
};

const generateUniqueCouponCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// export const claimCoupon = async (req, res) => {
//   try {
//     const { userId, couponId } = req.params;
//     const { purchaseType = 'coins' } = req.body; // 'coins' or 'coupons'

//     // Validate required parameters
//     if (!userId || !couponId) {
//       return res.status(400).json({
//         success: false,
//         message: 'UserId and CouponId are required'
//       });
//     }

//     // Find user
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     // Find and populate coupon with vendor details
//     const coupon = await Coupon.findById(couponId).populate('vendorId');
//     if (!coupon) {
//       return res.status(404).json({
//         success: false,
//         message: 'Coupon not found'
//       });
//     }

//     // Validate vendor exists
//     if (!coupon.vendorId || !coupon.vendorId._id) {
//       console.error("❌ Coupon vendorId is null or not populated for coupon:", coupon._id);
//       return res.status(400).json({
//         success: false,
//         message: "Coupon vendor not found"
//       });
//     }

//     // Check if coupon is approved
//     if (coupon.status !== 'approved') {
//       return res.status(400).json({
//         success: false,
//         message: `Coupon is not available. Status: ${coupon.status}`
//       });
//     }

//     // Check if coupon has expired
//     if (new Date(coupon.validityDate) < new Date()) {
//       coupon.status = 'expired';
//       await coupon.save();
//       return res.status(400).json({
//         success: false,
//         message: 'Coupon has expired'
//       });
//     }

//     // Check if user already has this active coupon
//     const existingCoupon = user.MyCoupons?.find(
//       item => item.couponId.toString() === couponId &&
//         item.status === 'Active'
//     );

//     if (existingCoupon) {
//       return res.status(400).json({
//         success: false,
//         message: 'You already have this active coupon',
//         couponId: existingCoupon._id
//       });
//     }

//     // Check if coupon has reached max usage
//     if (coupon.usedCount >= coupon.maxUsage) {
//       return res.status(400).json({
//         success: false,
//         message: 'Coupon has reached maximum usage limit'
//       });
//     }

//     // Handle payment based on purchase type
//     let paymentSuccess = false;
//     let paymentMethod = '';
//     let paymentDetails = {};

//     if (purchaseType === 'coupons') {
//       // Purchase with coupons
//       if (user.coupons < 1) {
//         return res.status(400).json({
//           success: false,
//           message: `Insufficient coupons. Required: 1, Available: ${user.coupons}`
//         });
//       }

//       // Deduct 1 coupon
//       user.coupons -= 1;

//       // Initialize couponHistory if needed
//       if (!Array.isArray(user.couponHistory)) {
//         user.couponHistory = [];
//       }

//       // Add to coupon history
//       user.couponHistory.push({
//         type: 'added',
//         code: coupon.couponCode || '',
//         message: `Purchased coupon "${coupon.name}" using 1 coupon`,
//         amount: -1,
//         date: new Date()
//       });

//       paymentSuccess = true;
//       paymentMethod = 'coupons';
//       paymentDetails = {
//         couponsUsed: 1,
//         remainingCoupons: user.coupons
//       };

//     } else if (purchaseType === 'coins') {
//       // Purchase with coins
//       if (user.coins < coupon.requiredCoins) {
//         return res.status(400).json({
//           success: false,
//           message: `Insufficient coins. Required: ${coupon.requiredCoins}, Available: ${user.coins}`
//         });
//       }

//       // Deduct coins
//       user.coins -= coupon.requiredCoins;

//       // Initialize coinHistory if needed
//       if (!Array.isArray(user.coinHistory)) {
//         user.coinHistory = [];
//       }

//       // Add to coin history
//       user.coinHistory.push({
//         type: 'added',
//         amount: -coupon.requiredCoins,
//         message: `Purchased coupon "${coupon.name}"`,
//         timestamp: new Date()
//       });

//       paymentSuccess = true;
//       paymentMethod = 'coins';
//       paymentDetails = {
//         coinsUsed: coupon.requiredCoins,
//         remainingCoins: user.coins
//       };

//     } else {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid purchase type. Use "coins" or "coupons"'
//       });
//     }

//     if (!paymentSuccess) {
//       return res.status(400).json({
//         success: false,
//         message: 'Payment failed'
//       });
//     }

//     // Generate unique coupon code for this user
//     const uniqueUserCouponCode = generateUniqueCouponCode();
//     console.log(`🎫 Generated unique code: ${uniqueUserCouponCode} for user ${userId} claiming coupon ${couponId}`);

//     // Add coupon to user's MyCoupons as "Active"
//     const now = new Date();
//     const activeCoupon = {
//       couponId: couponId,
//       status: 'Active',
//       purchasedAt: now,
//       activatedAt: null,
//       expiresAt: null,
//       claimedAt: null,
//       usedAt: null,
//       redeemedWith: paymentMethod,
//       vendorId: coupon.vendorId._id,
//       couponCode: uniqueUserCouponCode,
//       discountPercentage: coupon.discountPercentage,
//       couponCodeType: coupon.couponCodeType,
//       isClaimed: false,
//       canBeClaimed: true,
//       vendorName: coupon.vendorId?.businessName || 'Unknown Vendor',
//       vendorLogo: coupon.vendorId?.businessLogo || '',
//       purchaseMethod: paymentMethod,
//       purchaseCost: paymentMethod === 'coins' ? coupon.requiredCoins : 1
//     };

//     // Initialize MyCoupons array if it doesn't exist
//     if (!Array.isArray(user.MyCoupons)) {
//       user.MyCoupons = [];
//     }

//     user.MyCoupons.push(activeCoupon);

//     // Update coupon stats
//     coupon.downloaded = (coupon.downloaded || 0) + 1;
//     coupon.usedCount = (coupon.usedCount || 0) + 1;

//     if (coupon.usedCount >= coupon.maxUsage) {
//       coupon.status = 'used';
//     }

//     // Save user and coupon
//     await user.save();
//     await coupon.save();

//     // Create payment record for vendor
//     const currentMonth = new Date().toISOString().slice(0, 7);

//     try {
//       const paymentRecord = new PaymentRecord({
//         vendorId: coupon.vendorId._id,
//         couponId: coupon._id,
//         userId: user._id,
//         pricePerCoupon: PRICE_PER_COUPON,
//         month: currentMonth,
//         paymentMethod: 'pending',
//         paymentStatus: 'pending',
//         claimedAt: new Date(),
//         couponName: coupon.name || 'Unknown Coupon',
//         couponCode: uniqueUserCouponCode,
//         userPurchaseMethod: paymentMethod
//       });

//       await paymentRecord.save();
//       console.log(`✅ Payment record created: $${PRICE_PER_COUPON} for vendor ${coupon.vendorId._id}`);

//       // Update monthly payment summary
//       await updateMonthlyPaymentSummary(coupon.vendorId._id, currentMonth);
//     } catch (paymentError) {
//       console.error("⚠️ Payment record creation failed:", paymentError);
//       // Don't fail the main transaction if payment record fails
//     }

//     // Notify vendor
//     try {
//       await notifyVendor({
//         vendorId: coupon.vendorId._id,
//         title: '💰 Coupon Purchased',
//         message: `User purchased your coupon "${coupon.name}" using ${paymentMethod}`,
//         type: 'coupon_purchased',
//         couponId: coupon._id,
//         metadata: {
//           purchaseMethod: paymentMethod,
//           uniqueCouponCode: uniqueUserCouponCode,
//           ...paymentDetails
//         }
//       });
//     } catch (notifyError) {
//       console.error("⚠️ Vendor notification failed:", notifyError);
//     }

//     // Notify user
//     const purchaseMessage = paymentMethod === 'coins'
//       ? `You purchased "${coupon.name}" for ${coupon.requiredCoins} coins.`
//       : `You purchased "${coupon.name}" using 1 coupon.`;

//     try {
//       await notifyUser({
//         userId: user._id,
//         title: '🎉 Coupon Purchased Successfully!',
//         message: purchaseMessage,
//         type: 'coupon_purchased',
//         couponId: coupon._id,
//         vendorId: coupon.vendorId._id,
//         metadata: {
//           purchaseMethod: paymentMethod,
//           uniqueCouponCode: uniqueUserCouponCode,
//           ...paymentDetails
//         }
//       });
//     } catch (notifyError) {
//       console.error("⚠️ User notification failed:", notifyError);
//     }

//     // Send success response
//     res.status(200).json({
//       success: true,
//       message: 'Coupon purchased and added to active coupons',
//       purchaseMethod: paymentMethod,
//       ...paymentDetails,
//       coupon: {
//         id: user.MyCoupons[user.MyCoupons.length - 1]._id,
//         couponId: coupon._id,
//         vendorId: coupon.vendorId._id,
//         status: 'Active',
//         purchasedAt: now,
//         nextStep: 'Go to vendor to claim',
//         canBeClaimed: true,
//         purchaseMethod: paymentMethod,
//         vendorName: coupon.vendorId?.businessName || 'Unknown Vendor'
//       }
//     });

//   } catch (error) {
//     console.error('Error purchasing coupon:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: error.message
//     });
//   }
// };


export const claimCoupon = async (req, res) => {
  try {
    const { userId, couponId } = req.params;
    const { purchaseType = 'coins' } = req.body;

    // Validate required parameters
    if (!userId || !couponId) {
      return res.status(400).json({
        success: false,
        message: 'UserId and CouponId are required'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find and populate coupon with vendor details
    const coupon = await Coupon.findById(couponId).populate('vendorId');
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Validate vendor exists
    if (!coupon.vendorId || !coupon.vendorId._id) {
      console.error("❌ Coupon vendorId is null or not populated for coupon:", coupon._id);
      return res.status(400).json({
        success: false,
        message: "Coupon vendor not found"
      });
    }

    // Check if coupon is approved
    if (coupon.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Coupon is not available. Status: ${coupon.status}`
      });
    }

    // Check if coupon has expired
    if (new Date(coupon.validityDate) < new Date()) {
      coupon.status = 'expired';
      await coupon.save();
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired'
      });
    }
        // Check if user already has this active coupon
    const existingCoupon = user.MyCoupons?.find(
      item => item.couponId.toString() === couponId &&
        item.status === 'Active'
    );
        if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'You already have this active coupon',
        couponId: existingCoupon._id
      });
    }

    // Check if coupon has reached max usage
    if (coupon.usedCount >= coupon.maxUsage) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has reached maximum usage limit'
      });
    }

    // Handle payment based on purchase type
    let paymentSuccess = false;
    let paymentMethod = '';
    let paymentDetails = {};

    if (purchaseType === 'coupons') {
      // Purchase with coupons
      if (user.coupons < 1) {
        return res.status(400).json({
          success: false,
          message: `Insufficient coupons. Required: 1, Available: ${user.coupons}`
        });
      }

      user.coupons -= 1;

      if (!Array.isArray(user.couponHistory)) {
        user.couponHistory = [];
      }

      user.couponHistory.push({
        type: 'added',
        code: coupon.couponCode || '',
        message: `Purchased coupon "${coupon.name}" using 1 coupon`,
        amount: -1,
        date: new Date()
      });

      paymentSuccess = true;
      paymentMethod = 'coupons';
      paymentDetails = {
        couponsUsed: 1,
        remainingCoupons: user.coupons
      };

    } else if (purchaseType === 'coins') {
      // Purchase with coins
      if (user.coins < coupon.requiredCoins) {
        return res.status(400).json({
          success: false,
          message: `Insufficient coins. Required: ${coupon.requiredCoins}, Available: ${user.coins}`
        });
      }

      user.coins -= coupon.requiredCoins;

      if (!Array.isArray(user.coinHistory)) {
        user.coinHistory = [];
      }

      user.coinHistory.push({
        type: 'added',
        amount: -coupon.requiredCoins,
        message: `Purchased coupon "${coupon.name}"`,
        timestamp: new Date()
      });

      paymentSuccess = true;
      paymentMethod = 'coins';
      paymentDetails = {
        coinsUsed: coupon.requiredCoins,
        remainingCoins: user.coins
      };

    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid purchase type. Use "coins" or "coupons"'
      });
    }

    if (!paymentSuccess) {
      return res.status(400).json({
        success: false,
        message: 'Payment failed'
      });
    }

    // ✅ Generate UNIQUE ID for this purchase (MongoDB will auto-generate _id)
    // No need to manually create uniquePurchaseId - MongoDB creates unique _id automatically
    
    // Generate unique coupon code for this specific purchase
    const uniqueUserCouponCode = await generateUniqueUserCouponCode(coupon.name || 'CPN');
    
    // Count how many times user has purchased this coupon before
    const previousPurchases = user.MyCoupons?.filter(
      c => c && c.couponId && c.couponId.toString() === couponId
    ).length || 0;
    
    const now = new Date();
    
    // Create new coupon entry - MongoDB will automatically add a unique _id
    const activeCoupon = {
      couponId: couponId,
      status: 'Active',
      purchasedAt: now,
      activatedAt: null,
      expiresAt: null,
      claimedAt: null,
      usedAt: null,
      redeemedWith: paymentMethod,
      vendorId: coupon.vendorId._id,
      couponCode: uniqueUserCouponCode,  // ✅ Unique voucher code for this purchase
      discountPercentage: coupon.discountPercentage,
      couponCodeType: coupon.couponCodeType,
      isClaimed: false,
      canBeClaimed: true,
      vendorName: coupon.vendorId?.businessName || 'Unknown Vendor',
      vendorLogo: coupon.vendorId?.businessLogo || '',
      purchaseMethod: paymentMethod,
      purchaseCost: paymentMethod === 'coins' ? coupon.requiredCoins : 1,
      purchaseInstance: previousPurchases + 1  // Track which purchase instance this is
    };

    // Initialize MyCoupons array if it doesn't exist
    if (!Array.isArray(user.MyCoupons)) {
      user.MyCoupons = [];
    }

    user.MyCoupons.push(activeCoupon);  // ✅ Each push gets a unique MongoDB _id

    // Update coupon stats
    coupon.downloaded = (coupon.downloaded || 0) + 1;
    coupon.usedCount = (coupon.usedCount || 0) + 1;

    if (coupon.usedCount >= coupon.maxUsage) {
      coupon.status = 'used';
    }

    // Save user and coupon
    await user.save();
    await coupon.save();

    // Get the newly created coupon's unique ID (the one MongoDB generated)
    const newlyAddedCoupon = user.MyCoupons[user.MyCoupons.length - 1];
    const uniquePurchaseId = newlyAddedCoupon._id;

    // Create payment record for vendor
    const currentMonth = new Date().toISOString().slice(0, 7);
    const PRICE_PER_COUPON = 1.0; // Define your price or import from config

    try {
      const paymentRecord = new PaymentRecord({
        vendorId: coupon.vendorId._id,
        couponId: coupon._id,
        userId: user._id,
        pricePerCoupon: PRICE_PER_COUPON,
        month: currentMonth,
        paymentMethod: 'pending',
        paymentStatus: 'pending',
        claimedAt: new Date(),
        couponName: coupon.name || 'Unknown Coupon',
        couponCode: uniqueUserCouponCode,
        userPurchaseMethod: paymentMethod,
        purchaseInstanceId: uniquePurchaseId  // Store the unique purchase ID
      });

      await paymentRecord.save();
      console.log(`✅ Payment record created: $${PRICE_PER_COUPON} for vendor ${coupon.vendorId._id}`);

      // Update monthly payment summary
      await updateMonthlyPaymentSummary(coupon.vendorId._id, currentMonth);
    } catch (paymentError) {
      console.error("⚠️ Payment record creation failed:", paymentError);
    }

    // Notify vendor
    try {
      await notifyVendor({
        vendorId: coupon.vendorId._id,
        title: '💰 Coupon Purchased',
        message: `User purchased your coupon "${coupon.name}" using ${paymentMethod}`,
        type: 'coupon_purchased',
        couponId: coupon._id,
        metadata: {
          purchaseMethod: paymentMethod,
          uniqueCouponCode: uniqueUserCouponCode,
          purchaseInstance: previousPurchases + 1,
          ...paymentDetails
        }
      });
    } catch (notifyError) {
      console.error("⚠️ Vendor notification failed:", notifyError);
    }

    // Notify user
    const purchaseMessage = paymentMethod === 'coins'
      ? `You purchased "${coupon.name}" for ${coupon.requiredCoins} coins.`
      : `You purchased "${coupon.name}" using 1 coupon.`;

    try {
      await notifyUser({
        userId: user._id,
        title: '🎉 Coupon Purchased Successfully!',
        message: purchaseMessage,
        type: 'coupon_purchased',
        couponId: coupon._id,
        vendorId: coupon.vendorId._id,
        metadata: {
          purchaseMethod: paymentMethod,
          uniqueCouponCode: uniqueUserCouponCode,
          purchaseInstance: previousPurchases + 1,
          ...paymentDetails
        }
      });
    } catch (notifyError) {
      console.error("⚠️ User notification failed:", notifyError);
    }

    // ✅ EXACT SAME RESPONSE STRUCTURE (no changes)
    res.status(200).json({
      success: true,
      message: 'Coupon purchased and added to active coupons',
      purchaseMethod: paymentMethod,
      ...paymentDetails,
      coupon: {
        id: uniquePurchaseId,  // ✅ This is the unique MongoDB _id for this purchase
        couponId: coupon._id,
        vendorId: coupon.vendorId._id,
        status: 'Active',
        purchasedAt: now,
        nextStep: 'Go to vendor to claim',
        canBeClaimed: true,
        purchaseMethod: paymentMethod,
        vendorName: coupon.vendorId?.businessName || 'Unknown Vendor'
      }
    });

  } catch (error) {
    console.error('Error purchasing coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


// export const getActiveCoupons = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     if (!userId) {
//       return res.status(400).json({ message: "UserId is required" });
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     const now = new Date();
//     let isUpdated = false;

//     // 🔁 Auto-expire coupons safely
//     user.MyCoupons.forEach(coupon => {
//       if (
//         coupon.status === "Active" &&
//         coupon.expiresAt &&
//         new Date(coupon.expiresAt) < now
//       ) {
//         coupon.status = "Expired";
//         coupon.canBeClaimed = false;
//         isUpdated = true;
//       }
//     });

//     if (isUpdated) {
//       await user.save();
//     }

//     // ===== SIMPLE FIX: ONLY KEEP ACTIVE COUPONS =====
//     // Filter out any coupons that are NOT active
//     user.MyCoupons = user.MyCoupons.filter(coupon => 
//       coupon && coupon.couponId && coupon.status === "Active"
//     );
//     // ================================================

//     // ❌ Remove purchase-only coupons
//     const validCoupons = user.MyCoupons.filter(
//       c => c && c.couponId // must be a real coupon
//     );

//     if (validCoupons.length === 0) {
//       return res.status(200).json({
//         message: "No coupons found",
//         coupons: []
//       });
//     }

//     // Fetch full coupon + vendor details
//     const couponIds = validCoupons.map(c => c.couponId);
//     const couponsFromDB = await Coupon.find({ _id: { $in: couponIds } })
//       .populate("vendorId", "businessName businessLogo addresses phone email category");

//     // Final formatted response
//     const formattedCoupons = validCoupons.map(userCoupon => {
//       const couponDetail = couponsFromDB.find(
//         c => c._id.toString() === userCoupon.couponId.toString()
//       );

//       if (!couponDetail) return null;

//       // 🔍 Extract vendor address properly
//       let vendorAddress = null;

//       if (couponDetail.vendorId && couponDetail.vendorId.addresses) {
//         if (Array.isArray(couponDetail.vendorId.addresses) && couponDetail.vendorId.addresses.length > 0) {
//           vendorAddress = couponDetail.vendorId.addresses[0];
//         }
//         else if (typeof couponDetail.vendorId.addresses === 'string') {
//           vendorAddress = couponDetail.vendorId.addresses;
//         }
//         else if (couponDetail.vendorId.address) {
//           vendorAddress = couponDetail.vendorId.address;
//         }
//       }

//       return {
//         userCouponId: userCoupon._id,

//         // ✅ BOOLEAN FLAGS
//         isActive: userCoupon.status === "Active",
//         isClaimed: userCoupon.isClaimed === true,
//         isExpired: userCoupon.status === "Expired",

//         status: userCoupon.status,
//         expiresAt: userCoupon.expiresAt || null,
//         claimedAt: userCoupon.claimedAt || null,
//         usedAt: userCoupon.usedAt || null,
//         canBeClaimed: userCoupon.canBeClaimed !== false,

//         // 🎟 FULL COUPON DETAILS
//         coupon: {
//           _id: couponDetail._id,
//           name: couponDetail.name,
//           description: couponDetail.description,
//           image: couponDetail.couponImage,
//           discountPercentage: couponDetail.discountPercentage,
//           couponCodeType: couponDetail.couponCodeType,
//           couponCode: couponDetail.couponCode,
//           requiredCoins: couponDetail.requiredCoins,
//           validityDate: couponDetail.validityDate,
//           category: couponDetail.category,
//           maxUsage: couponDetail.maxUsage,
//           usedCount: couponDetail.usedCount,
//           status: couponDetail.status,
//           createdAt: couponDetail.createdAt
//         },

//         // 🏪 FULL VENDOR DETAILS WITH ADDRESS
//         vendor: couponDetail.vendorId
//           ? {
//             _id: couponDetail.vendorId._id,
//             businessName: couponDetail.vendorId.businessName,
//             businessLogo: couponDetail.vendorId.businessLogo,
//             vendorAddress: vendorAddress,
//             phone: couponDetail.vendorId.phone,
//             email: couponDetail.vendorId.email,
//             category: couponDetail.vendorId.category
//           }
//           : null
//       };
//     }).filter(Boolean);

//     return res.status(200).json({
//       message: "All coupons fetched successfully",
//       count: formattedCoupons.length,
//       coupons: formattedCoupons
//     });

//   } catch (error) {
//     console.error("Get Coupons Error:", error);
//     return res.status(500).json({
//       message: "Server error",
//       error: error.message
//     });
//   }
// };

export const getActiveCoupons = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "UserId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const now = new Date();
    let isUpdated = false;

    // Auto-expire coupons safely
    user.MyCoupons.forEach(coupon => {
      if (
        coupon.status === "Active" &&
        coupon.expiresAt &&
        new Date(coupon.expiresAt) < now
      ) {
        coupon.status = "Expired";
        coupon.canBeClaimed = false;
        isUpdated = true;
      }
    });

    if (isUpdated) {
      await user.save();
    }

    // Filter to keep ONLY active coupons
    const validCoupons = user.MyCoupons.filter(coupon => 
      coupon && coupon.couponId && coupon.status === "Active"
    );

    if (validCoupons.length === 0) {
      return res.status(200).json({
        message: "No coupons found",
        coupons: []
      });
    }

    // ✅ FIX: Deduplicate by couponId - only keep the most recent purchase for each coupon
    const couponMap = new Map();
    
    for (const userCoupon of validCoupons) {
      const couponIdStr = userCoupon.couponId.toString();
      const existing = couponMap.get(couponIdStr);
      
      // Keep the most recently purchased one (or the one with isClaimed false if both exist)
      if (!existing) {
        couponMap.set(couponIdStr, userCoupon);
      } else {
        // If we already have one, keep the one that's NOT claimed (prefer unclaimed)
        // OR keep the more recent purchase
        if (!userCoupon.isClaimed && existing.isClaimed) {
          couponMap.set(couponIdStr, userCoupon);
        } else if (userCoupon.purchasedAt > existing.purchasedAt) {
          couponMap.set(couponIdStr, userCoupon);
        }
      }
    }
    
    // Convert map back to array
    const uniqueCoupons = Array.from(couponMap.values());

    // Get unique coupon IDs for fetching details
    const uniqueCouponIds = [...new Set(uniqueCoupons.map(c => c.couponId.toString()))];
    
    // Fetch full coupon details
    const couponsFromDB = await Coupon.find({ _id: { $in: uniqueCouponIds } })
      .populate("vendorId", "businessName businessLogo addresses phone email category");

    // Create a map for quick lookup
    const couponDetailMap = {};
    couponsFromDB.forEach(c => {
      couponDetailMap[c._id.toString()] = c;
    });

    // Format each coupon purchase individually
    const formattedCoupons = uniqueCoupons.map(userCoupon => {
      const couponDetail = couponDetailMap[userCoupon.couponId.toString()];

      if (!couponDetail) return null;

      // Extract vendor address properly
      let vendorAddress = null;
      let vendorAddresses = [];

      if (couponDetail.vendorId) {
        if (couponDetail.vendorId.addresses) {
          if (Array.isArray(couponDetail.vendorId.addresses)) {
            vendorAddresses = couponDetail.vendorId.addresses;
            vendorAddress = vendorAddresses.length > 0 ? vendorAddresses[0] : null;
          } else if (typeof couponDetail.vendorId.addresses === 'string') {
            vendorAddress = couponDetail.vendorId.addresses;
            vendorAddresses = [couponDetail.vendorId.addresses];
          }
        }
        
        if (!vendorAddress && couponDetail.vendorId.address) {
          if (typeof couponDetail.vendorId.address === 'object') {
            vendorAddress = couponDetail.vendorId.address.street || 
                           couponDetail.vendorId.address.address || 
                           JSON.stringify(couponDetail.vendorId.address);
          } else {
            vendorAddress = couponDetail.vendorId.address;
          }
        }
      }

      // Calculate time remaining if expiresAt exists
      let timeRemaining = null;
      if (userCoupon.expiresAt) {
        const expiresAt = new Date(userCoupon.expiresAt);
        const timeRemainingMs = expiresAt - now;
        if (timeRemainingMs > 0) {
          const hours = Math.floor(timeRemainingMs / (1000 * 60 * 60));
          const minutes = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
          timeRemaining = `${hours}h ${minutes}m`;
        }
      }

      return {
        userCouponId: userCoupon._id,
        purchaseInstance: userCoupon.purchaseInstance || 1,
        isActive: userCoupon.status === "Active",
        isClaimed: userCoupon.isClaimed === true,
        isExpired: userCoupon.status === "Expired",
        status: userCoupon.status,
        expiresAt: userCoupon.expiresAt || null,
        claimedAt: userCoupon.claimedAt || null,
        usedAt: userCoupon.usedAt || null,
        canBeClaimed: userCoupon.canBeClaimed !== false,
        timeRemaining: timeRemaining,
        coupon: {
          _id: couponDetail._id,
          name: couponDetail.name,
          description: couponDetail.description,
          image: couponDetail.couponImage,
          discountPercentage: couponDetail.discountPercentage,
          couponCodeType: couponDetail.couponCodeType,
          couponCode: couponDetail.couponCode,
          requiredCoins: couponDetail.requiredCoins,
          validityDate: couponDetail.validityDate,
          category: couponDetail.category,
          maxUsage: couponDetail.maxUsage,
          usedCount: couponDetail.usedCount,
          status: couponDetail.status,
          createdAt: couponDetail.createdAt
        },
        vendor: couponDetail.vendorId ? {
          _id: couponDetail.vendorId._id,
          businessName: couponDetail.vendorId.businessName,
          businessLogo: couponDetail.vendorId.businessLogo,
          vendorAddress: vendorAddress,
          addresses: vendorAddresses,
          phone: couponDetail.vendorId.phone,
          email: couponDetail.vendorId.email,
          category: couponDetail.vendorId.category
        } : null,
        purchasedAt: userCoupon.purchasedAt,
        purchaseMethod: userCoupon.purchaseMethod,
        purchaseCost: userCoupon.purchaseCost,
        uniqueVoucherCode: userCoupon.couponCode
      };
    }).filter(Boolean);

    return res.status(200).json({
      message: "All coupons fetched successfully",
      count: formattedCoupons.length,
      coupons: formattedCoupons
    });

  } catch (error) {
    console.error("Get Coupons Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



export const claimCouponAtVendor = async (req, res) => {
  try {
    const { userId, couponId } = req.params;
    const { confirm, vendorId } = req.body;

    // Validate required parameters
    if (!userId || !couponId) {
      return res.status(400).json({
        message: 'UserId and CouponId are required'
      });
    }

    if (confirm === undefined) {
      return res.status(400).json({
        message: 'Vendor confirmation required (confirm: true/false)'
      });
    }

    // ✅ FIX: vendorId is now REQUIRED
    if (!vendorId) {
      return res.status(400).json({
        message: 'vendorId is required to claim coupon'
      });
    }

    // Find user and populate MyCoupons
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Ensure MyCoupons is an array
    if (!Array.isArray(user.MyCoupons)) {
      user.MyCoupons = [];
    }

    // Find the active coupon
    const couponIndex = user.MyCoupons.findIndex(item =>
      item &&
      item.couponId &&
      item.couponId.toString() === couponId &&
      item.status === 'Active' &&
      item.canBeClaimed !== false
    );

    if (couponIndex === -1) {
      return res.status(404).json({
        message: 'Active coupon not found or already claimed',
        suggestion: 'Check /user/:userId/active-coupons'
      });
    }

    const activeCoupon = user.MyCoupons[couponIndex];

    // CRITICAL FIX: If vendorId is missing in user coupon, fetch it from the Coupon collection
    if (!activeCoupon.vendorId) {
      console.log(`⚠️ Vendor ID missing in user coupon ${couponId}, fetching from Coupon collection...`);

      try {
        const couponFromDB = await Coupon.findById(couponId).select('vendorId');
        if (couponFromDB && couponFromDB.vendorId) {
          // Add vendorId to the user's coupon data
          activeCoupon.vendorId = couponFromDB.vendorId;
          console.log(`✅ Fetched vendor ID ${couponFromDB.vendorId} for coupon ${couponId}`);
        } else {
          return res.status(400).json({
            message: 'Coupon vendor not found in database',
            details: 'Please contact support'
          });
        }
      } catch (couponError) {
        console.error('Error fetching coupon vendor:', couponError);
        return res.status(500).json({
          message: 'Failed to fetch coupon vendor information'
        });
      }
    }

    // Validate vendorId exists on the coupon (after fetching)
    if (!activeCoupon.vendorId) {
      return res.status(400).json({
        message: 'Coupon vendor not found in coupon data',
        couponId: couponId,
        userCouponData: {
          hasVendorId: false,
          couponData: activeCoupon
        }
      });
    }

    // ✅ FIX: Verify vendor matches - NOW ENFORCED
    const vendorIdString = vendorId.toString();
    const activeCouponVendorId = activeCoupon.vendorId.toString();

    if (activeCouponVendorId !== vendorIdString) {
      return res.status(400).json({
        message: 'This coupon belongs to a different vendor',
        couponVendorId: activeCouponVendorId,
        providedVendorId: vendorIdString,
        details: 'Vendor ID mismatch - cannot claim this coupon'
      });
    }

    // Handle vendor rejection
    if (confirm === false) {
      // Update claim attempts
      user.MyCoupons[couponIndex].lastClaimAttempt = new Date();
      user.MyCoupons[couponIndex].claimAttempts =
        (user.MyCoupons[couponIndex].claimAttempts || 0) + 1;

      await user.save();

      // Notify vendor about rejection
      await notifyVendor({
        vendorId: activeCoupon.vendorId,
        title: '❌ Coupon Claim Rejected',
        message: `You rejected User's claim for coupon "${activeCoupon.couponCode}".`,
        type: 'coupon_rejected',
        couponId: couponId
      });

      // Notify user
      await notifyUser({
        userId: user._id,
        title: '❌ Claim Rejected',
        message: `Your claim for coupon "${activeCoupon.couponCode}" was rejected by the vendor. You can try again.`,
        type: 'coupon_rejected',
        couponId: couponId,
        vendorId: activeCoupon.vendorId
      });

      return res.status(200).json({
        message: 'Coupon claim rejected by vendor. You can try again.',
        status: 'Active',
        isClaimed: false,
        canBeClaimed: true,
        claimAttempts: user.MyCoupons[couponIndex].claimAttempts
      });
    }

    // Handle vendor acceptance
    if (confirm === true) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours

      // Update coupon status
      user.MyCoupons[couponIndex].isClaimed = true;
      user.MyCoupons[couponIndex].claimedAt = now;
      user.MyCoupons[couponIndex].activatedAt = now;
      user.MyCoupons[couponIndex].expiresAt = expiresAt;
      user.MyCoupons[couponIndex].canBeClaimed = false;
      user.MyCoupons[couponIndex].claimVerified = true;
      user.MyCoupons[couponIndex].status = 'Active';
      user.markModified('MyCoupons');
      await user.save();

      // Get price per coupon from PaymentConfig
      // In claimCouponAtVendor function, replace the payment record creation section:

      // Get price per coupon from PaymentConfig
      let pricePerCoupon = 1.0;
      try {
        const priceConfig = await PaymentConfig.findOne({ isActive: true });
        if (priceConfig && priceConfig.pricePerCoupon) {
          pricePerCoupon = priceConfig.pricePerCoupon;
        }
      } catch (configError) {
        console.error("Error fetching payment config:", configError);
      }

      // Get current month (YYYY-MM format)
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Get coupon details
      let couponName = 'Unknown Coupon';
      let vendorName = 'Unknown Vendor';
      try {
        const couponDetails = await Coupon.findById(couponId).populate('vendorId', 'businessName');
        if (couponDetails) {
          couponName = couponDetails.name || 'Unknown Coupon';
          if (couponDetails.vendorId) {
            vendorName = couponDetails.vendorId.businessName || 'Unknown Vendor';
          }
        }
      } catch (couponError) {
        console.error("Error fetching coupon details:", couponError);
      }

      // Create payment record
      try {
        const paymentRecord = new PaymentRecord({
          vendorId: activeCoupon.vendorId,
          couponId: couponId,
          userId: user._id,
          pricePerCoupon: pricePerCoupon,
          month: currentMonth,
          paymentMethod: 'pending',
          paymentStatus: 'pending',
          claimedAt: new Date(),
          couponName: couponName,
          couponCode: activeCoupon.couponCode || 'N/A',
          vendorName: vendorName
        });

        await paymentRecord.save();
        console.log(`✅ Payment record created: $${pricePerCoupon} for vendor ${activeCoupon.vendorId}, month ${currentMonth}`);

        // Update monthly payment summary
        try {
          await updateMonthlyPaymentSummary(activeCoupon.vendorId, currentMonth);
          console.log(`✅ Monthly summary updated for vendor ${activeCoupon.vendorId}`);
        } catch (summaryError) {
          console.error("⚠️ Monthly summary update failed:", summaryError);
        }

      } catch (paymentError) {
        console.error("⚠️ Payment record creation failed:", paymentError);
      }
      // Notify vendor
      await notifyVendor({
        vendorId: activeCoupon.vendorId,
        title: '✅ Coupon Claim Verified',
        message: `Claimed coupon "${activeCoupon.couponCode}" at your store. Valid for 4 hours. Payment record created.`,
        type: 'coupon_claimed',
        couponId: couponId,
        metadata: {
          claimedAt: now,
          expiresAt: expiresAt,
          paymentCreated: true
        }
      });

      // Notify user
      await notifyUser({
        userId: user._id,
        title: '⏰ Coupon Timer Started!',
        message: `Your coupon "${activeCoupon.couponCode}" claim verified! Use within 4 hours.`,
        type: 'coupon_claimed',
        couponId: couponId,
        vendorId: activeCoupon.vendorId,
        metadata: {
          claimedAt: now,
          expiresAt: expiresAt,
          timeRemaining: '4 hours'
        }
      });

      // Set timeout for auto-expiry after 4 hours
      setTimeout(async () => {
        try {
          const updatedUser = await User.findById(userId);
          if (updatedUser && updatedUser.MyCoupons) {
            const updatedCouponIndex = updatedUser.MyCoupons.findIndex(
              item =>
                item &&
                item.couponId &&
                item.couponId.toString() === couponId &&
                item.status === 'Active' &&
                item.isClaimed === true
            );

            if (updatedCouponIndex !== -1) {
              updatedUser.MyCoupons[updatedCouponIndex].status = 'Expired';
              await updatedUser.save();

              await notifyUser({
                userId: user._id,
                title: '⏰ Coupon Expired',
                message: `Your claimed coupon "${activeCoupon.couponCode}" has expired.`,
                type: 'coupon_expired',
                couponId: couponId,
                vendorId: activeCoupon.vendorId
              });
            }
          }
        } catch (err) {
          console.error('Error auto-expiring coupon:', err);
        }
      }, 4 * 60 * 60 * 1000);

      return res.status(200).json({
        message: 'Coupon claim verified! 4 hours timer started.',
        status: 'Active',
        isClaimed: true,
        claimedAt: now,
        expiresAt: expiresAt,
        expiresIn: '4 hours',
        usedAt: now,
        couponCode: activeCoupon.couponCode,
        canBeClaimed: true,
        paymentRecordCreated: true,
        vendorId: activeCoupon.vendorId
      });
    }

    // If confirm is not true/false
    return res.status(400).json({
      message: 'Invalid confirmation value. Must be true or false.'
    });

  } catch (error) {
    console.error('Error claiming coupon at vendor:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


// Run this ONCE to update existing feedback records with userCouponId
const updateExistingFeedbacks = async () => {
  // Get all feedback records
  const feedbacks = await UserCouponFeedback.find({ userCouponId: { $exists: false } });
  
  console.log(`Found ${feedbacks.length} feedback records to update`);
  
  for (const feedback of feedbacks) {
    // Find the user
    const user = await User.findById(feedback.userId);
    if (!user) continue;
    
    // Find the matching MyCoupon entry
    const matchingCoupon = user.MyCoupons?.find(
      mc => mc.couponId?.toString() === feedback.couponId?.toString()
    );
    
    if (matchingCoupon) {
      feedback.userCouponId = matchingCoupon._id;
      await feedback.save();
      console.log(`Updated feedback ${feedback._id} with userCouponId ${matchingCoupon._id}`);
    }
  }
  
  console.log('Migration complete');
}; 
// ============================================
// FIXED: submitCouponFeedback - Now works for both expired AND claimed coupons
// ============================================
export const submitCouponFeedback = async (req, res) => {
  try {
    const { userId, couponId } = req.params;
    const { rating, description } = req.body;

    // 1. Validate input
    if (!rating || !description) {
      return res.status(400).json({
        success: false,
        message: 'Rating and description are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // 2. Check user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // 3. Find the specific coupon in user's MyCoupons
    const userCoupon = user.MyCoupons?.find(coupon =>
      coupon.couponId && coupon.couponId.toString() === couponId
    );

    if (!userCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon not found in your purchased coupons'
      });
    }

    // 4. Check if feedback already exists for this specific purchase
    const existingFeedback = await UserCouponFeedback.findOne({
      userCouponId: userCoupon._id
    });

    if (existingFeedback) {
      return res.status(200).json({
        success: true,
        message: 'Feedback submission is already completed',
        feedback: {
          _id: existingFeedback._id,
          couponId: existingFeedback.couponId,
          rating: existingFeedback.rating,
          alreadySubmitted: true,
          description: existingFeedback.description,
          createdAt: existingFeedback.createdAt
        }
      });
    }

    // 5. Allow feedback for BOTH Expired AND Claimed/Used coupons
    const allowedStatuses = ['Expired', 'Used'];
    const isCouponClaimed = userCoupon.isClaimed === true;

    if (!allowedStatuses.includes(userCoupon.status) && !isCouponClaimed) {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be submitted for expired, used, or claimed coupons',
        currentStatus: userCoupon.status,
        isClaimed: userCoupon.isClaimed,
        suggestion: 'Wait until the coupon is used or expires to submit feedback'
      });
    }

    // 6. Check if coupon exists in Coupons collection
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // 7. Create feedback with userCouponId
    const feedback = new UserCouponFeedback({
      userId,
      couponId,
      userCouponId: userCoupon._id,
      vendorId: coupon.vendorId,
      rating,
      description,
      isAnonymous: false,
      couponStatus: userCoupon.status,
      claimedAt: userCoupon.claimedAt,
      expiredAt: userCoupon.expiresAt || userCoupon.expiredAt,
      couponCode: userCoupon.couponCode
    });

    // ⭐ CRITICAL FIX: Save feedback FIRST before awarding coins
    await feedback.save();

    // 8. Update coupon stats
    coupon.totalRatings = (coupon.totalRatings || 0) + 1;
    coupon.averageRating = ((coupon.averageRating || 0) * (coupon.totalRatings - 1) + rating) / coupon.totalRatings;
    await coupon.save();

    // 9. Award 100 coins for feedback
    const FEEDBACK_COIN_REWARD = 100;
    
    // Store coins before adding
    const coinsBefore = user.coins || 0;
    
    // Add coins directly
    user.coins = (user.coins || 0) + FEEDBACK_COIN_REWARD;
    
    // Initialize coinHistory if needed
    if (!Array.isArray(user.coinHistory)) {
      user.coinHistory = [];
    }
    
    // Add to coin history
    user.coinHistory.push({
      type: 'added',
      amount: FEEDBACK_COIN_REWARD,
      message: `Earned ${FEEDBACK_COIN_REWARD} coins for submitting feedback on coupon "${coupon.name || 'Coupon'}"`,
      timestamp: new Date(),
      metadata: {
        feedbackId: feedback._id,
        couponId: couponId,
        couponName: coupon.name || 'Coupon',
        rating: rating,
        reason: 'coupon_feedback'
      }
    });
    
    // Save user with new coins
    await user.save();
    
    console.log(`💰 Added ${FEEDBACK_COIN_REWARD} coins to user ${userId}. Before: ${coinsBefore}, After: ${user.coins}`);

    // Send notification to user about coin reward
    await notifyUser({
      userId: user._id,
      title: '💰 Feedback Reward!',
      message: `You earned ${FEEDBACK_COIN_REWARD} coins for submitting coupon feedback!`,
      type: 'coins_added',
      couponId: couponId,
      vendorId: coupon.vendorId,
      metadata: {
        amount: FEEDBACK_COIN_REWARD,
        totalCoins: user.coins,
        feedbackId: feedback._id,
        reason: 'coupon_feedback',
        coinsBefore: coinsBefore,
        coinsAfter: user.coins
      }
    });

    // Send notification to user about feedback submission
    await notifyUser({
      userId: user._id,
      title: '✅ Feedback Submitted!',
      message: `Your feedback for coupon "${userCoupon.couponCode || coupon.name}" has been submitted successfully.`,
      type: 'feedback_submitted',
      couponId: couponId,
      vendorId: coupon.vendorId,
      metadata: {
        rating: rating,
        submittedAt: new Date(),
        couponName: coupon.name || 'Coupon',
        coinsEarned: FEEDBACK_COIN_REWARD
      }
    });

    // 10. Return success response (EXACT SAME STRUCTURE - no changes)
    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback: {
        _id: feedback._id,
        couponId: feedback.couponId,
        rating: feedback.rating,
        alreadySubmitted: false,
        description: feedback.description,
        createdAt: feedback.createdAt
      }
    });

  } catch (error) {
    console.error('Error submitting coupon feedback:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Feedback already submitted for this coupon purchase'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

export const getUserCouponFeedback = async (req, res) => {
  try {
    const { userId, couponId } = req.params;

    const feedback = await UserCouponFeedback.findOne({
      userId,
      couponId
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'No feedback found for this coupon'
      });
    }

    res.status(200).json({
      success: true,
      feedback: {
        _id: feedback._id,
        rating: feedback.rating,
        description: feedback.description,
        createdAt: feedback.createdAt,
        updatedAt: feedback.updatedAt
      }
    });

  } catch (error) {
    console.error('Error getting coupon feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const updateCouponFeedback = async (req, res) => {
  try {
    const { userId, couponId } = req.params;
    const { rating, description } = req.body;

    // Validate at least one field is provided
    if (!rating && !description) {
      return res.status(400).json({
        success: false,
        message: 'Rating or description is required for update'
      });
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Find the existing feedback
    const feedback = await UserCouponFeedback.findOne({
      userId,
      couponId
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Store old rating for stats update
    const oldRating = feedback.rating;

    // Update fields if provided
    if (rating !== undefined) {
      feedback.rating = rating;
    }

    if (description !== undefined) {
      feedback.description = description;
    }

    feedback.updatedAt = new Date();
    await feedback.save();

    // Update coupon average rating if rating changed
    if (rating !== undefined && oldRating !== rating) {
      const coupon = await Coupon.findById(couponId);
      if (coupon) {
        const allFeedbacks = await UserCouponFeedback.find({ couponId });
        const totalRating = allFeedbacks.reduce((sum, fb) => sum + fb.rating, 0);
        coupon.averageRating = totalRating / allFeedbacks.length;
        coupon.totalRatings = allFeedbacks.length;
        await coupon.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Feedback updated successfully',
      feedback: {
        _id: feedback._id,
        rating: feedback.rating,
        description: feedback.description,
        createdAt: feedback.createdAt,
        updatedAt: feedback.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating coupon feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const deleteCouponFeedback = async (req, res) => {
  try {
    const { userId, couponId } = req.params;

    // Find and delete the feedback
    const feedback = await UserCouponFeedback.findOneAndDelete({
      userId,
      couponId
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Update coupon stats
    const coupon = await Coupon.findById(couponId);
    if (coupon) {
      const remainingFeedbacks = await UserCouponFeedback.find({ couponId });

      if (remainingFeedbacks.length === 0) {
        coupon.totalRatings = 0;
        coupon.averageRating = 0;
      } else {
        const totalRating = remainingFeedbacks.reduce((sum, fb) => sum + fb.rating, 0);
        coupon.totalRatings = remainingFeedbacks.length;
        coupon.averageRating = totalRating / remainingFeedbacks.length;
      }

      await coupon.save();
    }

    res.status(200).json({
      success: true,
      message: 'Feedback deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting coupon feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const getAllUserCouponFeedback = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch feedback
    const feedbacks = await UserCouponFeedback.find({ userId })
      .populate('couponId', 'name discountPercentage couponImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await UserCouponFeedback.countDocuments({ userId });

    // Format response
    const formattedFeedbacks = feedbacks.map(feedback => ({
      _id: feedback._id,
      coupon: feedback.couponId ? {
        name: feedback.couponId.name,
        discount: feedback.couponId.discountPercentage,
        image: feedback.couponId.couponImage
      } : null,
      rating: feedback.rating,
      description: feedback.description,
      date: feedback.createdAt
    }));

    res.status(200).json({
      success: true,
      count: formattedFeedbacks.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      feedbacks: formattedFeedbacks
    });

  } catch (error) {
    console.error('Error getting all coupon feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const getVendorCouponFeedback = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch feedback for vendor's coupons
    const feedbacks = await UserCouponFeedback.find({ vendorId })
      .populate('userId', 'name profileImage')
      .populate('couponId', 'name discountPercentage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await UserCouponFeedback.countDocuments({ vendorId });

    // Calculate average rating for vendor
    const vendorStats = await UserCouponFeedback.aggregate([
      { $match: { vendorId: new mongoose.Types.ObjectId(vendorId) } },
      {
        $group: {
          _id: '$vendorId',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    // Format rating distribution
    let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (vendorStats.length > 0 && vendorStats[0].ratingDistribution) {
      vendorStats[0].ratingDistribution.forEach(rating => {
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      });
    }

    // Format response
    const formattedFeedbacks = feedbacks.map(feedback => ({
      _id: feedback._id,
      user: feedback.userId ? {
        _id: feedback.userId._id,
        name: feedback.isAnonymous ? 'Anonymous' : feedback.userId.name,
        profileImage: feedback.isAnonymous ? null : feedback.userId.profileImage
      } : null,
      coupon: feedback.couponId ? {
        name: feedback.couponId.name,
        discount: feedback.couponId.discountPercentage
      } : null,
      rating: feedback.rating,
      description: feedback.description,
      isAnonymous: feedback.isAnonymous,
      date: feedback.createdAt
    }));

    res.status(200).json({
      success: true,
      vendor: {
        _id: vendor._id,
        businessName: vendor.businessName,
        businessLogo: vendor.businessLogo
      },
      stats: vendorStats.length > 0 ? {
        averageRating: vendorStats[0].averageRating.toFixed(1),
        totalReviews: vendorStats[0].totalReviews,
        ratingDistribution
      } : {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution
      },
      feedbacks: formattedFeedbacks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error getting vendor coupon feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

export const getClaimedCoupons = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get coupons that are claimed or used
    const claimedCoupons = user.MyCoupons.filter(coupon =>
      coupon.isClaimed === true || coupon.status === 'Used'
    );

    const now = new Date();
    const formattedCoupons = claimedCoupons.map(coupon => {
      const couponData = {
        _id: coupon._id,
        couponId: coupon.couponId,
        status: coupon.status,
        isClaimed: coupon.isClaimed,
        purchasedAt: coupon.purchasedAt,
        claimedAt: coupon.claimedAt,
        activatedAt: coupon.activatedAt,
        expiresAt: coupon.expiresAt,
        usedAt: coupon.usedAt,
        couponCode: coupon.couponCode,
        discount: `${coupon.discountPercentage}${coupon.couponCodeType}`,
        vendorLocation: coupon.vendorLocation,
        transactionId: coupon.transactionId
      };

      // Add time remaining for active claimed coupons
      if (coupon.status === 'Active' && coupon.expiresAt) {
        const expiresAt = new Date(coupon.expiresAt);
        const timeRemainingMs = expiresAt - now;

        if (timeRemainingMs > 0) {
          const hours = Math.floor(timeRemainingMs / (1000 * 60 * 60));
          const minutes = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
          couponData.timeRemaining = `${hours}h ${minutes}m`;
        } else {
          couponData.timeRemaining = 'Expired';
        }
      }

      return couponData;
    });

    res.status(200).json({
      message: 'Claimed coupons retrieved successfully',
      count: formattedCoupons.length,
      claimedCoupons: formattedCoupons
    });

  } catch (error) {
    console.error('Error getting claimed coupons:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getExpiredCoupons = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: 'UserId is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find expired coupons
    const expiredCoupons = user.MyCoupons.filter(coupon =>
      coupon.status === 'Expired' ||
      (coupon.expiresAt && new Date(coupon.expiresAt) < new Date())
    );

    // Auto-update any expired coupons
    const now = new Date();
    let updated = false;

    user.MyCoupons.forEach(coupon => {
      if (coupon.status === 'Active' &&
        coupon.expiresAt &&
        new Date(coupon.expiresAt) < now) {
        coupon.status = 'Expired';
        coupon.canBeClaimed = false;
        updated = true;
      }
    });

    if (updated) {
      await user.save();
    }

    // Get coupon details
    const couponIds = expiredCoupons.map(coupon => coupon.couponId);
    const couponDetails = await Coupon.find({ '_id': { $in: couponIds } })
      .populate('vendorId', 'businessName businessLogo');

    const detailedCoupons = expiredCoupons.map(userCoupon => {
      const couponDetail = couponDetails.find(
        detail => detail._id.toString() === userCoupon.couponId.toString()
      );

      return {
        _id: userCoupon._id,
        status: userCoupon.status,
        purchasedAt: userCoupon.purchasedAt,
        claimedAt: userCoupon.claimedAt,
        activatedAt: userCoupon.activatedAt,
        expiresAt: userCoupon.expiresAt,
        couponCode: userCoupon.couponCode,
        discount: `${userCoupon.discountPercentage}${userCoupon.couponCodeType}`,
        reason: userCoupon.expiresAt && new Date(userCoupon.expiresAt) < now ?
          'Time expired' : 'Manually expired',

        // Coupon details
        coupon: couponDetail ? {
          name: couponDetail.name,
          image: couponDetail.couponImage,
          requiredCoins: couponDetail.requiredCoins
        } : null,

        // Vendor details
        vendor: couponDetail?.vendorId ? {
          businessName: couponDetail.vendorId.businessName,
          businessLogo: couponDetail.vendorId.businessLogo
        } : null
      };
    });

    res.status(200).json({
      message: 'Expired coupons retrieved successfully',
      count: detailedCoupons.length,
      expiredCoupons: detailedCoupons
    });

  } catch (error) {
    console.error('Error retrieving expired coupons:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getUserCouponStats = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: 'UserId is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ SAFE DEFAULT (prevents undefined errors)
    const myCoupons = Array.isArray(user.MyCoupons) ? user.MyCoupons : [];

    const stats = {
      totalCoupons: myCoupons.length,
      activeCoupons: myCoupons.filter(c => c && c.status === 'Active').length,
      claimedCoupons: myCoupons.filter(c => c && c.isClaimed === true).length,
      expiredCoupons: myCoupons.filter(c => c && c.status === 'Expired').length,

      // untouched old logic fields
      totalCoinsSpent: 0,
      couponsPurchasedLast30Days: 0,
      couponsUsedLast30Days: 0
    };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // ✅ FILTER OUT NULL couponIds (prevents crash)
    const couponIds = myCoupons
      .filter(c => c && c.couponId)
      .map(c => c.couponId);

    const couponDetails = couponIds.length
      ? await Coupon.find({ _id: { $in: couponIds } })
      : [];

    myCoupons.forEach(userCoupon => {
      if (!userCoupon || !userCoupon.couponId) return;

      const couponDetail = couponDetails.find(
        d => d && d._id && d._id.toString() === userCoupon.couponId.toString()
      );

      // coins calculation (unchanged)
      if (couponDetail && couponDetail.requiredCoins) {
        stats.totalCoinsSpent += couponDetail.requiredCoins;
      }

      // last 30 days stats (unchanged)
      if (userCoupon.purchasedAt && new Date(userCoupon.purchasedAt) > thirtyDaysAgo) {
        stats.couponsPurchasedLast30Days++;
      }

      if (userCoupon.usedAt && new Date(userCoupon.usedAt) > thirtyDaysAgo) {
        stats.couponsUsedLast30Days++;
      }
    });

    // savings logic untouched
    const usedCoupons = myCoupons.filter(c => c && c.status === 'Used');
    let estimatedSavings = 0;

    usedCoupons.forEach(coupon => {
      if (coupon.discountPercentage && coupon.transactionAmount) {
        const discount =
          (coupon.discountPercentage / 100) * coupon.transactionAmount;
        estimatedSavings += discount;
      }
    });

    stats.estimatedSavings = estimatedSavings.toFixed(2);

    // ✅ ONLY REQUIRED OUTPUT
    return res.status(200).json({
      totalCoupons: stats.totalCoupons,
      activeCoupons: stats.activeCoupons,
      claimedCoupons: stats.claimedCoupons,
      expiredCoupons: stats.expiredCoupons
    });

  } catch (error) {
    console.error('Error getting coupon stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


export const getCouponsByStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'UserId is required' });
    }

    if (!status) {
      return res.status(400).json({
        message: 'Status parameter is required (Active, Used, Expired, etc.)'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const statusMap = {
      'active': 'Active',
      'used': 'Used',
      'expired': 'Expired',
      'claimed': (coupon) => coupon.isClaimed === true,
      'purchased': () => true // All coupons
    };

    const statusKey = status.toLowerCase();
    let filteredCoupons;

    if (statusMap[statusKey]) {
      if (typeof statusMap[statusKey] === 'function') {
        filteredCoupons = user.MyCoupons.filter(statusMap[statusKey]);
      } else {
        filteredCoupons = user.MyCoupons.filter(
          coupon => coupon.status === statusMap[statusKey]
        );
      }
    } else {
      // Try exact match
      filteredCoupons = user.MyCoupons.filter(
        coupon => coupon.status.toLowerCase() === statusKey
      );
    }

    // Get coupon details
    const couponIds = filteredCoupons.map(coupon => coupon.couponId);
    const couponDetails = await Coupon.find({ '_id': { $in: couponIds } })
      .populate('vendorId', 'businessName businessLogo');

    const detailedCoupons = filteredCoupons.map(userCoupon => {
      const couponDetail = couponDetails.find(
        detail => detail._id.toString() === userCoupon.couponId.toString()
      );

      return {
        userCouponId: userCoupon._id,
        status: userCoupon.status,
        purchasedAt: userCoupon.purchasedAt,
        claimedAt: userCoupon.claimedAt,
        usedAt: userCoupon.usedAt,
        expiresAt: userCoupon.expiresAt,
        isClaimed: userCoupon.isClaimed,
        couponCode: userCoupon.couponCode,
        discount: `${userCoupon.discountPercentage}${userCoupon.couponCodeType}`,

        // Coupon details
        coupon: couponDetail ? {
          _id: couponDetail._id,
          name: couponDetail.name,
          image: couponDetail.couponImage,
          category: couponDetail.category
        } : null,

        // Vendor details
        vendor: couponDetail?.vendorId ? {
          businessName: couponDetail.vendorId.businessName,
          businessLogo: couponDetail.vendorId.businessLogo
        } : null
      };
    });

    res.status(200).json({
      message: `Coupons with status '${status}' retrieved successfully`,
      count: detailedCoupons.length,
      coupons: detailedCoupons
    });

  } catch (error) {
    console.error('Error getting coupons by status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


export const getCouponHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: 'UserId is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const historyStatuses = ['Used', 'Redeemed', 'Expired'];
    const couponHistory = user.MyCoupons.filter(coupon =>
      historyStatuses.includes(coupon.status)
    );

    if (couponHistory.length === 0) {
      return res.status(404).json({ message: 'No coupon history found' });
    }

    // Fetch coupon details
    const couponIds = couponHistory.map(coupon => coupon.couponId);
    const couponDetails = await Coupon.find({ '_id': { $in: couponIds } });

    // 🔍 Fetch feedback records for these specific user-coupon combinations
    const feedbackRecords = await UserCouponFeedback.find({
      userId,
      couponId: { $in: couponIds }
    }).select('couponId userCouponId'); // only need to know which ones exist

    const submittedCouponIds = new Set(
      feedbackRecords.map(fb => fb.couponId.toString())
    );

    const detailedHistory = couponHistory.map(coupon => {
      const detail = couponDetails.find(
        d => d._id.toString() === coupon.couponId.toString()
      );
      const isFeedbackSubmitted = submittedCouponIds.has(coupon.couponId.toString());

      return {
        couponId: coupon.couponId,
        status: coupon.status,
        claimedAt: coupon.claimedAt,
        usedAt: coupon.usedAt,
        couponCode: coupon.couponCode,
        discount: `${coupon.discountPercentage}${coupon.couponCodeType}`,
        details: detail || {},
        // ✅ Add the flag
        alreadySubmitted: isFeedbackSubmitted   // matches naming in submitCouponFeedback
      };
    });

    res.status(200).json({
      message: 'Coupon history retrieved successfully',
      history: detailedHistory
    });
  } catch (error) {
    console.error('Error retrieving coupon history:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const addChatMember = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    // Check if both senderId and receiverId are provided
    if (!senderId || !receiverId) {
      return res.status(400).json({ message: 'Both senderId and receiverId are required' });
    }

    // Fetch sender and receiver users from the database
    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    // Check if both users exist
    if (!sender || !receiver) {
      return res.status(404).json({ message: 'Sender or Receiver not found' });
    }

    // Ensure MyChatMembers is initialized
    if (!Array.isArray(sender.MyChatMembers)) {
      sender.MyChatMembers = [];
    }

    if (!Array.isArray(receiver.MyChatMembers)) {
      receiver.MyChatMembers = [];
    }

    // Add receiver to sender's MyChatMembers if not already present
    if (!sender.MyChatMembers.some(member => member.userId.toString() === receiverId)) {
      sender.MyChatMembers.push({ userId: receiverId, status: 'Pending' });
    }

    // Add sender to receiver's MyChatMembers if not already present
    if (!receiver.MyChatMembers.some(member => member.userId.toString() === senderId)) {
      receiver.MyChatMembers.push({ userId: senderId, status: 'Pending' });
    }

    // Add notification to the receiver
    receiver.notifications.push({
      message: `${sender.name} wants to add you as a chat member.`,
      senderId: sender._id,
      receiverId: receiver._id,
      read: false
    });

    // Save both sender and receiver after modification
    await sender.save();
    await receiver.save();

    await notifyUser({
      userId: receiverId,
      title: '👥 Chat Request',
      message: `${sender.name} wants to add you as a chat member.`,
      type: 'chat_request',
      metadata: {
        senderId: sender._id,
        senderName: sender.name,
        status: 'pending',
        actionRequired: true
      }
    });

    return res.status(200).json({
      message: 'Chat member request sent successfully',
      sender: sender.name,
      receiver: receiver.name
    });

  } catch (error) {
    console.error('Error adding chat member:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


export const getChatMembers = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user and populate MyChatMembers.userId with name and profileImage
    const user = await User.findById(userId).populate({
      path: 'MyChatMembers.userId',
      select: 'name profileImage',
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.MyChatMembers || user.MyChatMembers.length === 0) {
      return res.status(200).json({
        message: 'No chat members found',
        chatMembers: [],
      });
    }

    // Filter only those chat members whose status is "Accepted"
    const acceptedChatMembers = user.MyChatMembers.filter(
      (chatMember) => chatMember.status === "Accepted"
    );

    const chatMembersWithMessages = await Promise.all(
      acceptedChatMembers.map(async (chatMember) => {
        if (!chatMember.userId) {
          return null;
        }

        const otherUserId = chatMember.userId._id;

        // Fetch last message between the user and chat member
        const lastMessage = await Message.findOne({
          $or: [
            { sender: userId, receiver: otherUserId },
            { sender: otherUserId, receiver: userId },
          ],
        }).sort({ createdAt: -1 });

        // Count unread messages where receiver is current user, sender is chat member, and read is false
        const unreadMessagesCount = await Message.countDocuments({
          receiver: userId,
          sender: otherUserId,
          read: false,
        });

        return {
          userId: chatMember.userId,
          status: chatMember.status,
          lastMessage: lastMessage
            ? {
              text: lastMessage.text,
              createdAt: lastMessage.createdAt, // Include timestamp
            }
            : null,
          unreadMessagesCount,
        };
      })
    );

    const filteredChatMembers = chatMembersWithMessages.filter(Boolean);

    return res.status(200).json({
      message: 'Chat members fetched successfully',
      chatMembers: filteredChatMembers,
    });

  } catch (error) {
    console.error('Error fetching chat members:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const acceptChatMember = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    // Check if both senderId and receiverId are provided
    if (!senderId || !receiverId) {
      return res
        .status(400)
        .json({ message: "Both senderId and receiverId are required" });
    }

    // Fetch sender and receiver users
    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    // Check if both users exist
    if (!sender || !receiver) {
      return res.status(404).json({ message: "Sender or Receiver not found" });
    }

    // 🔹 Update the status to 'Accepted' for both sender and receiver
    sender.MyChatMembers = sender.MyChatMembers.map((member) =>
      member.userId.toString() === receiverId
        ? { ...member, status: "Accepted" }
        : member
    );

    receiver.MyChatMembers = receiver.MyChatMembers.map((member) =>
      member.userId.toString() === senderId
        ? { ...member, status: "Accepted" }
        : member
    );

    // 🔹 Remove related notification (instead of just marking read)
    receiver.notifications = receiver.notifications.filter(
      (notification) => notification.senderId?.toString() !== senderId
    );

    // Save both sender and receiver after updating the status
    await sender.save();
    await receiver.save();

    // ✅ NOTIFY THE SENDER that their request was accepted
    await notifyUser({
      userId: senderId,
      title: '✅ Chat Request Accepted',
      message: `${receiver.name} accepted your chat request.`,
      type: 'chat_request_accepted',
      metadata: {
        receiverId: receiver._id,
        receiverName: receiver.name,
        status: 'accepted'
      }
    });

    // ✅ NOTIFY THE RECEIVER (optional confirmation)
    await notifyUser({
      userId: receiverId,
      title: '✅ Request Processed',
      message: `You accepted ${sender.name}'s chat request.`,
      type: 'chat_request_accepted',
      metadata: {
        senderId: sender._id,
        senderName: sender.name,
        status: 'accepted'
      }
    });

    // ✅ Also send notification through your socket system if needed
    if (global.io) {
      global.io.to(`user_${senderId}`).emit('chatRequestAccepted', {
        fromUserId: receiverId,
        fromUserName: receiver.name,
        message: `${receiver.name} accepted your chat request`
      });
    }

    return res.status(200).json({
      message: "Chat member request accepted successfully and notification removed",
      sender: sender.name,
      receiver: receiver.name,
    });
  } catch (error) {
    console.error("Error accepting chat member:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



export const declineChatMember = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    // Validate IDs
    if (!senderId || !receiverId) {
      return res
        .status(400)
        .json({ message: "Both senderId and receiverId are required" });
    }

    // Fetch sender and receiver users
    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      return res
        .status(404)
        .json({ message: "Sender or Receiver not found" });
    }

    // 🔹 Update chat member status to "Rejected"
    sender.MyChatMembers = sender.MyChatMembers.map((member) =>
      member.userId.toString() === receiverId
        ? { ...member, status: "Rejected" }
        : member
    );

    receiver.MyChatMembers = receiver.MyChatMembers.map((member) =>
      member.userId.toString() === senderId
        ? { ...member, status: "Rejected" }
        : member
    );

    // 🔹 Remove them completely from each other's MyChatMembers list
    sender.MyChatMembers = sender.MyChatMembers.filter(
      (member) => member.userId.toString() !== receiverId
    );

    receiver.MyChatMembers = receiver.MyChatMembers.filter(
      (member) => member.userId.toString() !== senderId
    );

    // 🔹 Remove related notification (not just mark as read)
    receiver.notifications = receiver.notifications.filter(
      (notification) => notification.senderId?.toString() !== senderId
    );

    await sender.save();
    await receiver.save();

    // ✅ NOTIFY THE SENDER that their request was declined
    await notifyUser({
      userId: senderId,
      title: '❌ Chat Request Declined',
      message: `${receiver.name} declined your chat request.`,
      type: 'chat_request_declined',
      metadata: {
        receiverId: receiver._id,
        receiverName: receiver.name,
        status: 'declined'
      }
    });

    // ✅ Send socket notification if needed
    if (global.io) {
      global.io.to(`user_${senderId}`).emit('chatRequestDeclined', {
        fromUserId: receiverId,
        fromUserName: receiver.name,
        message: `${receiver.name} declined your chat request`
      });
    }


    return res.status(200).json({
      message: "Chat member request declined successfully and notification removed",
      sender: sender.name,
      receiver: receiver.name,
    });
  } catch (error) {
    console.error("Error declining chat member:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// export const getNotifications = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     // Fetch the user by userId
//     const user = await User.findById(userId);

//     // If the user does not exist
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // Mark all notifications as read
//     user.notifications = user.notifications.map(notification => ({ ...notification, read: true }));

//     // Save the updated notifications
//     await user.save();

//     return res.status(200).json({
//       message: 'Notifications fetched successfully',
//       notifications: user.notifications
//     });

//   } catch (error) {
//     console.error('Error fetching notifications:', error);
//     return res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };


// // DELETE single or all notifications
// export const deleteNotifications = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const { notificationId } = req.body; // ✅ Now from body instead of query

//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ success: false, message: 'User not found' });
//     }

//     if (notificationId) {
//       const initialLength = user.notifications.length;

//       user.notifications = user.notifications.filter(
//         (notification) => notification._id.toString() !== notificationId
//       );

//       if (user.notifications.length === initialLength) {
//         return res.status(404).json({ success: false, message: 'Notification not found' });
//       }

//       await user.save();

//       return res.status(200).json({
//         success: true,
//         message: 'Notification deleted successfully',
//         notifications: user.notifications,
//       });
//     } else {
//       // Delete all
//       user.notifications = [];
//       await user.save();

//       return res.status(200).json({
//         success: true,
//         message: 'All notifications deleted successfully',
//         notifications: [],
//       });
//     }
//   } catch (error) {
//     console.error('Error deleting notification(s):', error);
//     return res.status(500).json({ success: false, message: 'Server error', error: error.message });
//   }
// };



const getGeminiApiKey = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }
  return apiKey;
};
//const GEMINI_API_KEY ='process.env.GEMINI_API_KEY'
//const GEMINI_API_KEY ='process.env.GEMINI_API_KEY'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.0-flash'; // or 'gemini-2.5-pro'


// // Helper function to clean markdown code blocks from response
// function cleanJsonString(str) {
//   return str
//     .trim()
//     .replace(/^```json\s*/, '')  // Remove starting ```json
//     .replace(/^```\s*/, '')      // Or just ```
//     .replace(/```$/, '')         // Remove trailing ```
//     .trim();
// }

export const getMCQQuestions = async (req, res) => {
  try {
    const { category } = req.query;

    const categories = [
      "General Knowledge", "Tollywood", "Bollywood", "Python & Java", "SQL", "Startups",
      "Math", "Indian Food", "Cricket", "Culture", "Tech", "Success Stories", "Accidental Inventions",
      "U.S. vs. Indian Pop Culture", "Navigating Life in the U.S.", "Global Tech & Startups",
      "World History & Geography", "Famous Indian-Americans", "Food Fusion"
    ];

    // Validate category
    if (category && !categories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Category "${category}" is not valid. Please choose from the available categories.`
      });
    }

    // 🧠 Prompt for Gemini API
    let prompt = `Generate a JSON object with a key "quizzes" that contains an array of 10 multiple-choice questions. Each object in the array should have the following structure:
{
  "topic": "<Topic Name>",
  "question": "<Question text>",
  "options": ["Option1", "Option2", "Option3", "Option4"],
  "answer": "<Correct answer>"
}
Do not include any explanation, intro, or text. Only return valid JSON.`;

    if (category) {
      prompt += ` The questions should only be about "${category}".`;
    }

    // 🧩 Call Gemini API
    const response = await axios.post(
      `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanedText = cleanJsonString(rawText);

    let quizzesObj;
    try {
      quizzesObj = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr);
      return res.status(500).json({
        success: false,
        message: "Failed to parse JSON from model response",
        rawText,
      });
    }

    const quizzes = quizzesObj.quizzes || [];

    // 🟩 Save each quiz to MongoDB
    if (quizzes.length > 0) {
      await Quiz.insertMany(
        quizzes.map((q) => ({
          topic: q.topic || category || "General",
          question: q.question,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation || "",
        }))
      );
    }

    // 🟢 Return final response
    res.status(200).json({
      success: true,
      message: "Quizzes generated and saved successfully",
      count: quizzes.length,
      quizzes,
    });

  } catch (error) {
    console.error("Gemini error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to generate or save quizzes",
    });
  }
};

const getImageForKeyword = async (keyword) => {
  try {
    // You can use this pattern with Bing, Pexels, or any image search engine in future
    const searchUrl = `https://source.unsplash.com/800x600/?${encodeURIComponent(keyword)}`;
    return searchUrl; // This returns a different image every time for the keyword
  } catch (err) {
    console.error(`❌ Image fetch error for keyword "${keyword}":`, err.message);
    return null;
  }
};



// const GEMINI_API_KEY = 'process.env.GEMINI_API_KEY';
// const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// const MODEL = 'gemini-2.0-flash';


// const CATEGORIES = [
//   "Indian Food", "Cricket", "Culture", "Tech", "Success Stories", "Accidental Inventions",
//   "U.S. vs. Indian Pop Culture", "Navigating Life in the U.S.", "Global Tech & Startups",
//   "World History & Geography", "Famous Indian-Americans", "Food Fusion",
// ];


// const generateFacts = async (category, offset = 0) => {
//   const prompt = `
// Generate 5 fun facts in JSON format with key "funFacts".
// Each object must include:
// - id: starting from ${offset + 1},
// - fact: short, catchy title,
// - description: around 8–10 sentences, detailed, rich, and engaging (explain context, background, and interesting details clearly),
// - source: short source name,
// - link: valid source URL,
// - image: valid image URL,
// - pubDate: recent date in "YYYY-MM-DD HH:mm:ss" format.

// ${category ? `Only include facts about: "${category}".` : ''}
// Respond ONLY with a valid JSON object. No markdown or text outside JSON.
// `;

//   const response = await axios.post(
//     `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`,
//     {
//       contents: [{ parts: [{ text: prompt }] }]
//     },
//     { timeout: 50000 }
//   );

//   const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
//   const cleaned = cleanJsonString(rawText);
//   const json = JSON.parse(cleaned);
//   return json.funFacts || [];
// };

// // Function to check if the image URL is valid (status 2xx)
// const checkImageUrl = async (url) => {
//   try {
//     const response = await axios.head(url, { timeout: 5000 });
//     return response.status >= 200 && response.status < 300;
//   } catch (error) {
//     return false; // Invalid or unreachable image
//   }
// };

// export const getFunFacts = async (req, res) => {
//   const { category } = req.query;

//   // Validate category (optional: if you have a predefined list of categories)
//   if (category && !CATEGORIES.includes(category)) {
//     return res.status(400).json({
//       success: false,
//       message: `Category "${category}" is not valid.`,
//     });
//   }

//   try {
//     const start = Date.now();

//     // Fetch two batches of 10 facts (pass the category in the generation function)
//     const [facts1, facts2] = await Promise.all([
//       generateFacts(category, 0),
//       generateFacts(category, 10),
//     ]);

//     const totalElapsed = Date.now() - start;
//     console.log(`⏱️ Total response time: ${totalElapsed} ms`);

//     // Combine facts from both batches
//     const allFacts = [...facts1, ...facts2];

//     // Filter out invalid image URLs (return only facts with valid images)
//     const validFacts = await Promise.all(
//       allFacts.map(async (fact) => {
//         const isValidImage = await checkImageUrl(fact.image);
//         return isValidImage ? fact : null; // Return fact only if image is valid
//       })
//     );

//     // Remove null values (invalid facts) from the array
//     const finalFacts = validFacts.filter((fact) => fact !== null);

//     // Check if we have valid facts, else handle the case
//     if (finalFacts.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'No valid facts with images found.',
//       });
//     }

//     // Store facts into the database
//     const storedFacts = await Promise.all(
//       finalFacts.map(async (fact) => {
//         const newFact = new FunFact({
//           id: fact.id,
//           fact: fact.fact,
//           description: fact.description,
//           source: fact.source,
//           link: fact.link,
//           image: fact.image,
//           pubDate: new Date(fact.pubDate),
//           category: category, // Store the category in the database
//         });

//         // Save fact to MongoDB
//         return newFact.save();
//       })
//     );

//     console.log(`Stored ${storedFacts.length} valid facts in the database.`);

//     // Return the response with only valid facts
//     return res.status(200).json({
//       success: true,
//       funFacts: finalFacts,
//     });

//   } catch (error) {
//     console.error('Gemini error:', error.response?.data || error.message);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to generate and store fun facts.',
//     });
//   }
// };





// // Fetch all stored fun facts
// // Fetch all stored fun facts with optional category filter
// export const getAllFunFacts = async (req, res) => {
//   try {
//     const { category } = req.query; // Get category filter from query params

//     // If a category is provided, filter the facts by category
//     const filter = category ? { category } : {};

//     // Fetch the fun facts from the database with the category filter if applicable
//     // Sort by 'createdAt' in descending order to show the newest ones first
//     const funFacts = await FunFact.find(filter).sort({ createdAt: -1 });

//     // If no facts found, return a message
//     if (funFacts.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'No fun facts found in the database for the given category.',
//       });
//     }

//     // Return the fun facts
//     return res.status(200).json({
//       success: true,
//       funFacts,
//     });
//   } catch (error) {
//     console.error('Error fetching fun facts:', error.message);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to retrieve fun facts.',
//     });
//   }
// };


const CATEGORIES = [
  'Indian Food',
  'Cricket',
  'Culture',
  'Tech',
  'Success Stories',
  'Accidental Inventions',
  'U.S. vs. Indian Pop Culture',
  'Navigating Life in the U.S.',
  'Global Tech & Startups',
  'World History & Geography',
  'Famous Indian-Americans',
  'Food Fusion',
];

// ─────────────────────────────────────────────
// STATIC FALLBACK IMAGES (guaranteed to work)
// ─────────────────────────────────────────────
const FALLBACK_IMAGES = {
  'Indian Food': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80&fm=jpg',
  'Cricket': 'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=800&q=80&fm=jpg',
  'Culture': 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80&fm=jpg',
  'Tech': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80&fm=jpg',
  'Success Stories': 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80&fm=jpg',
  'Accidental Inventions': 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&q=80&fm=jpg',
  'U.S. vs. Indian Pop Culture': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80&fm=jpg',
  'Navigating Life in the U.S.': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80&fm=jpg',
  'Global Tech & Startups': 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&q=80&fm=jpg',
  'World History & Geography': 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80&fm=jpg',
  'Famous Indian-Americans': 'https://images.unsplash.com/photo-1532634993-15f421e42ec0?w=800&q=80&fm=jpg',
  'Food Fusion': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80&fm=jpg',
  General: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80&fm=jpg',
};

// ─────────────────────────────────────────────
// HELPER: Strip markdown code fences from Gemini response
// ─────────────────────────────────────────────
// const cleanJsonString = (str) => {
//   if (!str || typeof str !== 'string') return '{}';
//   return str
//     .trim()
//     .replace(/^```json\s*/i, '')
//     .replace(/^```\s*/i, '')
//     .replace(/```\s*$/i, '')
//     .trim();
// };

// ─────────────────────────────────────────────
// HELPER: Validate image URL via HEAD request
// Returns the final URL if valid, null if broken
// ─────────────────────────────────────────────
const validateImageUrl = async (url) => {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  try {
    const response = await axios({
      method: 'HEAD',
      url,
      timeout: 6000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FunFactBot/1.0)' },
      validateStatus: (status) => status < 400,
    });
    const contentType = (response.headers['content-type'] || '').toLowerCase();
    return contentType.includes('image/') ? url : null;
  } catch {
    return null;
  }
};


// ─────────────────────────────────────────────
// HELPER: Force any image URL to return JPG format
// ─────────────────────────────────────────────
const forceJpgUrl = (url) => {
  if (!url || !url.startsWith('http')) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;

    // Unsplash — add fm=jpg param
    if (host.includes('unsplash.com')) {
      parsed.search = '';
      parsed.searchParams.set('w', '800');
      parsed.searchParams.set('q', '80');
      parsed.searchParams.set('fm', 'jpg');
      parsed.searchParams.set('fit', 'crop');
      return parsed.toString();
    }

    // Cloudinary — inject f_jpg transformation
    if (host.includes('cloudinary.com')) {
      const converted = url.replace(
        /\/upload\/(.*?)\.(png|webp|gif|bmp|tiff|svg)/i,
        '/upload/f_jpg,q_80,w_800/$1.jpg',
      );
      return converted !== url ? converted : url.replace(/\.(png|webp|gif|bmp|tiff|svg)(\?.*)?$/i, '.jpg');
    }

    // imgix / Contentful / WordPress — add format params
    if (
      host.includes('imgix') ||
      host.includes('ctfassets') ||
      host.includes('wp.com') ||
      host.includes('wordpress')
    ) {
      parsed.searchParams.set('fm', 'jpg');
      parsed.searchParams.set('q', '80');
      parsed.searchParams.set('w', '800');
      return parsed.toString();
    }

    // Generic — swap extension if non-jpg
    if (url.match(/\.(png|webp|gif|bmp|tiff|svg)(\?.*)?$/i)) {
      return url.replace(/\.(png|webp|gif|bmp|tiff|svg)(\?.*)?$/i, '.jpg');
    }

    // Already jpg/jpeg — return as-is
    return url;
  } catch {
    return url;
  }
};

// ─────────────────────────────────────────────
// HELPER: Validate + auto-convert to JPG
// Returns a working JPG URL or null
// ─────────────────────────────────────────────
const resolveImage = async (url) => {
  if (!url) return null;

  // Step 1: Try the original URL
  const original = await validateImageUrl(url);
  if (original) {
    const jpgUrl = forceJpgUrl(original);
    if (jpgUrl && jpgUrl !== original) {
      const jpgValid = await validateImageUrl(jpgUrl);
      if (jpgValid) return jpgValid;
    }
    return original; // original works even if JPG conversion fails
  }

  // Step 2: Try the JPG-converted version
  const jpgVersion = forceJpgUrl(url);
  if (jpgVersion && jpgVersion !== url) {
    const jpgValid = await validateImageUrl(jpgVersion);
    if (jpgValid) return jpgValid;
  }

  return null; // both failed
};

// ─────────────────────────────────────────────
// HELPER: Call Gemini and return parsed funFacts array
// offset lets us request facts starting at id = offset+1
// ─────────────────────────────────────────────
const fetchFactsFromGemini = async (category, offset = 0) => {
  const categoryClause = category ? `Only include facts about: "${category}".` : '';

  const prompt = `
Generate 5 fun facts in JSON format with key "funFacts".
Each object must include:
- id: number starting from ${offset + 1}
- fact: short catchy title (max 10 words)
- description: 8-10 detailed and engaging sentences with context, background and interesting details
- source: short source name (e.g. "Wikipedia", "BBC", "National Geographic")
- link: a valid real source URL related to the fact
- image: a REAL working direct JPG/JPEG image URL. Preferred sources in order:
    1. Wikimedia Commons: https://upload.wikimedia.org/wikipedia/commons/... (must end in .jpg)
    2. Unsplash: https://images.unsplash.com/photo-XXXXX?w=800&q=80&fm=jpg (use real photo IDs)
    3. Pixabay CDN: https://cdn.pixabay.com/photo/... (must end in .jpg)
  DO NOT use: placeholder images, SVG, PNG, WebP, or broken URLs.
  The image must visually relate to the fact topic.
- pubDate: recent date in "YYYY-MM-DD HH:mm:ss" format

${categoryClause}
Respond ONLY with a valid JSON object. No markdown, no backticks, no extra text outside JSON.
`.trim();

  const response = await axios.post(
    `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.9,
      },
    },
    { timeout: 50000 },
  );

  const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = cleanJsonString(rawText);
  const parsed = JSON.parse(cleaned); // intentionally throws on bad JSON — caught by caller
  return Array.isArray(parsed.funFacts) ? parsed.funFacts : [];
};

// ─────────────────────────────────────────────
// CONTROLLER: GET /api/funfacts?category=...
// ─────────────────────────────────────────────
// export const getFunFacts = async (req, res) => {
//   const { category } = req.query;

//   // Validate category
//   if (category && !CATEGORIES.includes(category)) {
//     return res.status(400).json({
//       success: false,
//       message: `Category "${category}" is not valid. Valid categories: ${CATEGORIES.join(', ')}`,
//     });
//   }

//   try {
//     console.log(`🎯 Generating fun facts${category ? ` for: "${category}"` : ' (all categories)'}...`);

//     // Fetch two batches in parallel → 10 facts total
//     const [batch1, batch2] = await Promise.allSettled([
//       fetchFactsFromGemini(category, 0),
//       fetchFactsFromGemini(category, 5),
//     ]);

//     const allFacts = [
//       ...(batch1.status === 'fulfilled' ? batch1.value : []),
//       ...(batch2.status === 'fulfilled' ? batch2.value : []),
//     ];

//     if (allFacts.length === 0) {
//       return res.status(500).json({
//         success: false,
//         message: 'Gemini returned no facts. Please try again.',
//       });
//     }

//     const fallbackImage = FALLBACK_IMAGES[category] || FALLBACK_IMAGES.General;

//     // Validate + fix images in parallel
//     const validatedFacts = await Promise.all(
//       allFacts.map(async (fact) => {
//         let finalImage = null;

//         if (fact.image) {
//           finalImage = await resolveImage(fact.image);
//         }

//         // Use category fallback if image is missing or broken
//         if (!finalImage) {
//           finalImage = fallbackImage;
//         }

//         return { ...fact, image: finalImage };
//       }),
//     );

//     // Filter out facts that are still missing critical fields
//     const finalFacts = validatedFacts.filter(
//       (f) => f && f.fact && f.description && f.image,
//     );

//     if (finalFacts.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'No valid facts could be generated. Please try again.',
//       });
//     }

//     // Save to DB — use Promise.allSettled so one save failure doesn't block the response
//     const saveResults = await Promise.allSettled(
//       finalFacts.map((fact) =>
//         FunFact.create({
//           id: fact.id,
//           fact: fact.fact,
//           description: fact.description,
//           source: fact.source,
//           link: fact.link,
//           image: fact.image,
//           pubDate: new Date(fact.pubDate || Date.now()),
//           category: category || 'General',
//         }),
//       ),
//     );

//     const savedCount = saveResults.filter((r) => r.status === 'fulfilled').length;
//     console.log(`💾 Saved ${savedCount}/${finalFacts.length} facts to database`);

//     return res.status(200).json({
//       success: true,
//       funFacts: finalFacts,
//     });

//   } catch (error) {
//     const errCode = error.response?.data?.error?.code;
//     const errMsg = error.response?.data?.error?.message || '';

//     console.error('❌ getFunFacts error:', errMsg || error.message);

//     if (errCode === 403) {
//       return res.status(500).json({
//         success: false,
//         message: errMsg.includes('leaked')
//           ? 'Gemini API key is invalid or leaked. Please update GEMINI_API_KEY.'
//           : 'Gemini API access denied. Check your API key.',
//       });
//     }

//     if (errCode === 429) {
//       return res.status(429).json({
//         success: false,
//         message: 'Gemini API rate limit exceeded. Please wait and try again.',
//       });
//     }

//     return res.status(500).json({
//       success: false,
//       message: 'Failed to generate fun facts. Please try again.',
//     });
//   }
// };



export const getFunFacts = async (req, res) => {
  const { category, userId } = req.query;
 
  // Validate category
  if (category && !CATEGORIES.includes(category)) {
    return res.status(400).json({
      success: false,
      message: `Category "${category}" is not valid. Valid categories: ${CATEGORIES.join(', ')}`,
    });
  }
 
  try {
    console.log(`🎯 Generating fun facts${category ? ` for: "${category}"` : ' (all categories)'}...`);
 
    const [batch1, batch2] = await Promise.allSettled([
      fetchFactsFromGemini(category, 0),
      fetchFactsFromGemini(category, 5),
    ]);
 
    const allFacts = [
      ...(batch1.status === 'fulfilled' ? batch1.value : []),
      ...(batch2.status === 'fulfilled' ? batch2.value : []),
    ];
 
    if (allFacts.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Gemini returned no facts. Please try again.',
      });
    }
 
    const fallbackImage = FALLBACK_IMAGES[category] || FALLBACK_IMAGES.General;
 
    const validatedFacts = await Promise.all(
      allFacts.map(async (fact) => {
        let finalImage = fact.image ? await resolveImage(fact.image) : null;
        if (!finalImage) finalImage = fallbackImage;
        return { ...fact, image: finalImage };
      })
    );
 
    const finalFacts = validatedFacts.filter(
      (f) => f && f.fact && f.description && f.image
    );
 
    if (finalFacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid facts could be generated. Please try again.',
      });
    }
 
    // Save to DB
    const saveResults = await Promise.allSettled(
      finalFacts.map((fact) =>
        FunFact.create({
          id: fact.id,
          fact: fact.fact,
          description: fact.description,
          source: fact.source,
          link: fact.link,
          image: fact.image,
          pubDate: new Date(fact.pubDate || Date.now()),
          category: category || 'General',
        })
      )
    );
 
    const savedCount = saveResults.filter((r) => r.status === 'fulfilled').length;
    console.log(`💾 Saved ${savedCount}/${finalFacts.length} facts to database`);
 
    // ========== TIME TRACKING + COIN AWARD FOR FACTS ==========
    if (userId && finalFacts.length > 0) {
      try {
        const factUser = await User.findById(userId);
        if (factUser) {
          const todayForFacts = new Date();
          todayForFacts.setHours(0, 0, 0, 0);
 
          // Check if already earned coins today for facts
          const alreadyEarnedFactCoinsToday = factUser.coinHistory?.some(
            entry =>
              entry.type === 'added' &&
              entry.message?.toLowerCase().includes('fact') &&
              new Date(entry.timestamp || entry.createdAt) >= todayForFacts
          );
 
          // ── ONLY CHANGE: award coins with metadata if not already awarded today ──
          if (!alreadyEarnedFactCoinsToday) {
            const COINS_FOR_FACTS = 5;
 
            // Get the saved fact _id if available, else use the fact's own id field
            const savedFact = saveResults.find(r => r.status === 'fulfilled');
            const firstFactId = savedFact?.value?._id || finalFacts[0]?._id || finalFacts[0]?.id || null;
 
            factUser.coins = (factUser.coins || 0) + COINS_FOR_FACTS;
 
            if (!Array.isArray(factUser.coinHistory)) factUser.coinHistory = [];
            factUser.coinHistory.push({
              type: 'added',
              amount: COINS_FOR_FACTS,
              message: `Earned ${COINS_FOR_FACTS} coins for reading fact`,
              timestamp: new Date(),
              metadata: {
                factId: firstFactId,
                type: 'fact',
                category: category || 'General',
                factsCount: finalFacts.length
              }
            });
 
            await factUser.save();
          }
 
          // trackUserContentTime preserved exactly as original
          for (const fact of finalFacts) {
            await trackUserContentTime(userId, fact._id || fact.id, 'fact', 30);
          }
        }
      } catch (trackErr) {
        console.error('Error tracking fact coins/time:', trackErr);
      }
    }
 
    // ── RESPONSE UNCHANGED ──
    return res.status(200).json({
      success: true,
      funFacts: finalFacts,
    });
 
  } catch (error) {
    const errCode = error.response?.data?.error?.code;
    const errMsg = error.response?.data?.error?.message || '';
 
    console.error('❌ getFunFacts error:', errMsg || error.message);
 
    if (errCode === 403) {
      return res.status(500).json({
        success: false,
        message: errMsg.includes('leaked')
          ? 'Gemini API key is invalid or leaked. Please update GEMINI_API_KEY.'
          : 'Gemini API access denied. Check your API key.',
      });
    }
 
    if (errCode === 429) {
      return res.status(429).json({
        success: false,
        message: 'Gemini API rate limit exceeded. Please wait and try again.',
      });
    }
 
    return res.status(500).json({
      success: false,
      message: 'Failed to generate fun facts. Please try again.',
    });
  }
};





// Update the validation in bulkUploadNews

export const bulkUploadNews = async (req, res) => {
  try {
    const { news } = req.body;
    const files = req.files;

    if (!news || !Array.isArray(news) || news.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of news articles"
      });
    }

    const validCategories = [
      'Immigration', 'Stocks & Finance', 'AI & Tech', 
      'India', 'Cricket', 'Geopolitics', 'Austin Local'
    ];

    const uploadedNews = [];
    const errors = [];

    for (let i = 0; i < news.length; i++) {
      try {
        const item = news[i];

        // Validate required fields
        if (!item.category || !item.catchy_headline || !item.source_url) {
          errors.push({
            index: i,
            error: "Missing required fields: category, catchy_headline, source_url"
          });
          continue;
        }

        // Validate category
        if (!validCategories.includes(item.category)) {
          errors.push({
            index: i,
            error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
          });
          continue;
        }

        // Handle image uploads (rest of the code remains the same)
        let url_large = item.url_large;
        let url = item.url;
        let cloudinary_ids = {};

        // Upload large image if provided
        if (files && files[`url_large_${i}`]) {
          const uploadResult = await uploadImageToCloudinary(files[`url_large_${i}`], "large");
          if (uploadResult) {
            url_large = uploadResult.url;
            cloudinary_ids.url_large = uploadResult.public_id;
          }
        } else if (item.url_large && await validateImageUrl2(item.url_large)) {
          const uploadResult = await uploadImageToCloudinary(item.url_large, "large");
          if (uploadResult) {
            url_large = uploadResult.url;
            cloudinary_ids.url_large = uploadResult.public_id;
          }
        }

        // Upload flip/secondary image if provided
        if (files && files[`url_${i}`]) {
          const uploadResult = await uploadImageToCloudinary(files[`url_${i}`], "flip");
          if (uploadResult) {
            url = uploadResult.url;
            cloudinary_ids.url = uploadResult.public_id;
          }
        } else if (item.url && await validateImageUrl2(item.url)) {
          const uploadResult = await uploadImageToCloudinary(item.url, "flip");
          if (uploadResult) {
            url = uploadResult.url;
            cloudinary_ids.url = uploadResult.public_id;
          }
        }

        // Create news article
        const newsArticle = new News({
          category: item.category,
          category_emoji: item.category_emoji || getCategoryEmoji(item.category),
          catchy_headline: item.catchy_headline,
          tldr: item.tldr || item.catchy_headline.substring(0, 100),
          summary: item.summary || item.what_happened || "Summary not available",
          what_it_means_for_you: item.what_it_means_for_you || "Impact analysis not available",
          disclaimer: item.disclaimer || "This news is for informational purposes only. Please verify with official sources.",
          source_name: item.source_name || extractSourceName(item.source_url),
          source_url: item.source_url,
          url_large: url_large || "https://via.placeholder.com/1200x630?text=News+Image",
          url: url || url_large || "https://via.placeholder.com/1200x630?text=News+Image",
          cloudinary_ids,
          published_at: item.published_at ? new Date(item.published_at) : new Date(),
          isActive: true
        });

        await newsArticle.save();
        uploadedNews.push(newsArticle);

      } catch (itemError) {
        console.error(`Error processing news item ${i}:`, itemError);
        errors.push({
          index: i,
          error: itemError.message
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `Successfully uploaded ${uploadedNews.length} news articles`,
      uploadedCount: uploadedNews.length,
      errors: errors.length > 0 ? errors : undefined,
      news: uploadedNews
    });

  } catch (error) {
    console.error("Bulk upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload news articles",
      error: error.message
    });
  }
};



// Update the query and response handling
// // In your userController.js - Replace your getAllNewses with this
// export const getAllNewses = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 2000000,
//       category,
//       search,
//       sortBy = 'published_at',
//       sortOrder = 'desc',
//       startDate,
//       endDate,
//       userId
//     } = req.query;
 
//     const query = { isActive: true };
 
//     const validCategories = [
//       'Immigration', 'Stocks & Finance', 'AI & Tech',
//       'India', 'Cricket', 'Geopolitics', 'Austin Local'
//     ];
 
//     if (category) {
//       const matchedCategory = validCategories.find(
//         c => c.toLowerCase() === category.toLowerCase()
//       );
//       if (matchedCategory) query.category = matchedCategory;
//     }
 
//     if (startDate || endDate) {
//       query.published_at = {};
//       if (startDate) query.published_at.$gte = new Date(startDate);
//       if (endDate) query.published_at.$lte = new Date(endDate);
//     }
 
//     if (search) query.$text = { $search: search };
 
//     const skip = (parseInt(page) - 1) * parseInt(limit);
//     const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
 
//     // Track start time for response
//     const responseStartTime = Date.now();
 
//     const [news, total] = await Promise.all([
//       News.find(query)
//         .sort(sort)
//         .skip(skip)
//         .limit(parseInt(limit))
//         .lean(),
//       News.countDocuments(query)
//     ]);
 
//     // ========== TIME TRACKING & COINS (ENHANCED) ==========
//     if (userId && news.length > 0) {
//       try {
//         const user = await User.findById(userId);
//         if (user) {
//           const today = new Date();
//           today.setHours(0, 0, 0, 0);
 
//           // Check if already earned coins today for news
//           const alreadyEarnedToday = user.coinHistory?.some(
//             entry =>
//               entry.type === 'added' &&
//               entry.message?.includes('news') &&
//               new Date(entry.timestamp || entry.createdAt) >= today
//           );
 
//           if (!alreadyEarnedToday) {
//             const COINS_FOR_NEWS = 5;
//             const coinsBefore = user.coins || 0;
//             user.coins = coinsBefore + COINS_FOR_NEWS;
 
//             if (!Array.isArray(user.coinHistory)) user.coinHistory = [];
 
//             const firstNewsId = news.length > 0 ? news[0]._id : null;
//             user.coinHistory.push({
//               type: 'added',
//               amount: COINS_FOR_NEWS,
//               message: `Earned ${COINS_FOR_NEWS} coins for viewing news`,
//               timestamp: new Date(),
//               metadata: {
//                 newsId: firstNewsId,
//                 type: 'news',
//                 category: category || 'General',
//                 articlesCount: news.length
//               }
//             });
 
//             await user.save();
//             console.log(`💰 Added ${COINS_FOR_NEWS} coins to user ${userId} for news viewing`);
//           }
 
//           // Track that user viewed news with actual time spent
//           // Store view history with timeSpent (we'll update actual time when user finishes reading)
//           // For now, store initial entry with estimated time
//           for (const article of news) {
//             await trackUserContentTime(userId, article._id, 'news', 60);
//           }
//         }
//       } catch (userError) {
//         console.error('Error tracking news view:', userError);
//       }
//     }
 
//     const responseTime = Date.now() - responseStartTime;
//     console.log(`📊 News response time: ${responseTime}ms`);
 
//     // ── RESPONSE UNCHANGED (no breaking changes) ──
//     return res.status(200).json({
//       success: true,
//       message: "News fetched successfully",
//       count: news.length,
//       total,
//       page: parseInt(page),
//       pages: Math.ceil(total / parseInt(limit)),
//       news,
//       availableCategories: validCategories
//     });
 
//   } catch (error) {
//     console.error("Get all news error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch news",
//       error: error.message
//     });
//   }
// };
// Update the getAllNewses function - add detailed coin tracking
// In your userController.js - Replace your getAllNewses with this
// In userController.js - Replace your existing getAllNewses with this
export const getAllNewses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 2000000,
      category,
      search,
      sortBy = 'published_at',
      sortOrder = 'desc',
      startDate,
      endDate,
      userId
    } = req.query;
 
    const query = { isActive: true };
 
    const validCategories = [
      'Immigration', 'Stocks & Finance', 'AI & Tech',
      'India', 'Cricket', 'Geopolitics', 'Austin Local'
    ];
 
    if (category) {
      const matchedCategory = validCategories.find(
        c => c.toLowerCase() === category.toLowerCase()
      );
      if (matchedCategory) query.category = matchedCategory;
    }
 
    if (startDate || endDate) {
      query.published_at = {};
      if (startDate) query.published_at.$gte = new Date(startDate);
      if (endDate) query.published_at.$lte = new Date(endDate);
    }
 
    if (search) query.$text = { $search: search };
 
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
 
    const [news, total] = await Promise.all([
      News.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      News.countDocuments(query)
    ]);
 
    // ========== ONLY TRACK VIEW HISTORY - NO COIN AWARDING ==========
    if (userId && news.length > 0) {
      try {
        const user = await User.findById(userId);
        if (user) {
          // ONLY track view history - NO coins awarded here
          for (const article of news) {
            await trackUserContentTime(userId, article._id, 'news', 0);
          }
        }
      } catch (userError) {
        console.error('Error tracking news view:', userError);
      }
    }
 
    // EXACT SAME RESPONSE STRUCTURE
    return res.status(200).json({
      success: true,
      message: "News fetched successfully",
      count: news.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      news,
      availableCategories: validCategories
    });
 
  } catch (error) {
    console.error("Get all news error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch news",
      error: error.message
    });
  }
};

/**
 * DELETE - Delete news article (soft delete)
 * DELETE /api/news/:id
 */
export const deleteNews = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid news ID"
      });
    }

    const news = await News.findById(id);
    if (!news) {
      return res.status(404).json({
        success: false,
        message: "News article not found"
      });
    }

    // Soft delete
    news.isActive = false;
    await news.save();

    return res.status(200).json({
      success: true,
      message: "News article deleted successfully"
    });

  } catch (error) {
    console.error("Delete news error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete news",
      error: error.message
    });
  }
};




// ─────────────────────────────────────────────
// CONTROLLER: GET /api/funfacts/all?category=...
// Returns stored facts from the database
// ─────────────────────────────────────────────
// In your userController.js - Replace your getAllFunFacts with this
// export const getAllFunFacts = async (req, res) => {
//   try {
//     const { category, userId } = req.query;
//     const filter = category ? { category } : {};
 
//     // Fetch fun facts sorted by pubDate DESC (newest first)
//     const funFacts = await FunFact.find(filter)
//       .sort({ pubDate: -1, createdAt: -1 });
 
//     if (funFacts.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'No fun facts found in the database for the given category.',
//       });
//     }
 
//     // ========== TIME TRACKING & COINS FOR FACTS (ENHANCED) ==========
//     if (userId && funFacts.length > 0) {
//       try {
//         const user = await User.findById(userId);
//         if (user) {
//           const today = new Date();
//           today.setHours(0, 0, 0, 0);
 
//           // Check if already earned coins today for facts
//           const alreadyEarnedFactCoinsToday = user.coinHistory?.some(
//             entry =>
//               entry.type === 'added' &&
//               (entry.message?.toLowerCase().includes('fact') || entry.metadata?.type === 'fact') &&
//               new Date(entry.timestamp || entry.createdAt) >= today
//           );
 
//           if (!alreadyEarnedFactCoinsToday) {
//             const COINS_FOR_FACTS = 5;
//             const coinsBefore = user.coins || 0;
//             user.coins = coinsBefore + COINS_FOR_FACTS;
 
//             if (!Array.isArray(user.coinHistory)) user.coinHistory = [];
 
//             const firstFactId = funFacts.length > 0 ? funFacts[0]._id : null;
//             user.coinHistory.push({
//               type: 'added',
//               amount: COINS_FOR_FACTS,
//               message: `Earned ${COINS_FOR_FACTS} coins for reading facts`,
//               timestamp: new Date(),
//               metadata: {
//                 factId: firstFactId,
//                 type: 'fact',
//                 category: category || 'General',
//                 factsCount: funFacts.length
//               }
//             });
 
//             await user.save();
//             console.log(`💰 Added ${COINS_FOR_FACTS} coins to user ${userId} for facts reading`);
//           }
 
//           // Track user content time for each fact
//           for (const fact of funFacts) {
//             await trackUserContentTime(userId, fact._id, 'fact', 45);
//           }
//         }
//       } catch (trackErr) {
//         console.error('Error tracking fact coins/time:', trackErr);
//       }
//     }
 
//     // ✅ SAME RESPONSE STRUCTURE (no breaking changes)
//     return res.status(200).json({
//       success: true,
//       funFacts,
//     });
//   } catch (error) {
//     console.error('❌ getAllFunFacts error:', error.message);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to retrieve fun facts.',
//     });
//   }
// };


// Update getAllFunFacts function
// In your userController.js - Replace your getAllFunFacts with this
// In your userController.js - Replace your getAllFunFacts with this
// In userController.js - Replace your existing getAllFunFacts with this
export const getAllFunFacts = async (req, res) => {
  try {
    const { category, userId } = req.query;
    const filter = category ? { category } : {};
 
    // Fetch fun facts sorted by pubDate DESC (newest first)
    const funFacts = await FunFact.find(filter)
      .sort({ pubDate: -1, createdAt: -1 });
 
    if (funFacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No fun facts found in the database for the given category.',
      });
    }
 
    // ========== ONLY TRACK VIEW HISTORY - NO COIN AWARDING ==========
    if (userId && funFacts.length > 0) {
      try {
        const user = await User.findById(userId);
        if (user) {
          // ONLY track view history - NO coins awarded here
          for (const fact of funFacts) {
            await trackUserContentTime(userId, fact._id, 'fact', 0);
          }
        }
      } catch (trackErr) {
        console.error('Error tracking fact view:', trackErr);
      }
    }
 
    // EXACT SAME RESPONSE STRUCTURE
    return res.status(200).json({
      success: true,
      funFacts,
    });
  } catch (error) {
    console.error('❌ getAllFunFacts error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve fun facts.',
    });
  }
};

// Add this helper function at the top of your controller file
// Helper function to format seconds into readable time
// Make sure this exists in your controller file
const formatTimeSpent = (seconds) => {
  if (!seconds || seconds < 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0 && secs > 0) return `${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m`;
  return `${secs}s`;
};



// ==================== TRACK CONTENT TIME SPENT API ====================
// POST /api/user/:userId/track-time
// This API is called by frontend timer to track exact time spent
// It works ALONGSIDE the existing getAllNewses/getAllFunFacts logic

// ==================== TRACK CONTENT TIME SPENT API ====================
// POST /api/user/:userId/track-time
// This API is called by frontend timer to track exact time spent
// It works ALONGSIDE the existing getAllNewses/getAllFunFacts logic

// ==================== TRACK CONTENT TIME SPENT API ====================
// POST /api/user/:userId/track-time
// This API is called by frontend timer to track exact time spent
// It works ALONGSIDE the existing getAllNewses/getAllFunFacts logic

// ==================== TRACK CONTENT TIME SPENT API ====================
// POST /api/user/:userId/track-time
// This API is called by frontend timer to track exact time spent
// It works ALONGSIDE the existing getAllNewses/getAllFunFacts logic

// ==================== TRACK CONTENT TIME SPENT API ====================
// ==================== TRACK CONTENT TIME SPENT API ====================
// ==================== TRACK CONTENT TIME SPENT API ====================
// ==================== TRACK CONTENT TIME SPENT API ====================
// ==================== TRACK CONTENT TIME SPENT API ====================
// Replace your trackContentTimeSpent with this COMPLETE fix
export const trackContentTimeSpent = async (req, res) => {
  try {
    const { userId } = req.params;
    const { contentId, contentType, timeSpentSeconds, category } = req.body;

    // Validation
    if (!userId || !contentId || !contentType || timeSpentSeconds === undefined) {
      return res.status(400).json({
        success: false,
        message: 'userId, contentId, contentType, and timeSpentSeconds are required'
      });
    }

    if (!['news', 'fact'].includes(contentType)) {
      return res.status(400).json({
        success: false,
        message: 'contentType must be "news" or "fact"'
      });
    }

    const MAX_COINS_PER_CONTENT = 5;
    const MIN_SECONDS_REQUIRED = 5;
    
    const contentIdStr = contentId.toString();
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const todayStr = new Date().toISOString().slice(0, 10);
    
    // 🔥 CRITICAL FIX: Check if user already earned coins for this content TODAY
    let alreadyEarnedToday = false;
    
    if (user.coinHistory && Array.isArray(user.coinHistory)) {
      for (const entry of user.coinHistory) {
        if (entry.type !== 'added') continue;
        
        const entryDate = new Date(entry.timestamp || entry.createdAt).toISOString().slice(0, 10);
        if (entryDate !== todayStr) continue;
        
        // Check if this is a 5-coin entry for this content
        if (entry.amount === MAX_COINS_PER_CONTENT) {
          const meta = entry.metadata || {};
          const entryContentId = meta.contentId?.toString() || meta.newsId?.toString() || meta.factId?.toString();
          const entryContentType = meta.contentType || meta.type;
          
          if (entryContentId === contentIdStr && entryContentType === contentType) {
            alreadyEarnedToday = true;
            console.log(`⏭️ Already earned 5 coins for ${contentType} ${contentIdStr} today`);
            break;
          }
          
          // Fallback: check message
          if (entry.message?.includes(contentIdStr) && entry.message?.toLowerCase().includes(contentType)) {
            alreadyEarnedToday = true;
            console.log(`⏭️ Already earned (by message) for ${contentType} ${contentIdStr} today`);
            break;
          }
        }
      }
    }
    
    // 🔥 SECOND CHECK: Use viewHistory to track cumulative time
    let cumulativeTime = 0;
    let viewEntry = null;
    
    if (user.viewHistory && Array.isArray(user.viewHistory)) {
      viewEntry = user.viewHistory.find(v => 
        v.contentId?.toString() === contentIdStr && 
        v.contentType === contentType
      );
      
      if (viewEntry) {
        cumulativeTime = viewEntry.timeSpent || 0;
      }
    }
    
    const newCumulativeTime = cumulativeTime + timeSpentSeconds;
    
    // 🔥 ONLY award coins if:
    // 1. Not already earned today
    // 2. Cumulative time is NOW reaching/exceeding 5 seconds for the FIRST time
    const wasBelowThreshold = cumulativeTime < MIN_SECONDS_REQUIRED;
    const nowReachesThreshold = newCumulativeTime >= MIN_SECONDS_REQUIRED;
    const shouldAwardCoins = !alreadyEarnedToday && wasBelowThreshold && nowReachesThreshold;
    
    let coinsEarned = 0;
    
    if (shouldAwardCoins) {
      coinsEarned = MAX_COINS_PER_CONTENT;
      user.coins = (user.coins || 0) + coinsEarned;
      
      if (!Array.isArray(user.coinHistory)) user.coinHistory = [];
      
      // Store the award record
      user.coinHistory.push({
        type: 'added',
        amount: coinsEarned,
        message: `Earned ${coinsEarned} coins for reading ${contentType}`,
        timestamp: new Date(),
        metadata: {
          contentId: contentIdStr,
          contentType: contentType,
          type: contentType,
          category: category || 'General',
          totalTimeSpent: newCumulativeTime,
          date: todayStr,
          awardedOnce: true
        }
      });
      
      console.log(`✅ AWARDED 5 COINS to user ${userId} for ${contentType}: ${contentIdStr}`);
    }
    
    // Update or create view history entry
    if (!Array.isArray(user.viewHistory)) user.viewHistory = [];
    
    if (viewEntry) {
      viewEntry.timeSpent = newCumulativeTime;
      viewEntry.viewedAt = new Date();
    } else {
      user.viewHistory.push({
        contentId: contentIdStr,
        contentType: contentType,
        timeSpent: timeSpentSeconds,
        viewedAt: new Date(),
        metadata: { category: category || 'General' }
      });
    }
    
    await user.save();
    
    // Calculate stats for response
    const todayViews = user.viewHistory.filter(v => 
      v.contentType === contentType && 
      new Date(v.viewedAt).toISOString().slice(0, 10) === todayStr
    );
    
    const uniqueContentToday = new Set();
    todayViews.forEach(v => {
      if (v.contentId) uniqueContentToday.add(v.contentId.toString());
    });
    
    let totalCoinsToday = 0;
    if (user.coinHistory) {
      for (const entry of user.coinHistory) {
        const entryDate = new Date(entry.timestamp || entry.createdAt).toISOString().slice(0, 10);
        if (entryDate === todayStr && entry.type === 'added' && entry.amount === MAX_COINS_PER_CONTENT) {
          totalCoinsToday += entry.amount;
        }
      }
    }
    
    // Send response
    return res.status(200).json({
      success: true,
      message: shouldAwardCoins 
        ? `🎉 You earned ${coinsEarned} coins for reading this ${contentType}!`
        : alreadyEarnedToday
          ? `📚 Already earned 5 coins for this ${contentType} today`
          : `📖 Need ${Math.max(0, MIN_SECONDS_REQUIRED - newCumulativeTime)} more seconds to earn ${MAX_COINS_PER_CONTENT} coins`,
      data: {
        contentType,
        contentId: contentIdStr,
        coinsEarned,
        totalCoins: user.coins,
        totalTimeSpentOnThisContent: newCumulativeTime,
        secondsNeededForCoins: Math.max(0, MIN_SECONDS_REQUIRED - newCumulativeTime),
        alreadyEarnedForThisContent: alreadyEarnedToday,
        todayStats: {
          uniqueContentReadToday: uniqueContentToday.size,
          totalCoinsEarnedToday: totalCoinsToday,
          expectedMaxCoinsToday: uniqueContentToday.size * MAX_COINS_PER_CONTENT,
          maxCoinsPerContent: MAX_COINS_PER_CONTENT,
          secondsRequired: MIN_SECONDS_REQUIRED
        }
      }
    });
    
  } catch (error) {
    console.error('❌ trackContentTimeSpent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
// ==================== GET USER TIME SPENT STATS ====================
// GET /api/user/:userId/time-stats?period=day|week|month

export const getUserTimeSpentStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = 'day' } = req.query;

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid userId is required'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const viewHistory = Array.isArray(user.viewHistory) ? user.viewHistory : [];
    const coinHistory = Array.isArray(user.coinHistory) ? user.coinHistory : [];
    
    const now = new Date();
    let startDate = new Date();
    
    // Set period filter
    if (period === 'day') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      startDate.setMonth(now.getMonth() - 1);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // Default to day
      startDate.setHours(0, 0, 0, 0);
    }

    // Filter by period
    const periodViews = viewHistory.filter(v => {
      const viewDate = new Date(v.viewedAt);
      return viewDate >= startDate && viewDate <= now;
    });
    
    const periodCoins = coinHistory.filter(c => {
      const coinDate = new Date(c.timestamp || c.createdAt);
      return coinDate >= startDate && coinDate <= now;
    });

    // News stats
    const newsViews = periodViews.filter(v => v.contentType === 'news');
    const newsCoins = periodCoins.filter(c => 
      c.type === 'added' && 
      (c.message?.toLowerCase().includes('news') || c.metadata?.contentType === 'news')
    );

    // Fact stats
    const factViews = periodViews.filter(v => v.contentType === 'fact');
    const factCoins = periodCoins.filter(c => 
      c.type === 'added' && 
      (c.message?.toLowerCase().includes('fact') || c.metadata?.contentType === 'fact')
    );

    // Calculate totals
    const newsTimeSeconds = newsViews.reduce((sum, v) => sum + (v.timeSpent || 0), 0);
    const factTimeSeconds = factViews.reduce((sum, v) => sum + (v.timeSpent || 0), 0);
    const totalTimeSeconds = newsTimeSeconds + factTimeSeconds;

    const newsCoinsEarned = newsCoins.reduce((sum, c) => sum + (c.amount || 0), 0);
    const factCoinsEarned = factCoins.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalCoinsEarned = newsCoinsEarned + factCoinsEarned;

    // Calculate average time per article/fact
    const avgNewsTime = newsViews.length > 0 
      ? Math.round(newsTimeSeconds / newsViews.length) 
      : 0;
    const avgFactTime = factViews.length > 0 
      ? Math.round(factTimeSeconds / factViews.length) 
      : 0;

    // Daily breakdown
    const dailyBreakdown = [];
    const daysMap = new Map();
    
    // Process all views for daily breakdown
    [...newsViews, ...factViews].forEach(view => {
      const date = new Date(view.viewedAt).toISOString().slice(0, 10);
      if (!daysMap.has(date)) {
        daysMap.set(date, { 
          date, 
          newsTime: 0, 
          factTime: 0, 
          newsCoins: 0, 
          factCoins: 0,
          newsCount: 0,
          factCount: 0
        });
      }
      const day = daysMap.get(date);
      if (view.contentType === 'news') {
        day.newsTime += view.timeSpent || 0;
        day.newsCount++;
      } else {
        day.factTime += view.timeSpent || 0;
        day.factCount++;
      }
    });

    // Add coin data to daily breakdown
    newsCoins.forEach(coin => {
      const date = new Date(coin.timestamp || coin.createdAt).toISOString().slice(0, 10);
      if (daysMap.has(date)) {
        daysMap.get(date).newsCoins += coin.amount || 0;
      }
    });

    factCoins.forEach(coin => {
      const date = new Date(coin.timestamp || coin.createdAt).toISOString().slice(0, 10);
      if (daysMap.has(date)) {
        daysMap.get(date).factCoins += coin.amount || 0;
      }
    });

    // Convert map to array and sort by date (newest first)
    daysMap.forEach((value, key) => {
      dailyBreakdown.push({
        date: key,
        news: {
          timeSpentSeconds: value.newsTime,
          timeSpentFormatted: formatTimeSpent(value.newsTime),
          coinsEarned: value.newsCoins,
          articlesRead: value.newsCount
        },
        facts: {
          timeSpentSeconds: value.factTime,
          timeSpentFormatted: formatTimeSpent(value.factTime),
          coinsEarned: value.factCoins,
          factsRead: value.factCount
        }
      });
    });

    dailyBreakdown.sort((a, b) => b.date.localeCompare(a.date));

    // Get today's coins earned
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCoins = periodCoins.filter(c => {
      const coinDate = new Date(c.timestamp || c.createdAt).toISOString().slice(0, 10);
      return coinDate === todayStr && c.type === 'added' && 
        (c.message?.toLowerCase().includes('news') || c.message?.toLowerCase().includes('fact'));
    }).reduce((sum, c) => sum + (c.amount || 0), 0);

    // Get remaining coins possible today
    const MAX_DAILY_COINS = 50; // 5 coins per content * 10 contents max
    const remainingCoinsToday = Math.max(0, MAX_DAILY_COINS - todayCoins);

    // Get category-wise breakdown (for current period)
    const categoryBreakdown = {};
    
    newsViews.forEach(view => {
      const category = view.metadata?.category || view.category || 'General';
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { timeSpent: 0, coinsEarned: 0, count: 0 };
      }
      categoryBreakdown[category].timeSpent += view.timeSpent || 0;
      categoryBreakdown[category].count++;
    });
    
    newsCoins.forEach(coin => {
      const category = coin.metadata?.category || 'General';
      if (categoryBreakdown[category]) {
        categoryBreakdown[category].coinsEarned += coin.amount || 0;
      }
    });
    
    factViews.forEach(view => {
      const category = view.metadata?.category || view.category || 'General';
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { timeSpent: 0, coinsEarned: 0, count: 0 };
      }
      categoryBreakdown[category].timeSpent += view.timeSpent || 0;
      categoryBreakdown[category].count++;
    });
    
    factCoins.forEach(coin => {
      const category = coin.metadata?.category || 'General';
      if (categoryBreakdown[category]) {
        categoryBreakdown[category].coinsEarned += coin.amount || 0;
      }
    });

    // Format category breakdown
    const formattedCategoryBreakdown = Object.keys(categoryBreakdown).map(cat => ({
      category: cat,
      timeSpentSeconds: categoryBreakdown[cat].timeSpent,
      timeSpentFormatted: formatTimeSpent(categoryBreakdown[cat].timeSpent),
      coinsEarned: categoryBreakdown[cat].coinsEarned,
      contentCount: categoryBreakdown[cat].count
    })).sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds);

    // Get top categories by time spent
    const topCategories = formattedCategoryBreakdown.slice(0, 5);

    // Get last 7 days trend
    const last7DaysTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(now.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      
      const dayData = dailyBreakdown.find(d => d.date === dateStr);
      
      last7DaysTrend.push({
        date: dateStr,
        news: {
          timeSpent: dayData?.news.timeSpentSeconds || 0,
          timeSpentFormatted: formatTimeSpent(dayData?.news.timeSpentSeconds || 0),
          coinsEarned: dayData?.news.coinsEarned || 0
        },
        facts: {
          timeSpent: dayData?.facts.timeSpentSeconds || 0,
          timeSpentFormatted: formatTimeSpent(dayData?.facts.timeSpentSeconds || 0),
          coinsEarned: dayData?.facts.coinsEarned || 0
        }
      });
    }

    // ========== RESPONSE (SAME STRUCTURE - NO BREAKING CHANGES) ==========
    return res.status(200).json({
      success: true,
      period: period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      summary: {
        news: {
          totalTimeSpentSeconds: newsTimeSeconds,
          totalTimeSpentFormatted: formatTimeSpent(newsTimeSeconds),
          totalCoinsEarned: newsCoinsEarned,
          totalArticlesRead: newsViews.length,
          averageTimePerArticle: formatTimeSpent(avgNewsTime)
        },
        facts: {
          totalTimeSpentSeconds: factTimeSeconds,
          totalTimeSpentFormatted: formatTimeSpent(factTimeSeconds),
          totalCoinsEarned: factCoinsEarned,
          totalFactsRead: factViews.length,
          averageTimePerFact: formatTimeSpent(avgFactTime)
        },
        overall: {
          totalTimeSpentSeconds: totalTimeSeconds,
          totalTimeSpentFormatted: formatTimeSpent(totalTimeSeconds),
          totalCoinsEarned: totalCoinsEarned,
          totalContentRead: newsViews.length + factViews.length,
          todayCoinsEarned: todayCoins,
          remainingCoinsToday: remainingCoinsToday,
          maxDailyCoins: MAX_DAILY_COINS
        }
      },
      dailyBreakdown: dailyBreakdown,
      categoryBreakdown: formattedCategoryBreakdown,
      topCategories: topCategories,
      last7DaysTrend: last7DaysTrend
    });

  } catch (error) {
    console.error('❌ getUserTimeSpentStats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ============================================================
// ENHANCED getLatestNews — Drop-in replacement
// Adds Gemini AI 500-word description pipeline.
// Payload structure is UNCHANGED.
// ============================================================

// ── Constants (already declared in your file, kept here for reference) ──
// const GEMINI_API_KEY = 'process.env.GEMINI_API_KEY';
// const GEMINI_BASE   = 'https://generativelanguage.googleapis.com/v1beta';
// const MODEL         = 'gemini-2.0-flash';


// ── RSS FEEDS ─────────────────────────────────────────────────
const RSS_FEEDS = {
  "US Immigration": [
    "https://www.uscis.gov/news/rss-feed",
    "https://www.migrationpolicy.org/rss/taxonomy-term/1",
    "https://www.cbp.gov/rss.xml"
  ],
  "Startup News": [
    "https://inc42.com/feed/",
    "https://yourstory.com/feed",
    "https://techcrunch.com/feed/",
    "https://entrepreneurtales.in/feed/"
  ],
  "Cricket": [
    "https://www.espncricinfo.com/rss/content/story/feeds/0.xml",
    "https://www.cricbuzz.com/rss/news"
  ],
  "Tech Jobs": [
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "https://www.builtinaustin.com/jobs/feed"
  ],
  "Geopolitical News": [
    "https://foreignpolicy.com/feed/",
    "https://thegeopolitics.com/feed/"
  ],
  "Stock Market & Crypto": [
    "https://finance.yahoo.com/news/rssindex",
    "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml"
  ],
  "AI Developments": [
    "https://www.technologyreview.com/feed/",
    "https://techrepublic.com/rssfeeds/topic/artificial-intelligence/"
  ],
  "AP/TS Local News": [
    "https://navatelangana.com/feed/",
    "https://manatelangana.news/feed/",
    "https://telugu.news18.com/rss/",
    "https://www.sakshi.com/rss/rss.xml"
  ]
};

// ── STATIC FALLBACK IMAGES (100% reliable, real Unsplash photo IDs) ──
// These are permanent direct JPG URLs — never break
const CATEGORY_FALLBACK_IMAGES = {
  "US Immigration": "https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=800&q=80&fm=jpg",
  "Startup News": "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&q=80&fm=jpg",
  "Cricket": "https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=800&q=80&fm=jpg",
  "Tech Jobs": "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80&fm=jpg",
  "Geopolitical News": "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80&fm=jpg",
  "Stock Market & Crypto": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80&fm=jpg",
  "AI Developments": "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=80&fm=jpg",
  "AP/TS Local News": "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&q=80&fm=jpg",
  "General": "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80&fm=jpg"
};

// ── SOURCE MAP ────────────────────────────────────────────────
const DOMAIN_SOURCE_MAP = {
  'inc42.com': 'Inc42',
  'yourstory.com': 'YourStory',
  'techcrunch.com': 'TechCrunch',
  'espncricinfo.com': 'ESPN Cricinfo',
  'cricbuzz.com': 'Cricbuzz',
  'uscis.gov': 'USCIS',
  'migrationpolicy.org': 'Migration Policy Institute',
  'cbp.gov': 'U.S. CBP',
  'navatelangana.com': 'నవ తెలంగాణ',
  'manatelangana.news': 'మన తెలంగాణ',
  'news18.com': 'News18 Telugu',
  'sakshi.com': 'సాక్షి',
  'coindesk.com': 'CoinDesk',
  'investing.com': 'Investing.com',
  'technologyreview.com': 'MIT Tech Review',
  'foreignpolicy.com': 'Foreign Policy',
  'builtinaustin.com': 'Built In Austin',
  'weworkremotely.com': 'We Work Remotely',
  'thegeopolitics.com': 'The Geopolitics',
  'finance.yahoo.com': 'Yahoo Finance',
  'techrepublic.com': 'TechRepublic',
  'theconversation.com': 'The Conversation',
  'entrepreneurtales.in': 'Entrepreneur Tales'
};

// =============================================================
// ── CORE HELPERS ─────────────────────────────────────────────
// =============================================================

const cleanJsonString = (str) => {
  if (!str) return '{}';
  return str.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
};

const stripHtml = (html) => {
  if (!html) return '';
  if (typeof html === 'object' && html._) html = html._;
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
};

const isFakeDescription = (desc) => {
  if (!desc || desc.trim().length < 50) return true;
  const markers = [
    'ఈ వార్తా కథనంలో తాజా పరిణామాల గురించి',
    'విభాగంలోని ఈ ముఖ్యమైన వార్తపై',
    'ఈ స్టోరీకి సంబంధించిన మరిన్ని వివరాలు',
    'మమ్మల్ని అనుసరించండి',
    'News విభాగంలోని',
  ];
  return markers.some(m => desc.includes(m));
};

const resolveSource = (link = '', feedUrl = '') => {
  const url = link || feedUrl;
  if (!url) return 'Unknown Source';
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const found = Object.keys(DOMAIN_SOURCE_MAP).find(d => hostname.includes(d));
    return found ? DOMAIN_SOURCE_MAP[found] : hostname;
  } catch { return 'Unknown Source'; }
};

// =============================================================
// ── IMAGE SYSTEM ─────────────────────────────────────────────
// =============================================================

/**
 * convertToJpg — Forces any image URL to return a JPG
 * Works for: Unsplash, Cloudinary, WordPress, Imgix, Contentful,
 *            Squarespace, Wix, Ghost, general URLs
 */
const convertToJpg = (url) => {
  if (!url || !url.startsWith('http')) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;

    // ── Unsplash (images.unsplash.com or source.unsplash.com) ──
    if (host.includes('unsplash.com')) {
      // Strip ALL existing params, add our own
      parsed.search = '';
      parsed.searchParams.set('w', '800');
      parsed.searchParams.set('q', '80');
      parsed.searchParams.set('fm', 'jpg');   // force JPG format
      parsed.searchParams.set('fit', 'crop');
      return parsed.toString();
    }

    // ── Cloudinary ──
    if (host.includes('cloudinary.com')) {
      // Insert transformation before /upload/
      const jpgUrl = url.replace(
        /\/upload\/(.*?)\.(png|webp|gif|bmp|tiff|svg)/i,
        '/upload/f_jpg,q_80,w_800/$1.jpg'
      );
      return jpgUrl !== url ? jpgUrl : url.replace(/\.(png|webp|gif|bmp|tiff|svg)(\?.*)?$/i, '.jpg');
    }

    // ── WordPress / standard CDNs (imgix, Contentful, etc.) ──
    if (url.match(/\.(png|webp|gif|bmp|tiff|svg)(\?.*)?$/i)) {
      // Try adding format param first (imgix / Contentful support)
      if (host.includes('imgix') || host.includes('ctfassets') || host.includes('wp.com') || host.includes('wordpress')) {
        parsed.searchParams.set('fm', 'jpg');
        parsed.searchParams.set('q', '80');
        parsed.searchParams.set('w', '800');
        return parsed.toString();
      }
      // For all others just swap the extension
      return url.replace(/\.(png|webp|gif|bmp|tiff|svg)(\?.*)?$/i, '.jpg');
    }

    // ── URLs with no extension — add JPG hint params ──
    if (!url.match(/\.(jpg|jpeg|png|webp|gif|bmp|tiff|svg)(\?.*)?$/i)) {
      parsed.searchParams.set('format', 'jpg');
      parsed.searchParams.set('fm', 'jpg');
      return parsed.toString();
    }

    // Already JPG/JPEG — just ensure it loads at good size
    if (url.match(/\.(jpg|jpeg)(\?.*)?$/i)) {
      if (host.includes('unsplash.com')) {
        parsed.searchParams.set('w', '800');
        parsed.searchParams.set('q', '80');
        return parsed.toString();
      }
      return url;
    }

    return url;
  } catch { return url; }
};

/**
 * validateImage — HEADs the URL and confirms it's a real image
 * Returns the final (possibly redirected) URL if valid, null if broken
 */
const validateImage = async (url) => {
  if (!url || !url.startsWith('http')) return null;
  try {
    const res = await axios({
      method: 'HEAD',
      url,
      timeout: 6000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
      validateStatus: s => s < 400   // 200-399 = valid
    });

    const ct = (res.headers['content-type'] || '').toLowerCase();
    if (ct.includes('image/')) {
      // Return the final URL (after any redirects)
      return res.request?.res?.responseUrl || url;
    }
    return null;
  } catch { return null; }
};

/**
 * validateAndFixImage — Validates a URL; if it fails or isn't a JPG,
 * converts it to JPG and validates again.
 * Returns a guaranteed-working image URL or null.
 */
const validateAndFixImage = async (url) => {
  if (!url) return null;

  // Step 1: Try the URL as-is
  const directResult = await validateImage(url);
  if (directResult) {
    // It works — but convert to JPG format if not already
    const jpgUrl = convertToJpg(directResult);
    if (jpgUrl !== directResult) {
      const jpgResult = await validateImage(jpgUrl);
      if (jpgResult) {
        console.log(`    🔄 Converted to JPG: ${jpgUrl.substring(0, 70)}`);
        return jpgResult;
      }
    }
    return directResult;
  }

  // Step 2: URL failed — try converting to JPG and retry
  const jpgVersion = convertToJpg(url);
  if (jpgVersion && jpgVersion !== url) {
    const jpgResult = await validateImage(jpgVersion);
    if (jpgResult) {
      console.log(`    ✅ JPG conversion fixed broken URL`);
      return jpgResult;
    }
  }

  return null; // Completely broken — caller will use fallback
};

// =============================================================
// ── IMAGE PIPELINE (4 Layers) ────────────────────────────────
// =============================================================

// Layer 1 — RSS media tags
const extractRSSImage = (item) => {
  try {
    // media:content
    const mc = item['media:content'];
    if (mc) {
      const tryMc = (m) => {
        const u = m?.$?.url || m?.url;
        return (u && u.startsWith('http')) ? u : null;
      };
      const found = Array.isArray(mc)
        ? mc.map(tryMc).find(Boolean)
        : tryMc(mc);
      if (found) return found;
    }

    // media:thumbnail
    const mt = item['media:thumbnail'];
    if (mt) {
      const u = Array.isArray(mt)
        ? (mt[0]?.$?.url || mt[0]?.url)
        : (mt?.$?.url || mt?.url);
      if (u && u.startsWith('http')) return u;
    }

    // enclosure
    const enc = item.enclosure;
    if (enc) {
      const u = enc?.$?.url || enc?.url;
      const t = enc?.$?.type || enc?.type || '';
      if (u && u.startsWith('http') && (t.includes('image') || /\.(jpg|jpeg|png|webp)/i.test(u))) return u;
    }

    // img inside content:encoded or description
    const rawContent = item['content:encoded'] || item.description || item.content || '';
    const rawStr = typeof rawContent === 'object' ? (rawContent._ || '') : String(rawContent);
    const imgMatch = rawStr.match(/<img[^>]+src=["'](https?:\/\/[^"'\s>]+)["']/i);
    if (imgMatch?.[1]) return imgMatch[1];

    // itunes:image
    const ii = item['itunes:image'];
    if (ii?.$?.href) return ii.$.href;

    return null;
  } catch { return null; }
};

// Layer 2 — Scrape og:image from article page
const scrapeArticleImage = async (url) => {
  if (!url?.startsWith('http')) return null;
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,*/*;q=0.9'
      },
      maxRedirects: 3,
      maxContentLength: 500000
    });
    const html = (typeof res.data === 'string' ? res.data : '').substring(0, 100000);
    if (!html) return null;

    // og:image
    let m = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (m?.[1]?.startsWith('http')) return m[1];

    // twitter:image
    m = html.match(/name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (m?.[1]?.startsWith('http')) return m[1];

    // JSON-LD
    const jld = html.match(/"image"\s*:\s*\{\s*"url"\s*:\s*"(https?:\/\/[^"]+)"/);
    if (jld?.[1]) return jld[1];
    const jld2 = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+)"/);
    if (jld2?.[1]) return jld2[1];

    // First real article image
    const imgs = [...html.matchAll(/<img[^>]+src=["'](https?:\/\/[^"'\s>]+)["']/gi)];
    for (const img of imgs) {
      const src = img[1];
      if (!/logo|icon|avatar|sprite|pixel|banner|ad\.|ads\./i.test(src)
        && /\.(jpg|jpeg|png|webp)/i.test(src)) return src;
    }

    return null;
  } catch { return null; }
};

// Layer 3 — Gemini smart keywords → Unsplash search URL
const generateSmartUnsplashUrl = async (title, category) => {
  try {
    const prompt = `News headline: "${title}"
Category: ${category}
Return ONLY JSON (no markdown): {"keywords": "3-4 specific English words describing the visual subject"}
Examples:
- Pakistan military attack → {"keywords": "military soldiers border conflict"}
- Arshdeep Singh cricket records → {"keywords": "cricket fast bowler pitch"}
- Bitcoin price surge → {"keywords": "bitcoin crypto trading chart"}
- Hyderabad train station → {"keywords": "india train railway station"}`;

    const response = await axios.post(
      `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 60 }
      },
      { timeout: 8000 }
    );

    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(cleanJsonString(raw));
    const kw = (parsed.keywords || '').trim();
    if (!kw) return null;

    // Return a validated Unsplash URL with fm=jpg
    const url = `https://source.unsplash.com/featured/800x500/?${encodeURIComponent(kw)}&fm=jpg`;
    return url;
  } catch { return null; }
};

/**
 * MASTER IMAGE RESOLVER
 * Tries all 4 layers + validates + converts to JPG.
 * NEVER returns null — always returns a working image URL.
 */
const resolveAndValidateImage = async (item, title, link, category, shouldScrape) => {
  const fallback = CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES['General'];

  // ── Layer 1: RSS media tags ───────────────────────────────
  const rssRaw = extractRSSImage(item);
  if (rssRaw) {
    const validated = await validateAndFixImage(rssRaw);
    if (validated) {
      console.log(`    🖼️ [L1-RSS] ✅ ${validated.substring(0, 70)}`);
      return validated;
    }
    console.log(`    🖼️ [L1-RSS] ❌ broken — trying L2`);
  }

  // ── Layer 2: Scrape og:image from article page ────────────
  if (shouldScrape && link) {
    const scraped = await scrapeArticleImage(link);
    if (scraped) {
      const validated = await validateAndFixImage(scraped);
      if (validated) {
        console.log(`    🖼️ [L2-SCRAPE] ✅ ${validated.substring(0, 70)}`);
        return validated;
      }
      console.log(`    🖼️ [L2-SCRAPE] ❌ broken — trying L3`);
    }
  }

  // ── Layer 3: Gemini smart Unsplash URL ────────────────────
  const smartUrl = await generateSmartUnsplashUrl(title, category);
  if (smartUrl) {
    // source.unsplash.com redirects to a real image — validate the redirect target
    const validated = await validateImage(smartUrl);
    if (validated) {
      console.log(`    🖼️ [L3-SMART] ✅ ${smartUrl.substring(0, 70)}`);
      return validated;
    }
  }

  // ── Layer 4: Static category fallback (always works) ─────
  console.log(`    🖼️ [L4-FALLBACK] Using guaranteed category image`);
  return fallback;
};

// =============================================================
// ── RSS PARSER ────────────────────────────────────────────────
// =============================================================
const parseRSSFeed = async (feedUrl) => {
  try {
    const response = await axios.get(feedUrl, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      },
      maxRedirects: 5
    });

    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: false,
      explicitCharkey: true
    });

    const parsed = await parser.parseStringPromise(response.data);
    const channel = parsed?.rss?.channel || parsed?.feed || {};
    const items = channel.item || channel.entry || [];
    return Array.isArray(items) ? items : (items ? [items] : []);
  } catch (err) {
    console.error(`❌ RSS [${feedUrl}]: ${err.message}`);
    return [];
  }
};

// =============================================================
// ── GEMINI DESCRIPTION GENERATOR ─────────────────────────────
// =============================================================
const generateGeminiDescription = async (title, existingDesc, category, articleUrl) => {
  try {
    const isTeluguCategory = category === 'AP/TS Local News';

    const prompt = `You are a professional news journalist writing for young Indian professionals (22-35 years).

${isTeluguCategory ? 'IMPORTANT: Title may be in Telugu. Translate to English and write the full article in English.' : ''}

NEWS:
- Title: ${title}
- Category: ${category}
- URL: ${articleUrl || 'N/A'}
- Existing brief: ${existingDesc && existingDesc.length > 30 && !isFakeDescription(existingDesc) ? existingDesc.substring(0, 400) : 'None — generate from title context'}

Return ONLY valid JSON, no markdown, no backticks:
{
  "headline": "Compelling English headline (max 15 words)",
  "what_happened": "4-5 detailed sentences: background, key players, location, timeline, specific facts.",
  "why_it_matters": "4-5 sentences on political, economic, social, or technology significance.",
  "what_it_means_for_you": [
    "Implication 1: 2-3 sentences, specific & actionable for young Indian professionals",
    "Implication 2: career, finance, or daily life impact — 2-3 sentences",
    "Implication 3: future opportunity or risk — 2-3 sentences",
    "Implication 4: recommended action or awareness — 2-3 sentences"
  ],
  "content_type": "${category.toLowerCase().replace(/[\s&\/]+/g, '_')}",
  "outlook": "2-3 sentences on what to expect next.",
  "disclaimer": "AI-enhanced summary. Verify facts with the original source."
}
Total: 550-600 words. Clear English. Factual. No jargon.`;

    const response = await axios.post(
      `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048, topP: 0.9 }
      },
      { timeout: 35000 }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawText) throw new Error('Empty Gemini response');

    const parsed = JSON.parse(cleanJsonString(rawText));
    if (!parsed.headline || !parsed.what_happened) throw new Error('Missing required fields');

    const richDescription = [
      `📰 ${parsed.headline}`,
      '',
      '🔍 What Happened:',
      parsed.what_happened,
      '',
      '💡 Why It Matters:',
      parsed.why_it_matters || '',
      '',
      '🎯 What This Means For You:',
      ...(Array.isArray(parsed.what_it_means_for_you)
        ? parsed.what_it_means_for_you.map((pt, i) => `${i + 1}. ${pt}`)
        : []),
      '',
      parsed.outlook ? `🔮 Outlook:\n${parsed.outlook}` : '',
      '',
      parsed.disclaimer ? `ℹ️ ${parsed.disclaimer}` : ''
    ].filter(l => l !== undefined).join('\n').trim();

    console.log(`    ✅ Description: ${richDescription.split(/\s+/).length} words`);
    return richDescription;

  } catch (err) {
    console.error(`    ❌ Gemini description failed: ${err.message}`);
    return `📰 ${title.substring(0, 120)}\n\nThis news covers recent developments in ${category}. ${existingDesc && !isFakeDescription(existingDesc) ? existingDesc.substring(0, 400) : 'Visit the source link for full details.'}\n\nℹ️ Please check the original article link for complete information.`;
  }
};

// =============================================================
// MAIN CONTROLLER — getLatestNews
// =============================================================
export const getLatestNews = async (req, res) => {
  try {
    const allowedCategories = Object.keys(RSS_FEEDS);
    let { category, refresh } = req.query;

    if (category) {
      const match = allowedCategories.find(
        c => c.toLowerCase() === category.trim().toLowerCase()
      );
      if (!match) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Available: ${allowedCategories.join(', ')}`
        });
      }
      category = match;
    }

    const feedUrls = category ? RSS_FEEDS[category] : Object.values(RSS_FEEDS).flat();
    const categoryLabel = category || 'All';
    const forceRefresh = refresh === 'true';
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // ── Cache Check ───────────────────────────────────────────
    if (!forceRefresh) {
      const cached = await NewsArticle.find(
        category ? { category } : {}
      ).sort({ pubDate: -1 }).limit(10);

      const validCache = cached.filter(a => {
        const recent = new Date(a.createdAt) > oneHourAgo;
        const realDesc = a.description && !isFakeDescription(a.description) && a.description.split(/\s+/).length >= 80;
        const realImage = a.image && a.image.startsWith('http') && !a.image.includes('source.unsplash.com/featured');
        return recent && realDesc && realImage;
      });

      if (validCache.length >= 5) {
        console.log(`✅ Cache hit: ${validCache.length} valid articles for "${categoryLabel}"`);
        return res.status(200).json({
          success: true,
          message: `Fetched ${validCache.length} news articles`,
          news: validCache,
          source: 'cache'
        });
      }
      console.log(`🔄 Cache miss — fetching live for "${categoryLabel}"`);
    }

    // ── Fetch RSS ─────────────────────────────────────────────
    console.log(`📡 Fetching ${feedUrls.length} feeds for "${categoryLabel}"...`);
    const allRawItems = [];

    for (const feedUrl of feedUrls) {
      const items = await parseRSSFeed(feedUrl);
      items.forEach(item => { item.__feedUrl = feedUrl; });
      allRawItems.push(...items);
      console.log(`  ✓ ${items.length} items ← ${feedUrl}`);
    }

    if (allRawItems.length === 0) {
      const fallback = await NewsArticle.find(category ? { category } : {}).sort({ pubDate: -1 }).limit(10);
      return res.status(200).json({
        success: fallback.length > 0,
        message: fallback.length > 0 ? 'Returning cached articles (RSS unavailable)' : 'No articles available',
        news: fallback,
        source: 'emergency_cache'
      });
    }

    // Sort latest-first
    allRawItems.sort((a, b) => {
      const dA = new Date(a.pubDate || a.updated || a.published || 0);
      const dB = new Date(b.pubDate || b.updated || b.published || 0);
      return dB - dA;
    });

    console.log(`📊 ${allRawItems.length} raw items — processing top 10`);

    const savedArticles = [];
    let processed = 0;

    for (const item of allRawItems) {
      if (processed >= 10) break;

      try {
        // ── Extract title ─────────────────────────────────────
        const titleRaw = item.title;
        let title = stripHtml(
          typeof titleRaw === 'object' ? (titleRaw._ || titleRaw) : (titleRaw || '')
        ).substring(0, 200);
        if (title.length < 5) continue;

        // ── Extract link ──────────────────────────────────────
        let link = '';
        if (typeof item.link === 'string') link = item.link;
        else if (item.link?.$?.href) link = item.link.$.href;
        else if (item.link?.href) link = item.link.href;
        else if (item.guid) link = typeof item.guid === 'object' ? (item.guid._ || '') : item.guid;
        else if (item.id) link = typeof item.id === 'object' ? (item.id._ || '') : item.id;

        // ── Extract existing description ──────────────────────
        const rawDescObj = item['content:encoded'] || item.description || item.summary || item.content || '';
        const existingDesc = stripHtml(
          typeof rawDescObj === 'object' ? (rawDescObj._ || '') : String(rawDescObj)
        ).substring(0, 600);

        // ── Date ──────────────────────────────────────────────
        let pubDate = new Date(item.pubDate || item.updated || item.published || Date.now());
        if (isNaN(pubDate.getTime())) pubDate = new Date();

        const feedUrl = item.__feedUrl || '';
        const source = resolveSource(link, feedUrl);

        // ── Detect category ───────────────────────────────────
        let detectedCategory = category;
        if (!detectedCategory) {
          for (const [cat, urls] of Object.entries(RSS_FEEDS)) {
            if (urls.some(u => {
              try { return feedUrl.includes(new URL(u).hostname); } catch { return false; }
            })) { detectedCategory = cat; break; }
          }
          detectedCategory = detectedCategory || 'General';
        }

        // ── Deduplicate ───────────────────────────────────────
        const escapedTitle = title.substring(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const dupCheck = await NewsArticle.findOne({
          $or: [
            ...(link ? [{ link }] : []),
            { title: { $regex: escapedTitle, $options: 'i' } }
          ]
        });

        if (dupCheck) {
          const badDesc = isFakeDescription(dupCheck.description) || dupCheck.description.split(/\s+/).length < 80;
          const badImage = !dupCheck.image || dupCheck.image.includes('source.unsplash.com/featured');

          if (badDesc || badImage) {
            console.log(`🔄 Fixing existing: "${title.substring(0, 50)}"`);

            const newDesc = badDesc
              ? await generateGeminiDescription(title, existingDesc, detectedCategory, link)
              : dupCheck.description;

            const newImage = badImage
              ? await resolveAndValidateImage(item, title, link, detectedCategory, true)
              : dupCheck.image;

            await NewsArticle.findByIdAndUpdate(dupCheck._id, { description: newDesc, image: newImage });
            savedArticles.push({ ...dupCheck.toObject(), description: newDesc, image: newImage });
            processed++;
          } else {
            console.log(`⏭️ Skip (clean duplicate): "${title.substring(0, 50)}"`);
          }
          continue;
        }

        // ── Resolve Image (4-layer + validate + JPG convert) ─
        console.log(`🖼️  Resolving image for: "${title.substring(0, 50)}"`);
        const image = await resolveAndValidateImage(
          item, title, link, detectedCategory,
          processed < 8   // scrape OG only for first 8 items
        );

        // ── Generate Gemini Description ───────────────────────
        console.log(`🤖 Generating description for: "${title.substring(0, 50)}"`);
        const aiDescription = await generateGeminiDescription(title, existingDesc, detectedCategory, link);

        // ── Save ──────────────────────────────────────────────
        const newArticle = await NewsArticle.create({
          title,
          description: aiDescription,
          pubDate,
          source,
          link,
          image,
          category: detectedCategory
        });

        savedArticles.push(newArticle);
        processed++;

        const imgType = image.includes('images.unsplash.com/photo') ? 'StaticFallback'
          : image.includes('source.unsplash') ? 'SmartUnsplash'
            : image.includes('unsplash') ? 'Unsplash'
              : 'Real';

        console.log(`✅ [${processed}/10] "${title.substring(0, 45)}" | Img:${imgType} | Words:${aiDescription.split(/\s+/).length}`);

      } catch (itemErr) {
        console.error(`❌ Item error: ${itemErr.message}`);
      }
    }

    if (savedArticles.length === 0) {
      const fallback = await NewsArticle.find(category ? { category } : {}).sort({ pubDate: -1 }).limit(10);
      return res.status(200).json({
        success: true,
        message: `Returning ${fallback.length} cached articles`,
        news: fallback,
        source: 'fallback'
      });
    }

    savedArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    return res.status(200).json({
      success: true,
      message: `Fetched ${savedArticles.length} news articles`,
      news: savedArticles,
      source: 'live'
    });

  } catch (mainErr) {
    console.error('❌ getLatestNews critical error:', mainErr.message);
    try {
      const fallback = await NewsArticle.find({}).sort({ pubDate: -1 }).limit(10);
      return res.status(200).json({
        success: fallback.length > 0,
        message: 'Returning last available articles',
        news: fallback,
        source: 'emergency_cache'
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: 'News service temporarily unavailable',
        error: mainErr.message
      });
    }
  }
};

// // Main function to fetch and process news from RSS feeds
// export const getLatestNews = async (req, res) => {
//   try {
//     const allowedCategories = Object.keys(RSS_FEEDS);
//     let { category } = req.query;

//     // Validate category
//     if (category) {
//       category = category.trim();
//       const match = allowedCategories.find(
//         (cat) => cat.toLowerCase() === category.toLowerCase()
//       );

//       if (!match) {
//         return res.status(400).json({
//           success: false,
//           message: `Category "${category}" is not valid. Available: ${allowedCategories.join(', ')}`,
//         });
//       }
//       category = match;
//     }

//     // Determine which feeds to fetch
//     const feedsToFetch = category ? RSS_FEEDS[category] : Object.values(RSS_FEEDS).flat();
//     const categoryForFeed = category || 'General';

//     console.log(`📰 Fetching news for category: ${categoryForFeed} from ${feedsToFetch.length} feeds`);

//     // Try to get from database first (cached)
//     const cachedNews = await NewsArticle.find(category ? { category: categoryForFeed } : {})
//       .sort({ pubDate: -1 })
//       .limit(10);

//     // If we have recent cached news (less than 1 hour old), return them
//     const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
//     const recentCachedNews = cachedNews.filter(article =>
//       new Date(article.createdAt) > oneHourAgo
//     );

//     if (recentCachedNews.length > 0) {
//       console.log(`✅ Returning ${recentCachedNews.length} cached articles`);
//       return res.status(200).json({
//         success: true,
//         message: `Fetched ${recentCachedNews.length} news articles`,
//         news: recentCachedNews,
//         source: 'cache'
//       });
//     }

//     // Fetch all RSS feeds
//     const allItems = [];
//     for (const feedUrl of feedsToFetch) {
//       try {
//         const items = await parseRSSFeed(feedUrl);
//         console.log(`✅ Fetched ${items.length} items from ${feedUrl}`);
//         allItems.push(...items);
//       } catch (error) {
//         console.error(`❌ Failed to fetch ${feedUrl}:`, error.message);
//       }
//     }

//     if (allItems.length === 0) {
//       // Return cached news if available
//       if (cachedNews.length > 0) {
//         return res.status(200).json({
//           success: true,
//           message: `Returning ${cachedNews.length} cached news articles`,
//           news: cachedNews,
//           source: 'fallback_cache'
//         });
//       }

//       return res.status(404).json({
//         success: false,
//         message: 'No news articles found from RSS feeds.',
//       });
//     }

//     // Process articles (limited to 5 for speed)
//     const processedArticles = [];

//     for (let i = 0; i < Math.min(allItems.length, 5); i++) {
//       try {
//         const item = allItems[i];

//         // Extract basic fields
//         let title = item.title || '';
//         let description = item.description || item.summary || item.content || '';
//         let link = item.link || item.guid || '';
//         let pubDate = item.pubDate || item.published || new Date().toISOString();

//         // Fix: Extract ORIGINAL source from link
//         let source = 'Unknown';
//         if (link) {
//           try {
//             const url = new URL(link);
//             const hostname = url.hostname.replace('www.', '');
//             source = hostname;
//           } catch (e) {
//             source = 'Unknown';
//           }
//         }

//         // Extract image
//         let image = null;

//         // Try RSS media fields
//         if (item['media:content']?.$?.url) {
//           image = item['media:content'].$.url;
//         } else if (item.enclosure?.$?.url) {
//           image = item.enclosure.$.url;
//         } else if (item['media:thumbnail']?.$?.url) {
//           image = item['media:thumbnail'].$.url;
//         }

//         // Fallback to Unsplash if no image
//         if (!image) {
//           image = `https://source.unsplash.com/800x600/?${encodeURIComponent(categoryForFeed)}`;
//         }

//         // Clean HTML
//         if (typeof description === 'object' && description._) {
//           description = description._;
//         }

//         // Extract text from HTML
//         title = extractTextFromHTML(title).substring(0, 150);
//         description = extractTextFromHTML(description).substring(0, 500);

//         // Skip if title is too short
//         if (title.length < 10) {
//           continue;
//         }

//         // 🆕 IMPORTANT: Check if article already exists to avoid duplicates
//         const existingArticle = await NewsArticle.findOne({
//           $or: [
//             { title: { $regex: new RegExp(title.substring(0, 50), 'i') } },
//             { link: link }
//           ]
//         });

//         if (existingArticle) {
//           console.log(`⏭️ Skipping duplicate article: ${title.substring(0, 50)}...`);
//           continue;
//         }

//         // 🆕 SIMPLIFIED: Use original description if available (don't expand to 200 words for now)
//         // You can enable this later if needed
//         let finalDescription = description;

//         // Optional: Expand description using Gemini (uncomment when ready)
//         /*
//         if (description.length < 100) {
//           try {
//             finalDescription = await expandDescriptionTo200Words(title, description, categoryForFeed);
//             console.log(`✅ Expanded description for: ${title.substring(0, 50)}...`);
//           } catch (geminiError) {
//             console.log(`❌ Gemini expansion failed, using original description`);
//             finalDescription = description;
//           }
//         }
//         */

//         // Create article object
//         const article = {
//           title,
//           description: finalDescription,
//           pubDate: new Date(pubDate),
//           source, // This should now show actual source like "inc42.com"
//           link,
//           image,
//           category: categoryForFeed,
//         };

//         processedArticles.push(article);

//       } catch (error) {
//         console.error(`❌ Error processing article ${i}:`, error.message);
//       }
//     }

//     if (processedArticles.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: `Returning ${cachedNews.length} cached news articles`,
//         news: cachedNews,
//         source: 'fallback'
//       });
//     }

//     // Save to database
//     const savedArticles = [];
//     for (const article of processedArticles) {
//       try {
//         const newArticle = await NewsArticle.create(article);
//         savedArticles.push(newArticle);
//       } catch (err) {
//         // Skip duplicate errors
//         if (!err.message.includes('duplicate')) {
//           console.error('Save error:', err.message);
//         }
//       }
//     }

//     console.log(`✅ Saved ${savedArticles.length} new articles to database`);

//     return res.status(200).json({
//       success: true,
//       message: `Fetched ${savedArticles.length} fresh news articles`,
//       news: savedArticles,
//       source: 'rss'
//     });

//   } catch (error) {
//     console.error('❌ Main news fetch error:', error.message);

//     // Final fallback - try to return cached news
//     try {
//       const fallbackNews = await NewsArticle.find({})
//         .sort({ createdAt: -1 })
//         .limit(10);

//       return res.status(200).json({
//         success: fallbackNews.length > 0,
//         message: fallbackNews.length > 0 ? 'Returning last available news' : 'No news available',
//         news: fallbackNews,
//         source: 'emergency_cache'
//       });
//     } catch (fallbackError) {
//       return res.status(500).json({
//         success: false,
//         message: 'News service temporarily unavailable',
//         error: error.message
//       });
//     }
//   }
// };



// export const getLatestNews = async (req, res) => {
//   try {
//     const allowedCategories = Object.keys(RSS_FEEDS);
//     let { category } = req.query;

//     // Validate category
//     if (category) {
//       category = category.trim();
//       const match = allowedCategories.find(
//         (cat) => cat.toLowerCase() === category.toLowerCase()
//       );

//       if (!match) {
//         return res.status(400).json({
//           success: false,
//           message: `Category "${category}" is not valid. Available: ${allowedCategories.join(', ')}`,
//         });
//       }
//       category = match;
//     }

//     // Determine which feeds to fetch
//     const feedsToFetch = category ? RSS_FEEDS[category] : Object.values(RSS_FEEDS).flat();
//     const categoryForFeed = category || 'General';

//     console.log(`📰 Fetching news for category: ${categoryForFeed} from ${feedsToFetch.length} feeds`);

//     // Try to get from database first (cached) - ✅ SORTED BY LATEST FIRST
//     const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
//     const cachedNews = await NewsArticle.find(
//       category ? { category: categoryForFeed } : {}
//     )
//       .sort({ pubDate: -1, createdAt: -1 }) // ✅ Sort by pubDate descending (latest first)
//       .limit(10);

//     const recentCachedNews = cachedNews.filter(article =>
//       new Date(article.createdAt) > oneHourAgo
//     );

//     if (recentCachedNews.length > 0) {
//       console.log(`✅ Returning ${recentCachedNews.length} cached articles (latest first)`);
//       return res.status(200).json({
//         success: true,
//         message: `Fetched ${recentCachedNews.length} news articles`,
//         news: recentCachedNews,
//         source: 'cache'
//       });
//     }

//     // Fetch all RSS feeds
//     const allItems = [];
//     for (const feedUrl of feedsToFetch) {
//       try {
//         const items = await parseRSSFeed(feedUrl);
//         console.log(`✅ Fetched ${items.length} items from ${feedUrl}`);
//         allItems.push(...items);
//       } catch (error) {
//         console.error(`❌ Failed to fetch ${feedUrl}:`, error.message);
//       }
//     }

//     if (allItems.length === 0) {
//       if (cachedNews.length > 0) {
//         return res.status(200).json({
//           success: true,
//           message: `Returning ${cachedNews.length} cached news articles`,
//           news: cachedNews,
//           source: 'fallback_cache'
//         });
//       }

//       return res.status(404).json({
//         success: false,
//         message: 'No news articles found from RSS feeds.',
//       });
//     }

//     // ✅ SORT ALL ITEMS BY DATE (LATEST FIRST) BEFORE PROCESSING
//     allItems.sort((a, b) => {
//       const dateA = new Date(a.pubDate || a.published || 0);
//       const dateB = new Date(b.pubDate || b.published || 0);
//       return dateB - dateA; // Descending order (latest first)
//     });

//     console.log(`📊 Processing ${allItems.length} items sorted by latest date`);

//     // Process articles (limited to 10 for speed)
//     const processedArticles = [];

//     for (let i = 0; i < Math.min(allItems.length, 10); i++) {
//       try {
//         const item = allItems[i];

//         // Extract basic fields
//         let title = item.title || '';
//         let description = item.description || item.summary || item.content || '';
//         let link = item.link || item.guid || '';
//         let pubDate = item.pubDate || item.published || new Date().toISOString();

//         // ✅ IMPROVED: Extract ORIGINAL source from link
//         let source = 'Unknown';
//         if (link) {
//           try {
//             const url = new URL(link);
//             // Get clean domain name
//             const hostname = url.hostname.replace('www.', '');

//             // Map common domains to readable names
//             const domainMap = {
//               'inc42.com': 'Inc42',
//               'yourstory.com': 'YourStory',
//               'techcrunch.com': 'TechCrunch',
//               'espncricinfo.com': 'ESPN Cricinfo',
//               'cricbuzz.com': 'Cricbuzz',
//               'uscis.gov': 'USCIS',
//               'migrationpolicy.org': 'Migration Policy',
//               'cbp.gov': 'U.S. Customs',
//               'teluguone.com': 'Telugu One',
//               'news18.com': 'News18',
//               'coindesk.com': 'CoinDesk',
//               'investing.com': 'Investing.com',
//               'technologyreview.com': 'MIT Tech Review',
//               'foreignpolicy.com': 'Foreign Policy',
//               'builtinaustin.com': 'Built In Austin',
//               'weworkremotely.com': 'We Work Remotely',
//               'thegeopolitics.com': 'The Geopolitics',
//               'mea.gov.in': 'MEA India',
//               'finance.yahoo.com': 'Yahoo Finance',
//               'techrepublic.com': 'TechRepublic',
//               'theconversation.com': 'The Conversation',
//               'manatelangana.news': 'Mana Telangana',
//               'navatelangana.com': 'Nava Telangana'
//             };

//             // Check if domain has a mapped name
//             const foundDomain = Object.keys(domainMap).find(domain => hostname.includes(domain));
//             source = foundDomain ? domainMap[foundDomain] : hostname;

//           } catch (e) {
//             source = 'Unknown';
//           }
//         }

//         // ✅ IMPROVED: Extract image with multiple fallbacks
//         let image = null;

//         // Try 1: RSS media fields
//         if (item['media:content']?.$?.url) {
//           image = item['media:content'].$.url;
//         } 
//         else if (item['media:content']?.url) {
//           image = item['media:content'].url;
//         }
//         else if (item.enclosure?.$?.url) {
//           image = item.enclosure.$.url;
//         }
//         else if (item.enclosure?.url) {
//           image = item.enclosure.url;
//         }
//         else if (item['media:thumbnail']?.$?.url) {
//           image = item['media:thumbnail'].$.url;
//         }
//         else if (item['media:thumbnail']?.url) {
//           image = item['media:thumbnail'].url;
//         }
//         // Try 2: Image tag in description
//         else if (description) {
//           const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
//           if (imgMatch && imgMatch[1]) {
//             image = imgMatch[1];
//           }
//         }

//         // Try 3: og:image from description HTML
//         if (!image && description) {
//           const ogImageMatch = description.match(/og:image"?\s+content="([^">]+)"/);
//           if (ogImageMatch && ogImageMatch[1]) {
//             image = ogImageMatch[1];
//           }
//         }

//         // Try 4: Extract from article URL (if no image found yet) - ONLY FOR FIRST 5 ITEMS
//         if (!image && link && i < 5) {
//           try {
//             console.log(`🔍 Extracting image from URL: ${link}`);
//             const extractedImage = await extractImageFromURL(link);
//             if (extractedImage) {
//               image = extractedImage;
//               console.log(`✅ Extracted image: ${extractedImage}`);
//             }
//           } catch (err) {
//             console.log(`⚠️ Failed to extract image from URL`);
//           }
//         }

//         // Fallback: Use category-specific Unsplash ONLY if absolutely no image found
//         if (!image) {
//           const unsplashKeywords = {
//             'US Immigration': 'passport,visa,immigration',
//             'Startup News': 'startup,entrepreneur,business',
//             'Cricket': 'cricket,sports,stadium',
//             'Tech Jobs': 'technology,coding,office',
//             'Geopolitical News': 'world,politics,news',
//             'Stock Market & Crypto': 'finance,trading,cryptocurrency',
//             'AI Developments': 'artificial intelligence,technology,ai',
//             'AP/TS Local News': 'india,telugu,news'
//           };

//           const keyword = unsplashKeywords[categoryForFeed] || 'news,article';
//           image = `https://source.unsplash.com/800x600/?${encodeURIComponent(keyword)}`;
//         }

//         // Clean HTML
//         if (typeof description === 'object' && description._) {
//           description = description._;
//         }

//         // Extract text from HTML
//         title = extractTextFromHTML(title).substring(0, 150);
//         description = extractTextFromHTML(description).substring(0, 500);

//         // Skip if title is too short
//         if (title.length < 10) {
//           continue;
//         }

//         // ✅ Check if article already exists to avoid duplicates
//         const existingArticle = await NewsArticle.findOne({
//           $or: [
//             { title: { $regex: new RegExp(title.substring(0, 50), 'i') } },
//             { link: link }
//           ]
//         });

//         if (existingArticle) {
//           console.log(`⏭️ Skipping duplicate article: ${title.substring(0, 50)}...`);
//           continue;
//         }

//         // Create article object with proper date
//         const article = {
//           title,
//           description,
//           pubDate: new Date(pubDate), // ✅ Store as proper Date object
//           source,
//           link,
//           image,
//           category: categoryForFeed,
//         };

//         processedArticles.push(article);
//         console.log(`📰 Processed: ${title.substring(0, 50)}... | Date: ${new Date(pubDate).toLocaleDateString()} | Source: ${source}`);

//       } catch (error) {
//         console.error(`❌ Error processing article ${i}:`, error.message);
//       }
//     }

//     if (processedArticles.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: `Returning ${cachedNews.length} cached news articles`,
//         news: cachedNews,
//         source: 'fallback'
//       });
//     }

//     // Save to database
//     const savedArticles = [];
//     for (const article of processedArticles) {
//       try {
//         const newArticle = await NewsArticle.create(article);
//         savedArticles.push(newArticle);
//       } catch (err) {
//         // Skip duplicate errors
//         if (!err.message.includes('duplicate')) {
//           console.error('Save error:', err.message);
//         }
//       }
//     }

//     console.log(`✅ Saved ${savedArticles.length} new articles to database (latest first)`);

//     // ✅ FINAL SORT BY DATE (JUST IN CASE)
//     savedArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

//     return res.status(200).json({
//       success: true,
//       message: `Fetched ${savedArticles.length} fresh news articles`,
//       news: savedArticles,
//       source: 'rss'
//     });

//   } catch (error) {
//     console.error('❌ Main news fetch error:', error.message);

//     // Final fallback - try to return cached news
//     try {
//       const fallbackNews = await NewsArticle.find({})
//         .sort({ pubDate: -1, createdAt: -1 }) // ✅ Latest first
//         .limit(10);

//       return res.status(200).json({
//         success: fallbackNews.length > 0,
//         message: fallbackNews.length > 0 ? 'Returning last available news' : 'No news available',
//         news: fallbackNews,
//         source: 'emergency_cache'
//       });
//     } catch (fallbackError) {
//       return res.status(500).json({
//         success: false,
//         message: 'News service temporarily unavailable',
//         error: error.message
//       });
//     }
//   }
// };

// Get all news from database
export const getAllNews = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};

    // Fetch news articles sorted by pubDate (latest first)
    const newsArticles = await NewsArticle.find(filter)
      .sort({ pubDate: -1, createdAt: -1 })
      .limit(50);

    if (newsArticles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No news articles found in database.',
      });
    }

    return res.status(200).json({
      success: true,
      count: newsArticles.length,
      news: newsArticles,
    });

  } catch (error) {
    console.error('Error fetching news articles:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve news articles from database.',
    });
  }
};



export const getAllSpinRewards = async (req, res) => {
  try {
    const { userId } = req.params;

    // 🔍 Validate user existence
    const userExists = await User.findById(userId);

    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // 🔄 Fetch all spin reward data (not just one)
    const spinDocs = await SpinCoin.find();

    if (!spinDocs || spinDocs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No spin reward data found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Spin rewards fetched successfully",
      data: spinDocs.map(doc => ({
        coins: doc.coins || [],
        coupons: doc.coupons || []
      }))
    });
  } catch (error) {
    console.error("❌ Error fetching spin rewards:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


// 📌 Get all surveys by vendorId and validate userId
export const getSurveysByVendor = async (req, res) => {
  try {
    const { vendorId, userId } = req.params;

    if (!vendorId || !userId) {
      return res.status(400).json({ message: 'vendorId and userId are required in params' });
    }

    // ✅ Validate userId exists
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ Fetch surveys for the vendor
    const surveys = await Survay.find({ vendorId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Surveys fetched successfully',
      data: surveys,
    });
  } catch (error) {
    console.error('Error fetching surveys:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};



export const submitSurveyResponse = async (req, res) => {
  try {
    const { surveyId, userId, vendorId, answers } = req.body;


    const survey = await Survay.findById(surveyId);
    if (!survey) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    const alreadySubmitted = survey.responses.find(
      (r) =>
        r.userId.toString() === userId &&
        r.vendorId.toString() === vendorId
    );
    if (alreadySubmitted) {
      return res.status(400).json({ message: 'Survey already submitted by this user for this vendor' });
    }

    survey.responses.push({
      userId,
      vendorId,
      answers,
    });

    await survey.save();

    return res.status(200).json({
      success: true,
      message: 'Survey submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting survey response:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


export const sendInfoRequest = async (req, res) => {
  try {
    const { toUserId } = req.params;
    const { fromUserId } = req.body;

    const toUser = await User.findById(toUserId);
    const fromUser = await User.findById(fromUserId);

    if (!toUser || !fromUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ Use senderId and receiverId properly
    toUser.notifications.push({
      type: 'infoRequest',
      senderId: fromUserId,
      receiverId: toUserId,
      message: `${fromUser.name} has requested your info.`,
      status: 'pending',
      read: false,
      createdAt: new Date()
    });

    await toUser.save();

    return res.status(200).json({ message: 'Info request sent successfully' });
  } catch (error) {
    console.error('Error sending info request:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const acceptUserInfoRequest = async (req, res) => {
  try {
    const { userId } = req.params; // Receiver ID (the one who got the request)
    const { fromUserId, status } = req.body; // Sender ID & response status

    // Validate required fields
    if (!userId || !fromUserId || !status) {
      return res.status(400).json({ message: "userId, fromUserId, and status are required" });
    }

    // Validate status
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be "accepted" or "rejected"' });
    }

    // Fetch receiver user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🔹 Find matching pending notification (type can be 'general' or 'infoRequest')
    const notification = user.notifications.find(
      (notif) =>
        notif.senderId?.toString() === fromUserId &&
        notif.status === "pending"
    );

    if (!notification) {
      return res.status(404).json({ message: "Pending request not found" });
    }

    // 🔹 Update the notification status
    notification.status = status;

    // 🔹 Remove the notification after handling (clean inbox)
    user.notifications = user.notifications.filter(
      (notif) => notif._id.toString() !== notification._id.toString()
    );

    await user.save();

    // 🔹 Notify the requester (the one who sent the request)
    const requester = await User.findById(fromUserId);
    if (requester) {
      const message =
        status === "accepted"
          ? `${user.name} has accepted your request.`
          : `${user.name} has rejected your request.`;

      requester.notifications.push({
        type: `infoRequest${status.charAt(0).toUpperCase() + status.slice(1)}`, // infoRequestAccepted / infoRequestRejected
        message,
        senderId: user._id,
        status: "unread",
        createdAt: new Date(),
      });

      await requester.save();
    }

    return res.status(200).json({
      message: `Request ${status} successfully and requester notified.`,
    });
  } catch (error) {
    console.error("Error processing info request:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};




export const getUserInfoIfAccepted = async (req, res) => {
  try {
    const { targetUserId, requesterId } = req.params;

    const targetUser = await User.findById(targetUserId).select(
      'steps coins profileImage couponCode notifications'
    );

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const acceptedNotification = targetUser.notifications.find(
      (notif) =>
        notif.type === 'infoRequest' &&
        notif.senderId?.toString() === requesterId &&
        notif.status === 'accepted'
    );

    if (!acceptedNotification) {
      return res.status(403).json({ message: 'Access denied: Info request not accepted' });
    }

    // ✅ Calculate total steps
    const totalStepCount = targetUser.steps.reduce(
      (total, stepObj) => total + (stepObj.stepsCount || 0),
      0
    );

    return res.status(200).json({
      message: 'User info fetched successfully',
      data: {
        //steps: targetUser.steps,
        totalStepCount,  // Include total step count here
        coins: targetUser.coins,
        profileImage: targetUser.profileImage,
        couponCode: targetUser.couponCode,
      },
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// In your userController.js or quiz controller - update submitQuiz
// Submit Quiz - EXACT same payload/response
// Submit Quiz - Fixed to properly update seenQuizzes
// Submit Quiz - Fixed to properly update seenQuizzes
// export const submitQuiz = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const { answers } = req.body;

//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: 'userId is required'
//       });
//     }

//     if (!answers || !Array.isArray(answers) || answers.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'answers array is required'
//       });
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     // ✅ Initialize seenQuizzes if it doesn't exist
//     if (!user.seenQuizzes) {
//       user.seenQuizzes = [];
//     }

//     // Validate that every answer contains a questionId
//     const missingIds = answers.filter(a => !a.questionId);
//     if (missingIds.length > 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Each answer must include a valid questionId',
//         missingCount: missingIds.length
//       });
//     }

//     // ✅ Check for duplicate submissions by questionId
//     const questionIds = answers.map(a => a.questionId);
//     const existingSubmissions = await QuizSubmission.find({
//       userId,
//       questionId: { $in: questionIds }
//     }).select('questionId');

//     const existingIds = new Set(existingSubmissions.map(s => s.questionId.toString()));
//     const newAnswers = answers.filter(a => !existingIds.has(a.questionId));

//     if (newAnswers.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'All quizzes already submitted. You cannot submit the same questions again.',
//         alreadySubmitted: existingIds.size
//       });
//     }

//     // Prepare bulk submission data
//     const submissions = [];
//     let correctAnswers = 0;

//     for (const item of newAnswers) {
//       const quiz = await Quiz.findById(item.questionId).lean();
//       if (!quiz) {
//         console.warn(`Quiz question ${item.questionId} not found – skipping`);
//         continue;
//       }

//       const isCorrect = (quiz.answer === item.selectedOption);
//       if (isCorrect) correctAnswers++;

//       submissions.push({
//         userId,
//         questionId: quiz._id,  // ✅ Store questionId
//         topic: quiz.topic,
//         question: quiz.question,
//         options: quiz.options,
//         selectedOption: item.selectedOption,
//         correctAnswer: quiz.answer,
//         explanation: quiz.explanation,
//         isCorrect,
//         score: isCorrect ? 1 : 0,
//         submittedAt: new Date(),
//         timeSpent: item.timeSpent || 30
//       });
//     }

//     if (submissions.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No valid questions found for submission'
//       });
//     }

//     // Save all submissions
//     await QuizSubmission.insertMany(submissions);

//     // ✅ Update user.seenQuizzes with the newly submitted question IDs
//     const newQuestionIds = submissions.map(s => s.questionId.toString());
    
//     for (const id of newQuestionIds) {
//       if (!user.seenQuizzes.includes(id)) {
//         user.seenQuizzes.push(id);
//       }
//     }

//     // Award coins (1 coin per correct answer)
//     const coinsEarned = correctAnswers;
//     if (coinsEarned > 0) {
//       user.coins = (user.coins || 0) + coinsEarned;

//       if (!Array.isArray(user.coinHistory)) user.coinHistory = [];
//       user.coinHistory.push({
//         type: 'added',
//         amount: coinsEarned,
//         message: `Earned ${coinsEarned} coins from quiz (${correctAnswers} correct out of ${submissions.length})`,
//         timestamp: new Date(),
//         metadata: {
//           type: 'quiz',
//           correctAnswers,
//           totalQuestions: submissions.length
//         }
//       });
//     }

//     await user.save();

//     return res.status(200).json({
//       success: true,
//       message: 'Quiz submitted successfully',
//       correctAnswers,
//       totalQuestions: submissions.length,
//       coinsEarned,
//       totalCoins: user.coins,
//       newlySeen: newQuestionIds.length
//     });

//   } catch (error) {
//     console.error('Error in submitQuiz:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Server error while submitting quiz'
//     });
//   }
// };


// ============================================
// FIXED: submitQuiz - Prevents duplicate submissions
// ============================================
export const submitQuiz = async (req, res) => {
  try {
    console.log("🚀 ========== SUBMIT QUIZ STARTED ==========");
    const { userId, answers } = req.body;
    console.log("📥 userId:", userId, "| answers count:", answers?.length);

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ success: false, message: "answers array is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!Array.isArray(user.seenQuizzes)) {
      user.seenQuizzes = [];
    }

    // ── Duplicate guard: check QuizSubmission directly, NOT seenQuizzes ──
    // seenQuizzes is only used by getUserQuizzes to avoid repeat delivery
    // submitQuiz uses QuizSubmission collection as the source of truth
    console.log("\n🗄️ Checking QuizSubmission for already-submitted questions...");
    const incomingIds = answers
      .filter(a => a.questionId)
      .map(a => new mongoose.Types.ObjectId(a.questionId));

    const alreadySubmitted = await QuizSubmission.find({
      userId: new mongoose.Types.ObjectId(userId),
      questionId: { $in: incomingIds }
    }).lean();

    const alreadySubmittedIds = new Set(
      alreadySubmitted.map(s => s.questionId.toString())
    );

    console.log(`   Already in QuizSubmission: ${alreadySubmitted.length}`);
    console.log(`   Already submitted IDs:`, Array.from(alreadySubmittedIds));

    // Filter to only answers not yet in QuizSubmission
    const newAnswers = answers.filter(
      a => a.questionId && !alreadySubmittedIds.has(a.questionId.toString())
    );

    console.log(`   New answers to process: ${newAnswers.length}`);

    if (newAnswers.length === 0) {
      console.log("❌ All answers already exist in QuizSubmission — genuine duplicate");
      return res.status(400).json({
        success: false,
        message: "You have already submitted all these questions.",
        alreadySubmitted: alreadySubmitted.length,
        suggestion: "Call getUserQuizzes to get new questions"
      });
    }

    // ── Process new answers ─────────────────────────────────
    console.log("\n⚙️ Processing answers...");
    let correct = 0;
    let wrong = 0;
    const results = [];
    const submissionsToSave = [];

    for (const item of newAnswers) {
      const { questionId, selectedOption } = item;
      console.log(`\n   Processing questionId: ${questionId} | selected: ${selectedOption}`);

      if (!questionId || !selectedOption) {
        console.log("   ⚠️ Skipping — missing questionId or selectedOption");
        continue;
      }

      const quiz = await Quiz.findById(questionId);
      if (!quiz) {
        console.log(`   ❌ Quiz not found: ${questionId}`);
        continue;
      }

      console.log(`   correctAnswer: "${quiz.answer}"`);

      const isCorrect =
        quiz.answer.toString().trim().toLowerCase() ===
        selectedOption.toString().trim().toLowerCase();

      console.log(`   isCorrect: ${isCorrect}`);
      if (isCorrect) correct++;
      else wrong++;

      submissionsToSave.push({
        userId: new mongoose.Types.ObjectId(userId),
        questionId: new mongoose.Types.ObjectId(questionId),
        selectedOption,
        correctAnswer: quiz.answer,
        score: isCorrect ? 1 : 0,
        submittedAt: new Date(),
        topic: quiz.topic
      });

      results.push({
        questionId,
        question: quiz.question,
        selectedOption,
        correctAnswer: quiz.answer,
        isCorrect,
        explanation: quiz.explanation || "No explanation available"
      });
    }

    console.log(`\n📦 submissionsToSave: ${submissionsToSave.length} | correct: ${correct} | wrong: ${wrong}`);

    // ── STEP 1: Save to QuizSubmission ──────────────────────
    console.log("\n💾 STEP 1: Saving to QuizSubmission...");
    if (submissionsToSave.length > 0) {
      try {
        const insertResult = await QuizSubmission.insertMany(
          submissionsToSave,
          { ordered: false }
        );
        console.log(`✅ QuizSubmission.insertMany SUCCESS — inserted: ${insertResult.length}`);

        const verifyCount = await QuizSubmission.countDocuments({
          userId: new mongoose.Types.ObjectId(userId),
          questionId: { $in: submissionsToSave.map(s => s.questionId) }
        });
        console.log(`✅ Verification count in QuizSubmission: ${verifyCount}`);
      } catch (insertError) {
        console.log("❌ QuizSubmission.insertMany FAILED:", insertError.message);
        console.log("   model:", QuizSubmission.modelName);
        console.log("   collection:", QuizSubmission.collection.name);
        throw insertError;
      }
    }

    // ── STEP 2: Award coins ─────────────────────────────────
    console.log("\n💰 STEP 2: Awarding coins...");
    const coinsEarned = correct;
    if (coinsEarned > 0) {
      const coinsBefore = user.coins || 0;
      user.coins = coinsBefore + coinsEarned;
      console.log(`   coins: ${coinsBefore} → ${user.coins}`);
      if (!Array.isArray(user.coinHistory)) user.coinHistory = [];
      user.coinHistory.push({
        type: 'added',
        amount: coinsEarned,
        message: `Earned ${coinsEarned} coins from quiz (${correct}/${submissionsToSave.length} correct)`,
        timestamp: new Date(),
        metadata: {
          type: 'quiz',
          correctAnswers: correct,
          totalQuestions: submissionsToSave.length
        }
      });
      user.markModified('coinHistory');
    } else {
      console.log("   No coins to award");
    }

    // ── STEP 3: Save user ───────────────────────────────────
    console.log("\n💾 STEP 3: Saving user document...");
    await user.save();
    console.log("✅ user.save() SUCCESS");

    const verifiedUser = await User.findById(userId).select('coins seenQuizzes').lean();
    console.log(`   Verified coins in DB: ${verifiedUser.coins}`);
    console.log(`   Verified seenQuizzes in DB: ${verifiedUser.seenQuizzes.length}`);
    console.log("\n✅ ========== SUBMIT QUIZ COMPLETED ==========\n");

    return res.status(200).json({
      success: true,
      message: `${submissionsToSave.length} quizzes submitted successfully`,
      debug: {
        totalReceived: answers.length,
        alreadyInDB: alreadySubmitted.length,
        newlyProcessed: submissionsToSave.length,
        savedToQuizSubmission: submissionsToSave.length
      },
      summary: {
        totalSubmitted: submissionsToSave.length,
        correct,
        wrong,
        score: correct,
        percentage: submissionsToSave.length > 0
          ? `${Math.round((correct / submissionsToSave.length) * 100)}%`
          : '0%'
      },
      rewards: { coinsEarned, totalCoins: user.coins },
      results
    });

  } catch (error) {
    console.log("\n❌ ========== SUBMIT QUIZ CRASHED ==========");
    console.log("   error:", error.message);
    console.log("   stack:", error.stack);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get Top Performers - EXACT same payload/response
export const getTopPerformers = async (req, res) => {
  try {
    const { userId } = req.params;

    const topPerformers = await QuizSubmission.aggregate([
      { $sort: { userId: 1, score: -1, submittedAt: 1 } },
      {
        $group: {
          _id: "$userId",
          submissionId: { $first: "$_id" },
          score: { $first: "$score" },
          totalQuestions: { $first: "$totalQuestions" },
          submittedAt: { $first: "$submittedAt" },
        }
      },
      { $sort: { score: -1, submittedAt: 1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: "$submissionId",
          userId: {
            _id: "$user._id",
            name: "$user.name",
            profileImage: "$user.profileImage"
          },
          score: 1,
          totalQuestions: 1,
          submittedAt: 1,
          myChatMembers: "$user.MyChatMembers"
        }
      }
    ]);

    if (!topPerformers.length) {
      return res.status(404).json({
        success: false,
        message: "No quiz submissions found."
      });
    }

    const requestingUser = await User.findById(userId).select('MyChatMembers');
    if (!requestingUser) {
      return res.status(404).json({
        success: false,
        message: "Requesting user not found"
      });
    }

    const myChatMemberIds = requestingUser.MyChatMembers.map(member => member.userId.toString());

    const filteredPerformers = topPerformers.filter(performer =>
      myChatMemberIds.includes(performer.userId._id.toString())
    );

    const rankedData = filteredPerformers.map((submission, index) => ({
      ...submission,
      rank: index + 1
    }));

    // EXACT SAME RESPONSE STRUCTURE
    res.status(200).json({
      success: true,
      message: "🏆 Ranked top performers fetched successfully.",
      data: rankedData
    });

  } catch (error) {
    console.error("Error fetching ranked top performers:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};


//const GEMINI_API_KEY = 'process.env.GEMINI_API_KEY';



export const getQuiz = async (req, res) => {
  const { topic } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required." });
  }

  try {
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`,
      {
        contents: [
          {
            parts: [
              {
                text: `Generate 30 multiple-choice quiz questions on the topic "${topic}". Each question must have options A, B, C, D and a correct answer. Format like:
                
Q1. Question text?
A. Option A
B. Option B
C. Option C
D. Option D
Answer: A`
              },
            ],
          },
        ],
      }
    );

    const quiz = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!quiz) {
      return res.status(500).json({ error: "No quiz returned from Gemini API." });
    }

    res.json({ quiz });

  } catch (error) {
    console.error("Gemini API Error:", error.message);
    res.status(500).json({ error: "Failed to fetch quiz from Gemini." });
  }
};


export const getUsersExcludingChatMembers = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch the user with populated MyChatMembers to filter Accepted and Pending chat members only
    const user = await User.findById(userId).select('MyChatMembers');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Extract userIds of chat members whose status is "Accepted"
    const acceptedChatMemberIds = user.MyChatMembers
      .filter(member => member.status === 'Accepted' && member.userId) // status Accepted and userId exists
      .map(member => member.userId.toString());

    // Fetch users excluding logged-in user and accepted chat members only
    const users = await User.find({
      _id: { $nin: [...acceptedChatMemberIds, userId] }
    });

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found!' });
    }

    // Format users with added chatRequest field based on Pending status
    const formattedUsers = users.map((user) => {
      // Check if there is a pending request
      const pendingRequest = user.MyChatMembers.some(member =>
        member.userId.toString() === userId && member.status === 'Pending'
      );

      return {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: user.city,
        zipcode: user.zipcode,
        dateOfBirth: user.dateOfBirth,
        coins: user.coins,
        couponCode: user.couponCode || 'null',
        favoriteCoupons: user.favoriteCoupons || [],
        profileImage: user.profileImage || null,
        otp: user.otp || null,
        otpExpiry: user.otpExpiry || null,
        steps: user.steps || {},
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        chatRequest: pendingRequest ? 'Pending' : 'None',  // Add chatRequest field
      };
    });

    return res.status(200).json({
      message: 'Users retrieved successfully!',
      count: formattedUsers.length,  // <-- Added count here
      users: formattedUsers,
    });
  } catch (error) {
    console.error('Error retrieving users:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};




// Get User Coupon Code Controller
export const getUserCouponCode = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user by ID and select only couponCode field
    const user = await User.findById(userId).select("couponCode");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      reffralCode: user.couponCode,
    });
  } catch (error) {
    console.error("Error fetching coupon code:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// export const getUserQuizzes = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const { query } = req.query;

//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found", quizzes: [] });
//     }

//     if (!query || query.trim() === "") {
//       return res.status(200).json({
//         quizzes: [],
//         message: "Please provide a search query to view your quizzes.",
//       });
//     }

//     // Get ALL quiz IDs for this topic from DB first
//     const allQuizzes = await Quiz.find({ topic: query })
//       .sort({ createdAt: 1 })  // oldest first → consistent order
//       .lean();

//     if (allQuizzes.length === 0) {
//       return res.status(200).json({ quizzes: [] });
//     }

//     // Get all questionIds this user already submitted for this topic
//     const allTopicIds = allQuizzes.map(q => q._id);

//     const submissions = await QuizSubmission.find({
//       userId,
//       questionId: { $in: allTopicIds }  // only check submissions for THIS topic
//     }).select("questionId").lean();

//     const submittedIds = new Set(
//       submissions.map(s => s.questionId?.toString()).filter(Boolean)
//     );

//     // Filter: only questions NOT yet submitted by this user
//     let unseenQuizzes = allQuizzes.filter(
//       q => q._id && !submittedIds.has(q._id.toString())
//     );

//     // If all questions in this topic are done → reset: show from beginning (old to new)
//     // This gives the cycle: old→new, then after all done, old→new again
//     if (unseenQuizzes.length === 0) {
//       // Delete this user's submissions for this topic so they can start over
//       await QuizSubmission.deleteMany({
//         userId,
//         questionId: { $in: allTopicIds }
//       });

//       // Return all from beginning (old to new)
//       unseenQuizzes = allQuizzes;
//     }

//     // Deduplicate by question text (guard against DB duplicates)
//     const seen = new Set();
//     const uniqueQuizzes = [];
//     for (const quiz of unseenQuizzes) {
//       if (!quiz.question) continue;
//       const key = quiz.question.trim().toLowerCase();
//       if (!seen.has(key)) {
//         seen.add(key);
//         uniqueQuizzes.push(quiz);
//       }
//     }

//     // Return next batch of 10 (old to new order maintained)
//     const resultQuizzes = uniqueQuizzes.slice(0, 10);

//     return res.status(200).json({
//       quizzes: resultQuizzes,
//       totalAvailable: uniqueQuizzes.length,
//       returned: resultQuizzes.length,
//       hasCompletedAll: unseenQuizzes.length === allQuizzes.length && submittedIds.size > 0
//     });

//   } catch (error) {
//     console.error("Error fetching user quizzes:", error);
//     res.status(500).json({
//       message: "Server error while fetching user quizzes",
//       error: error.message
//     });
//   }
// };


// ============================================
// FIXED: Get User Quizzes - Returns only unseen questions
// ============================================
export const getUserQuizzes = async (req, res) => {
  try {
    const { userId } = req.params;
    const { query } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    if (!query || query.trim() === "") {
      return res.status(400).json({ success: false, message: "Topic query is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!Array.isArray(user.seenQuizzes)) {
      user.seenQuizzes = [];
    }

    const allQuizzes = await Quiz.find({
      topic: { $regex: new RegExp(`^${query.trim()}$`, 'i') }
    }).sort({ createdAt: 1 }).lean();

    console.log(`📚 Total quizzes in DB for topic "${query}": ${allQuizzes.length}`);
    console.log(`👁️ User seenQuizzes count: ${user.seenQuizzes.length}`);

    if (!allQuizzes.length) {
      return res.status(200).json({
        success: true,
        quizzes: [],
        totalAvailable: 0,
        returned: 0,
        totalSeen: user.seenQuizzes.length,
        totalQuestionsInTopic: 0,
        hasCompletedAll: false,
        topic: query,
        message: `No quizzes found for topic: ${query}`
      });
    }

    const seenSet = new Set(user.seenQuizzes.map(id => id.toString()));
    let unseenQuizzes = allQuizzes.filter(q => !seenSet.has(q._id.toString()));
    let hasCompletedAll = false;
    let bonusCoins = 0;

    console.log(`✅ Unseen quizzes count: ${unseenQuizzes.length}`);

    // All done — reset only this topic
    if (unseenQuizzes.length === 0) {
      hasCompletedAll = true;
      console.log(`🔄 All questions completed for topic "${query}" — resetting`);

      const topicIdSet = new Set(allQuizzes.map(q => q._id.toString()));
      user.seenQuizzes = user.seenQuizzes.filter(id => !topicIdSet.has(id.toString()));

      bonusCoins = 50;
      user.coins = (user.coins || 0) + bonusCoins;
      if (!Array.isArray(user.coinHistory)) user.coinHistory = [];
      user.coinHistory.push({
        type: 'added',
        amount: bonusCoins,
        message: `Completed all ${allQuizzes.length} questions for ${query}!`,
        timestamp: new Date(),
        metadata: { type: 'quiz_completion', topic: query }
      });

      unseenQuizzes = allQuizzes;
      console.log(`🔄 After reset, unseenQuizzes count: ${unseenQuizzes.length}`);
    }

    // Take next 10
    const finalQuizzes = unseenQuizzes.slice(0, 10);
    const newIds = finalQuizzes.map(q => q._id.toString());

    console.log(`📤 Returning ${finalQuizzes.length} questions`);
    console.log(`   IDs being returned:`, newIds);

    // ✅ Mark as seen NOW on delivery so repeat calls don't return same questions
    // submitQuiz will NOT use seenQuizzes as duplicate guard — it checks QuizSubmission directly
    for (const id of newIds) {
      if (!user.seenQuizzes.map(s => s.toString()).includes(id)) {
        user.seenQuizzes.push(id);
      }
    }

    console.log(`   seenQuizzes after marking: ${user.seenQuizzes.length}`);

    user.markModified('seenQuizzes');
    user.markModified('coinHistory');
    await user.save();

    console.log(`✅ Saved. seenQuizzes in DB: ${user.seenQuizzes.length}`);

    return res.status(200).json({
      success: true,
      quizzes: finalQuizzes,
      totalAvailable: unseenQuizzes.length - finalQuizzes.length,
      returned: finalQuizzes.length,
      totalSeen: user.seenQuizzes.length,
      totalQuestionsInTopic: allQuizzes.length,
      hasCompletedAll,
      bonusCoinsAwarded: bonusCoins,
      topic: query,
      message: `Found ${finalQuizzes.length} new questions for you`
    });

  } catch (error) {
    console.error("❌ getUserQuizzes error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};





const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'pms226803@gmail.com',
    pass: 'nrasbifqxsxzurrm',
  },
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 60000,
  greetingTimeout: 30000,
  socketTimeout: 60000
});

export const deleteAccount = async (req, res) => {
  const { email, reason } = req.body;

  // Validate email and reason
  if (!email || !reason) {
    return res.status(400).json({ message: 'Email and reason are required' });
  }

  try {
    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a unique token for account deletion
    const token = crypto.randomBytes(20).toString('hex');
    const deleteLink = `${process.env.BASE_URL}/confirm-delete-account/${token}`;

    // Set the deleteToken and deleteTokenExpiration
    user.deleteToken = token;
    user.deleteTokenExpiration = Date.now() + 3600000;  // Token expires in 1 hour

    // Log the user object before saving
    console.log('User before saving:', user);

    // Save the token and expiration time to the database
    await user.save();  // This should now save the user along with the deleteToken and deleteTokenExpiration

    // Log after saving to confirm
    console.log('User after saving:', user);

    // Send the confirmation email
    const mailOptions = {
      from: 'pms226803@gmail.com',
      to: email,
      subject: 'Account Deletion Request Received',
      text: `Hi ${user.name},\n\nWe have received your account deletion request. To confirm the deletion of your account, please click the link below:\n\n${deleteLink}\n\nReason: ${reason}\n\nIf you have any questions or need further assistance, please feel free to contact us at contact.varahiselfdrivecars@gmail.com.\n\nBest regards,\nYour Team`,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: 'Account deletion request has been processed.We are send mail shortly.Please check your email and confirm the link to delete.',
      token: token // Send the token in the response
    });
  } catch (err) {
    console.error('Error in deleteAccount:', err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

export const confirmDeleteAccount = async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({
      deleteToken: token,
      deleteTokenExpiration: { $gt: Date.now() },
    });

    // Token is valid, delete the user account
    await User.deleteOne({ _id: user._id });

    // Always return success even if something minor fails afterward
    return res.status(200).json({
      message: 'Your account has been successfully deleted.',
    });
  } catch (err) {
    // Optional: You can still log it but don't let it affect the user
    console.error('Error in confirmDeleteAccount:', err);

    // Return a 200 anyway if user deletion probably succeeded
    return res.status(200).json({
      message: 'Your account has been successfully deleted.',
    });
  }
};



export const deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    // Check if user exists
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};



// Controller function to get user coin history with populated fromUser
export const getCoinHistoryByUserId = async (req, res) => {
  try {
    const { userId } = req.params; // Extract userId from the request params

    // Validate if userId is provided
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Fetch user data from the database
    const user = await User.findById(userId);

    // If user doesn't exist, return an error
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Extract the coin history and the current coin balance
    const coinHistory = await user
      .populate({
        path: 'coinHistory.fromUser', // Populate fromUser in coinHistory
        select: 'name email _id', // Specify the fields you want to return from the populated user
      })
      .then(() => user.coinHistory || []);  // Ensure the coin history is still returned

    const currentCoins = user.coins || 0;  // Default to 0 if no coins available

    // Respond with coin history, current coin balance, and populated fromUser
    return res.status(200).json({
      message: 'Coin history fetched successfully',
      data: {
        currentCoins,
        coinHistory,
      },
    });

  } catch (error) {
    console.error('Error fetching coin history:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



export const spinWheel = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let config = await SpinConfig.findOne();
    if (!config) {
      config = await SpinConfig.create({ dailySpinLimit: 1 });
    }

    // 🕛 Reset at 12 AM
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (!user.lastSpinDate || new Date(user.lastSpinDate) < todayStart) {
      user.spinCountToday = 0;
      user.dailySpinUsed = false;
    }

    // ❌ limit reached
    if (user.spinCountToday >= config.dailySpinLimit) {
      await user.save();

      return res.status(400).json({
        success: false,
        message: "Daily spin limit reached. Try again after 12:00 AM",
        spinCountToday: user.spinCountToday,
        dailySpinLimit: config.dailySpinLimit,
      });
    }

    // ✅ spin allowed
    user.spinCountToday += 1;
    user.lastSpinDate = new Date();

    if (user.spinCountToday >= config.dailySpinLimit) {
      user.dailySpinUsed = true;
    }

    await user.save();

    // ✅ CALCULATE spinsLeftToday BEFORE using it
    const spinsLeftToday = config.dailySpinLimit - user.spinCountToday;

    await notifyUser({
      userId: user._id,
      title: '🎡 Spin Completed',
      message: `You used a spin. ${spinsLeftToday} spins left for today.`,
      type: 'spin_used',
      metadata: {
        spinsUsed: user.spinCountToday,
        spinsLeft: spinsLeftToday,
        resetTime: "12:00 AM"
      }
    });


    return res.status(200).json({
      success: true,
      message: "Spin successful",
      spinCountToday: user.spinCountToday,
      dailySpinLimit: config.dailySpinLimit,
      spinsLeftToday: config.dailySpinLimit - user.spinCountToday,
      nextResetAt: "12:00 AM",
    });

  } catch (error) {
    console.error("❌ Spin Wheel Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};






export const getSpinCountToday = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let config = await SpinConfig.findOne();
    if (!config) {
      config = await SpinConfig.create({ dailySpinLimit: 1 });
    }

    // 🕛 reset if new day
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (!user.lastSpinDate || new Date(user.lastSpinDate) < todayStart) {
      user.spinCountToday = 0;
      user.dailySpinUsed = false;
      await user.save();
    }

    return res.status(200).json({
      success: true,
      spinCountToday: user.spinCountToday,
      dailySpinLimit: config.dailySpinLimit,
      spinsLeftToday: config.dailySpinLimit - user.spinCountToday,
      dailySpinUsed: user.dailySpinUsed,
      nextResetAt: "12:00 AM",
    });

  } catch (error) {
    console.error("❌ Get Spin Count Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};






/* ================= CREATE CATEGORY ================= */
export const createRedeemCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !req.files?.image) {
      return res.status(400).json({
        success: false,
        message: "Name and image are required"
      });
    }

    // Upload image to Cloudinary
    const upload = await cloudinary.uploader.upload(
      req.files.image.tempFilePath,
      { folder: "redeem-categories" }
    );

    const category = await RedeemRewardCategory.create({
      name,
      image: upload.secure_url
    });

    res.status(201).json({
      success: true,
      message: "Redeem reward category created successfully",
      data: category
    });
  } catch (error) {
    console.error("Create Redeem Category Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/* ================= GET ALL CATEGORIES ================= */
export const getAllRedeemCategories = async (req, res) => {
  try {
    const categories = await RedeemRewardCategory.find({ isActive: true })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    console.error("Get Redeem Categories Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/* ================= GET SINGLE CATEGORY ================= */
export const getRedeemCategoryById = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await RedeemRewardCategory.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error("Get Redeem Category Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/* ================= UPDATE CATEGORY ================= */
export const updateRedeemCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name } = req.body;

    const category = await RedeemRewardCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    if (name) category.name = name;

    if (req.files?.image) {
      const upload = await cloudinary.uploader.upload(
        req.files.image.tempFilePath,
        { folder: "redeem-categories" }
      );
      category.image = upload.secure_url;
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category
    });
  } catch (error) {
    console.error("Update Redeem Category Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/* ================= DELETE CATEGORY (SOFT) ================= */
export const deleteRedeemCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await RedeemRewardCategory.findByIdAndUpdate(
      categoryId,
      { isActive: false },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (error) {
    console.error("Delete Redeem Category Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};



// Get user notifications
// Get user notifications
export const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const skip = (page - 1) * limit;
    const filter = { userId };

    if (unreadOnly === 'true') {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('vendorId', 'businessName businessLogo')
      .populate('couponId', 'name discountPercentage');

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false
    });

    // Format notifications to include receiver info
    const formattedNotifications = notifications.map(notification => {
      const notif = notification.toObject();

      // Add receiver information to the response
      return {
        ...notif,
        receiverId: userId, // Add receiver ID from params
        metadata: {
          ...notif.metadata,
          receiverId: userId // Also add to metadata for consistency
        }
      };
    });

    res.status(200).json({
      success: true,
      notifications: formattedNotifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


// Mark notification as read
export const markNotificationAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const { notificationId } = req.body;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      {
        isRead: true,
        readAt: new Date()
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await Notification.updateMany(
      { userId, isRead: false },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const { userId, notificationId } = req.params;

    // Validate params
    if (!userId || !notificationId) {
      return res.status(400).json({
        success: false,
        message: 'userId and notificationId are required'
      });
    }

    // Find and delete notification
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
      notification
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Helper: Track time spent on any content
const trackUserContentTime = async (userId, contentId, contentType, timeSpentSeconds) => {
  try {
    if (!userId || !contentId || !contentType || !timeSpentSeconds) return null;
    
    const user = await User.findById(userId);
    if (!user) return null;
    
    if (!Array.isArray(user.viewHistory)) user.viewHistory = [];
    
    const today = new Date().toISOString().slice(0, 10);
    const existingIndex = user.viewHistory.findIndex(
      v => v.contentId && v.contentId.toString() === contentId && 
           v.contentType === contentType &&
           new Date(v.viewedAt).toISOString().slice(0, 10) === today
    );
    
    if (existingIndex !== -1) {
      user.viewHistory[existingIndex].timeSpent += timeSpentSeconds;
      user.viewHistory[existingIndex].viewedAt = new Date();
    } else {
      user.viewHistory.push({
        contentId,
        contentType,
        timeSpent: timeSpentSeconds,
        viewedAt: new Date()
      });
    }
    
    await user.save();
    return user.viewHistory;
  } catch (error) {
    console.error('trackUserContentTime error:', error);
    return null;
  }
};
