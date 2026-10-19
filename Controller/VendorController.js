import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Vendor from '../Models/Vendor.js';
import cloudinary from '../config/cloudinary.js';
import Coupon from '../Models/Coupon.js';
import GuideVideo from '../Models/GuideVideo.js';
import User from '../Models/User.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import SpinCoin from '../Models/SpinCoin.js';
import Survey from '../Models/Survey.js';
import Notification from '../Models/Notification.js';
import mongoose from 'mongoose';
import nodemailer from "nodemailer";
import multer from "multer";
import Feedback from '../Models/Feedback.js';
import PaymentConfig from '../Models/PaymentConfig.js';
import PaymentRecord from '../Models/PaymentRecord.js';
import VendorMonthlyPayment from '../Models/VendorMonthlyPayment.js';
import crypto from 'crypto';
import CashPaymentApproval from '../Models/CashPaymentApproval.js';
import Razorpay from 'razorpay';
import PaymentTransaction from '../Models/PaymentTransaction.js';
import UserCouponFeedback from '../Models/UserCouponFeedback.js';
// ✅ ADD THIS LINE HERE
const pendingVendorRegistrations = new Map();

dotenv.config();

// import CashPaymentApproval from '../Models/CashPaymentApproval.js';
// Initialize Razorpay - check if already exists, if not create it
let razorpayInstance;
try {
  // Check if razorpay is already imported/initialized
  if (typeof razorpay !== 'undefined') {
    razorpayInstance = new razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  } else {
    // Dynamic import if not available
    const Razorpay = (await import('razorpay')).default;
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
} catch (error) {
  console.error('Failed to initialize Razorpay:', error);
  // Create a placeholder if needed
  razorpayInstance = null;
}
// VendorController.js
// Helper: Convert USD to INR (using fixed exchange rate or API)
const convertUSDToINR = async (usdAmount) => {
  try {
    const exchangeRate = 83.0;
    const inrAmount = usdAmount * exchangeRate;
    return Math.round(inrAmount * 100);
  } catch (error) {
    console.error("Currency conversion error:", error);
    return Math.round(usdAmount * 83 * 100);
  }
};
// Your vendor payment functions...



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: generate 4-digit OTP
const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

// Helper: Get current price per coupon
const getCurrentPrice = async () => {
  const config = await PaymentConfig.findOne({ isActive: true });
  return config ? config.pricePerCoupon : 1.0;
};





// // Email Transporter
// const transporter = nodemailer.createTransport({
//   host: "smtp.gmail.com",
//   port: 587,
//   secure: false,
//   auth: {
//     user: "redemly1@gmail.com",
//     pass: "sxuulrugmcyvzauz"
//   }
// });

// transporter.verify((error, success) => {
//   if (error) {
//     console.log("❌ Connection failed:", error.message);
//   } else {
//     console.log("✅ Server ready to send emails");
//   }
// });
// Helper: Update monthly payment summary
// Helper: Update monthly payment summary (USD)
// In your updateMonthlyPaymentSummary function
// This is likely the issue - your update function might be setting amounts to 0
// Helper: Update monthly payment summary (USD)
// Helper: Update monthly payment summary (USD)
// Helper: Update monthly payment summary

// ================= UNIFIED NOTIFICATION HELPERS =================


// Helper: Get week number (ISO week)
const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
};

// Helper: Get start of week (Monday)
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0));
};

// Helper: Get end of week (Sunday)
const getWeekEnd = (date) => {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() + (day === 0 ? 0 : 7 - day);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 23, 59, 59, 999));
};

// Helper: Format date short
const formatDateShort = (date) => {
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
};

// Helper: Update monthly payment summary
const updateMonthlyPaymentSummary = async (vendorId, month) => {
  try {
    if (!vendorId || !month) {
      console.error('❌ updateMonthlyPaymentSummary: Missing vendorId or month');
      return null;
    }

    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

    console.log(`📊 Updating monthly summary for vendor ${vendorId}, month ${month}`);

    const records = await PaymentRecord.find({
      vendorId: vendorObjectId,
      month: month
    });

    let totalAmount = 0;
    let amountPaid = 0;
    let amountPending = 0;

    for (const record of records) {
      const price = record.pricePerCoupon || 1.0;
      totalAmount += price;

      if (record.paymentStatus === 'paid' || record.paymentStatus === 'verified') {
        amountPaid += price;
      } else {
        amountPending += price;
      }
    }

    totalAmount = parseFloat(totalAmount.toFixed(2));
    amountPaid = parseFloat(amountPaid.toFixed(2));
    amountPending = parseFloat(amountPending.toFixed(2));

    let paymentStatus = 'pending';
    if (records.length === 0) {
      paymentStatus = 'pending';
    } else if (amountPending <= 0.01 && totalAmount > 0) {
      paymentStatus = 'fully_paid';
    } else if (amountPaid > 0) {
      paymentStatus = 'partially_paid';
    }

    const summary = await VendorMonthlyPayment.findOneAndUpdate(
      { vendorId: vendorObjectId, month: month },
      {
        vendorId: vendorObjectId,
        month: month,
        totalCouponsClaimed: records.length,
        totalAmount: totalAmount,
        amountPaid: amountPaid,
        amountPending: amountPending,
        paymentStatus: paymentStatus,
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Monthly summary updated for ${month}:`, {
      totalCoupons: records.length,
      totalAmount: totalAmount,
      amountPaid: amountPaid,
      amountPending: amountPending
    });

    return summary;
  } catch (error) {
    console.error('❌ updateMonthlyPaymentSummary error:', error.message);
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
const notifyUser = async ({
  userId,
  title,
  message,
  type = 'general',
  vendorId = null,
  couponId = null,
  metadata = {}
}) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.error(`❌ User ${userId} not found for notification`);
      return;
    }

    await Notification.create({
      userId,
      title,
      message,
      type, // Must be from schema enum
      vendorId,
      couponId,
      metadata,
      isRead: false,
    });

    console.log(`✅ User notification created: ${title} | Type: ${type}`);
  } catch (error) {
    console.error('⚠️ Failed to create user notification:', error.message);
  }
};

// Send OTP mail
const sendOtpMail = async (email, otp) => {
  console.log(`📧 Sending OTP ${otp} to ${email}`);
  const mailOptions = {
    from: `"Redemly" <${process.env.MAIL_ID}>`,
    to: email,
    subject: "Vendor Verification OTP - Redemly",
    text: `Your OTP is: ${otp}\n\nThis OTP expires in 5 minutes.`,
    html: `<h2>Your OTP is: <strong>${otp}</strong></h2><p>This OTP expires in 5 minutes.</p>`,
  };

  try {
    const info = await emailTransporter.sendMail(mailOptions);
    console.log("✅ OTP email sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ Email send FAILED:", err.message);
    // Throw so the caller knows it failed
    throw new Error(`Could not send OTP email: ${err.message}`);
  }
};





// ================= EMAIL TRANSPORTER (SINGLE INSTANCE) =================
const emailTransporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAIL_ID,
    pass: process.env.MAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

emailTransporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email transporter connection failed:", error.message);
  } else {
    console.log("✅ Email transporter ready to send emails");
  }
});
// export const registerVendor = async (req, res) => {
//   try {
//     const {
//       firstName,
//       lastName,
//       email,
//       phone,
//       tillNumber,
//       businessName,
//       latitude,
//       longitude,
//       password,
//       note,
//       addresses,
//       acceptTerms
//     } = req.body;

//     console.log("📝 Registration attempt:", { email, phone, businessName });
//     console.log("📦 Request body:", req.body);

//     // Validate required fields
//     if (!firstName || !lastName) {
//       return res.status(400).json({ message: "First name and last name are required" });
//     }

//     if (!email) {
//       return res.status(400).json({ message: "Email is required" });
//     }

//     if (!phone) {
//       return res.status(400).json({ message: "Phone number is required" });
//     }

//     if (!tillNumber) {
//       return res.status(400).json({ message: "Till number is required" });
//     }

//     if (!businessName) {
//       return res.status(400).json({ message: "Business name is required" });
//     }

//     // Check if vendor already exists
//     const existingByEmail = await Vendor.findOne({ email });
//     if (existingByEmail) {
//       return res.status(400).json({ message: "Email already registered" });
//     }

//     // ✅ CHECK TRUE ONLY
//     if (acceptTerms !== true && acceptTerms !== "true") {
//       return res.status(400).json({
//         message: "acceptTerms must be true to register"
//       });
//     }

//     const existingByPhone = await Vendor.findOne({ phone });
//     if (existingByPhone) {
//       return res.status(400).json({ message: "Phone number already registered" });
//     }

//     // Check if till number already exists
//     const existingByTill = await Vendor.findOne({ tillNumber });
//     if (existingByTill) {
//       return res.status(400).json({ message: "Till number already registered" });
//     }

//     // Password validation
//     if (!password) {
//       return res.status(400).json({ message: "Password is required" });
//     }

//     if (password.length < 6) {
//       return res.status(400).json({ message: "Password must be at least 6 characters" });
//     }

// // Check for business logo - UPDATED FOR MULTER
//     if (!req.file) {
//       return res.status(400).json({ message: "Business logo required" });
//     }

//     console.log("📤 Uploading logo to Cloudinary...");

//     // Upload business logo to Cloudinary - UPDATED FOR MULTER
//     let logoUpload;
//     try {
//       logoUpload = await cloudinary.uploader.upload(
//         req.file.path, // 👈 Changed from req.files.businessLogo.tempFilePath
//         { folder: "vendorLogos" }
//       );
//       console.log("✅ Logo uploaded successfully");

//       // Clean up local file after upload
//       fs.unlinkSync(req.file.path);
//     } catch (uploadErr) {
//       console.error("❌ Cloudinary upload error:", uploadErr);
//       // Clean up file even on error
//       if (req.file?.path) fs.unlinkSync(req.file.path);
//       return res.status(500).json({
//         message: "Failed to upload business logo",
//         error: uploadErr.message
//       });
//     }

//     // Parse addresses from JSON string
//     let parsedAddresses = [];
//     try {
//       if (addresses) {
//         parsedAddresses = JSON.parse(addresses);
//       }
//     } catch (err) {
//       console.error("⚠️ Error parsing addresses:", err);
//       parsedAddresses = [];
//     }

//         // ── Generate OTP ───────────────────────────────────────────
//     const otp = generateOtp();
//     const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

//     console.log("💾 Creating vendor in database...");

//     // Create vendor object
//     const vendor = new Vendor({
//       name: `${firstName} ${lastName}`,
//       firstName,
//       lastName,
//       email,
//       phone,
//       tillNumber,
//       businessName,
//       businessLogo: logoUpload.secure_url,
//       password,
//       note: note || "",
//       addresses: parsedAddresses,
//       acceptTerms: true,
//       location: {
//         type: "Point",
//         coordinates: [parseFloat(longitude || 0), parseFloat(latitude || 0)],
//       },
//     });

//     await vendor.save();
//     console.log("✅ Vendor saved to database");

//     // 🔔 NOTIFY ADMIN ABOUT NEW VENDOR
//     try {
//       await Notification.create({
//         vendorId: vendor._id,
//         vendorName: vendor.businessName || vendor.name,
//         title: '👤 New Vendor Registration',
//         message: `${vendor.businessName || vendor.name} (${vendor.email}) has registered. Awaiting approval.`,
//         type: 'vendor',
//         isRead: false,
//       });
//       console.log("✅ Admin notification created");
//     } catch (notifErr) {
//       console.error("⚠️ Failed to create notification:", notifErr.message);
//       // Don't fail registration if notification fails
//     }

//     // Create password activation token
//     const token = jwt.sign(
//       { id: vendor._id, password },
//       process.env.JWT_SECRET_KEY,
//       { expiresIn: "10m" }
//     );


//     await vendor.save();

//     console.log("📧 Sending OTP email...");

//     // Send OTP email
//     try {
//       await sendOtpMail(email, otp);
//       console.log("✅ OTP email sent successfully");
//     } catch (emailErr) {
//       console.error("⚠️ Email sending failed:", emailErr.message);
//       // Don't fail registration if email fails
//     }

//     console.log("🎉 Registration completed successfully");

//     return res.status(201).json({
//       message: "Vendor registered successfully. Verify OTP to activate account.",
//       token,
//       vendorId: vendor._id
//     });

//   } catch (err) {
//     console.error("❌ Register Vendor Error:", err);
//     return res.status(500).json({
//       message: "Server error",
//       error: err.message
//     });
//   }
// };

// export const verifyOtpAndSetPassword = async (req, res) => {
//   try {
//     const { token, otp } = req.body;

//     if (!token || !otp)
//       return res.status(400).json({ message: "Token and OTP required" });

//     const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

//     const vendor = await Vendor.findById(decoded.id);
//     if (!vendor) return res.status(404).json({ message: "Vendor not found" });

//     if (otp !== vendor.otp)
//       return res.status(400).json({ message: "Invalid OTP" });

//     vendor.password = decoded.password;
//     vendor.otp = null;
//     vendor.otpExpiry = null;

//     await vendor.save();

//     return res.status(200).json({
//       message: "OTP verified & password activated. Waiting for admin approval."
//     });

//   } catch (err) {
//     console.error("OTP Verification Error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

export const registerVendor = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      tillNumber,
      businessName,
      latitude,
      longitude,
      password,
      note,
      addresses,
      acceptTerms
    } = req.body; 

    console.log("📝 Registration attempt:", { email, phone, businessName });
    console.log("📦 Request body:", req.body);

    // Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({ message: "First name and last name are required" });
    }
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }
    if (!tillNumber) {
      return res.status(400).json({ message: "Till number is required" });
    }
    if (!businessName) {
      return res.status(400).json({ message: "Business name is required" });
    }

    // Check if vendor already exists in DB
    const existingByEmail = await Vendor.findOne({ email });
    if (existingByEmail) {
      return res.status(400).json({ message: "Email already registered" });
    }

    if (acceptTerms !== true && acceptTerms !== "true") {
      return res.status(400).json({
        message: "acceptTerms must be true to register"
      });
    }

    const existingByPhone = await Vendor.findOne({ phone });
    if (existingByPhone) {
      return res.status(400).json({ message: "Phone number already registered" });
    }

    const existingByTill = await Vendor.findOne({ tillNumber });
    if (existingByTill) {
      return res.status(400).json({ message: "Till number already registered" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Business logo required" });
    }

    console.log("📤 Uploading logo to Cloudinary...");

    let logoUpload;
    try {
      logoUpload = await cloudinary.uploader.upload(
        req.file.path,
        { folder: "vendorLogos" }
      );
      console.log("✅ Logo uploaded successfully");
      fs.unlinkSync(req.file.path);
    } catch (uploadErr) {
      console.error("❌ Cloudinary upload error:", uploadErr);
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(500).json({
        message: "Failed to upload business logo",
        error: uploadErr.message
      });
    }

    let parsedAddresses = [];
    if (addresses !== undefined && addresses !== null && addresses !== "") {
      try {
        const addressData = typeof addresses === "string"
          ? JSON.parse(addresses)
          : addresses;

        if (Array.isArray(addressData)) {
          parsedAddresses = addressData;
        } else if (addressData && typeof addressData === "object") {
          parsedAddresses = [addressData];
        } else {
          return res.status(400).json({ message: "Invalid addresses format" });
        }
      } catch (err) {
        console.error("⚠️ Error parsing addresses:", err);
        return res.status(400).json({ message: "Invalid addresses format" });
      }
    }

    // Generate OTP
    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    // Store vendor data temporarily in memory (NOT saved to DB yet)
    const pendingData = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email,
      phone,
      tillNumber,
      businessName,
      businessLogo: logoUpload.secure_url,
      password,
      note: note || "",
      addresses: parsedAddresses,
      acceptTerms: true,
      location: {
        type: "Point",
        coordinates: [parseFloat(longitude || 0), parseFloat(latitude || 0)],
      },
      otp,
      otpExpiry,
    };

    pendingVendorRegistrations.set(email, pendingData);

    // Auto-cleanup after 10 minutes if OTP not verified
    setTimeout(() => {
      if (pendingVendorRegistrations.has(email)) {
        pendingVendorRegistrations.delete(email);
        console.log(`🧹 Cleaned up pending registration for ${email}`);
      }
    }, 10 * 60 * 1000);

    // Create token carrying email + password for OTP step
    const token = jwt.sign(
      { email, password },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "10m" }
    );

    console.log("📧 Sending OTP email...");

    try {
      await sendOtpMail(email, otp);
      console.log("✅ OTP email sent successfully");
    } catch (emailErr) {
      console.error("⚠️ Email sending failed:", emailErr.message);
    }

    console.log("🎉 Registration pending OTP verification");

    return res.status(201).json({
      message: "Vendor registered successfully. Verify OTP to activate account.",
      token,
      vendorId: null   // vendorId not yet assigned (vendor not in DB)
    });

  } catch (err) {
    console.error("❌ Register Vendor Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 – verifyOtpAndSetPassword
//   Verifies OTP → creates real Vendor → deletes TempVendor → notifies admin.
// ─────────────────────────────────────────────────────────────────────────────
export const verifyOtpAndSetPassword = async (req, res) => {
  try {
    const { token, otp } = req.body;

    if (!token || !otp)
      return res.status(400).json({ message: "Token and OTP required" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (err) {
      return res.status(400).json({ message: "Token expired or invalid. Please register again." });
    }

    const email = decoded.email;

    // Get pending registration data from memory
    const pendingData = pendingVendorRegistrations.get(email);

    if (!pendingData) {
      return res.status(400).json({
        message: "No pending registration found for this email. OTP may have expired. Please register again."
      });
    }

    // Check OTP expiry
    if (new Date() > new Date(pendingData.otpExpiry)) {
      pendingVendorRegistrations.delete(email);
      return res.status(400).json({ message: "OTP has expired. Please register again." });
    }

    // Validate OTP
    if (otp !== pendingData.otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // OTP verified — now create the vendor in DB
    const { otp: _otp, otpExpiry: _otpExpiry, ...vendorFields } = pendingData;

    const vendor = new Vendor(vendorFields);
    await vendor.save();

    // Remove from pending store
    pendingVendorRegistrations.delete(email);

    console.log("✅ Vendor created in DB after OTP verification:", vendor._id);

    // Notify admin about new vendor
    try {
      await Notification.create({
        vendorId: vendor._id,
        vendorName: vendor.businessName || vendor.name,
        title: '👤 New Vendor Registration',
        message: `${vendor.businessName || vendor.name} (${vendor.email}) has registered. Awaiting approval.`,
        type: 'vendor',
        isRead: false,
      });
      console.log("✅ Admin notification created");
    } catch (notifErr) {
      console.error("⚠️ Failed to create notification:", notifErr.message);
    }

    return res.status(200).json({
      message: "OTP verified & password activated. Waiting for admin approval."
    });

  } catch (err) {
    console.error("OTP Verification Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



export const loginVendor = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // ✅ At least one identifier required
    if ((!email && !phone) || !password) {
      return res.status(400).json({
        message: "Email or phone and password are required",
      });
    }

    // ✅ Find vendor by email OR phone
    const vendor = await Vendor.findOne({
      $or: [
        email ? { email } : null,
        phone ? { phone } : null,
      ].filter(Boolean),
    });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    if (!vendor.password) {
      return res.status(400).json({ message: "Password not set yet" });
    }

    // ❗ Plain password compare (bcrypt later)
    if (vendor.password !== password) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    // ✅ Admin approval check
    if (!vendor.isApproved) {
      return res
        .status(403)
        .json({ message: "Vendor not approved by admin" });
    }

    // ✅ Generate token
    const token = jwt.sign(
      { id: vendor._id, role: "vendor" },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "2h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful ✅",
      token,
      vendor,
    });

  } catch (err) {
    console.error("Login Vendor Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const vendorForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const vendor = await Vendor.findOne({ email });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const otp = generateOtp();
    vendor.otp = otp;
    vendor.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await vendor.save();

    await sendOtpMail(email, otp);

    return res.status(200).json({ message: "OTP sent to email" });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const vendorResendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const pendingData = pendingVendorRegistrations.get(email);

    if (pendingData) {
      const otp = generateOtp();
      pendingData.otp = otp;
      pendingData.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
      pendingVendorRegistrations.set(email, pendingData);

      try {
        await sendOtpMail(email, otp); // ✅ use sendOtpMail, not transporter
      } catch (emailErr) {
        console.error("⚠️ Email sending failed:", emailErr.message);
      }

      return res.status(200).json({ message: "OTP resent successfully" });
    }

    const vendor = await Vendor.findOne({ email });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const otp = generateOtp();
    vendor.otp = otp;
    vendor.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await vendor.save();

    try {
      await sendOtpMail(email, otp); // ✅ use sendOtpMail, not transporter
    } catch (emailErr) {
      console.error("⚠️ Email sending failed:", emailErr.message);
    }

    return res.status(200).json({ message: "OTP resent successfully" });

  } catch (err) {
    console.error("Resend OTP Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
export const vendorResetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const vendor = await Vendor.findOne({ email });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    if (otp !== vendor.otp)
      return res.status(400).json({ message: "Invalid OTP" });

    vendor.password = newPassword;
    vendor.otp = null;
    vendor.otpExpiry = null;
    await vendor.save();

    return res.status(200).json({ message: "Password reset successful" });

  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getVendorById = async (req, res) => {
  try {
    const { vendorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ message: "Invalid Vendor ID" });
    }

    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    return res.status(200).json({
      message: "Vendor fetched successfully",
      vendor
    });

  } catch (err) {
    console.error("Get Vendor By ID Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


export const updateVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    console.log("🔍 Update request for vendor:", vendorId);
    console.log("📦 Request body:", req.body);
    console.log("📎 File received:", req.file ? "Yes" : "No");

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ message: "Invalid Vendor ID" });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const {
      firstName,
      lastName,
      phone,
      tillNumber,
      businessName,
      latitude,
      longitude,
      password,
      note,
      addresses,
    } = req.body;

    /* ---------------- DUPLICATE CHECKS ---------------- */

    // ❌ Email update not allowed (ignore silently)
    if (req.body.email) {
      delete req.body.email;
    }

    // ✔ Phone duplicate check (except self)
    if (phone && phone !== vendor.phone) {
      const existingPhone = await Vendor.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ message: "Phone number already registered" });
      }
    }

    // ✔ Till number duplicate check (except self)
    if (tillNumber && tillNumber !== vendor.tillNumber) {
      const existingTill = await Vendor.findOne({ tillNumber });
      if (existingTill) {
        return res.status(400).json({ message: "Till number already registered" });
      }
    }

    /* ---------------- PASSWORD UPDATE (OPTIONAL) ---------------- */

    if (password) {
      if (password.length < 6) {
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters" });
      }
      vendor.password = password;
    }

    /* ---------------- BUSINESS LOGO (MULTER) ---------------- */

    if (req.file) {
      console.log("📤 Uploading new logo to Cloudinary...");
      try {
        const upload = await cloudinary.uploader.upload(
          req.file.path, // 👈 Changed from req.files.businessLogo.tempFilePath
          { folder: "vendorLogos" }
        );
        vendor.businessLogo = upload.secure_url;
        console.log("✅ Logo uploaded:", upload.secure_url);

        // Clean up local file
        fs.unlinkSync(req.file.path);
      } catch (uploadErr) {
        console.error("❌ Cloudinary upload error:", uploadErr);
        // Clean up file even on error
        if (req.file?.path) fs.unlinkSync(req.file.path);
        return res.status(500).json({
          message: "Failed to upload business logo",
          error: uploadErr.message
        });
      }
    }

    /* ---------------- ADDRESSES ---------------- */

    if (addresses !== undefined && addresses !== null) {
      try {
        const addressData = typeof addresses === "string"
          ? JSON.parse(addresses)
          : addresses;

        if (Array.isArray(addressData)) {
          vendor.addresses = addressData;
        } else if (addressData && typeof addressData === "object") {
          vendor.addresses = [addressData];
        } else {
          return res.status(400).json({ message: "Invalid addresses format" });
        }
        console.log("✅ Addresses updated:", vendor.addresses);
      } catch (err) {
        console.error("❌ Address parse error:", err);
        return res.status(400).json({ message: "Invalid addresses format" });
      }
    }

    /* ---------------- LOCATION ---------------- */

    if (latitude && longitude) {
      vendor.location = {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      };
      console.log("✅ Location updated:", vendor.location);
    }

    /* ---------------- BASIC FIELDS ---------------- */

    if (firstName) vendor.firstName = firstName;
    if (lastName) vendor.lastName = lastName;
    if (firstName || lastName) {
      vendor.name = `${firstName || vendor.firstName} ${lastName || vendor.lastName}`;
    }

    if (phone) vendor.phone = phone;
    if (tillNumber) vendor.tillNumber = tillNumber;
    if (businessName) vendor.businessName = businessName;
    if (note !== undefined) vendor.note = note;

    console.log("💾 Saving vendor updates...");
    await vendor.save();

    console.log("✅ Vendor updated successfully");

    return res.status(200).json({
      success: true,
      message: "Vendor updated successfully ✅",
      vendor,
    });

  } catch (err) {
    console.error("❌ Update Vendor Error:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};


/**
 * Normalize & validate the `location` field coming from req.body.
 * Accepts:
 *   - Array of objects: [{ state, city }, ...]
 *   - JSON string: '[{"state":"TS","city":"Hyd"}]'
 *   - Single object: { state, city }
 * Returns:
 *   { data: [{ state, city }] } on success
 *   { error: "message" } on failure
 */
function normalizeLocation(location) {
  if (location === undefined || location === null || location === '') {
    return { data: [] };
  }

  let parsed = location;

  // If sent as JSON string, try to parse
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      return { error: 'Invalid location format. Expected JSON array.' };
    }
  }

  // Wrap a single object into an array
  if (!Array.isArray(parsed)) {
    parsed = [parsed];
  }

  const cleaned = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (!item || typeof item !== 'object') {
      return { error: `location[${i}] must be an object with state and city` };
    }

    const state = (item.state || '').toString().trim();
    const city  = (item.city  || '').toString().trim();

    if (!state || !city) {
      return { error: `location[${i}] requires both 'state' and 'city'` };
    }

    cleaned.push({ state, city });
  }

  return { data: cleaned };
}


// Assuming generateCouponCode is imported or defined above:
function generateCouponCode(vendorPrefix, length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = vendorPrefix.toUpperCase().slice(0, 2); // first 2 letters from vendorPrefix

  for (let i = 0; i < length - 2; i++) { // 6 - 2 = 4 random chars
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

export const createCoupon = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // ✅ 1. Fetch vendor
    const vendor = await Vendor.findById(vendorId).select(
      "businessName businessLogo"
    );

    if (!vendor) {
      return res.status(404).json({
        message: "Vendor not found"
      });
    }

    // ✅ 2. Enforce logo presence
    if (!vendor.businessLogo) {
      return res.status(400).json({
        message: "Vendor business logo is required before creating coupon"
      });
    }

    // ✅ 3. Read only required inputs
    const {
      category,
      discountPercentage,
      validityDate,
      couponCodeType = "%",
      location = []
    } = req.body;

    if (!category || !discountPercentage || !validityDate) {
      return res.status(400).json({
        message: "category, discountPercentage and validityDate are required",
      });
    }

    const normalizedLocation = normalizeLocation(location);
    if (normalizedLocation.error) {
      return res.status(400).json({ message: normalizedLocation.error });
    }

    const parsedDate = new Date(validityDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid validityDate format" });
    }

    // ✅ 4. Create coupon
    /* ------------------ CREATE COUPON ------------------ */
    const coupon = await Coupon.create({
      vendorId: vendor._id,
      name: vendor.businessName,                 // auto
      category,
      discountPercentage,
      couponCode: generateCouponCode(vendor.businessName),
      validityDate: parsedDate,
      couponCodeType,
      couponImage: vendor.businessLogo,          // auto
      status: "pending",                         // admin approval
      location: normalizedLocation.data
    });


    // 🔔 NOTIFY ADMIN ABOUT NEW COUPON
    await notifyAdmin(
      vendor._id,
      "🆕 New Coupon Created",
      `${vendor.businessName} created a new coupon with ${discountPercentage}${couponCodeType} discount. Awaiting approval.`,
      "coupon"
    );

    await notifyVendor({
      vendorId: vendor._id,
      title: '🆕 Coupon Created',
      message: `Your coupon has been created and sent for admin approval.`,
      type: 'coupon_created',
      couponId: coupon._id
    });
    return res.status(201).json({
      message: "Coupon created successfully",
      coupon
    });

  } catch (error) {
    console.error("Create coupon error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};






export const createBulkCoupons = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const vendorPrefix = vendor.businessName || 'XX';

    const {
      count = 1,
      namePrefix = "",
      nameSuffix = "COUPON",
      category,
      discountPercentage,
      validityDate,
      couponCodeType = '%',
      location = []
    } = req.body;

    if (count < 1 || count > 1000) {
      return res.status(400).json({ message: 'Count must be between 1 and 1000' });
    }

    const validity = new Date(validityDate);
    if (isNaN(validity.getTime())) {
      return res.status(400).json({ message: 'Invalid validityDate format' });
    }

    const normalizedLocation = normalizeLocation(location);
    if (normalizedLocation.error) {
      return res.status(400).json({ message: normalizedLocation.error });
    }

    const createdCoupons = [];
    const failedCoupons = [];
    const padLength = String(count).length;

    for (let i = 1; i <= count; i++) {
      try {
        const paddedIndex = String(i).padStart(padLength, '0');
        const name = `${namePrefix}${namePrefix ? '_' : ''}${nameSuffix}_${paddedIndex}`;

        let couponCode;
        let isUnique = false;

        do {
          couponCode = generateCouponCode(vendorPrefix, 6);
          const existing = await Coupon.findOne({ couponCode });
          if (!existing) isUnique = true;
        } while (!isUnique);

        const coupon = new Coupon({
          vendorId,
          name,
          category,
          discountPercentage,
          couponCode,
          validityDate: validity,
          couponCodeType,

          // ✅ Vendor business image
          couponImage: vendor.businessLogo,
          location: normalizedLocation.data,

          // 🔒 Admin decides later
          status: 'pending'
        });

        await coupon.save();
        createdCoupons.push(coupon);

      } catch (error) {
        failedCoupons.push({ index: i, error: error.message });
      }
    }

    // 🔔 NOTIFY ADMIN ABOUT BULK CREATION
    await notifyAdmin(
      vendorId,
      '📦 Bulk Coupons Created',
      `${vendor.businessName} created ${createdCoupons.length} coupons in bulk. Awaiting approval.`,
      'coupon'
    );

    res.status(201).json({
      message: `Bulk coupon creation completed`,
      created: createdCoupons.length,
      failed: failedCoupons.length,
      coupons: createdCoupons,
      failures: failedCoupons
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


export const getCouponsByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const coupons = await Coupon.find({ vendorId });

    res.status(200).json({
      message: 'Coupons fetched successfully for vendor',
      total: coupons.length,
      coupons,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// GET: All available coupons for a user, optionally filtered by vendorId
export const getAllCoupons = async (req, res) => {
  try {
    const { userId } = req.params;
    const { vendorId } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    let query = { status: 'approved' };

    if (user.MyCoupons?.length) {
      query._id = { $nin: user.MyCoupons.map(c => c.couponId) };
    }

    if (vendorId) {
      query.vendorId = vendorId;
    }

    const coupons = await Coupon.find(query)
      .populate('vendorId', 'businessName businessLogo');

    if (!coupons.length) {
      return res.status(404).json({ message: 'No available coupons for this user.' });
    }

    res.status(200).json({
      message: 'Available coupons fetched successfully.',
      total: coupons.length,
      coupons,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


export const getCouponById = async (req, res) => {
  try {
    const { couponId } = req.params;

    if (!couponId) {
      return res.status(400).json({ message: 'couponId parameter is required' });
    }

    const coupon = await Coupon.findById(couponId)
      .populate('vendorId', 'businessName businessLogo'); // 🔍 populate vendor info

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.status(200).json({
      message: 'Coupon fetched successfully',
      coupon,
    });
  } catch (error) {
    console.error('Get coupon by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// export const getAllVendorCoupons = async (req, res) => {
//   try {
//     const { vendorId } = req.params;
//     const {
//       status,
//       category,
//       search,
//       page = 1,
//       limit = 10
//     } = req.query;

//     if (!vendorId) {
//       return res.status(400).json({ message: "vendorId is required" });
//     }

//     /* ---------- CHECK VENDOR ---------- */
//     const vendor = await Vendor.findById(vendorId);
//     if (!vendor) {
//       return res.status(404).json({ message: "Vendor not found" });
//     }

//     /* ---------- BUILD QUERY ---------- */
//     const query = { vendorId };

//     if (status) query.status = status;
//     if (category) query.category = category;

//     if (search) {
//       query.$or = [
//         { name: { $regex: search, $options: "i" } },
//         { couponCode: { $regex: search, $options: "i" } }
//       ];
//     }

//     const skip = (Number(page) - 1) * Number(limit);

//     /* ---------- FETCH COUPONS ---------- */
//     const coupons = await Coupon.find(query)
//       .populate("vendorId", "businessName businessLogo")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(Number(limit));

//     const total = await Coupon.countDocuments(query);

//     res.status(200).json({
//       message: "Vendor coupons fetched successfully",
//       vendor: {
//         id: vendor._id,
//         businessName: vendor.businessName
//       },
//       pagination: {
//         total,
//         page: Number(page),
//         limit: Number(limit),
//         totalPages: Math.ceil(total / limit)
//       },
//       coupons
//     });

//   } catch (error) {
//     console.error("Get all vendor coupons error:", error);
//     res.status(500).json({
//       message: "Server error",
//       error: error.message
//     });
//   }
// };

// In VendorController.js - Update this function to ensure fresh data


export const getAllVendorCoupons = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const {
      status,
      category,
      search,
      page = 1,
      limit = 10000
    } = req.query;

    if (!vendorId) {
      return res.status(400).json({ message: "vendorId is required" });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const query = { vendorId };

    if (status) query.status = status;
    if (category) query.category = category;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { couponCode: { $regex: search, $options: "i" } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Fetch fresh data
    const coupons = await Coupon.find(query)
      .populate("vendorId", "businessName businessLogo")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Coupon.countDocuments(query);

    // Log for debugging
    console.log(`📊 Vendor ${vendorId} - Found ${coupons.length} coupons`);
    coupons.forEach(c => {
      console.log(`   Coupon: ${c.name} | Status: ${c.status}`);
    });

    res.status(200).json({
      message: "Vendor coupons fetched successfully",
      vendor: {
        id: vendor._id,
        businessName: vendor.businessName
      },
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      },
      coupons
    });

  } catch (error) {
    console.error("Get all vendor coupons error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


// export const updateCoupon = async (req, res) => {
//   try {
//     const { couponId } = req.params;
//     const coupon = await Coupon.findById(couponId);

//     if (!coupon) {
//       return res.status(404).json({ message: "Coupon not found" });
//     }

//     // ✅ PREVENT UPDATES TO APPROVED COUPONS WITHOUT GOING BACK TO PENDING
//     if (coupon.status === 'approved') {
//       coupon.status = 'pending'; // Reset to pending for re-approval
//     }

//     const {
//       name,
//       category,
//       discountPercentage,
//       validityDate,
//       couponCodeType
//     } = req.body;

//     // Track changes for notification
//     const changes = [];

//     if (validityDate) {
//       const parsedDate = new Date(validityDate);
//       if (isNaN(parsedDate.getTime())) {
//         return res.status(400).json({ message: "Invalid validityDate format" });
//       }
//       if (coupon.validityDate.getTime() !== parsedDate.getTime()) {
//         changes.push(`validity date to ${parsedDate.toLocaleDateString()}`);
//         coupon.validityDate = parsedDate;
//       }
//     }

//     if (name !== undefined && name !== coupon.name) {
//       changes.push(`name from "${coupon.name}" to "${name}"`);
//       coupon.name = name;
//     }

//     if (category !== undefined && category !== coupon.category) {
//       changes.push(`category from "${coupon.category}" to "${category}"`);
//       coupon.category = category;
//     }

//     if (discountPercentage !== undefined && discountPercentage !== coupon.discountPercentage) {
//       changes.push(`discount from ${coupon.discountPercentage}${coupon.couponCodeType} to ${discountPercentage}${couponCodeType || coupon.couponCodeType}`);
//       coupon.discountPercentage = discountPercentage;
//     }

//     if (couponCodeType !== undefined && couponCodeType !== coupon.couponCodeType) {
//       changes.push(`discount type to "${couponCodeType}"`);
//       coupon.couponCodeType = couponCodeType;
//     }

//     await coupon.save();

//     // 🔔 NOTIFY ADMIN ABOUT UPDATES
//     if (changes.length > 0) {
//       await notifyAdmin(
//         coupon.vendorId._id,
//         '✏️ Coupon Updated',
//         `${coupon.vendorId.businessName} updated coupon "${coupon.name}": Changed ${changes.join(', ')}. Awaiting re-approval.`,
//         'coupon'
//       );
//     }

//     res.status(200).json({
//       success: true,
//       message: "Coupon updated successfully ✅",
//       coupon,
//     });

//   } catch (error) {
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };




// Function to upload the coupon image and update coupon details

export const updateCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    // ✅ REMOVED: Don't reset approved coupons to pending automatically
    // Let admin control the status

    const {
      name,
      category,
      discountPercentage,
      validityDate,
      couponCodeType,
      status,
    } = req.body;

    // Track changes for notification
    const changes = [];

    // Handle status changes with validation
    if (status !== undefined && status !== coupon.status) {
      const validStatuses = ['pending', 'approved', 'rejected'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          message: "Invalid status. Status must be 'pending', 'approved', or 'rejected'"
        });
      }

      // Add status change to changes array
      changes.push(`status from "${coupon.status}" to "${status}"`);
      coupon.status = status;
    }

    if (validityDate) {
      const parsedDate = new Date(validityDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid validityDate format" });
      }
      if (coupon.validityDate.getTime() !== parsedDate.getTime()) {
        changes.push(`validity date to ${parsedDate.toLocaleDateString()}`);
        coupon.validityDate = parsedDate;
      }
    }

    if (name !== undefined && name !== coupon.name) {
      changes.push(`name from "${coupon.name}" to "${name}"`);
      coupon.name = name;
    }

    if (category !== undefined && category !== coupon.category) {
      changes.push(`category from "${coupon.category}" to "${category}"`);
      coupon.category = category;
    }

    if (discountPercentage !== undefined && discountPercentage !== coupon.discountPercentage) {
      changes.push(`discount from ${coupon.discountPercentage}${coupon.couponCodeType} to ${discountPercentage}${couponCodeType || coupon.couponCodeType}`);
      coupon.discountPercentage = discountPercentage;
    }

    if (couponCodeType !== undefined && couponCodeType !== coupon.couponCodeType) {
      changes.push(`discount type to "${couponCodeType}"`);
      coupon.couponCodeType = couponCodeType;
    }

    await coupon.save();

    // 🔔 NOTIFY ADMIN ABOUT UPDATES
    if (changes.length > 0) {
      const vendor = await Vendor.findById(coupon.vendorId).select('businessName name');
      await notifyAdmin(
        coupon.vendorId,
        '✏️ Coupon Updated',
        `${vendor?.businessName || 'Vendor'} updated coupon "${coupon.name}": Changed ${changes.join(', ')}.`,
        'coupon'
      );
    }

    res.status(200).json({
      success: true,
      message: "Coupon updated successfully ✅",
      coupon,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
export const updateCouponImage = async (req, res) => {
  try {
    const { couponId } = req.params;

    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const coupon = await Coupon.findById(couponId).populate('vendorId', 'businessLogo');
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    // ✅ RESET TO PENDING IF APPROVED
    if (coupon.status === 'approved') {
      coupon.status = 'pending';
    }

    // ✅ UPLOAD NEW COUPON IMAGE
    try {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: 'couponImages',
        resource_type: 'auto'
      });

      coupon.couponImage = uploadResult.secure_url;

      // Clean up local file
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

    } catch (uploadErr) {
      console.error('❌ Cloudinary upload error:', uploadErr);
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({
        message: 'Failed to upload coupon image',
        error: uploadErr.message
      });
    }

    await coupon.save();

    // 🔔 NOTIFY ADMIN ABOUT IMAGE UPDATE
    await notifyAdmin(
      coupon.vendorId._id,
      '🖼️ Coupon Image Updated',
      `${coupon.vendorId.businessName} updated the image for coupon "${coupon.name}". Awaiting re-approval.`,
      'coupon'
    );

    // ✅ Keep your existing response structure
    res.status(200).json({
      message: 'Coupon image updated successfully. Sent for admin re-approval.',
      coupon,
      status: "Pending admin approval"
    });

  } catch (error) {
    console.error('Update coupon image error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};

export const getCouponImage = async (req, res) => {
  try {
    const { couponId } = req.params;

    // Find coupon
    const coupon = await Coupon.findById(couponId)
      .populate('vendorId', 'businessName businessLogo');

    if (!coupon) {
      return res.status(404).json({
        message: 'Coupon not found'
      });
    }

    // If no image
    if (!coupon.couponImage) {
      return res.status(404).json({
        message: 'No image found for this coupon'
      });
    }

    // ✅ Response (same clean structure)
    res.status(200).json({
      message: 'Coupon image fetched successfully',
      couponId: coupon._id,
      couponName: coupon.name,
      couponImage: coupon.couponImage,
      vendor: {
        vendorId: coupon.vendorId?._id,
        businessName: coupon.vendorId?.businessName,
        businessLogo: coupon.vendorId?.businessLogo
      }
    });

  } catch (error) {
    console.error('Get coupon image error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};


export const getActiveCoupons = async (req, res) => {
  try {
    const { businessName } = req.query;

    let query = { status: 'active' }; // Only fetch coupons with status 'active'

    // 🔍 If businessName is passed, find matching vendor(s)
    if (businessName) {
      const matchingVendors = await Vendor.find({
        businessName: { $regex: businessName, $options: 'i' }, // case-insensitive match
      }).select('_id');

      const vendorIds = matchingVendors.map(v => v._id);
      query.vendorId = { $in: vendorIds }; // Match only the vendors from the query
    }

    // Fetch coupons matching the query with active status
    const coupons = await Coupon.find(query)
      .populate('vendorId', 'businessName businessLogo'); // Populate vendor details

    res.status(200).json({
      message: 'Active coupons fetched successfully',
      total: coupons.length,
      coupons,
    });
  } catch (error) {
    console.error('Get active coupons error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const uploadGuideVideo = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // Check if video file is provided in the request
    if (!req.files || !req.files.video) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    const video = req.files.video;

    // Upload video to Cloudinary
    const uploadedVideo = await cloudinary.uploader.upload(video.tempFilePath, {
      folder: 'guideVideos',  // Specify the folder in Cloudinary
      resource_type: 'video', // Specify the type as video
      use_filename: true,
      unique_filename: true,
    });

    const videoUrl = uploadedVideo.secure_url; // Store the URL of the uploaded video

    // Create a new guide video document
    const guideVideo = new GuideVideo({
      title,
      videoUrl,
    });

    await guideVideo.save();

    res.status(201).json({
      message: 'Guide video uploaded successfully',
      guideVideo,
    });
  } catch (error) {
    console.error('Upload guide video error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};





export const generateQuizzes = async (req, res) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const allQuizzes = [];
  const totalRequests = 5; // 5 x 20 = 100 quizzes

  for (let i = 0; i < totalRequests; i++) {
    console.log(`🔁 Request ${i + 1}/${totalRequests}`);

    const prompt = `
Generate 20 unique multiple-choice trivia questions (with 4 options and the correct answer marked) 
on world history. Format the response as valid JSON in this structure:
[
  {
    "question": "What is ...?",
    "options": ["A", "B", "C", "D"],
    "answer": "B"
  },
  ...
]
Only respond with JSON. Do not include any explanation or extra text.
`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response.text();

      // Clean JSON (Gemini sometimes wraps it in triple backticks or explanation)
      const cleanedJson = response
        .replace(/^```json/, "")
        .replace(/^```/, "")
        .replace(/```$/, "")
        .trim();

      const parsed = JSON.parse(cleanedJson);

      if (Array.isArray(parsed) && parsed.length === 20) {
        allQuizzes.push(...parsed);
      } else {
        console.warn(`⚠️ Batch ${i + 1} returned invalid format.`);
      }
    } catch (error) {
      console.error(`❌ Error on batch ${i + 1}:`, error.message);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
  }

  res.json({
    message: '✅ Successfully generated quizzes',
    total: allQuizzes.length,
    quizzes: allQuizzes,
  });
};



export const spinTheWheel = async (req, res) => {
  try {
    const { coins, coupons } = req.body;

    // Parse coins
    let coinArray = [];
    if (coins && typeof coins === "string") {
      coinArray = coins.split(",").map(val => parseInt(val.trim())).filter(val => !isNaN(val));
    }

    // Parse coupons
    let couponArray = [];
    if (coupons && typeof coupons === "string") {
      couponArray = coupons.split(",").map(val => parseInt(val.trim())).filter(val => !isNaN(val));
    }

    if (coinArray.length === 0 && couponArray.length === 0) {
      return res.status(400).json({ success: false, message: "No valid coin or coupon values found" });
    }

    let coinDoc = await SpinCoin.findOne();
    if (!coinDoc) {
      coinDoc = await SpinCoin.create({
        coins: coinArray,
        coupons: couponArray
      });
    } else {
      if (coinArray.length > 0) coinDoc.coins.push(...coinArray);
      if (couponArray.length > 0) coinDoc.coupons.push(...couponArray);
      await coinDoc.save();
    }

    res.status(200).json({
      success: true,
      message: "Coins and/or Coupons added successfully",
      coins: coinDoc.coins,
      coupons: coinDoc.coupons
    });
  } catch (error) {
    console.error("❌ Error adding coins/coupons:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const createSurvey = async (req, res) => {
  try {
    const { vendorId, questions } = req.body;

    // ✅ Validate input
    if (!vendorId || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vendor ID and at least one question are required.',
      });
    }

    // ✅ Check vendor existence
    const vendor = await Vendor.findById(vendorId).select('name businessLogo');
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // ✅ Validate each question
    for (const question of questions) {
      if (
        !question.questionText ||
        !Array.isArray(question.options) ||
        question.options.length !== 4
      ) {
        return res.status(400).json({
          success: false,
          message: 'Each question must have questionText and exactly 4 options.',
        });
      }
    }

    // ✅ Create survey
    const newSurvey = await Survey.create({ vendorId, questions });

    // ✅ Get all users except the vendor
    const users = await User.find({ _id: { $ne: vendorId } });

    // ✅ Create bulk notification operations
    const notificationMessage = `${vendor.name} has sent a survey. Please take a moment to respond.`;
    const createdAt = new Date();

    const bulkOperations = users.map((user) => ({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $push: {
            notifications: {
              message: notificationMessage,
              senderId: vendorId,
              receiverId: user._id,
              vendorId: vendor._id,
              vendorName: vendor.name,
              vendorLogo: vendor.businessLogo || '',
              type: 'survey',
              read: false,
              createdAt,
            },
          },
        },
      },
    }));

    // ✅ Execute bulk write
    if (bulkOperations.length > 0) {
      await User.bulkWrite(bulkOperations);
    }

    // ✅ Response
    return res.status(201).json({
      success: true,
      message: 'Survey created successfully and users notified.',
      data: newSurvey,
    });
  } catch (error) {
    console.error('Error creating survey:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};


// Function to update coupon status to 'used' by vendor
export const updateCouponStatus = async (req, res) => {
  try {
    const { vendorId, couponId } = req.params;

    // Check if both vendorId and couponId are provided
    if (!vendorId || !couponId) {
      return res.status(400).json({ message: 'Vendor ID and Coupon ID are required' });
    }

    // Find the coupon by ID
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    // Optional: You can also check if this coupon belongs to the vendor (if such relation exists)

    // Update the status of the coupon to 'used'
    coupon.status = 'used';

    // Save the updated coupon
    await coupon.save();

    // Replace the notification part in updateCouponStatus:
    const notificationType = status === 'approved'
      ? 'coupon_approved'
      : status === 'rejected'
        ? 'coupon_rejected'
        : 'coupon_submitted';

    // 🔔 NOTIFY VENDOR about admin decision
    const notificationTitle = status === 'approved'
      ? '✅ Coupon Approved'
      : status === 'rejected'
        ? '❌ Coupon Rejected'
        : '⏳ Coupon Pending';

    let notificationMessage = status === 'approved'
      ? `Your coupon "${coupon.name}" has been approved by admin and is now live.`
      : status === 'rejected'
        ? `Your coupon "${coupon.name}" has been rejected. ${rejectionReason ? 'Reason: ' + rejectionReason : ''}`
        : `Your coupon "${coupon.name}" is under review.`;

    await notifyVendor({
      vendorId: coupon.vendorId._id,
      title: notificationTitle,
      message: notificationMessage,
      type: notificationType,
      metadata: {
        couponId: coupon._id,
        couponName: coupon.name,
        status: status,
        rejectionReason: rejectionReason || null
      }
    });

    return res.status(200).json({
      message: 'Coupon status updated to used',
      coupon: {
        id: coupon._id,
        name: coupon.name,
        category: coupon.category,
        discountPercentage: coupon.discountPercentage,
        requiredCoins: coupon.requiredCoins,
        couponCode: coupon.couponCode,
        couponImage: coupon.couponImage,
        status: coupon.status, // Should now be "used"
        validityDate: coupon.validityDate,
      },
    });
  } catch (error) {
    console.error('Error updating coupon status:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


export const getVendorCouponUsageHistory = async (req, res) => {
  const { vendorId } = req.params;

  if (!vendorId) {
    return res.status(400).json({
      success: false,
      message: 'Vendor ID is required'
    });
  }

  try {
    console.log(`📊 Fetching usage history for vendor: ${vendorId}`);

    const vendorCoupons = await Coupon.find({ vendorId }).lean();
    const vendorCouponIds = vendorCoupons.map(c => c._id.toString());

    console.log(`📦 Found ${vendorCoupons.length} coupons for this vendor`);

    const users = await User.find({}).lean();

    // Get ALL feedback for vendor's coupons
    let allFeedbacks = [];
    try {
      if (vendorCouponIds.length > 0) {
        allFeedbacks = await UserCouponFeedback.find({
          couponId: { $in: vendorCouponIds }
        }).lean();
        console.log(`📝 Found ${allFeedbacks.length} total feedback entries`);
      }
    } catch (fbError) {
      console.log('⚠️ Could not fetch feedback:', fbError.message);
    }

    // Create map for feedback by userCouponId
    const feedbackByUserCouponId = new Map();

    allFeedbacks.forEach(fb => {
      if (fb.userCouponId) {
        feedbackByUserCouponId.set(fb.userCouponId.toString(), fb);
      }
    });

    let history = [];

    for (const user of users) {
      if (!user || !user._id) continue;

      // ✅ FIX: Generate Customer_ID as C + last 6 digits of userId
      const userIdStr = user._id.toString();
      const customerId = `C${userIdStr.slice(-6)}`;

      if (user.MyCoupons && Array.isArray(user.MyCoupons)) {
        for (const mc of user.MyCoupons) {
          if (!mc || !mc.couponId) continue;

          const mcCouponId = mc.couponId.toString();
          const coupon = vendorCoupons.find(c => c._id.toString() === mcCouponId);

          if (coupon) {
            // Get download/purchase date
            let downloadDate = mc.purchasedAt || mc.createdAt || mc.claimedAt || coupon.createdAt;

            // Determine redeem date and status
            let redeemDate = null;
            let redeemTime = null;
            let redeemStatus = 'Not Redeemed';

            if (mc.claimedAt) {
              redeemDate = mc.claimedAt;
              redeemTime = mc.claimedAt;
              redeemStatus = 'Redeemed';
            } else if (mc.usedAt) {
              redeemDate = mc.usedAt;
              redeemTime = mc.usedAt;
              redeemStatus = 'Redeemed';
            } else if (mc.status === 'Used' || mc.status === 'Redeemed') {
              redeemDate = mc.updatedAt || mc.validityDate || coupon.validityDate;
              redeemTime = mc.updatedAt || mc.validityDate || coupon.validityDate;
              redeemStatus = 'Redeemed';
            } else if (mc.status === 'Active') {
              redeemStatus = 'Active';
            } else if (mc.status === 'Expired') {
              redeemStatus = 'Expired';
            }

            // Find feedback for this specific purchase
            let feedback = null;
            let feedbackText = 'N/A';
            let feedbackCreatedAt = null;

            if (mc._id) {
              feedback = feedbackByUserCouponId.get(mc._id.toString());
              if (feedback) {
                feedbackCreatedAt = feedback.createdAt || feedback.updatedAt;
              }
            }

            // Format feedback text
            if (feedback) {
              const rating = feedback.rating || 0;
              const description = feedback.description || '';
              const stars = '⭐'.repeat(Math.min(Math.floor(rating), 5));
              const descText = description ? ` - ${description}` : '';
              feedbackText = `${rating}${stars}${descText}`;
            } else {
              if (redeemStatus === 'Redeemed') {
                feedbackText = 'Awaiting Feedback';
              } else if (redeemStatus === 'Active') {
                feedbackText = 'Not Yet Used';
              } else if (redeemStatus === 'Expired') {
                feedbackText = 'Expired - No Feedback';
              }
            }

            // Format dates in CST
            const downloadedDateFormatted = formatDateInCST(downloadDate);
            const downloadedTimeFormatted = formatTimeInCST(downloadDate);
            const redeemedDateFormatted = redeemDate ? formatDateInCST(redeemDate) : 'N/A';
            const redeemedTimeFormatted = redeemTime ? formatTimeInCST(redeemTime) : 'N/A';

            const sortDateTime = downloadDate ? new Date(downloadDate) : new Date(0);

            history.push({
              Customer_ID: customerId,  // ✅ Now using C + last 6 digits
              Coupon_ID: coupon.couponCode || 'N/A',
              Discount: `${coupon.discountPercentage || 0}${coupon.couponCodeType === '%' ? '% off' : ''}`,
              Downloaded: downloadedDateFormatted,
              Downloaded_Time: downloadedTimeFormatted,
              Redeemed_Date: redeemedDateFormatted,
              Redeemed_Time: redeemedTimeFormatted,
              Order_Details: mc.orderDetails || 'N/A',
              Order_Value: mc.orderValue ? `$${mc.orderValue}` : '$0.00',
              Feedback: feedbackText,
              _sortDateTime: sortDateTime,
              _hasFeedback: feedback !== null,
              _feedbackCreatedAt: feedbackCreatedAt,
              _purchaseDate: downloadDate
            });
          }
        }
      }
    }

    // Sort by download date - LATEST FIRST
    history.sort((a, b) => {
      const dateA = a._sortDateTime instanceof Date ? a._sortDateTime : new Date(a._sortDateTime);
      const dateB = b._sortDateTime instanceof Date ? b._sortDateTime : new Date(b._sortDateTime);
      return dateB - dateA;
    });

    // Assign SI_No starting from 1 after sorting
    const finalHistory = history.map((item, index) => {
      const { _sortDateTime, _hasFeedback, _feedbackCreatedAt, _purchaseDate, ...cleanItem } = item;
      return {
        SI_No: index + 1,
        ...cleanItem
      };
    });

    console.log(`\n✅ TOTAL: ${finalHistory.length} entries`);
    console.log(`✅ Sorted: Latest purchases first (most recent users at top)`);

    return res.status(200).json({
      success: true,
      count: finalHistory.length,
      history: finalHistory
    });

  } catch (error) {
    console.error('getVendorCouponUsageHistory error:', error);

    return res.status(500).json({
      success: false,
      message: 'Error fetching coupon usage history',
      error: error.message
    });
  }
};

// Helper functions for CST (Central Standard Time)
function formatDateInCST(date) {
  if (!date) return 'N/A';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';

    // Convert to CST by subtracting 5 hours (CST is UTC-5)
    const cstDate = new Date(d.getTime() - (5 * 60 * 60 * 1000));

    const year = cstDate.getUTCFullYear();
    const month = String(cstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(cstDate.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch {
    return 'N/A';
  }
}

function formatTimeInCST(date) {
  if (!date) return 'N/A';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';

    // Convert to CST by subtracting 5 hours (CST is UTC-5)
    const cstDate = new Date(d.getTime() - (5 * 60 * 60 * 1000));

    let hours = cstDate.getUTCHours();
    const minutes = String(cstDate.getUTCMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  } catch {
    return 'N/A';
  }
}



// DELETE /api/vendor/:vendorId/coupon-usage-history
// Clear/Delete vendor coupon usage history
export const deleteVendorCouponUsageHistory = async (req, res) => {
  const { vendorId } = req.params;
  const { clearAll, keepLastMonths, deleteSpecificCoupon } = req.body;

  if (!vendorId) {
    return res.status(400).json({
      success: false,
      message: 'Vendor ID is required'
    });
  }

  try {
    console.log(`🗑️ Deleting coupon usage history for vendor: ${vendorId}`);

    // Validate vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Get all vendor coupons
    const vendorCoupons = await Coupon.find({ vendorId }).select('_id');
    const vendorCouponIds = vendorCoupons.map(c => c._id);

    if (vendorCouponIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No coupons found for this vendor, nothing to delete',
        deletedCount: 0
      });
    }

    let deletedCount = 0;
    let deletionDetails = {};

    // Option 1: Delete ALL usage history for this vendor
    if (clearAll === true) {
      const result = await User.updateMany(
        { 'MyCoupons.couponId': { $in: vendorCouponIds } },
        { $pull: { MyCoupons: { couponId: { $in: vendorCouponIds } } } }
      );
      deletedCount = result.modifiedCount;
      deletionDetails = { totalUsersAffected: result.modifiedCount };

      console.log(`✅ Deleted all usage history, affected ${deletedCount} users`);
    }

    // Option 2: Delete history older than X months
    else if (keepLastMonths && typeof keepLastMonths === 'number') {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - keepLastMonths);

      const result = await User.updateMany(
        {
          'MyCoupons.couponId': { $in: vendorCouponIds },
          'MyCoupons.claimedAt': { $lt: cutoffDate }
        },
        {
          $pull: {
            MyCoupons: {
              couponId: { $in: vendorCouponIds },
              claimedAt: { $lt: cutoffDate }
            }
          }
        }
      );
      deletedCount = result.modifiedCount;
      deletionDetails = {
        olderThanMonths: keepLastMonths,
        cutoffDate: cutoffDate.toISOString(),
        totalUsersAffected: result.modifiedCount
      };

      console.log(`✅ Deleted history older than ${keepLastMonths} months, affected ${deletedCount} users`);
    }

    // Option 3: Delete history for specific coupon
    else if (deleteSpecificCoupon) {
      const specificCoupon = await Coupon.findOne({
        _id: deleteSpecificCoupon,
        vendorId
      });

      if (!specificCoupon) {
        return res.status(404).json({
          success: false,
          message: 'Coupon not found or does not belong to this vendor'
        });
      }

      const result = await User.updateMany(
        { 'MyCoupons.couponId': specificCoupon._id },
        { $pull: { MyCoupons: { couponId: specificCoupon._id } } }
      );
      deletedCount = result.modifiedCount;
      deletionDetails = {
        couponId: specificCoupon._id,
        couponCode: specificCoupon.couponCode,
        couponName: specificCoupon.name,
        totalUsersAffected: result.modifiedCount
      };

      console.log(`✅ Deleted history for coupon ${specificCoupon.couponCode}, affected ${deletedCount} users`);
    }

    // Option 4: Delete feedback entries only (keep usage)
    else if (req.query.deleteFeedbackOnly === 'true') {
      const result = await UserCouponFeedback.deleteMany({
        couponId: { $in: vendorCouponIds }
      });
      deletedCount = result.deletedCount;
      deletionDetails = { feedbackEntriesDeleted: result.deletedCount };

      console.log(`✅ Deleted ${deletedCount} feedback entries`);
    }

    else {
      return res.status(400).json({
        success: false,
        message: 'Please specify deletion criteria: clearAll, keepLastMonths, deleteSpecificCoupon, or deleteFeedbackOnly'
      });
    }

    // 🔔 Notify vendor about history deletion
    await notifyVendor({
      vendorId: vendor._id,
      title: '🗑️ Usage History Deleted',
      message: `Coupon usage history has been ${clearAll ? 'completely cleared' : 'partially deleted'}. ${deletedCount} records affected.`,
      type: 'general',
      metadata: deletionDetails
    });

    return res.status(200).json({
      success: true,
      message: 'Coupon usage history deleted successfully',
      data: {
        vendorId: vendor._id,
        vendorName: vendor.businessName || vendor.name,
        deletionType: clearAll ? 'all' : (keepLastMonths ? `older_than_${keepLastMonths}_months` : (deleteSpecificCoupon ? 'specific_coupon' : 'feedback_only')),
        deletedCount,
        details: deletionDetails,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('deleteVendorCouponUsageHistory error:', error);

    return res.status(500).json({
      success: false,
      message: 'Error deleting coupon usage history',
      error: error.message
    });
  }
};


export const uploadVendorDocuments = async (req, res) => {
  try {
    const { vendorId } = req.params;

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const allowedDocs = ['Driving License', 'State ID', 'Tax Certificate', 'Business License'];
    let uploadedDocs = [];

    for (let docType of allowedDocs) {
      if (req.files[docType]) {

        const filePath = req.files[docType][0].path;

        // ✅ Upload ANY file type
        const uploaded = await cloudinary.uploader.upload(filePath, {
          folder: `vendorDocuments/${vendorId}`,
          resource_type: "auto"  // 🔥 VERY IMPORTANT FOR FILES
        });

        uploadedDocs.push({
          type: docType,
          url: uploaded.secure_url,
          uploadedAt: new Date()
        });

        // delete local file
        fs.unlinkSync(filePath);
      }
    }

    if (uploadedDocs.length === 0) {
      return res.status(400).json({ message: "No valid files uploaded" });
    }

    vendor.documents.push(...uploadedDocs);
    await vendor.save();

    return res.status(200).json({
      success: true,
      message: "Documents uploaded successfully",
      totalDocuments: vendor.documents.length,
      uploadedDocs
    });

  } catch (error) {
    console.error("Upload Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



export const getVendorDocuments = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // Find vendor by ID and select only documents field
    const vendor = await Vendor.findById(vendorId).select('documents');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.status(200).json({
      message: 'Vendor documents fetched successfully',
      documents: vendor.documents,
    });
  } catch (error) {
    console.error('getVendorDocuments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


export const getSurveysByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required.",
      });
    }

    // Find surveys for the given vendorId
    const surveys = await Survey.find({ vendorId });

    if (!surveys || surveys.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No surveys found for this vendor.",
      });
    }

    // For each survey, map responses' answers to include questionId
    const surveysWithQuestionIds = surveys.map((survey) => {
      // Convert Mongoose doc to plain JS object if needed
      const surveyObj = survey.toObject();

      if (surveyObj.responses) {
        surveyObj.responses = surveyObj.responses.map((response) => {
          const updatedAnswers = response.answers.map((answer) => {
            // Get question _id from questions array using questionIndex
            const question = surveyObj.questions[answer.questionIndex];

            return {
              ...answer,
              questionId: question ? question._id : null,
            };
          });

          return {
            ...response,
            answers: updatedAnswers,
          };
        });
      }

      return surveyObj;
    });

    return res.status(200).json({
      success: true,
      message: "Surveys fetched successfully.",
      data: surveysWithQuestionIds,
    });
  } catch (error) {
    console.error("Error fetching surveys:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



export const getAllNotifications = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { type, isRead, limit = 50, page = 1 } = req.query;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Vendor ID is required'
      });
    }

    // Build filter
    let filter = {
      userId: { $exists: false }  // ✅ Exclude user notifications
    };
    if (type) filter.type = type;
    if (isRead !== undefined) filter.isRead = isRead === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find(filter)
      .populate({ path: 'userId', select: 'name profileImage email' })
      .populate({ path: 'couponId', select: 'name couponCode discountPercentage' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ ...filter, isRead: false });

    res.status(200).json({
      success: true,
      message: 'Vendor notifications fetched successfully',
      data: {
        notifications,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        },
        stats: {
          total,
          unread: unreadCount,
          read: total - unreadCount
        }
      }
    });

  } catch (error) {
    console.error('Get vendor notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications',
      error: error.message
    });
  }
};



export const getDashboardData = async (req, res) => {
  try {
    const { vendorId } = req.params;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required"
      });
    }

    // Validate vendorId format
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Vendor ID format"
      });
    }

    // Verify vendor exists
    const vendor = await Vendor.findById(vendorId).select(
      'businessName name email phone businessLogo location isApproved note firstName lastName tillNumber addresses acceptTerms'
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found"
      });
    }

    // ==================== DATE CALCULATIONS ====================
    const now = new Date();

    // Today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Yesterday
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(todayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);
    yesterdayEnd.setMilliseconds(-1);

    // This Week (Monday to Sunday - matching your original)
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // Convert Sunday (0) to 7
    const thisWeekStart = new Date(todayStart);
    thisWeekStart.setDate(todayStart.getDate() - (dayOfWeek - 1));

    // Last Week
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setMilliseconds(-1);

    // This Month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Last Month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Last 7 Days for charts
    const last7Days = new Date(now);
    last7Days.setDate(now.getDate() - 7);
    last7Days.setHours(0, 0, 0, 0);

    // ==================== GET VENDOR COUPONS ====================
    const vendorCoupons = await Coupon.find({ vendorId })
      .select('_id name category discountPercentage couponImage validityDate status downloaded')
      .lean();

    const couponIds = vendorCoupons.map(c => c._id);
    const couponIdsObject = couponIds.map(id => new mongoose.Types.ObjectId(id));

    // ==================== COUPON STATISTICS ====================
    const [
      totalCoupons,
      activeCoupons,
      pendingCoupons,
      expiredCoupons
    ] = await Promise.all([
      Coupon.countDocuments({ vendorId }),
      Coupon.countDocuments({
        vendorId,
        status: 'approved',
        validityDate: { $gte: now }
      }),
      Coupon.countDocuments({ vendorId, status: 'pending' }),
      Coupon.countDocuments({
        vendorId,
        validityDate: { $lt: now }
      })
    ]);

    // ==================== DOWNLOAD STATISTICS ====================
    // Total Downloads
    const totalDownloadsAgg = await User.aggregate([
      { $unwind: '$MyCoupons' },
      { $match: { 'MyCoupons.couponId': { $in: couponIdsObject } } },
      { $count: 'total' }
    ]);
    const totalDownloadCount = totalDownloadsAgg.length > 0 ? totalDownloadsAgg[0].total : 0;

    // Today's Downloads
    const todayDownloadsAgg = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.couponId': { $in: couponIdsObject },
          'MyCoupons.claimedAt': { $gte: todayStart }
        }
      },
      { $count: 'total' }
    ]);
    const downloadsToday = todayDownloadsAgg.length > 0 ? todayDownloadsAgg[0].total : 0;

    // Yesterday's Downloads
    const yesterdayDownloadsAgg = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.couponId': { $in: couponIdsObject },
          'MyCoupons.claimedAt': { $gte: yesterdayStart, $lte: yesterdayEnd }
        }
      },
      { $count: 'total' }
    ]);
    const downloadsYesterday = yesterdayDownloadsAgg.length > 0 ? yesterdayDownloadsAgg[0].total : 0;

    // This Week's Downloads
    const weekDownloadsAgg = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.couponId': { $in: couponIdsObject },
          'MyCoupons.claimedAt': { $gte: thisWeekStart }
        }
      },
      { $count: 'total' }
    ]);
    const downloadsThisWeek = weekDownloadsAgg.length > 0 ? weekDownloadsAgg[0].total : 0;

    // Last Week's Downloads
    const lastWeekDownloadsAgg = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.couponId': { $in: couponIdsObject },
          'MyCoupons.claimedAt': { $gte: lastWeekStart, $lte: lastWeekEnd }
        }
      },
      { $count: 'total' }
    ]);
    const downloadsLastWeek = lastWeekDownloadsAgg.length > 0 ? lastWeekDownloadsAgg[0].total : 0;

    // This Month's Downloads
    const monthDownloadsAgg = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.couponId': { $in: couponIdsObject },
          'MyCoupons.claimedAt': { $gte: thisMonthStart }
        }
      },
      { $count: 'total' }
    ]);
    const downloadsThisMonth = monthDownloadsAgg.length > 0 ? monthDownloadsAgg[0].total : 0;

    // Last Month's Downloads
    const lastMonthDownloadsAgg = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.couponId': { $in: couponIdsObject },
          'MyCoupons.claimedAt': { $gte: lastMonthStart, $lte: lastMonthEnd }
        }
      },
      { $count: 'total' }
    ]);
    const downloadsLastMonth = lastMonthDownloadsAgg.length > 0 ? lastMonthDownloadsAgg[0].total : 0;

    // ==================== REDEMPTION STATISTICS ====================
    // Total Redemptions
    const totalRedemptionsAgg = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.couponId': { $in: couponIdsObject },
          'MyCoupons.status': { $in: ['Used', 'Redeemed'] }
        }
      },
      { $count: 'total' }
    ]);
    const totalRedemptionCount = totalRedemptionsAgg.length > 0 ? totalRedemptionsAgg[0].total : 0;

    // Today's Redemptions
    const todayRedemptionsAgg = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.couponId': { $in: couponIdsObject },
          'MyCoupons.claimedAt': { $gte: todayStart },
          'MyCoupons.status': { $in: ['Used', 'Redeemed'] }
        }
      },
      { $count: 'total' }
    ]);
    const redemptionsToday = todayRedemptionsAgg.length > 0 ? todayRedemptionsAgg[0].total : 0;

    // ==================== CHARTS DATA ====================

    // Weekly Downloads Chart (Last 7 Days)
    const weeklyDownloads = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.couponId': { $in: couponIdsObject },
          'MyCoupons.claimedAt': { $gte: last7Days }
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: '$MyCoupons.claimedAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format weekly downloads chart (matching your original format)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyDownloadsFormatted = dayNames.map((day, idx) => {
      const dayData = weeklyDownloads.find(e => e._id === idx + 1);
      return { day, downloads: dayData ? dayData.count : 0 };
    });

    // Weekly Redemptions Chart (Last 7 Days)
    const weeklyRedemptions = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.couponId': { $in: couponIdsObject },
          'MyCoupons.claimedAt': { $gte: last7Days },
          'MyCoupons.status': { $in: ['Used', 'Redeemed'] }
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: '$MyCoupons.claimedAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const weeklyRedemptionsFormatted = dayNames.map((day, idx) => {
      const dayData = weeklyRedemptions.find(e => e._id === idx + 1);
      return { day, redemptions: dayData ? dayData.count : 0 };
    });

    // Monthly Downloads Chart (Last 12 Months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyDownloads = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.couponId': { $in: couponIdsObject },
          'MyCoupons.claimedAt': { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$MyCoupons.claimedAt' },
            month: { $month: '$MyCoupons.claimedAt' }
          },
          downloads: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Format monthly downloads chart (matching your original format)
    const monthlyDownloadsFormatted = [];
    const currentDate = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthName = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();

      const monthData = monthlyDownloads.find(e =>
        e._id.year === year && e._id.month === date.getMonth() + 1
      );

      monthlyDownloadsFormatted.unshift({
        month: `${monthName} ${year}`,
        downloads: monthData ? monthData.downloads : 0
      });
    }

    // ==================== TOP PERFORMING COUPONS ====================
    // Get download counts for each coupon
    const couponDownloadCounts = await User.aggregate([
      { $unwind: '$MyCoupons' },
      { $match: { 'MyCoupons.couponId': { $in: couponIdsObject } } },
      {
        $group: {
          _id: '$MyCoupons.couponId',
          downloads: { $sum: 1 }
        }
      }
    ]);

    // Create a map of coupon download counts
    const downloadCountMap = {};
    couponDownloadCounts.forEach(item => {
      downloadCountMap[item._id.toString()] = item.downloads;
    });

    // Get top 5 coupons by downloads
    const topCoupons = vendorCoupons
      .map(coupon => ({
        id: coupon._id,
        name: coupon.name,
        downloads: downloadCountMap[coupon._id.toString()] || 0,
        discountPercentage: coupon.discountPercentage,
        category: coupon.category,
        couponImage: coupon.couponImage,
        validityDate: coupon.validityDate,
        status: coupon.status
      }))
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 5);

    // ==================== FEEDBACK & RATING ====================
    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

    // Recent Feedbacks
    const recentFeedbacks = await Feedback.find({ vendorId: vendorObjectId })
      .populate('userId', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('stars tellUsAboutExperience createdAt')
      .lean();

    // Average Rating
    const avgRatingAgg = await Feedback.aggregate([
      { $match: { vendorId: vendorObjectId } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$stars' },
          totalFeedbacks: { $sum: 1 }
        }
      }
    ]);

    const averageRating = avgRatingAgg.length > 0 && avgRatingAgg[0]?.avgRating
      ? Number(avgRatingAgg[0].avgRating.toFixed(1))
      : 0;

    const totalFeedbacks = avgRatingAgg.length > 0 ? avgRatingAgg[0]?.totalFeedbacks || 0 : 0;

    // Rating distribution
    const ratingDistributionAgg = await Feedback.aggregate([
      { $match: { vendorId: vendorObjectId } },
      {
        $group: {
          _id: '$stars',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    const ratingDistribution = ratingDistributionAgg.map(item => ({
      _id: item._id,
      count: item.count
    }));



    // ==================== PERFORMANCE METRICS ====================
    const conversionRate = totalDownloadCount > 0
      ? Number(((totalRedemptionCount / totalDownloadCount) * 100).toFixed(2))
      : 0;

    const avgDailyDownloads = downloadsThisMonth > 0
      ? Number((downloadsThisMonth / now.getDate()).toFixed(2))
      : 0;

    const engagementScore = averageRating > 0 ? Number((averageRating * 20).toFixed(2)) : 0;

    // ==================== RESPONSE ====================
    return res.status(200).json({
      success: true,
      data: {
        // Vendor Info
        vendor: {
          id: vendor._id,
          name: vendor.businessName || vendor.name,
          email: vendor.email,
          phone: vendor.phone,
          logo: vendor.businessLogo,
          location: vendor.location,
          status: vendor.isApproved ? 'approved' : 'pending',
          note: vendor.note,
          firstName: vendor.firstName,
          lastName: vendor.lastName,
          tillNumber: vendor.tillNumber,
          addresses: vendor.addresses,
          acceptTerms: vendor.acceptTerms
        },

        // Coupon Statistics
        couponStats: {
          total: totalCoupons,
          active: activeCoupons,
          pending: pendingCoupons,
          expired: expiredCoupons
        },

        // Download Statistics
        downloadStats: {
          total: totalDownloadCount,
          today: downloadsToday,
          yesterday: downloadsYesterday,
          thisWeek: downloadsThisWeek,
          lastWeek: downloadsLastWeek,
          thisMonth: downloadsThisMonth,
          lastMonth: downloadsLastMonth
        },

        // Redemption Statistics
        redemptionStats: {
          total: totalRedemptionCount,
          today: redemptionsToday
        },

        // Charts Data
        charts: {
          weeklyDownloads: weeklyDownloadsFormatted,
          weeklyRedemptions: weeklyRedemptionsFormatted,
          monthlyDownloads: monthlyDownloadsFormatted
        },

        // Top Performing Coupons
        topCoupons: topCoupons,

        // Feedback & Rating
        feedback: {
          recent: recentFeedbacks,
          averageRating: averageRating,
          totalFeedbacks: totalFeedbacks,
          distribution: ratingDistribution
        },



        // Performance Metrics
        performance: {
          conversionRate: conversionRate,
          avgDailyDownloads: avgDailyDownloads,
          topCoupon: topCoupons.length > 0 ? topCoupons[0] : null,
          engagementScore: engagementScore
        },

        // Quick Stats for Dashboard Cards
        quickStats: {
          totalCoupons: totalCoupons,
          activeCoupons: activeCoupons,
          totalDownloads: totalDownloadCount,
          totalRedemptions: totalRedemptionCount,
          averageRating: averageRating,

        },

        // Time-based Statistics
        timeStats: {
          daily: {
            downloads: downloadsToday,
            redemptions: redemptionsToday
          },
          weekly: {
            downloads: downloadsThisWeek
          },
          monthly: {
            downloads: downloadsThisMonth
          }
        }
      }
    });

  } catch (error) {
    console.error("Vendor Dashboard Data Error:", error);

    // Handle specific error types
    if (error.name === 'MongooseError' && error.message.includes('buffering')) {
      return res.status(503).json({
        success: false,
        message: "Database connection issue. Please try again.",
        error: error.message
      });
    }

    if (error.name === 'MongoNetworkError') {
      return res.status(503).json({
        success: false,
        message: "Network error while connecting to database.",
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};



export const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({ message: "Invalid coupon ID" });
    }

    const coupon = await Coupon.findById(couponId).populate(
      "vendorId",
      "name businessName"
    );

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    // ================= FIRST CALL → VENDOR REQUEST =================
    if (!coupon.deleteRequested) {
      coupon.deleteRequested = true;
      coupon.deleteRequestedAt = new Date();
      coupon.status = "pending";
      await coupon.save();

      await notifyAdmin(
        coupon.vendorId?._id,
        "🗑️ Coupon Delete Request",
        `${coupon.vendorId?.businessName || "Vendor"} requested deletion of coupon "${coupon.name}"`,
        "coupon"
      );

      return res.status(200).json({
        success: true,
        message: "Delete request sent for admin approval"
      });
    }

    // ================= SECOND CALL → ADMIN APPROVAL =================
    await Coupon.findByIdAndDelete(couponId);

    // ✅ FIX
    await Notification.create({
      vendorId: vendor._id,
      vendorName: vendor.businessName || vendor.name,
      title: '👤 New Vendor Registration',
      message: `${vendor.businessName || vendor.name} (${vendor.email}) has registered. Awaiting approval.`,
      type: 'general',   // ✅ use a valid enum value
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      message: "Coupon deleted successfully"
    });

  } catch (error) {
    console.error("Delete coupon error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};



export const deleteSurvey = async (req, res) => {
  try {
    const { surveyId, vendorId } = req.params;

    // ✅ Validate IDs
    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
      return res.status(400).json({ message: "Invalid surveyId" });
    }

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ message: "Invalid vendorId" });
    }

    // ✅ Check survey exists & belongs to vendor
    const survey = await Survey.findOne({ _id: surveyId, vendorId });
    if (!survey) {
      return res.status(404).json({
        message: "Survey not found or does not belong to this vendor"
      });
    }

    await Survey.findByIdAndDelete(surveyId);

    return res.status(200).json({
      success: true,
      message: "Survey deleted successfully ✅",
      deletedSurveyId: surveyId
    });

  } catch (error) {
    console.error("Delete survey error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Mark vendor notification as read
export const markVendorNotificationAsRead = async (req, res) => {
  try {
    const { vendorId, notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, vendorId },
      { isRead: true },
      { new: true }
    ).populate('userId couponId');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or not authorized'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Mark vendor notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
// Mark all vendor notifications as read
export const markAllVendorNotificationsAsRead = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const result = await Notification.updateMany(
      { vendorId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: `All notifications marked as read (${result.modifiedCount} updated)`
    });
  } catch (error) {
    console.error('Mark all vendor notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Delete vendor notification
export const deleteVendorNotification = async (req, res) => {
  try {
    const { vendorId, notificationId } = req.params;

    const deleted = await Notification.findOneAndDelete({
      _id: notificationId,
      vendorId
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or not authorized'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
      data: { deletedId: notificationId }
    });
  } catch (error) {
    console.error('Delete vendor notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting notification',
      error: error.message,
    });
  }
};


// Get vendor notification statistics
export const getVendorNotificationStats = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const stats = await Notification.aggregate([
      { $match: { vendorId: mongoose.Types.ObjectId.createFromHexString(vendorId) } },
      {
        $facet: {
          totalStats: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
                read: { $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] } }
              }
            }
          ],
          typeStats: [
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 },
                unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } }
              }
            },
            { $sort: { count: -1 } }
          ],
          recentActivity: [
            { $sort: { createdAt: -1 } },
            { $limit: 10 },
            {
              $project: {
                title: 1,
                type: 1,
                isRead: 1,
                createdAt: 1,
                userId: 1,
                couponId: 1
              }
            }
          ]
        }
      }
    ]);

    const result = {
      total: stats[0]?.totalStats[0]?.total || 0,
      unread: stats[0]?.totalStats[0]?.unread || 0,
      read: stats[0]?.totalStats[0]?.read || 0,
      byType: stats[0]?.typeStats || [],
      recent: stats[0]?.recentActivity || []
    };

    res.status(200).json({
      success: true,
      message: 'Vendor notification statistics fetched successfully',
      data: result
    });
  } catch (error) {
    console.error('Get vendor notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};



// ============================================================
// ==================  VENDOR ENDPOINTS  ======================
// ============================================================

// ────────────────────────────────────────────────────────────
// GET  /api/vendor/:vendorId/payment-dashboard
// Full payment overview for a vendor
// ────────────────────────────────────────────────────────────
// ============================================================
// ==================  VENDOR ENDPOINTS  ======================
// ============================================================


// ================= FIXED VENDOR PAYMENT CONTROLLERS =================

// ============================================================
// ================== VENDOR PAYMENT CONTROLLERS ==============
// ============================================================
// GET /api/vendor/:vendorId/payment-dashboard - ULTIMATE FIX
// GET /api/vendor/:vendorId/payment-dashboard - ULTIMATE FIX
// GET /api/vendor/:vendorId/payment-dashboard - ULTIMATE FIX
// GET /api/vendor/:vendorId/payment-dashboard - ULTIMATE FIX




export const getVendorPaymentDashboard = async (req, res) => {
  try {
    const { vendorId } = req.params;

    console.log(`🔍 Getting payment dashboard for vendor: ${vendorId}`);

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor ID format'
      });
    }

    const vendor = await Vendor.findById(vendorId).select('businessName email tillNumber phone');
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const priceConfig = await PaymentConfig.findOne({ isActive: true });
    const currentPrice = priceConfig?.pricePerCoupon || 1.0;
    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

    // Get all payment records
    const paymentRecords = await PaymentRecord.find({ vendorId: vendorObjectId })
      .sort({ claimedAt: -1 })
      .populate('userId', 'name email phone')
      .populate('couponId', 'name couponCode')
      .lean();

    console.log(`📊 Found ${paymentRecords.length} total payment records`);

    // Calculate totals using ACTUAL prices from records
    let totalEarned = 0;
    let totalPaid = 0;
    let totalPending = 0;

    paymentRecords.forEach(record => {
      const amount = record.pricePerCoupon || currentPrice;
      totalEarned += amount;

      if (record.paymentStatus === 'paid' || record.paymentStatus === 'verified') {
        totalPaid += amount;
      } else {
        totalPending += amount;
      }
    });

    console.log(`💰 Totals: Earned=${totalEarned}, Paid=${totalPaid}, Pending=${totalPending}`);

    // ========== MONTHLY BREAKDOWN - FROM PAYMENT RECORDS ==========
    const monthlyMap = new Map();

    paymentRecords.forEach(record => {
      const month = record.month;
      if (!month) return;

      const amount = record.pricePerCoupon || currentPrice;

      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          month,
          totalCoupons: 0,
          totalAmount: 0,
          amountPaid: 0,
          amountPending: 0
        });
      }

      const m = monthlyMap.get(month);
      m.totalCoupons++;
      m.totalAmount += amount;

      if (record.paymentStatus === 'paid' || record.paymentStatus === 'verified') {
        m.amountPaid += amount;
      } else {
        m.amountPending += amount;
      }
    });

    const monthlyBreakdown = Array.from(monthlyMap.values())
      .map(m => {
        let paymentStatus = 'pending';
        if (m.totalCoupons === 0) {
          paymentStatus = 'pending';
        } else if (m.amountPending <= 0.01 && m.totalAmount > 0) {
          paymentStatus = 'fully_paid';
        } else if (m.amountPaid > 0) {
          paymentStatus = 'partially_paid';
        }

        return {
          month: m.month,
          totalCoupons: m.totalCoupons,
          totalAmount: parseFloat(m.totalAmount.toFixed(2)),
          amountPaid: parseFloat(m.amountPaid.toFixed(2)),
          amountPending: parseFloat(m.amountPending.toFixed(2)),
          paymentStatus: paymentStatus,
          lastUpdated: new Date()
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month));

    console.log(`📅 Monthly breakdown:`, monthlyBreakdown);

    // ========== WEEKLY BREAKDOWN - STRICTLY BY MONTH ==========
    // Group records by (year, week, month) combination
    const weekMonthMap = new Map();

    paymentRecords.forEach(record => {
      const claimedDate = record.claimedAt || record.createdAt;
      if (!claimedDate) return;

      const date = new Date(claimedDate);
      const amount = record.pricePerCoupon || currentPrice;
      const month = record.month; // The month this record belongs to

      const weekNumber = getWeekNumber(date);
      const year = date.getUTCFullYear();

      // Create a composite key that includes month
      const weekMonthKey = `${year}-W${weekNumber}-${month}`;

      const weekStart = getWeekStart(date);
      const weekEnd = getWeekEnd(date);

      if (!weekMonthMap.has(weekMonthKey)) {
        weekMonthMap.set(weekMonthKey, {
          weekKey: `${year}-W${weekNumber}`,
          weekNumber,
          year,
          month, // Store which month this week entry belongs to
          startDate: weekStart,
          endDate: weekEnd,
          totalCoupons: 0,
          totalAmount: 0,
          amountPaid: 0,
          amountPending: 0
        });
      }

      const w = weekMonthMap.get(weekMonthKey);
      w.totalCoupons++;
      w.totalAmount += amount;

      if (record.paymentStatus === 'paid' || record.paymentStatus === 'verified') {
        w.amountPaid += amount;
      } else {
        w.amountPending += amount;
      }
    });

    // Convert to array and sort by year, week, month
    const weeklyBreakdown = Array.from(weekMonthMap.values())
      .map(w => ({
        weekKey: w.weekKey,
        weekNumber: w.weekNumber,
        year: w.year,
        month: w.month, // Include month to show which month this belongs to
        period: `${formatDateShort(w.startDate)} - ${formatDateShort(w.endDate)}`,
        startDate: w.startDate,
        endDate: w.endDate,
        totalCoupons: w.totalCoupons,
        totalAmount: parseFloat(w.totalAmount.toFixed(2)),
        amountPaid: parseFloat(w.amountPaid.toFixed(2)),
        amountPending: parseFloat(w.amountPending.toFixed(2)),
        paymentStatus: w.amountPending <= 0.01 && w.totalAmount > 0 ? 'fully_paid' :
          w.amountPaid > 0 ? 'partially_paid' : 'pending'
      }))
      .sort((a, b) => {
        // Sort by year, then month, then week
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month.localeCompare(a.month);
        return b.weekNumber - a.weekNumber;
      });

    console.log(`📅 Weekly breakdown (strict by month): ${weeklyBreakdown.length} entries`);

    // Format recent claims
    const recentClaims = paymentRecords.slice(0, 20).map(r => ({
      id: r._id,
      couponName: r.couponName || r.couponId?.name || 'Unknown Coupon',
      couponCode: r.couponCode || r.couponId?.couponCode || 'N/A',
      user: {
        id: r.userId?._id || r.userId,
        name: r.userId?.name || 'Unknown User',
        email: r.userId?.email,
        phone: r.userId?.phone,
      },
      amount: parseFloat((r.pricePerCoupon || currentPrice).toFixed(2)),
      status: r.paymentStatus || 'pending',
      claimedAt: r.claimedAt || r.createdAt,
      paidAt: r.paidAt,
      month: r.month,
    }));

    // Get pending offline requests
    const pendingOfflineRequests = await CashPaymentApproval.find({
      vendorId: vendorObjectId,
      status: 'pending'
    })
      .sort({ submittedAt: -1 })
      .limit(5)
      .lean();

    return res.status(200).json({
      success: true,
      vendor: {
        id: vendor._id,
        businessName: vendor.businessName,
        email: vendor.email,
        tillNumber: vendor.tillNumber,
        phone: vendor.phone
      },
      summary: {
        totalEarned: parseFloat(totalEarned.toFixed(2)),
        totalPaid: parseFloat(totalPaid.toFixed(2)),
        totalPending: parseFloat(totalPending.toFixed(2)),
        currentPricePerCoupon: currentPrice,
        currency: 'USD',
        totalTransactions: paymentRecords.length
      },
      monthlyBreakdown,
      weeklyBreakdown,
      recentClaims,
      pendingOfflineRequests: pendingOfflineRequests.map(r => ({
        id: r._id,
        amountUSD: r.amountUSD,
        periodLabel: r.periodLabel,
        submittedAt: r.submittedAt,
        status: r.status
      }))
    });

  } catch (error) {
    console.error('❌ getVendorPaymentDashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


// ============================================================
// ================== CREATE PAYMENT RECORD ==================
// ============================================================

export const createPaymentRecord = async (vendorId, userId, couponId, couponName, couponCode, pricePerCoupon, month) => {
  try {
    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const couponObjectId = new mongoose.Types.ObjectId(couponId);

    const paymentRecord = await PaymentRecord.create({
      vendorId: vendorObjectId,
      userId: userObjectId,
      couponId: couponObjectId,
      couponName: couponName,
      couponCode: couponCode,
      pricePerCoupon: pricePerCoupon,
      month: month,
      claimedAt: new Date(),
      paymentStatus: 'pending'
    });

    console.log(`✅ Created payment record for vendor ${vendorId}, month ${month}, amount ${pricePerCoupon}`);

    await updateMonthlyPaymentSummary(vendorId, month);

    return paymentRecord;
  } catch (error) {
    console.error('❌ createPaymentRecord error:', error.message);
    return null;
  }
};

// ────────────────────────────────────────────────────────────
// GET  /api/vendor/:vendorId/payments/monthly?month=YYYY-MM
// ────────────────────────────────────────────────────────────


export const getVendorPaymentsByMonth = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Invalid month. Use YYYY-MM format' });
    }

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor ID format' });
    }

    const vendor = await Vendor.findById(vendorId).select('businessName');
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
    const priceConfig = await PaymentConfig.findOne({ isActive: true });
    const currentPrice = priceConfig?.pricePerCoupon || 1.0;

    const records = await PaymentRecord.find({ vendorId: vendorObjectId, month })
      .populate('userId', 'name email phone')
      .populate('couponId', 'name couponCode category')
      .sort({ claimedAt: -1 })
      .lean();

    let totalAmount = 0, amountPaid = 0, amountPending = 0;
    const grouped = { paid: [], pending: [], verified: [] };

    records.forEach(record => {
      const amount = record.pricePerCoupon || currentPrice;
      totalAmount += amount;

      if (record.paymentStatus === 'paid' || record.paymentStatus === 'verified') {
        amountPaid += amount;
      } else {
        amountPending += amount;
      }

      const formattedRecord = {
        id: record._id,
        couponName: record.couponName || record.couponId?.name || 'Unknown Coupon',
        couponCode: record.couponCode || record.couponId?.couponCode || 'N/A',
        category: record.couponId?.category,
        user: {
          id: record.userId?._id || record.userId,
          name: record.userId?.name || 'Unknown User',
          email: record.userId?.email,
          phone: record.userId?.phone
        },
        amount: parseFloat(amount.toFixed(2)),
        claimedAt: record.claimedAt || record.createdAt,
        paidAt: record.paidAt,
        paymentMethod: record.paymentMethod || 'pending',
        month: record.month
      };

      if (record.paymentStatus === 'paid') grouped.paid.push(formattedRecord);
      else if (record.paymentStatus === 'verified') grouped.verified.push(formattedRecord);
      else grouped.pending.push(formattedRecord);
    });

    return res.status(200).json({
      success: true,
      vendor: vendor.businessName,
      month,
      summary: {
        month,
        totalCoupons: records.length,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        amountPaid: parseFloat(amountPaid.toFixed(2)),
        amountPending: parseFloat(amountPending.toFixed(2)),
        paymentStatus: amountPending <= 0 && totalAmount > 0 ? 'fully_paid' : amountPaid > 0 ? 'partially_paid' : 'pending',
        lastUpdated: new Date()
      },
      records: grouped,
      totals: {
        totalRecords: records.length,
        paidRecords: grouped.paid.length,
        pendingRecords: grouped.pending.length,
        verifiedRecords: grouped.verified.length
      }
    });

  } catch (error) {
    console.error('getVendorPaymentsByMonth error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ────────────────────────────────────────────────────────────
// GET  /api/vendor/:vendorId/payments/weekly?weeks=4
// ────────────────────────────────────────────────────────────
export const getVendorWeeklyPayments = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const weeks = parseInt(req.query.weeks) || 4;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor ID format' });
    }

    const vendor = await Vendor.findById(vendorId).select('businessName');
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
    const priceConfig = await PaymentConfig.findOne({ isActive: true });
    const currentPrice = priceConfig?.pricePerCoupon || 1.0;

    const summaries = [];
    const now = new Date();

    for (let i = 0; i < weeks; i++) {
      const weekDate = new Date(now);
      weekDate.setDate(now.getDate() - (7 * i));

      const dayOfWeek = weekDate.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      const weekStart = new Date(weekDate);
      weekStart.setDate(weekDate.getDate() - daysToMonday);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const records = await PaymentRecord.find({
        vendorId: vendorObjectId,
        claimedAt: { $gte: weekStart, $lte: weekEnd }
      }).lean();

      let totalAmount = 0, amountPaid = 0;

      records.forEach(record => {
        const amount = record.pricePerCoupon || currentPrice;
        totalAmount += amount;
        if (record.paymentStatus === 'paid' || record.paymentStatus === 'verified') {
          amountPaid += amount;
        }
      });

      const amountPending = totalAmount - amountPaid;

      summaries.push({
        weekNumber: i === 0 ? 'Current Week' : `${i} week${i > 1 ? 's' : ''} ago`,
        startDate: weekStart,
        endDate: weekEnd,
        totalCoupons: records.length,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        amountPaid: parseFloat(amountPaid.toFixed(2)),
        amountPending: parseFloat(amountPending.toFixed(2)),
        paymentStatus: amountPending <= 0 && totalAmount > 0 ? 'fully_paid' : amountPaid > 0 ? 'partially_paid' : 'pending'
      });
    }

    return res.status(200).json({
      success: true,
      vendor: vendor.businessName,
      weeks,
      summaries
    });

  } catch (error) {
    console.error('getVendorWeeklyPayments error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ────────────────────────────────────────────────────────────
// GET  /api/vendor/:vendorId/payments/pending-balance
// ────────────────────────────────────────────────────────────

export const getVendorPendingBalance = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId).select('businessName');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const summaries = await VendorMonthlyPayment.find({ vendorId }).sort({ month: 1 }).lean();

    if (!summaries.length) {
      return res.status(200).json({
        success: true,
        vendor: vendor.businessName,
        totalPending: 0,
        currentMonthPending: 0,
        lastUnpaidMonth: null,
        paymentDue: false,
      });
    }

    let totalPending = 0;
    let lastUnpaidMonth = null;

    summaries.forEach(s => {
      if ((s.amountPending || 0) > 0) {
        totalPending += s.amountPending;
        lastUnpaidMonth = s.month;
      }
    });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentMonthData = summaries.find(s => s.month === currentMonth);
    const currentMonthPending = currentMonthData?.amountPending || 0;

    return res.status(200).json({
      success: true,
      vendor: vendor.businessName,
      currency: 'USD',
      totalPending: parseFloat(totalPending.toFixed(2)),
      currentMonthPending: parseFloat(currentMonthPending.toFixed(2)),
      lastUnpaidMonth,
      paymentDue: totalPending > 0,
    });
  } catch (err) {
    console.error('getVendorPendingBalance error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// POST /api/vendor/:vendorId/payments/initiate-online
// POST /api/vendor/:vendorId/payments/initiate-online
export const initiateOnlinePayment = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { periodType, month, startDate, endDate } = req.body;

    // Validate periodType
    if (!periodType || !['monthly', 'weekly'].includes(periodType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid periodType. Use "monthly" or "weekly"'
      });
    }

    // Validate based on periodType
    if (periodType === 'monthly') {
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid month. Use YYYY-MM format'
        });
      }
    } else {
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid week. Use YYYY-ww format (e.g., 2026-08)'
        });
      }
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'startDate and endDate are required for weekly payments'
        });
      }
    }

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor ID format'
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

    // Build query for pending records
    let query = {
      vendorId: vendorObjectId,
      paymentStatus: 'pending'
    };

    if (periodType === 'monthly') {
      query.month = month;
    } else {
      query.claimedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    const pendingRecords = await PaymentRecord.find(query).lean();

    if (pendingRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No pending payments found for this ${periodType}`
      });
    }

    // ✅ Extract record IDs
    const recordIds = pendingRecords.map(record => record._id);

    const priceConfig = await PaymentConfig.findOne({ isActive: true });
    const currentPrice = priceConfig?.pricePerCoupon || 1.0;

    // Calculate total pending amount
    let totalAmountUSD = 0;
    pendingRecords.forEach(record => {
      totalAmountUSD += record.pricePerCoupon || currentPrice;
    });

    // Create period label
    let periodLabel;
    if (periodType === 'monthly') {
      const [year, monthNum] = month.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      periodLabel = `${monthNames[parseInt(monthNum) - 1]} ${year}`;
    } else {
      const parts = month.split('-');
      periodLabel = `Week ${parts[1]}, ${parts[0]}`;
    }

    // Convert to INR — Razorpay requires paise (multiply by 100)
    const exchangeRate = 83;
    const totalAmountINR = totalAmountUSD * exchangeRate;
    const totalAmountINRPaise = Math.round(totalAmountINR * 100); // ✅ correct paise conversion

    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    // Create receipt (max 40 chars)
    const shortVendorId = vendorId.slice(-6);
    const timestamp = Date.now().toString().slice(-6);
    const receipt = `${periodType}_${shortVendorId}_${month}_${timestamp}`.slice(0, 40);

    const order = await razorpay.orders.create({
      amount: totalAmountINRPaise,
      currency: 'INR',
      receipt,
      notes: {
        vendorId: vendorId.toString(),
        vendorName: vendor.businessName || vendor.name,
        periodType,
        month,
        periodLabel,
        amountUSD: totalAmountUSD.toString(),
        purpose: `vendor_${periodType}_payment`,
        totalCoupons: pendingRecords.length.toString(),
        recordIds: JSON.stringify(recordIds.map(id => id.toString()))
      }
    });

    // ✅ Save transaction using imported PaymentTransaction model
    const transaction = new PaymentTransaction({
      orderId: order.id,
      vendorId: vendorObjectId,
      vendorName: vendor.businessName || vendor.name,
      amountUSD: parseFloat(totalAmountUSD.toFixed(2)),
      amountINR: totalAmountINR,
      status: 'created',
      periodType,
      month,
      periodLabel,
      recordIds,
      paymentDetails: {
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      }
    });

    await transaction.save();
    console.log(`✅ PaymentTransaction saved: ${transaction._id} | Order: ${order.id}`);

    return res.status(200).json({
      success: true,
      message: 'Payment order created successfully',
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        amountUSD: parseFloat(totalAmountUSD.toFixed(2)),
        amountINR: parseFloat(totalAmountINR.toFixed(2)),
        exchangeRate
      },
      periodSummary: {
        periodType,
        month,
        periodLabel,
        ...(periodType === 'weekly' && { startDate, endDate }),
        totalCoupons: pendingRecords.length,
        totalAmount: parseFloat(totalAmountUSD.toFixed(2))
      },
      razorpayKey: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('initiateOnlinePayment error:', error);

    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        message: error.error?.description || 'Invalid request to payment gateway',
        details: error.error
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
};


// POST /api/vendor/:vendorId/payments/verify-online
export const verifyOnlinePayment = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      periodType,
      month,
      startDate,
      endDate
    } = req.body;

    // Validate required fields (signature removed intentionally)
    if (!razorpay_order_id || !razorpay_payment_id || !periodType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: razorpay_order_id, razorpay_payment_id, periodType'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor ID format'
      });
    }

    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    // Fetch payment from Razorpay directly to verify
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    // Verify the payment belongs to the provided order
    if (payment.order_id !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Payment does not match the provided order ID'
      });
    }

    if (payment.status !== 'captured') {
      return res.status(400).json({
        success: false,
        message: 'Payment not captured',
        paymentStatus: payment.status
      });
    }

    const amountUSD = parseFloat(payment.notes?.amountUSD) ||
      parseFloat((payment.amount / (83 * 100)).toFixed(2));

    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

    // Build query based on period type
    let query = {
      vendorId: vendorObjectId,
      paymentStatus: 'pending'
    };

    if (periodType === 'monthly') {
      if (!month) {
        return res.status(400).json({
          success: false,
          message: 'month is required for monthly payments'
        });
      }
      query.month = month;
    } else {
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'startDate and endDate are required for weekly payments'
        });
      }
      query.claimedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    // Update all matching pending records to paid
    const updateResult = await PaymentRecord.updateMany(
      query,
      {
        $set: {
          paymentStatus: 'paid',
          paymentMethod: 'online',
          paidAt: new Date(),
          transactionId: razorpay_payment_id,
          paymentDetails: {
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            amountINR: payment.amount / 100,
            amountUSD,
            paymentMethod: payment.method,
            email: payment.email,
            contact: payment.contact,
            periodType,
            month
          }
        }
      }
    );

    // Update PaymentTransaction status
    await PaymentTransaction.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        $set: {
          status: 'paid',
          paymentDetails: {
            razorpayPaymentId: razorpay_payment_id,
            amountINR: payment.amount / 100,
            amountUSD,
            paymentMethod: payment.method
          },
          updatedAt: new Date()
        }
      }
    );

    // Update monthly summary if monthly payment
    if (periodType === 'monthly') {
      await updateMonthlyPaymentSummary(vendorId, month);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and recorded successfully',
      payment: {
        id: payment.id,
        status: payment.status,
        method: payment.method,
        amountINR: payment.amount / 100,
        amountUSD,
        capturedAt: payment.created_at
      },
      summary: {
        periodType,
        month,
        ...(periodType === 'weekly' && { startDate, endDate }),
        totalAmount: amountUSD,
        recordsUpdated: updateResult.modifiedCount
      }
    });

  } catch (error) {
    console.error('verifyOnlinePayment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};


export const requestOfflinePayment = async (req, res) => {
  try {
    const { vendorId } = req.params;

    console.log("📥 Request Body:", req.body);
    console.log("📥 Request File:", req.file);
    console.log("📥 Vendor ID:", vendorId);

    const { periodType, month, startDate, endDate, description } = req.body;
    const paymentProofFile = req.file;

    console.log("1️⃣ Starting validation...");

    // Check if periodType exists
    if (!periodType) {
      console.log("❌ periodType missing");
      return res.status(400).json({
        success: false,
        message: 'periodType is required. Use "monthly" or "weekly"'
      });
    }

    // Ensure periodType is a string and trim it
    const normalizedPeriodType = periodType.toString().trim().toLowerCase();
    console.log("2️⃣ Normalized periodType:", normalizedPeriodType);

    // Validate periodType
    if (!['monthly', 'weekly'].includes(normalizedPeriodType)) {
      console.log("❌ Invalid periodType");
      return res.status(400).json({
        success: false,
        message: `Invalid periodType: "${periodType}". Use "monthly" or "weekly"`
      });
    }

    // Validate based on periodType
    if (normalizedPeriodType === 'monthly') {
      console.log("3️⃣ Validating monthly...");
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        console.log("❌ Invalid month format:", month);
        return res.status(400).json({
          success: false,
          message: 'Invalid month. Use YYYY-MM format'
        });
      }
    } else {
      console.log("3️⃣ Validating weekly...");
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid week. Use YYYY-ww format (e.g., 2026-09)'
        });
      }
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'startDate and endDate are required for weekly payments'
        });
      }
    }

    console.log("4️⃣ Validating vendor ID...");
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      console.log("❌ Invalid vendor ID format");
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor ID format'
      });
    }

    console.log("5️⃣ Finding vendor...");
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      console.log("❌ Vendor not found");
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }
    console.log("✅ Vendor found:", vendor.businessName);

    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
    console.log("6️⃣ Checking for existing pending requests...");

    // Check for existing pending request
    const existingRequest = await CashPaymentApproval.findOne({
      vendorId: vendorObjectId,
      month,
      periodType: normalizedPeriodType,
      status: 'pending'
    });

    if (existingRequest) {
      console.log("❌ Existing pending request found");
      return res.status(400).json({
        success: false,
        message: `You already have a pending offline payment request for this ${normalizedPeriodType}`,
        existingRequest: {
          id: existingRequest._id,
          amountUSD: existingRequest.amountUSD,
          submittedAt: existingRequest.submittedAt
        }
      });
    }
    console.log("✅ No existing pending requests");

    // Build query for pending records
    let query = {
      vendorId: vendorObjectId,
      paymentStatus: 'pending'
    };

    if (normalizedPeriodType === 'monthly') {
      query.month = month;
      console.log("7️⃣ Query for monthly:", query);
    } else {
      query.claimedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
      console.log("7️⃣ Query for weekly:", query);
    }

    console.log("8️⃣ Finding pending records...");
    const pendingRecords = await PaymentRecord.find(query).lean();
    console.log(`Found ${pendingRecords.length} pending records`);

    if (pendingRecords.length === 0) {
      console.log("❌ No pending records found");

      // Check if there are ANY records for this month
      const anyRecords = await PaymentRecord.countDocuments({
        vendorId: vendorObjectId,
        month: month
      });
      console.log(`Total records for month: ${anyRecords}`);

      return res.status(400).json({
        success: false,
        message: `No pending payments found for this ${normalizedPeriodType}`,
        summary: {
          totalRecords: anyRecords,
          hasRecords: anyRecords > 0
        }
      });
    }

    console.log("9️⃣ Calculating totals...");
    const priceConfig = await PaymentConfig.findOne({ isActive: true });
    const currentPrice = priceConfig?.pricePerCoupon || 1.0;

    let totalAmountUSD = 0;
    pendingRecords.forEach(record => {
      totalAmountUSD += record.pricePerCoupon || currentPrice;
    });
    console.log(`Total amount: $${totalAmountUSD}`);

    const exchangeRate = 83;
    const totalAmountINR = Math.round(totalAmountUSD * exchangeRate);
    const recordIds = pendingRecords.map(r => r._id);
    console.log(`Record IDs:`, recordIds);

    // Create period label
    let periodLabel;
    if (normalizedPeriodType === 'monthly') {
      const [year, monthNum] = month.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      periodLabel = `${monthNames[parseInt(monthNum) - 1]} ${year}`;
    } else {
      // For weekly: month format is YYYY-ww (e.g., 2026-09)
      const [year, weekNum] = month.split('-');
      periodLabel = `Week ${weekNum}, ${year}`;
    }
    console.log(`Period label: ${periodLabel}`);

    // Generate payment proof URL if file uploaded
    let paymentProofUrl = '';
    if (paymentProofFile) {
      // In a real app, you'd upload to cloud storage like Cloudinary
      // For now, we'll use a local path or cloud upload
      if (process.env.CLOUDINARY_ENABLED === 'true') {
        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(paymentProofFile.path, {
          folder: `payment-proofs/${vendorId}`,
          resource_type: 'auto'
        });
        paymentProofUrl = uploadResult.secure_url;

        // Clean up local file
        if (paymentProofFile.path && fs.existsSync(paymentProofFile.path)) {
          fs.unlinkSync(paymentProofFile.path);
        }
      } else {
        // Local storage
        paymentProofUrl = `/uploads/payment-proofs/${paymentProofFile.filename}`;
      }
      console.log(`Payment proof URL: ${paymentProofUrl}`);
    }

    console.log("🔟 Creating approval request...");
    const approval = await CashPaymentApproval.create({
      vendorId: vendorObjectId,
      vendorName: vendor.businessName || vendor.name,
      amountUSD: parseFloat(totalAmountUSD.toFixed(2)),
      amountINR: totalAmountINR,
      month,
      periodLabel,
      periodType: normalizedPeriodType,
      description: description || `${normalizedPeriodType} payment for ${periodLabel}`,
      paymentProof: paymentProofUrl,
      status: 'pending',
      adminNotes: '',
      recordIds,
      submittedAt: new Date()
    });
    console.log("✅ Approval created:", approval._id);

    // Create notification
    console.log("11️⃣ Creating notification...");
    if (typeof Notification !== 'undefined') {
      try {
        await Notification.create({
          vendorId: vendorObjectId,
          vendorName: vendor.businessName || vendor.name,
          title: '💵 Offline Payment Request',
          message: `${vendor.businessName} submitted offline payment of $${totalAmountUSD.toFixed(2)} for ${periodLabel}.`,
          type: 'payment',
          metadata: {
            approvalId: approval._id,
            amountUSD: totalAmountUSD,
            amountINR: totalAmountINR,
            periodType: normalizedPeriodType,
            month,
            periodLabel,
            totalCoupons: pendingRecords.length,
            paymentProof: paymentProofUrl
          },
          isRead: false
        });
        console.log("✅ Notification created");
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
      }
    }

    console.log("✅ Sending success response");
    return res.status(200).json({
      success: true,
      message: 'Offline payment request submitted. Awaiting admin approval.',
      approval: {
        id: approval._id,
        status: approval.status,
        amountUSD: approval.amountUSD,
        amountINR: approval.amountINR,
        periodType: approval.periodType,
        month: approval.month,
        periodLabel: approval.periodLabel,
        submittedAt: approval.submittedAt,
        description: approval.description,
        paymentProof: approval.paymentProof,
        recordCount: approval.recordIds.length
      }
    });

  } catch (error) {
    console.error('❌ requestOfflinePayment error:', error);
    console.error('❌ Error stack:', error.stack);

    if (error instanceof multer.MulterError) {
      console.error('❌ Multer error:', error);
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 5MB'
        });
      }
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
      stack: error.stack
    });
  }
};

export const getOfflinePaymentRequests = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { status, periodType, month } = req.query;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor ID format'
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
    const query = { vendorId: vendorObjectId };

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    if (periodType && ['monthly', 'weekly'].includes(periodType)) {
      query.periodType = periodType;
    }

    if (month) {
      query.month = month;
    }

    const requests = await CashPaymentApproval.find(query)
      .sort({ submittedAt: -1 })
      .populate('reviewedBy', 'name email')
      .lean();

    // Response payload
    return res.status(200).json({
      success: true,
      total: requests.length,
      requests: requests.map(r => ({
        id: r._id,
        periodType: r.periodType,
        month: r.month,
        periodLabel: r.periodLabel,
        amountUSD: r.amountUSD,
        amountINR: r.amountINR,
        status: r.status,
        description: r.description,
        paymentProof: r.paymentProof,
        submittedAt: r.submittedAt,
        reviewedAt: r.reviewedAt,
        reviewedBy: r.reviewedBy ? {
          id: r.reviewedBy._id,
          name: r.reviewedBy.name,
          email: r.reviewedBy.email
        } : null,
        adminNotes: r.adminNotes,
        recordCount: r.recordIds?.length || 0
      }))
    });

  } catch (error) {
    console.error('getOfflinePaymentRequests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


// ────────────────────────────────────────────────────────────
// GET /api/vendor/:vendorId/payments/stats
// ────────────────────────────────────────────────────────────
export const getVendorPaymentStats = async (req, res) => {
  try {
    const { vendorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor ID format' });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
    const priceConfig = await PaymentConfig.findOne({ isActive: true });
    const currentPrice = priceConfig?.pricePerCoupon || 1.0;

    const allRecords = await PaymentRecord.find({ vendorId: vendorObjectId }).lean();

    const stats = {
      totalCouponsRedeemed: allRecords.length,
      totalRevenue: 0,
      totalPaid: 0,
      totalPending: 0,
      methodBreakdown: { online: 0, offline: 0, pending: 0 },
      monthlyTrend: []
    };

    const monthlyData = {};

    allRecords.forEach(record => {
      const price = record.pricePerCoupon || currentPrice;
      stats.totalRevenue += price;

      if (record.paymentStatus === 'paid' || record.paymentStatus === 'verified') {
        stats.totalPaid += price;
        const method = record.paymentMethod || 'other';
        if (method === 'online') stats.methodBreakdown.online += price;
        else if (method === 'offline' || method === 'cash') stats.methodBreakdown.offline += price;
      } else {
        stats.totalPending += price;
        stats.methodBreakdown.pending += price;
      }

      const month = record.month;
      if (month) {
        if (!monthlyData[month]) monthlyData[month] = { coupons: 0, revenue: 0, paid: 0 };
        monthlyData[month].coupons += 1;
        monthlyData[month].revenue += price;
        if (record.paymentStatus === 'paid' || record.paymentStatus === 'verified') {
          monthlyData[month].paid += price;
        }
      }
    });

    stats.totalRevenue = parseFloat(stats.totalRevenue.toFixed(2));
    stats.totalPaid = parseFloat(stats.totalPaid.toFixed(2));
    stats.totalPending = parseFloat(stats.totalPending.toFixed(2));
    stats.averagePerCoupon = stats.totalCouponsRedeemed > 0
      ? parseFloat((stats.totalRevenue / stats.totalCouponsRedeemed).toFixed(2))
      : 0;

    stats.monthlyTrend = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        coupons: data.coupons,
        revenue: parseFloat(data.revenue.toFixed(2)),
        paid: parseFloat(data.paid.toFixed(2)),
        collectionRate: data.revenue > 0 ? parseFloat(((data.paid / data.revenue) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    return res.status(200).json({
      success: true,
      vendor: { id: vendor._id, businessName: vendor.businessName },
      currentPricePerCoupon: currentPrice,
      statistics: stats,
      currency: 'USD'
    });

  } catch (error) {
    console.error('getVendorPaymentStats error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

