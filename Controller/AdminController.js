import jwt from 'jsonwebtoken';
import Admin from '../Models/Admin.js';
import User from '../Models/User.js';
import Vendor from '../Models/Vendor.js';
import Coupon from '../Models/Coupon.js';
import Category from '../Models/Category.js';
import Quiz from '../Models/Quizz.js';
import FunFact from '../Models/FunFacts.js';
import NewsArticle from '../Models/NewsArticle.js';
import axios from 'axios';
import News from '../Models/News.js';  
import Feedback from '../Models/Feedback.js';
import PrivacyPolicy from '../Models/PrivacyPolicy.js';
import cloudinary from '../config/cloudinary.js';
import Notification from '../Models/Notification.js';
import SpinCoin from '../Models/SpinCoin.js';
import SpinConfig from '../Models/SpinConfig.js';
import mongoose from "mongoose";
import PaymentConfig from '../Models/PaymentConfig.js';
import PaymentRecord from '../Models/PaymentRecord.js';
import VendorMonthlyPayment from '../Models/VendorMonthlyPayment.js';
import AdminBanner from "../Models/AdminBanner.js";
import razorpay from '../config/razorpay.js';
import crypto from 'crypto';
import QuizSubmission from '../Models/QuizSubmission.js';
import UserCouponFeedback from '../Models/UserCouponFeedback.js';
import CashPaymentApproval from '../Models/CashPaymentApproval.js';
import SystemConfig from '../Models/SystemConfig.js';
// ================= UNIFIED NOTIFICATION HELPERS =================



 
// ── helpers ──────────────────────────────────────────────────
 
/** Convert seconds → human-readable string */
const formatTimeSpent = (seconds) => {
  if (!seconds || seconds < 0) return '0m';
  const hours   = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs    = Math.floor(seconds % 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0)                return `${hours}h`;
  if (minutes > 0)              return `${minutes}m`;
  return `${secs}s`;
};
 
/** Safe date → "YYYY-MM-DD" string */
const toDateStr = (d) => {
  try { return new Date(d).toISOString().slice(0, 10); }
  catch { return null; }
};


// Add this helper function at the top of your controller
/**
 * Helper function to parse period parameters
 * @param {string} period - 'monthly', 'weekly', 'YYYY-MM', or 'YYYY-WW'
 * @returns {Object} - { periodType, periodValue, month, week }
 */
function parsePeriodParameter(period) {
  if (!period) return { periodType: null, periodValue: null, month: null, week: null };

  // Check if it's a month format (YYYY-MM)
  const monthRegex = /^\d{4}-\d{2}$/;
  if (monthRegex.test(period)) {
    return {
      periodType: 'monthly',
      periodValue: period,
      month: period,
      week: null
    };
  }

  // Check if it's a week format (YYYY-WW)
  const weekRegex = /^\d{4}-\d{1,2}$/;
  if (weekRegex.test(period)) {
    return {
      periodType: 'weekly',
      periodValue: period,
      month: null,
      week: period
    };
  }

  // Check for 'monthly' or 'weekly' keywords
  if (period === 'monthly') {
    return {
      periodType: 'monthly',
      periodValue: new Date().toISOString().slice(0, 7),
      month: new Date().toISOString().slice(0, 7),
      week: null
    };
  }

  if (period === 'weekly') {
    const now = new Date();
    const year = now.getFullYear();
    const weekNumber = getWeekNumber(now);
    return {
      periodType: 'weekly',
      periodValue: `${year}-W${weekNumber}`,
      month: null,
      week: `${year}-W${weekNumber}`
    };
  }

  return { periodType: null, periodValue: period, month: period, week: null };
}

/**
 * Get week number for a date
 * @param {Date} date 
 * @returns {number} week number (1-52)
 */
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
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



// Admin Register
export const registerAdmin = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists with this email" });
    }

    const newAdmin = new Admin({ name, email, phone, password });
    await newAdmin.save();

    return res.status(201).json({
      message: "Admin registered successfully",
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        phone: newAdmin.phone,
        createdAt: newAdmin.createdAt,
      },
    });
  } catch (error) {
    console.error("Admin registration error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Admin Login
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Static password check
    const STATIC_PASSWORD = "Redemly@25";
    if (password !== STATIC_PASSWORD) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET_KEY, {
      expiresIn: '2h',
    });

    return res.status(200).json({
      message: "Admin logged in successfully",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


// export const getAllUsers = async (req, res) => {
//   try {
//     const users = await User.find().lean();
 
//     if (!users || users.length === 0) {
//       return res.status(404).json({ message: 'No users found!' });
//     }
 
//     // ── helpers ──────────────────────────────────────────────
//     const formatTimeSpent = (seconds) => {
//       if (!seconds || seconds < 0) return '0m';
//       const hours   = Math.floor(seconds / 3600);
//       const minutes = Math.floor((seconds % 3600) / 60);
//       const secs    = Math.floor(seconds % 60);
//       if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
//       if (hours > 0)                return `${hours}h`;
//       if (minutes > 0)              return `${minutes}m`;
//       return `${secs}s`;
//     };
 
//     const toDateStr = (d) => {
//       try { return new Date(d).toISOString().slice(0, 10); }
//       catch { return null; }
//     };
 
//     // ── PRE-LOAD all collections once (avoid N+1 queries) ───
 
//     // 1. All quiz submissions
//     const allQuizSubs = await QuizSubmission.find({})
//       .select('userId topic question score timeSpent submittedAt createdAt isCorrect selectedOption correctAnswer questionId')
//       .lean();
 
//     const quizSubsByUser = {};
//     for (const sub of allQuizSubs) {
//       const uid = sub.userId?.toString();
//       if (!uid) continue;
//       if (!quizSubsByUser[uid]) quizSubsByUser[uid] = [];
//       quizSubsByUser[uid].push(sub);
//     }
 
//     // 2. News — fetch ALL news from BOTH models
//     let allNewsArticles = [];
//     try {
//       const [rssNews, bulkNews] = await Promise.all([
//         mongoose.models.NewsArticle
//           ? mongoose.model('NewsArticle').find({}).select('_id title category source published_at pubDate createdAt').lean()
//           : [],
//         mongoose.models.News
//           ? mongoose.model('News').find({}).select('_id catchy_headline category source_name published_at createdAt').lean()
//           : [],
//       ]);
//       allNewsArticles = [...rssNews, ...bulkNews];
//     } catch (e) {
//       console.error('News pre-load error:', e.message);
//     }
 
//     const newsArticleById = {};
//     for (const n of allNewsArticles) {
//       newsArticleById[n._id.toString()] = n;
//     }
 
//     // 3. FunFacts — fetch ALL
//     let allFunFacts = [];
//     try {
//       allFunFacts = await FunFact.find({})
//         .select('_id fact category createdAt pubDate')
//         .lean();
//     } catch (e) {
//       console.error('FunFact pre-load error:', e.message);
//     }
 
//     const funFactById = {};
//     for (const f of allFunFacts) {
//       funFactById[f._id.toString()] = f;
//     }
 
//     // ── Helpers to detect news/fact coinHistory entries ─────
//     const NEWS_KEYWORDS  = ['news', 'buzz', 'article', 'headline', 'reading news'];
//     const FACTS_KEYWORDS = ['fact', 'funfact', 'fun fact', 'fun-fact'];
 
//     const isNewsEntry = (entry) => {
//       if ((entry.amount || 0) <= 0) return false;
//       if (entry.metadata?.newsId) return true;
//       const t = (entry.metadata?.type || entry.metadata?.bonusType || entry.bonusType || '').toLowerCase();
//       if (t === 'news' || t === 'buzz' || t === 'news_read') return true;
//       const msg  = (entry.message || '').toLowerCase();
//       const meta = entry.metadata ? JSON.stringify(entry.metadata).toLowerCase() : '';
//       return NEWS_KEYWORDS.some(kw => msg.includes(kw) || meta.includes(kw));
//     };
 
//     const isFactEntry = (entry) => {
//       if ((entry.amount || 0) <= 0) return false;
//       if (entry.metadata?.factId) return true;
//       const t = (entry.metadata?.type || entry.metadata?.bonusType || entry.bonusType || '').toLowerCase();
//       if (t === 'fact' || t === 'funfact' || t === 'fun_fact' || t === 'fact_read') return true;
//       const msg  = (entry.message || '').toLowerCase();
//       const meta = entry.metadata ? JSON.stringify(entry.metadata).toLowerCase() : '';
//       return FACTS_KEYWORDS.some(kw => msg.includes(kw) || meta.includes(kw));
//     };
 
//     // ── ADDED: Helper to get read status for content ─────────
//     // Returns object with counts by day and list of read items with time spent
//     const getReadStatusWithTime = (viewHistory = [], contentType = '') => {
//       const filtered = viewHistory.filter(v => v && v.contentType === contentType);
//       const byDate = new Map();
//       const details = [];
      
//       for (const item of filtered) {
//         const date = toDateStr(item.viewedAt);
//         if (!date) continue;
        
//         if (!byDate.has(date)) {
//           byDate.set(date, { count: 0, totalTime: 0 });
//         }
//         const dayData = byDate.get(date);
//         dayData.count++;
//         dayData.totalTime += (item.timeSpent || 0);
        
//         details.push({
//           contentId: item.contentId,
//           date: date,
//           timeSpent: item.timeSpent || 0,
//           timeSpentFormatted: formatTimeSpent(item.timeSpent || 0)
//         });
//       }
      
//       const dailyBreakdown = Array.from(byDate.entries())
//         .map(([date, data]) => ({
//           date,
//           count: data.count,
//           timeSpent: formatTimeSpent(data.totalTime),
//           timeSpentSeconds: data.totalTime
//         }))
//         .sort((a, b) => b.date.localeCompare(a.date));
      
//       return {
//         totalRead: filtered.length,
//         totalTimeSpent: formatTimeSpent(filtered.reduce((sum, v) => sum + (v.timeSpent || 0), 0)),
//         totalTimeSpentSeconds: filtered.reduce((sum, v) => sum + (v.timeSpent || 0), 0),
//         dailyBreakdown,
//         details
//       };
//     };
 
//     // ── Process each user ────────────────────────────────────
//     const formattedUsers = [];
 
//     for (const user of users) {
//       const userIdStr  = user._id.toString();
//       const customerId = `C${userIdStr.slice(-6)}`;
 
//       const viewHistory = Array.isArray(user.viewHistory)  ? user.viewHistory  : [];
//       const coinHistory = Array.isArray(user.coinHistory)  ? user.coinHistory  : [];
 
//       // ═══════════════════════════════════════════════════════════
//       // ADDED: News Read Status with Timer
//       // ═══════════════════════════════════════════════════════════
//       const newsReadStatus = getReadStatusWithTime(viewHistory, 'news');
      
//       // Also add any news from coin history that might not be in viewHistory
//       const newsCoinEntries = coinHistory.filter(isNewsEntry);
//       const newsFromCoins = newsCoinEntries.map(entry => ({
//         contentId: entry.metadata?.newsId || null,
//         date: toDateStr(entry.timestamp || entry.createdAt),
//         timeSpent: entry.metadata?.timeSpent || 60,
//         coinsEarned: entry.amount || 0,
//         type: 'coin_entry'
//       }));
      
//       // ═══════════════════════════════════════════════════════════
//       // ADDED: Facts Read Status with Timer
//       // ═══════════════════════════════════════════════════════════
//       const factReadStatus = getReadStatusWithTime(viewHistory, 'fact');
      
//       const factCoinEntries = coinHistory.filter(isFactEntry);
//       const factsFromCoins = factCoinEntries.map(entry => ({
//         contentId: entry.metadata?.factId || null,
//         date: toDateStr(entry.timestamp || entry.createdAt),
//         timeSpent: entry.metadata?.timeSpent || 30,
//         coinsEarned: entry.amount || 0,
//         type: 'coin_entry'
//       }));
 
//       // ═══════════════════════════════════════════════════════════
//       // QUIZ STATS (unchanged)
//       // ═══════════════════════════════════════════════════════════
//       let quizAttempted = 0, quizCorrect = 0, quizWrong = 0;
//       let quizCoins = 0, quizTimeSeconds = 0;
//       const dailyQuizMap = new Map();
 
//       const userQuizSubs = quizSubsByUser[userIdStr] || [];
//       if (userQuizSubs.length > 0) {
//         quizAttempted   = userQuizSubs.length;
//         quizCorrect     = userQuizSubs.filter(s => (s.score || 0) > 0).length;
//         quizWrong       = quizAttempted - quizCorrect;
//         quizCoins       = userQuizSubs.reduce((sum, s) => sum + (s.score || 0), 0);
//         const hasTime   = userQuizSubs.some(s => s.timeSpent && s.timeSpent > 0);
//         quizTimeSeconds = hasTime
//           ? userQuizSubs.reduce((sum, s) => sum + (s.timeSpent || 0), 0)
//           : quizAttempted * 30;
 
//         for (const sub of userQuizSubs) {
//           const date = toDateStr(sub.submittedAt || sub.createdAt);
//           if (!date) continue;
//           if (!dailyQuizMap.has(date)) {
//             dailyQuizMap.set(date, { attempted: 0, correct: 0, wrong: 0, coins: 0, timeSec: 0 });
//           }
//           const day = dailyQuizMap.get(date);
//           day.attempted++;
//           const s = sub.score || 0;
//           day.coins   += s;
//           day.timeSec += sub.timeSpent || 30;
//           if (s > 0) day.correct++; else day.wrong++;
//         }
//       }
 
//       // ═══════════════════════════════════════════════════════════
//       // NEWS STATS (enhanced with read status)
//       // ═══════════════════════════════════════════════════════════
//       let newsReadCount = 0, newsCoins = 0, newsTimeSeconds = 0;
//       const dailyNewsMap  = new Map();
//       const seenNewsByDate = new Map();
 
//       // Use viewHistory for most accurate read tracking
//       const newsViews = viewHistory.filter(
//         v => v && (v.contentType === 'news' || v.contentType === 'buzz')
//       );
//       for (const v of newsViews) {
//         const date = toDateStr(v.viewedAt);
//         const nid  = v.contentId?.toString() || `vh_${date}_${Math.random()}`;
//         if (!date) continue;
 
//         if (!seenNewsByDate.has(date)) seenNewsByDate.set(date, new Set());
//         if (seenNewsByDate.get(date).has(nid)) continue;
//         seenNewsByDate.get(date).add(nid);
 
//         newsReadCount++;
//         const timeSec = v.timeSpent || 90;
//         newsTimeSeconds += timeSec;
 
//         if (!dailyNewsMap.has(date)) dailyNewsMap.set(date, { read: 0, coins: 0, timeSec: 0 });
//         const day = dailyNewsMap.get(date);
//         day.read++;
//         day.timeSec += timeSec;
//       }
 
//       // Coin history entries for news (for coins earned)
//       for (const entry of newsCoinEntries) {
//         const date = toDateStr(entry.timestamp || entry.createdAt);
//         if (!date) continue;
//         newsCoins += entry.amount || 0;
        
//         if (!dailyNewsMap.has(date)) dailyNewsMap.set(date, { read: 0, coins: 0, timeSec: 0 });
//         dailyNewsMap.get(date).coins += entry.amount || 0;
//       }
 
//       // Fallback if no read tracking
//       if (newsReadCount === 0) {
//         const articleViews = viewHistory.filter(v =>
//           v && ['news', 'buzz', 'article', 'newsarticle'].includes(
//             (v.contentType || '').toLowerCase()
//           )
//         );
//         if (articleViews.length > 0) {
//           newsReadCount   = articleViews.length;
//           newsTimeSeconds = articleViews.reduce((sum, v) => sum + (v.timeSpent || 90), 0);
//         }
//       }
 
//       // ═══════════════════════════════════════════════════════════
//       // FACTS STATS (enhanced with read status)
//       // ═══════════════════════════════════════════════════════════
//       let factReadCount = 0, factCoins = 0, factTimeSeconds = 0;
//       const dailyFactMap   = new Map();
//       const seenFactsByDate = new Map();
 
//       const factViews = viewHistory.filter(v => v && v.contentType === 'fact');
//       for (const v of factViews) {
//         const date = toDateStr(v.viewedAt);
//         const fid  = v.contentId?.toString() || `vh_${date}_${Math.random()}`;
//         if (!date) continue;
 
//         if (!seenFactsByDate.has(date)) seenFactsByDate.set(date, new Set());
//         if (seenFactsByDate.get(date).has(fid)) continue;
//         seenFactsByDate.get(date).add(fid);
 
//         factReadCount++;
//         const timeSec = v.timeSpent || 45;
//         factTimeSeconds += timeSec;
 
//         if (!dailyFactMap.has(date)) dailyFactMap.set(date, { read: 0, coins: 0, timeSec: 0 });
//         const day = dailyFactMap.get(date);
//         day.read++;
//         day.timeSec += timeSec;
//       }
 
//       for (const entry of factCoinEntries) {
//         const date = toDateStr(entry.timestamp || entry.createdAt);
//         if (!date) continue;
//         factCoins += entry.amount || 0;
        
//         if (!dailyFactMap.has(date)) dailyFactMap.set(date, { read: 0, coins: 0, timeSec: 0 });
//         dailyFactMap.get(date).coins += entry.amount || 0;
//       }
 
//       if (factReadCount === 0) {
//         const factViewsAlt = viewHistory.filter(v =>
//           v && ['fact', 'funfact', 'fun_fact'].includes((v.contentType || '').toLowerCase())
//         );
//         if (factViewsAlt.length > 0) {
//           factReadCount   = factViewsAlt.length;
//           factTimeSeconds = factViewsAlt.reduce((sum, v) => sum + (v.timeSpent || 45), 0);
//         }
//       }
 
//       // ═══════════════════════════════════════════════════════════
//       // STEPS TIME (unchanged)
//       // ═══════════════════════════════════════════════════════════
//       const stepsTimeSeconds = (() => {
//         const steps = Array.isArray(user.steps) ? user.steps : [];
//         let totalMins = 0;
//         for (const step of steps) {
//           const timeStr   = step.timeSpent || '0m';
//           const hourMatch = timeStr.match(/(\d+)\s*hr?/i);
//           const minMatch  = timeStr.match(/(\d+)\s*m(?!s)/i);
//           let mins = 0;
//           if (hourMatch) mins += parseInt(hourMatch[1]) * 60;
//           if (minMatch && (!hourMatch || minMatch[0] !== hourMatch[0])) {
//             mins += parseInt(minMatch[1]);
//           }
//           totalMins += mins;
//         }
//         return totalMins * 60;
//       })();
 
//       // ═══════════════════════════════════════════════════════════
//       // TOTALS & DAILY ACTIVITY
//       // ═══════════════════════════════════════════════════════════
//       const totalTimeSeconds = quizTimeSeconds + newsTimeSeconds + factTimeSeconds + stepsTimeSeconds;
 
//       const allDates = new Set([
//         ...dailyQuizMap.keys(),
//         ...dailyNewsMap.keys(),
//         ...dailyFactMap.keys(),
//       ]);
 
//       const dailyActivity = Array.from(allDates)
//         .map(date => ({
//           date,
//           quizzes: dailyQuizMap.get(date) || { attempted: 0, correct: 0, wrong: 0, coins: 0, timeSec: 0 },
//           news:    dailyNewsMap.get(date)  || { read: 0, coins: 0, timeSec: 0 },
//           facts:   dailyFactMap.get(date)  || { read: 0, coins: 0, timeSec: 0 },
//         }))
//         .sort((a, b) => b.date.localeCompare(a.date));
 
//       // ═══════════════════════════════════════════════════════════
//       // FINAL USER OBJECT (EXACT SAME STRUCTURE + NEW FIELDS)
//       // ═══════════════════════════════════════════════════════════
//       formattedUsers.push({
//         id:              user._id,
//         name:            user.name,
//         email:           user.email,
//         phone:           user.phone,
//         city:            user.city,
//         zipcode:         user.zipcode,
//         dateOfBirth:     user.dateOfBirth,
//         coins:           user.coins,
//         couponCode:      user.couponCode || 'null',
//         favoriteCoupons: user.favoriteCoupons || [],
//         profileImage:    user.profileImage || null,
//         otp:             user.otp || null,
//         otpExpiry:       user.otpExpiry || null,
//         steps:           user.steps || {},
//         createdAt:       user.createdAt,
//         updatedAt:       user.updatedAt,
//         customerId,
 
//         activityStats: {
//           quizzes: {
//             attempted:        quizAttempted,
//             correct:          quizCorrect,
//             wrong:            quizWrong,
//             coinsEarned:      quizCoins,
//             timeSpent:        formatTimeSpent(quizTimeSeconds),
//             timeSpentSeconds: quizTimeSeconds,
//           },
//           news: {
//             read:             newsReadCount,
//             coinsEarned:      newsCoins,
//             timeSpent:        formatTimeSpent(newsTimeSeconds),
//             timeSpentSeconds: newsTimeSeconds,
//             // ADDED: Read status with timer details
//             readStatus: {
//               totalRead: newsReadStatus.totalRead,
//               totalTimeSpent: newsReadStatus.totalTimeSpent,
//               dailyBreakdown: newsReadStatus.dailyBreakdown,
//               details: newsReadStatus.details.slice(0, 20) // Last 20 reads
//             }
//           },
//           facts: {
//             read:             factReadCount,
//             coinsEarned:      factCoins,
//             timeSpent:        formatTimeSpent(factTimeSeconds),
//             timeSpentSeconds: factTimeSeconds,
//             // ADDED: Read status with timer details
//             readStatus: {
//               totalRead: factReadStatus.totalRead,
//               totalTimeSpent: factReadStatus.totalTimeSpent,
//               dailyBreakdown: factReadStatus.dailyBreakdown,
//               details: factReadStatus.details.slice(0, 20) // Last 20 reads
//             }
//           },
//           totalTimeSpent: formatTimeSpent(totalTimeSeconds),
//         },
 
//         dailyActivity,
//       });
//     }
 
//     return res.status(200).json({
//       message: 'Users retrieved successfully!',
//       users:   formattedUsers,
//     });
 
//   } catch (error) {
//     console.error('Error retrieving users:', error);
//     return res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };


// In AdminController.js - Replace your existing getAllUsers with this
// Replace your existing getAllUsers with this enhanced version
// In AdminController.js - Complete getAllUsers function
// In AdminController.js - Complete getAllUsers function
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().lean();
 
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found!' });
    }
 
    // ── helpers ──────────────────────────────────────────────
    const formatTimeSpent = (seconds) => {
      if (!seconds || seconds < 0) return '0m';
      const hours   = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs    = Math.floor(seconds % 60);
      if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
      if (hours > 0)                return `${hours}h`;
      if (minutes > 0)              return `${minutes}m`;
      return `${secs}s`;
    };
 
    const toDateStr = (d) => {
      try { return new Date(d).toISOString().slice(0, 10); }
      catch { return null; }
    };
 
    // ── PRE-LOAD all collections once (avoid N+1 queries) ───
 
    // 1. All quiz submissions
    const allQuizSubs = await QuizSubmission.find({})
      .select('userId topic question score timeSpent submittedAt createdAt isCorrect selectedOption correctAnswer questionId')
      .lean();
 
    const quizSubsByUser = {};
    for (const sub of allQuizSubs) {
      const uid = sub.userId?.toString();
      if (!uid) continue;
      if (!quizSubsByUser[uid]) quizSubsByUser[uid] = [];
      quizSubsByUser[uid].push(sub);
    }
 
    // 2. News — fetch ALL news from BOTH models
    let allNewsArticles = [];
    try {
      const [rssNews, bulkNews] = await Promise.all([
        mongoose.models.NewsArticle
          ? mongoose.model('NewsArticle').find({}).select('_id title category source published_at pubDate createdAt').lean()
          : [],
        mongoose.models.News
          ? mongoose.model('News').find({}).select('_id catchy_headline category source_name published_at createdAt').lean()
          : [],
      ]);
      allNewsArticles = [...rssNews, ...bulkNews];
    } catch (e) {
      console.error('News pre-load error:', e.message);
    }
 
    const newsArticleById = {};
    for (const n of allNewsArticles) {
      newsArticleById[n._id.toString()] = n;
    }
 
    // 3. FunFacts — fetch ALL
    let allFunFacts = [];
    try {
      allFunFacts = await FunFact.find({})
        .select('_id fact category createdAt pubDate')
        .lean();
    } catch (e) {
      console.error('FunFact pre-load error:', e.message);
    }
 
    const funFactById = {};
    for (const f of allFunFacts) {
      funFactById[f._id.toString()] = f;
    }
 
    // ── Helpers to detect news/fact coinHistory entries ─────
    const NEWS_KEYWORDS  = ['news', 'buzz', 'article', 'headline', 'reading news'];
    const FACTS_KEYWORDS = ['fact', 'funfact', 'fun fact', 'fun-fact'];
 
    const isNewsEntry = (entry) => {
      if ((entry.amount || 0) <= 0) return false;
      if (entry.metadata?.newsId) return true;
      const t = (entry.metadata?.type || entry.metadata?.bonusType || entry.bonusType || '').toLowerCase();
      if (t === 'news' || t === 'buzz' || t === 'news_read') return true;
      const msg  = (entry.message || '').toLowerCase();
      const meta = entry.metadata ? JSON.stringify(entry.metadata).toLowerCase() : '';
      return NEWS_KEYWORDS.some(kw => msg.includes(kw) || meta.includes(kw));
    };
 
    const isFactEntry = (entry) => {
      if ((entry.amount || 0) <= 0) return false;
      if (entry.metadata?.factId) return true;
      const t = (entry.metadata?.type || entry.metadata?.bonusType || entry.bonusType || '').toLowerCase();
      if (t === 'fact' || t === 'funfact' || t === 'fun_fact' || t === 'fact_read') return true;
      const msg  = (entry.message || '').toLowerCase();
      const meta = entry.metadata ? JSON.stringify(entry.metadata).toLowerCase() : '';
      return FACTS_KEYWORDS.some(kw => msg.includes(kw) || meta.includes(kw));
    };
 
    // ── Helper to get read status with time tracking (ENHANCED) ──
    const getReadStatusWithTime = (viewHistory = [], contentType = '', contentTypeDisplay = '') => {
      const filtered = viewHistory.filter(v => v && v.contentType === contentType);
      const byDate = new Map();
      const details = [];
      const contentReadMap = new Map(); // Track which content was read on which date
      
      for (const item of filtered) {
        const date = toDateStr(item.viewedAt);
        if (!date) continue;
        
        const contentId = item.contentId?.toString() || `view_${date}_${item.viewedAt?.getTime()}`;
        
        // Track unique content reads per day
        const contentKey = `${date}_${contentId}`;
        if (!contentReadMap.has(contentKey)) {
          contentReadMap.set(contentKey, { date, contentId, timeSpent: item.timeSpent || 0 });
        }
        
        if (!byDate.has(date)) {
          byDate.set(date, { 
            count: 0, 
            totalTime: 0,
            uniqueContentIds: new Set()
          });
        }
        const dayData = byDate.get(date);
        
        // Count unique content per day
        if (!dayData.uniqueContentIds.has(contentId)) {
          dayData.uniqueContentIds.add(contentId);
          dayData.count++;
        }
        dayData.totalTime += (item.timeSpent || 0);
        dayData.lastView = Math.max(dayData.lastView || 0, new Date(item.viewedAt).getTime());
        
        details.push({
          contentId: item.contentId,
          date: date,
          timeSpent: item.timeSpent || 0,
          timeSpentFormatted: formatTimeSpent(item.timeSpent || 0)
        });
      }
      
      const dailyBreakdown = Array.from(byDate.entries())
        .map(([date, data]) => ({
          date,
          readCount: data.count,
          totalTimeSpent: formatTimeSpent(data.totalTime),
          totalTimeSpentSeconds: data.totalTime,
          lastReadAt: data.lastView ? new Date(data.lastView).toISOString() : null
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
      
      return {
        totalRead: filtered.length,
        totalUniqueContentRead: contentReadMap.size,
        totalTimeSpent: formatTimeSpent(filtered.reduce((sum, v) => sum + (v.timeSpent || 0), 0)),
        totalTimeSpentSeconds: filtered.reduce((sum, v) => sum + (v.timeSpent || 0), 0),
        dailyBreakdown,
        details: details.slice(0, 50) // Last 50 reads
      };
    };
 
    // ── Process each user ────────────────────────────────────
    const formattedUsers = [];
 
    for (const user of users) {
      const userIdStr  = user._id.toString();
      const customerId = `C${userIdStr.slice(-6)}`;
 
      const viewHistory = Array.isArray(user.viewHistory)  ? user.viewHistory  : [];
      const coinHistory = Array.isArray(user.coinHistory)  ? user.coinHistory  : [];
 
      // ═══════════════════════════════════════════════════════════
      // COIN BREAKDOWN BY CATEGORY
      // ═══════════════════════════════════════════════════════════
      const coinBreakdown = {
        quizzes: {
          totalCoins: 0,
          count: 0
        },
        news: {
          totalCoins: 0,
          count: 0,
          byCategory: {}
        },
        facts: {
          totalCoins: 0,
          count: 0,
          byCategory: {}
        },
        totalCoinsEarned: 0
      };
 
      // Process coinHistory entries for breakdown
      for (const entry of coinHistory) {
        if (entry.type !== 'added') continue;
        const amount = entry.amount || 0;
        if (amount <= 0) continue;
        
        coinBreakdown.totalCoinsEarned += amount;
        
        // Quiz coins
        if (entry.message?.toLowerCase().includes('quiz') || entry.metadata?.type === 'quiz') {
          coinBreakdown.quizzes.totalCoins += amount;
          coinBreakdown.quizzes.count++;
        }
        // News coins
        else if (entry.message?.toLowerCase().includes('news') || entry.metadata?.type === 'news') {
          coinBreakdown.news.totalCoins += amount;
          coinBreakdown.news.count++;
          
          const cat = entry.metadata?.category || 'Unknown';
          if (!coinBreakdown.news.byCategory[cat]) {
            coinBreakdown.news.byCategory[cat] = { totalCoins: 0, count: 0 };
          }
          coinBreakdown.news.byCategory[cat].totalCoins += amount;
          coinBreakdown.news.byCategory[cat].count++;
        }
        // Fact coins
        else if (entry.message?.toLowerCase().includes('fact') || entry.metadata?.type === 'fact') {
          coinBreakdown.facts.totalCoins += amount;
          coinBreakdown.facts.count++;
          
          const cat = entry.metadata?.category || 'General';
          if (!coinBreakdown.facts.byCategory[cat]) {
            coinBreakdown.facts.byCategory[cat] = { totalCoins: 0, count: 0 };
          }
          coinBreakdown.facts.byCategory[cat].totalCoins += amount;
          coinBreakdown.facts.byCategory[cat].count++;
        }
      }
 
      // ═══════════════════════════════════════════════════════════
      // ENHANCED: News Read Status with Timer (includes daily breakdown)
      // ═══════════════════════════════════════════════════════════
      const newsReadStatus = getReadStatusWithTime(viewHistory, 'news', 'News');
      
      // Also add any news from coin history that might not be in viewHistory
      const newsCoinEntries = coinHistory.filter(isNewsEntry);
      const newsFromCoins = newsCoinEntries.map(entry => ({
        contentId: entry.metadata?.newsId || null,
        date: toDateStr(entry.timestamp || entry.createdAt),
        timeSpent: entry.metadata?.timeSpent || 60,
        coinsEarned: entry.amount || 0,
        type: 'coin_entry',
        category: entry.metadata?.category || 'Unknown'
      }));
      
      // ═══════════════════════════════════════════════════════════
      // ENHANCED: Facts Read Status with Timer (includes daily breakdown)
      // ═══════════════════════════════════════════════════════════
      const factReadStatus = getReadStatusWithTime(viewHistory, 'fact', 'Fun Fact');
      
      const factCoinEntries = coinHistory.filter(isFactEntry);
      const factsFromCoins = factCoinEntries.map(entry => ({
        contentId: entry.metadata?.factId || null,
        date: toDateStr(entry.timestamp || entry.createdAt),
        timeSpent: entry.metadata?.timeSpent || 30,
        coinsEarned: entry.amount || 0,
        type: 'coin_entry',
        category: entry.metadata?.category || 'General'
      }));
 
      // ═══════════════════════════════════════════════════════════
      // QUIZ STATS
      // ═══════════════════════════════════════════════════════════
      let quizAttempted = 0, quizCorrect = 0, quizWrong = 0;
      let quizCoins = 0, quizTimeSeconds = 0;
      const dailyQuizMap = new Map();
 
      const userQuizSubs = quizSubsByUser[userIdStr] || [];
      if (userQuizSubs.length > 0) {
        quizAttempted   = userQuizSubs.length;
        quizCorrect     = userQuizSubs.filter(s => (s.score || 0) > 0).length;
        quizWrong       = quizAttempted - quizCorrect;
        quizCoins       = userQuizSubs.reduce((sum, s) => sum + (s.score || 0), 0);
        const hasTime   = userQuizSubs.some(s => s.timeSpent && s.timeSpent > 0);
        quizTimeSeconds = hasTime
          ? userQuizSubs.reduce((sum, s) => sum + (s.timeSpent || 0), 0)
          : quizAttempted * 30;
 
        for (const sub of userQuizSubs) {
          const date = toDateStr(sub.submittedAt || sub.createdAt);
          if (!date) continue;
          if (!dailyQuizMap.has(date)) {
            dailyQuizMap.set(date, { attempted: 0, correct: 0, wrong: 0, coins: 0, timeSec: 0 });
          }
          const day = dailyQuizMap.get(date);
          day.attempted++;
          const s = sub.score || 0;
          day.coins   += s;
          day.timeSec += sub.timeSpent || 30;
          if (s > 0) day.correct++; else day.wrong++;
        }
      }
 
      // ═══════════════════════════════════════════════════════════
      // ENHANCED: NEWS STATS with detailed time tracking
      // ═══════════════════════════════════════════════════════════
      let newsReadCount = 0, newsCoins = 0, newsTimeSeconds = 0;
      const dailyNewsMap = new Map();
      const seenNewsByDate = new Map();
 
      // Use viewHistory for most accurate read tracking
      const newsViews = viewHistory.filter(
        v => v && (v.contentType === 'news' || v.contentType === 'buzz')
      );
      
      for (const v of newsViews) {
        const date = toDateStr(v.viewedAt);
        const nid  = v.contentId?.toString() || `vh_${date}_${Math.random()}`;
        if (!date) continue;
 
        // Track unique news reads per day (avoid counting same news multiple times in same day)
        const dayKey = `${date}_${nid}`;
        if (!seenNewsByDate.has(dayKey)) {
          seenNewsByDate.set(dayKey, true);
          newsReadCount++;
        }
        
        const timeSec = v.timeSpent || 90;
        newsTimeSeconds += timeSec;
 
        if (!dailyNewsMap.has(date)) {
          dailyNewsMap.set(date, { 
            read: 0, 
            uniqueRead: 0,
            coins: 0, 
            timeSec: 0,
            newsIds: new Set()
          });
        }
        const day = dailyNewsMap.get(date);
        
        // Track unique news per day for accurate count
        if (!day.newsIds.has(nid)) {
          day.newsIds.add(nid);
          day.uniqueRead++;
        }
        day.read++; // total views (may include repeats)
        day.timeSec += timeSec;
      }
 
      // Coin history entries for news (for coins earned)
      for (const entry of newsCoinEntries) {
        const date = toDateStr(entry.timestamp || entry.createdAt);
        if (!date) continue;
        newsCoins += entry.amount || 0;
        
        if (!dailyNewsMap.has(date)) {
          dailyNewsMap.set(date, { read: 0, uniqueRead: 0, coins: 0, timeSec: 0, newsIds: new Set() });
        }
        dailyNewsMap.get(date).coins += entry.amount || 0;
      }
 
      // Fallback if no read tracking
      if (newsReadCount === 0) {
        const articleViews = viewHistory.filter(v =>
          v && ['news', 'buzz', 'article', 'newsarticle'].includes(
            (v.contentType || '').toLowerCase()
          )
        );
        if (articleViews.length > 0) {
          newsReadCount   = articleViews.length;
          newsTimeSeconds = articleViews.reduce((sum, v) => sum + (v.timeSpent || 90), 0);
        }
      }
 
      // ═══════════════════════════════════════════════════════════
      // ENHANCED: FACTS STATS with detailed time tracking
      // ═══════════════════════════════════════════════════════════
      let factReadCount = 0, factCoins = 0, factTimeSeconds = 0;
      const dailyFactMap = new Map();
      const seenFactsByDate = new Map();
 
      const factViews = viewHistory.filter(v => v && v.contentType === 'fact');
      for (const v of factViews) {
        const date = toDateStr(v.viewedAt);
        const fid  = v.contentId?.toString() || `vh_${date}_${Math.random()}`;
        if (!date) continue;
 
        const dayKey = `${date}_${fid}`;
        if (!seenFactsByDate.has(dayKey)) {
          seenFactsByDate.set(dayKey, true);
          factReadCount++;
        }
        
        const timeSec = v.timeSpent || 45;
        factTimeSeconds += timeSec;
 
        if (!dailyFactMap.has(date)) {
          dailyFactMap.set(date, { 
            read: 0, 
            uniqueRead: 0,
            coins: 0, 
            timeSec: 0,
            factIds: new Set()
          });
        }
        const day = dailyFactMap.get(date);
        
        if (!day.factIds.has(fid)) {
          day.factIds.add(fid);
          day.uniqueRead++;
        }
        day.read++;
        day.timeSec += timeSec;
      }
 
      for (const entry of factCoinEntries) {
        const date = toDateStr(entry.timestamp || entry.createdAt);
        if (!date) continue;
        factCoins += entry.amount || 0;
        
        if (!dailyFactMap.has(date)) {
          dailyFactMap.set(date, { read: 0, uniqueRead: 0, coins: 0, timeSec: 0, factIds: new Set() });
        }
        dailyFactMap.get(date).coins += entry.amount || 0;
      }
 
      if (factReadCount === 0) {
        const factViewsAlt = viewHistory.filter(v =>
          v && ['fact', 'funfact', 'fun_fact'].includes((v.contentType || '').toLowerCase())
        );
        if (factViewsAlt.length > 0) {
          factReadCount   = factViewsAlt.length;
          factTimeSeconds = factViewsAlt.reduce((sum, v) => sum + (v.timeSpent || 45), 0);
        }
      }
 
      // ═══════════════════════════════════════════════════════════
      // STEPS TIME
      // ═══════════════════════════════════════════════════════════
      const stepsTimeSeconds = (() => {
        const steps = Array.isArray(user.steps) ? user.steps : [];
        let totalMins = 0;
        for (const step of steps) {
          const timeStr   = step.timeSpent || '0m';
          const hourMatch = timeStr.match(/(\d+)\s*hr?/i);
          const minMatch  = timeStr.match(/(\d+)\s*m(?!s)/i);
          let mins = 0;
          if (hourMatch) mins += parseInt(hourMatch[1]) * 60;
          if (minMatch && (!hourMatch || minMatch[0] !== hourMatch[0])) {
            mins += parseInt(minMatch[1]);
          }
          totalMins += mins;
        }
        return totalMins * 60;
      })();
 
      // ═══════════════════════════════════════════════════════════
      // TOTALS & DAILY ACTIVITY (ENHANCED)
      // ═══════════════════════════════════════════════════════════
      const totalTimeSeconds = quizTimeSeconds + newsTimeSeconds + factTimeSeconds + stepsTimeSeconds;
 
      const allDates = new Set([
        ...dailyQuizMap.keys(),
        ...dailyNewsMap.keys(),
        ...dailyFactMap.keys(),
      ]);
 
      const dailyActivity = Array.from(allDates)
        .map(date => ({
          date,
          quizzes: dailyQuizMap.get(date) || { attempted: 0, correct: 0, wrong: 0, coins: 0, timeSec: 0 },
          news: dailyNewsMap.get(date) || { 
            read: 0, 
            uniqueRead: 0,
            coins: 0, 
            timeSec: 0 
          },
          facts: dailyFactMap.get(date) || { 
            read: 0, 
            uniqueRead: 0,
            coins: 0, 
            timeSec: 0 
          },
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
 
      // Calculate read/unread percentages for news and facts
      const totalDaysWithNewsActivity = dailyActivity.filter(d => d.news.read > 0).length;
      const totalDaysWithFactActivity = dailyActivity.filter(d => d.facts.read > 0).length;
      
      // News read stats per day (already in dailyActivity)
      // Get last 7 days of news activity
      const last7DaysNews = dailyActivity.slice(0, 7).map(day => ({
        date: day.date,
        readCount: day.news.uniqueRead || day.news.read,
        timeSpent: formatTimeSpent(day.news.timeSec),
        timeSpentSeconds: day.news.timeSec,
        coinsEarned: day.news.coins
      }));
      
      // Facts read stats per day
      const last7DaysFacts = dailyActivity.slice(0, 7).map(day => ({
        date: day.date,
        readCount: day.facts.uniqueRead || day.facts.read,
        timeSpent: formatTimeSpent(day.facts.timeSec),
        timeSpentSeconds: day.facts.timeSec,
        coinsEarned: day.facts.coins
      }));
 
      // ═══════════════════════════════════════════════════════════
      // FINAL USER OBJECT (ENHANCED with per-day breakdown)
      // ═══════════════════════════════════════════════════════════
      formattedUsers.push({
        id:              user._id,
        name:            user.name,
        email:           user.email,
        phone:           user.phone,
        city:            user.city,
        zipcode:         user.zipcode,
        dateOfBirth:     user.dateOfBirth,
        coins:           user.coins,
        couponCode:      user.couponCode || 'null',
        favoriteCoupons: user.favoriteCoupons || [],
        profileImage:    user.profileImage || null,
        otp:             user.otp || null,
        otpExpiry:       user.otpExpiry || null,
        steps:           user.steps || {},
        createdAt:       user.createdAt,
        updatedAt:       user.updatedAt,
        customerId,
 
        // ADDED: Coin breakdown by category
        coinBreakdown,
 
        // ADDED: Total coins earned from all activities
        totalCoinsEarned: coinBreakdown.totalCoinsEarned,
 
        activityStats: {
          quizzes: {
            attempted:        quizAttempted,
            correct:          quizCorrect,
            wrong:            quizWrong,
            coinsEarned:      quizCoins,
            timeSpent:        formatTimeSpent(quizTimeSeconds),
            timeSpentSeconds: quizTimeSeconds,
          },
          news: {
            read:             newsReadCount,
            coinsEarned:      newsCoins,
            timeSpent:        formatTimeSpent(newsTimeSeconds),
            timeSpentSeconds: newsTimeSeconds,
            // ENHANCED: Read status with timer and daily breakdown
            readStatus: {
              totalRead: newsReadStatus.totalRead,
              totalUniqueContentRead: newsReadStatus.totalUniqueContentRead,
              totalTimeSpent: newsReadStatus.totalTimeSpent,
              totalTimeSpentSeconds: newsReadStatus.totalTimeSpentSeconds,
              dailyBreakdown: newsReadStatus.dailyBreakdown,
              last7Days: last7DaysNews,
              details: newsReadStatus.details.slice(0, 20)
            }
          },
          facts: {
            read:             factReadCount,
            coinsEarned:      factCoins,
            timeSpent:        formatTimeSpent(factTimeSeconds),
            timeSpentSeconds: factTimeSeconds,
            // ENHANCED: Read status with timer and daily breakdown
            readStatus: {
              totalRead: factReadStatus.totalRead,
              totalUniqueContentRead: factReadStatus.totalUniqueContentRead,
              totalTimeSpent: factReadStatus.totalTimeSpent,
              totalTimeSpentSeconds: factReadStatus.totalTimeSpentSeconds,
              dailyBreakdown: factReadStatus.dailyBreakdown,
              last7Days: last7DaysFacts,
              details: factReadStatus.details.slice(0, 20)
            }
          },
          totalTimeSpent: formatTimeSpent(totalTimeSeconds),
        },
 
        dailyActivity,
      });
    }
 
    return res.status(200).json({
      message: 'Users retrieved successfully!',
      users:   formattedUsers,
    });
 
  } catch (error) {
    console.error('Error retrieving users:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// GET Single User by ID

// GET Single User by ID - FIXED with better time calculation

// export const getUserById = async (req, res) => {
//   try {
//     const userId = req.params.userId;

//     const user = await User.findById(userId)
//       .populate('favoriteCoupons')
//       .populate('MyCoupons.couponId')
//       .populate('coinHistory.toUser')
//       .populate('MyChatMembers.userId')
//       .populate('notifications.senderId')
//       .populate('notifications.vendorId');

//     if (!user) {
//       return res.status(404).json({ message: 'User not found!' });
//     }

//     // ==================== IMPROVED TIME TRACKING ====================
//     const now = new Date();

//     // Helper to calculate time stats
//     const calculateTimeStats = (views = [], type = '') => {
//       if (!Array.isArray(views)) views = [];
      
//       const totalSeconds = views.reduce((sum, v) => {
//         // Handle different possible timeSpent formats
//         let timeSpent = 0;
//         if (v && v.timeSpent) {
//           if (typeof v.timeSpent === 'number') {
//             timeSpent = v.timeSpent;
//           } else if (typeof v.timeSpent === 'string') {
//             // Parse string like "120" or "2m" or "1h 30m"
//             const numMatch = v.timeSpent.match(/\d+/);
//             if (numMatch) {
//               timeSpent = parseInt(numMatch[0]);
//             }
            
//             // Convert minutes to seconds if needed
//             if (v.timeSpent.includes('m') && !v.timeSpent.includes('h')) {
//               timeSpent = timeSpent * 60;
//             }
//             // Convert hours to seconds
//             if (v.timeSpent.includes('h')) {
//               const hours = parseInt(v.timeSpent.match(/\d+/)[0]);
//               timeSpent = hours * 3600;
//             }
//           }
//         }
//         return sum + (timeSpent || 0);
//       }, 0);
      
//       const hours = Math.floor(totalSeconds / 3600);
//       const minutes = Math.floor((totalSeconds % 3600) / 60);
//       const seconds = totalSeconds % 60;

//       return {
//         totalSeconds,
//         formatted: `${hours}h ${minutes}m ${seconds}s`,
//         hours,
//         minutes,
//         seconds,
//         days: Math.floor(hours / 24),
//         itemCount: views.length,
//         note: views.length > 0 
//           ? `Based on ${views.length} ${type} interactions`
//           : 'No activity detected'
//       };
//     };

//     // Get viewHistory
//     const viewHistory = Array.isArray(user.viewHistory) ? user.viewHistory : [];

//     // Facts time
//     const factViews = viewHistory.filter(v => v && v.contentType === 'fact');
//     const factsTimeSpent = calculateTimeStats(factViews, 'fact');
    
//     // Buzz time
//     const buzzViews = viewHistory.filter(v => v && (v.contentType === 'buzz' || v.contentType === 'news'));
//     const buzzTimeSpent = calculateTimeStats(buzzViews, 'buzz');

//     // Quiz time - try to calculate from available data
//     let quizTimeSpent = {
//       totalSeconds: 0,
//       formatted: '0h 0m 0s',
//       hours: 0,
//       minutes: 0,
//       seconds: 0,
//       days: 0,
//       itemCount: 0,
//       note: 'No quiz activity'
//     };

//     try {
//       // Check if user has quiz submissions
//       let QuizSubmission;
//       try {
//         QuizSubmission = mongoose.model('QuizSubmission');
//       } catch (e) {
//         QuizSubmission = mongoose.connection.model('QuizSubmission');
//       }

//       const userQuizzes = await QuizSubmission.find({ userId }).lean();

//       if (userQuizzes && userQuizzes.length > 0) {
//         let totalSeconds = 0;
        
//         userQuizzes.forEach(quiz => {
//           // Check for timeSpent field
//           if (quiz.timeSpent && typeof quiz.timeSpent === 'number') {
//             totalSeconds += quiz.timeSpent;
//           } else {
//             // If no timeSpent, estimate based on number of questions
//             // Each question might take ~30 seconds on average
//             if (quiz.answers && Array.isArray(quiz.answers)) {
//               totalSeconds += quiz.answers.length * 30;
//             } else {
//               // Default estimate: 2 minutes per quiz
//               totalSeconds += 120;
//             }
//           }
//         });

//         const hours = Math.floor(totalSeconds / 3600);
//         const minutes = Math.floor((totalSeconds % 3600) / 60);
//         const seconds = totalSeconds % 60;

//         quizTimeSpent = {
//           totalSeconds,
//           formatted: `${hours}h ${minutes}m ${seconds}s`,
//           hours,
//           minutes,
//           seconds,
//           days: Math.floor(hours / 24),
//           itemCount: userQuizzes.length,
//           note: userQuizzes[0]?.timeSpent 
//             ? `Actual tracked time from ${userQuizzes.length} quizzes`
//             : `Estimated time from ${userQuizzes.length} quizzes (30 sec per question)`
//         };
//       }
//     } catch (err) {
//       console.error('Quiz time error:', err.message);
//     }

//     // Steps time - calculate from steps array
//     const stepsTimeSpent = (() => {
//       const steps = Array.isArray(user.steps) ? user.steps : [];
      
//       if (steps.length === 0) {
//         return {
//           totalSeconds: 0,
//           formatted: '0h 0m 0s',
//           hours: 0,
//           minutes: 0,
//           seconds: 0,
//           days: 0,
//           itemCount: 0,
//           note: 'No steps activity'
//         };
//       }

//       let totalMinutes = 0;

//       steps.forEach(stepEntry => {
//         // Parse timeSpent string
//         const timeStr = stepEntry.timeSpent || '0m';
        
//         // Extract hours and minutes
//         const hourMatch = timeStr.match(/(\d+)\s*h/);
//         const minMatch = timeStr.match(/(\d+)\s*m/);
//         const hrMatch = timeStr.match(/(\d+)\s*hr/);

//         const hours = (hourMatch ? parseInt(hourMatch[1]) : 0) || (hrMatch ? parseInt(hrMatch[1]) : 0);
//         const minutes = minMatch ? parseInt(minMatch[1]) : 0;

//         totalMinutes += (hours * 60) + minutes;
//       });

//       const totalSeconds = totalMinutes * 60;
//       const hours = Math.floor(totalMinutes / 60);
//       const minutes = totalMinutes % 60;

//       return {
//         totalSeconds,
//         formatted: `${hours}h ${minutes}m 0s`,
//         hours,
//         minutes,
//         seconds: 0,
//         days: Math.floor(hours / 24),
//         itemCount: steps.length,
//         note: `Based on ${steps.length} walking sessions`
//       };
//     })();

//     // Calculate totals
//     const totalTimeSpent = {
//       totalSeconds: factsTimeSpent.totalSeconds + buzzTimeSpent.totalSeconds +
//         quizTimeSpent.totalSeconds + stepsTimeSpent.totalSeconds,
//       formatted: '',
//       hours: 0,
//       minutes: 0,
//       seconds: 0,
//       days: 0
//     };

//     const totalHours = Math.floor(totalTimeSpent.totalSeconds / 3600);
//     const totalMinutes = Math.floor((totalTimeSpent.totalSeconds % 3600) / 60);
//     const totalSeconds = totalTimeSpent.totalSeconds % 60;

//     totalTimeSpent.hours = totalHours;
//     totalTimeSpent.minutes = totalMinutes;
//     totalTimeSpent.seconds = totalSeconds;
//     totalTimeSpent.days = Math.floor(totalHours / 24);
//     totalTimeSpent.formatted = `${totalHours}h ${totalMinutes}m ${totalSeconds}s`;

//     // Live timestamp
//     const liveTimestamp = {
//       date: now.toISOString().split('T')[0],
//       day: now.toLocaleDateString('en-US', { weekday: 'long' }),
//       time: now.toLocaleTimeString('en-US', { hour12: false }),
//       hours: now.getHours(),
//       minutes: now.getMinutes(),
//       seconds: now.getSeconds(),
//       fullTimestamp: now.toISOString(),
//       epoch: now.getTime()
//     };

//     // Category breakdown with percentages
//     const categoryTimeSpent = {
//       facts: factsTimeSpent,
//       buzz: buzzTimeSpent,
//       quiz: quizTimeSpent,
//       steps: stepsTimeSpent,
//       total: totalTimeSpent,
//       liveTimestamp: liveTimestamp,
//       percentageBreakdown: {
//         facts: totalTimeSpent.totalSeconds > 0
//           ? parseFloat((factsTimeSpent.totalSeconds / totalTimeSpent.totalSeconds * 100).toFixed(2))
//           : 0,
//         buzz: totalTimeSpent.totalSeconds > 0
//           ? parseFloat((buzzTimeSpent.totalSeconds / totalTimeSpent.totalSeconds * 100).toFixed(2))
//           : 0,
//         quiz: totalTimeSpent.totalSeconds > 0
//           ? parseFloat((quizTimeSpent.totalSeconds / totalTimeSpent.totalSeconds * 100).toFixed(2))
//           : 0,
//         steps: totalTimeSpent.totalSeconds > 0
//           ? parseFloat((stepsTimeSpent.totalSeconds / totalTimeSpent.totalSeconds * 100).toFixed(2))
//           : 0
//       },
//       disclaimer: "Time tracked from actual user activity. Quiz times are estimated based on question count."
//     };

//     // Format response (keep existing structure)
//     const formatted = {
//       id: user._id,
//       name: user.name,
//       email: user.email,
//       phone: user.phone,
//       city: user.city,
//       zipcode: user.zipcode,
//       dateOfBirth: user.dateOfBirth,
//       coins: user.coins,
//       couponCode: user.couponCode || null,
//       favoriteCoupons: user.favoriteCoupons || [],
//       profileImage: user.profileImage || null,
//       otp: user.otp || null,
//       otpExpiry: user.otpExpiry || null,
//       steps: user.steps || [],
//       createdAt: user.createdAt,
//       updatedAt: user.updatedAt,
//       __v: user.__v,
//       location: user.location || null,
//       coinHistory: user.coinHistory || [],
//       MyCoupons: user.MyCoupons || [],
//       claimedCoupons: user.claimedCoupons || [],
//       MyChatMembers: user.MyChatMembers || [],
//       notifications: user.notifications || [],
//       onlineStatus: user.onlineStatus || false,
//       couponHistory: user.couponHistory || [],
//       coupons: user.coupons || 0,
//       categoryTimeSpent: categoryTimeSpent
//     };

//     return res.status(200).json({
//       message: 'User retrieved successfully!',
//       user: formatted,
//     });
//   } catch (error) {
//     console.error('Error fetching user by ID:', error);
//     return res.status(500).json({ 
//       message: 'Server error',
//       error: error.message 
//     });
//   }
// };

// GET Single User by ID - ALWAYS FETCH FRESH DATA
// GET Single User by ID - Enhanced with activity tracking from getAllUsers
export const getUserById = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Fetch user with all populated fields (keep existing population)
    const user = await User.findById(userId)
      .populate('favoriteCoupons')
      .populate('MyCoupons.couponId')
      .populate('coinHistory.toUser')
      .populate('MyChatMembers.userId')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // ==================== PRE-LOAD ALL COLLECTIONS (same as getAllUsers) ====================
    
    // 1. All quiz submissions
    let allQuizSubs = [];
    let quizSubsByUser = {};
    try {
      let QuizSubmission;
      try {
        QuizSubmission = mongoose.model('QuizSubmission');
      } catch (e) {
        QuizSubmission = mongoose.connection.model('QuizSubmission');
      }
      
      allQuizSubs = await QuizSubmission.find({ userId })
        .select('userId topic question score timeSpent submittedAt createdAt isCorrect selectedOption correctAnswer questionId')
        .lean();
      
      const uid = userId.toString();
      quizSubsByUser[uid] = allQuizSubs;
    } catch (err) {
      console.error('Quiz submissions error:', err.message);
    }

    // 2. News articles
    let allNewsArticles = [];
    try {
      const [rssNews, bulkNews] = await Promise.all([
        mongoose.models.NewsArticle
          ? mongoose.model('NewsArticle').find({}).select('_id title category source published_at pubDate createdAt').lean()
          : [],
        mongoose.models.News
          ? mongoose.model('News').find({}).select('_id catchy_headline category source_name published_at createdAt').lean()
          : [],
      ]);
      allNewsArticles = [...rssNews, ...bulkNews];
    } catch (e) {
      console.error('News pre-load error:', e.message);
    }

    const newsArticleById = {};
    for (const n of allNewsArticles) {
      newsArticleById[n._id.toString()] = n;
    }

    // 3. FunFacts
    let allFunFacts = [];
    try {
      allFunFacts = await FunFact.find({})
        .select('_id fact category createdAt pubDate')
        .lean();
    } catch (e) {
      console.error('FunFact pre-load error:', e.message);
    }

    const funFactById = {};
    for (const f of allFunFacts) {
      funFactById[f._id.toString()] = f;
    }

    // ==================== HELPER FUNCTIONS ====================
    
    const formatTimeSpent = (seconds) => {
      if (!seconds || seconds < 0) return '0m';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
      if (hours > 0) return `${hours}h`;
      if (minutes > 0) return `${minutes}m`;
      return `${secs}s`;
    };

    const toDateStr = (d) => {
      try { return new Date(d).toISOString().slice(0, 10); }
      catch { return null; }
    };

    // Helper to detect news/fact entries
    const NEWS_KEYWORDS = ['news', 'buzz', 'article', 'headline', 'reading news'];
    const FACTS_KEYWORDS = ['fact', 'funfact', 'fun fact', 'fun-fact'];

    const isNewsEntry = (entry) => {
      if ((entry.amount || 0) <= 0) return false;
      if (entry.metadata?.newsId) return true;
      const t = (entry.metadata?.type || entry.metadata?.bonusType || entry.bonusType || '').toLowerCase();
      if (t === 'news' || t === 'buzz' || t === 'news_read') return true;
      const msg = (entry.message || '').toLowerCase();
      const meta = entry.metadata ? JSON.stringify(entry.metadata).toLowerCase() : '';
      return NEWS_KEYWORDS.some(kw => msg.includes(kw) || meta.includes(kw));
    };

    const isFactEntry = (entry) => {
      if ((entry.amount || 0) <= 0) return false;
      if (entry.metadata?.factId) return true;
      const t = (entry.metadata?.type || entry.metadata?.bonusType || entry.bonusType || '').toLowerCase();
      if (t === 'fact' || t === 'funfact' || t === 'fun_fact' || t === 'fact_read') return true;
      const msg = (entry.message || '').toLowerCase();
      const meta = entry.metadata ? JSON.stringify(entry.metadata).toLowerCase() : '';
      return FACTS_KEYWORDS.some(kw => msg.includes(kw) || meta.includes(kw));
    };

    // Enhanced read status helper (same as getAllUsers)
    const getReadStatusWithTime = (viewHistory = [], contentType = '') => {
      const filtered = viewHistory.filter(v => v && v.contentType === contentType);
      const byDate = new Map();
      const details = [];
      const contentReadMap = new Map();
      
      for (const item of filtered) {
        const date = toDateStr(item.viewedAt);
        if (!date) continue;
        
        const contentId = item.contentId?.toString() || `view_${date}_${item.viewedAt?.getTime()}`;
        
        const contentKey = `${date}_${contentId}`;
        if (!contentReadMap.has(contentKey)) {
          contentReadMap.set(contentKey, { date, contentId, timeSpent: item.timeSpent || 0 });
        }
        
        if (!byDate.has(date)) {
          byDate.set(date, { 
            count: 0, 
            totalTime: 0,
            uniqueContentIds: new Set()
          });
        }
        const dayData = byDate.get(date);
        
        if (!dayData.uniqueContentIds.has(contentId)) {
          dayData.uniqueContentIds.add(contentId);
          dayData.count++;
        }
        dayData.totalTime += (item.timeSpent || 0);
        dayData.lastView = Math.max(dayData.lastView || 0, new Date(item.viewedAt).getTime());
        
        details.push({
          contentId: item.contentId,
          date: date,
          timeSpent: item.timeSpent || 0,
          timeSpentFormatted: formatTimeSpent(item.timeSpent || 0)
        });
      }
      
      const dailyBreakdown = Array.from(byDate.entries())
        .map(([date, data]) => ({
          date,
          readCount: data.count,
          totalTimeSpent: formatTimeSpent(data.totalTime),
          totalTimeSpentSeconds: data.totalTime,
          lastReadAt: data.lastView ? new Date(data.lastView).toISOString() : null
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
      
      return {
        totalRead: filtered.length,
        totalUniqueContentRead: contentReadMap.size,
        totalTimeSpent: formatTimeSpent(filtered.reduce((sum, v) => sum + (v.timeSpent || 0), 0)),
        totalTimeSpentSeconds: filtered.reduce((sum, v) => sum + (v.timeSpent || 0), 0),
        dailyBreakdown,
        details: details.slice(0, 50)
      };
    };

    // ==================== DATA PROCESSING ====================
    
    const viewHistory = Array.isArray(user.viewHistory) ? user.viewHistory : [];
    const coinHistory = Array.isArray(user.coinHistory) ? user.coinHistory : [];
    const userIdStr = user._id.toString();
    const customerId = `C${userIdStr.slice(-6)}`;

    // Coin breakdown (same as getAllUsers)
    const coinBreakdown = {
      quizzes: { totalCoins: 0, count: 0 },
      news: { totalCoins: 0, count: 0, byCategory: {} },
      facts: { totalCoins: 0, count: 0, byCategory: {} },
      totalCoinsEarned: 0
    };

    for (const entry of coinHistory) {
      if (entry.type !== 'added') continue;
      const amount = entry.amount || 0;
      if (amount <= 0) continue;
      
      coinBreakdown.totalCoinsEarned += amount;
      
      if (entry.message?.toLowerCase().includes('quiz') || entry.metadata?.type === 'quiz') {
        coinBreakdown.quizzes.totalCoins += amount;
        coinBreakdown.quizzes.count++;
      }
      else if (entry.message?.toLowerCase().includes('news') || entry.metadata?.type === 'news') {
        coinBreakdown.news.totalCoins += amount;
        coinBreakdown.news.count++;
        const cat = entry.metadata?.category || 'Unknown';
        if (!coinBreakdown.news.byCategory[cat]) {
          coinBreakdown.news.byCategory[cat] = { totalCoins: 0, count: 0 };
        }
        coinBreakdown.news.byCategory[cat].totalCoins += amount;
        coinBreakdown.news.byCategory[cat].count++;
      }
      else if (entry.message?.toLowerCase().includes('fact') || entry.metadata?.type === 'fact') {
        coinBreakdown.facts.totalCoins += amount;
        coinBreakdown.facts.count++;
        const cat = entry.metadata?.category || 'General';
        if (!coinBreakdown.facts.byCategory[cat]) {
          coinBreakdown.facts.byCategory[cat] = { totalCoins: 0, count: 0 };
        }
        coinBreakdown.facts.byCategory[cat].totalCoins += amount;
        coinBreakdown.facts.byCategory[cat].count++;
      }
    }

    // QUIZ STATS
    let quizAttempted = 0, quizCorrect = 0, quizWrong = 0;
    let quizCoins = 0, quizTimeSeconds = 0;
    const dailyQuizMap = new Map();

    const userQuizSubs = quizSubsByUser[userIdStr] || [];
    if (userQuizSubs.length > 0) {
      quizAttempted = userQuizSubs.length;
      quizCorrect = userQuizSubs.filter(s => (s.score || 0) > 0).length;
      quizWrong = quizAttempted - quizCorrect;
      quizCoins = userQuizSubs.reduce((sum, s) => sum + (s.score || 0), 0);
      const hasTime = userQuizSubs.some(s => s.timeSpent && s.timeSpent > 0);
      quizTimeSeconds = hasTime
        ? userQuizSubs.reduce((sum, s) => sum + (s.timeSpent || 0), 0)
        : quizAttempted * 30;

      for (const sub of userQuizSubs) {
        const date = toDateStr(sub.submittedAt || sub.createdAt);
        if (!date) continue;
        if (!dailyQuizMap.has(date)) {
          dailyQuizMap.set(date, { attempted: 0, correct: 0, wrong: 0, coins: 0, timeSec: 0 });
        }
        const day = dailyQuizMap.get(date);
        day.attempted++;
        const s = sub.score || 0;
        day.coins += s;
        day.timeSec += sub.timeSpent || 30;
        if (s > 0) day.correct++; else day.wrong++;
      }
    }

    // NEWS STATS
    const newsCoinEntries = coinHistory.filter(isNewsEntry);
    const newsReadStatus = getReadStatusWithTime(viewHistory, 'news');
    
    let newsReadCount = newsReadStatus.totalRead;
    let newsCoins = newsCoinEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
    let newsTimeSeconds = newsReadStatus.totalTimeSpentSeconds;
    
    const dailyNewsMap = new Map();
    const seenNewsByDate = new Map();
    
    const newsViews = viewHistory.filter(v => v && (v.contentType === 'news' || v.contentType === 'buzz'));
    
    for (const v of newsViews) {
      const date = toDateStr(v.viewedAt);
      const nid = v.contentId?.toString() || `vh_${date}_${Math.random()}`;
      if (!date) continue;
      
      const dayKey = `${date}_${nid}`;
      if (!seenNewsByDate.has(dayKey)) {
        seenNewsByDate.set(dayKey, true);
      }
      
      if (!dailyNewsMap.has(date)) {
        dailyNewsMap.set(date, { read: 0, uniqueRead: 0, coins: 0, timeSec: 0, newsIds: new Set() });
      }
      const day = dailyNewsMap.get(date);
      
      if (!day.newsIds.has(nid)) {
        day.newsIds.add(nid);
        day.uniqueRead++;
      }
      day.read++;
      day.timeSec += v.timeSpent || 90;
    }
    
    for (const entry of newsCoinEntries) {
      const date = toDateStr(entry.timestamp || entry.createdAt);
      if (!date) continue;
      if (!dailyNewsMap.has(date)) {
        dailyNewsMap.set(date, { read: 0, uniqueRead: 0, coins: 0, timeSec: 0, newsIds: new Set() });
      }
      dailyNewsMap.get(date).coins += entry.amount || 0;
    }

    // Get last 7 days of news activity
    const last7DaysNews = Array.from(dailyNewsMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .map(day => ({
        date: day.date,
        readCount: day.uniqueRead || day.read,
        timeSpent: formatTimeSpent(day.timeSec),
        timeSpentSeconds: day.timeSec,
        coinsEarned: day.coins
      }));

    // FACTS STATS
    const factCoinEntries = coinHistory.filter(isFactEntry);
    const factReadStatus = getReadStatusWithTime(viewHistory, 'fact');
    
    let factReadCount = factReadStatus.totalRead;
    let factCoins = factCoinEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
    let factTimeSeconds = factReadStatus.totalTimeSpentSeconds;
    
    const dailyFactMap = new Map();
    const seenFactsByDate = new Map();
    
    const factViews = viewHistory.filter(v => v && v.contentType === 'fact');
    
    for (const v of factViews) {
      const date = toDateStr(v.viewedAt);
      const fid = v.contentId?.toString() || `vh_${date}_${Math.random()}`;
      if (!date) continue;
      
      const dayKey = `${date}_${fid}`;
      if (!seenFactsByDate.has(dayKey)) {
        seenFactsByDate.set(dayKey, true);
      }
      
      if (!dailyFactMap.has(date)) {
        dailyFactMap.set(date, { read: 0, uniqueRead: 0, coins: 0, timeSec: 0, factIds: new Set() });
      }
      const day = dailyFactMap.get(date);
      
      if (!day.factIds.has(fid)) {
        day.factIds.add(fid);
        day.uniqueRead++;
      }
      day.read++;
      day.timeSec += v.timeSpent || 45;
    }
    
    for (const entry of factCoinEntries) {
      const date = toDateStr(entry.timestamp || entry.createdAt);
      if (!date) continue;
      if (!dailyFactMap.has(date)) {
        dailyFactMap.set(date, { read: 0, uniqueRead: 0, coins: 0, timeSec: 0, factIds: new Set() });
      }
      dailyFactMap.get(date).coins += entry.amount || 0;
    }

    // Get last 7 days of facts activity
    const last7DaysFacts = Array.from(dailyFactMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .map(day => ({
        date: day.date,
        readCount: day.uniqueRead || day.read,
        timeSpent: formatTimeSpent(day.timeSec),
        timeSpentSeconds: day.timeSec,
        coinsEarned: day.coins
      }));

    // STEPS TIME (keep existing calculation)
    const stepsTimeSeconds = (() => {
      const steps = Array.isArray(user.steps) ? user.steps : [];
      let totalMins = 0;
      for (const step of steps) {
        const timeStr = step.timeSpent || '0m';
        const hourMatch = timeStr.match(/(\d+)\s*hr?/i);
        const minMatch = timeStr.match(/(\d+)\s*m(?!s)/i);
        let mins = 0;
        if (hourMatch) mins += parseInt(hourMatch[1]) * 60;
        if (minMatch && (!hourMatch || minMatch[0] !== hourMatch[0])) {
          mins += parseInt(minMatch[1]);
        }
        totalMins += mins;
      }
      return totalMins * 60;
    })();

    // TOTAL TIME
    const totalTimeSeconds = quizTimeSeconds + newsTimeSeconds + factTimeSeconds + stepsTimeSeconds;

    // DAILY ACTIVITY
    const allDates = new Set([
      ...dailyQuizMap.keys(),
      ...dailyNewsMap.keys(),
      ...dailyFactMap.keys(),
    ]);

    const dailyActivity = Array.from(allDates)
      .map(date => ({
        date,
        quizzes: dailyQuizMap.get(date) || { attempted: 0, correct: 0, wrong: 0, coins: 0, timeSec: 0 },
        news: dailyNewsMap.get(date) || { read: 0, uniqueRead: 0, coins: 0, timeSec: 0 },
        facts: dailyFactMap.get(date) || { read: 0, uniqueRead: 0, coins: 0, timeSec: 0 },
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // ==================== BUILD RESPONSE ====================
    // Keep all existing fields from old response EXACTLY as they were
    const formatted = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      city: user.city,
      zipcode: user.zipcode,
      dateOfBirth: user.dateOfBirth,
      coins: user.coins,
      couponCode: user.couponCode || null,
      favoriteCoupons: user.favoriteCoupons || [],
      profileImage: user.profileImage || null,
      otp: user.otp || null,
      otpExpiry: user.otpExpiry || null,
      steps: user.steps || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      __v: user.__v,
      location: user.location || null,
      coinHistory: user.coinHistory || [],
      MyCoupons: user.MyCoupons || [],
      claimedCoupons: user.claimedCoupons || [],
      MyChatMembers: user.MyChatMembers || [],
      onlineStatus: user.onlineStatus || false,
      couponHistory: user.couponHistory || [],
      coupons: user.coupons || 0,
      
      // NEW ENHANCED FIELDS (matching getAllUsers structure)
      customerId: customerId,
      coinBreakdown: coinBreakdown,
      totalCoinsEarned: coinBreakdown.totalCoinsEarned,
      
      activityStats: {
        quizzes: {
          attempted: quizAttempted,
          correct: quizCorrect,
          wrong: quizWrong,
          coinsEarned: quizCoins,
          timeSpent: formatTimeSpent(quizTimeSeconds),
          timeSpentSeconds: quizTimeSeconds,
        },
        news: {
          read: newsReadCount,
          coinsEarned: newsCoins,
          timeSpent: formatTimeSpent(newsTimeSeconds),
          timeSpentSeconds: newsTimeSeconds,
          readStatus: {
            totalRead: newsReadStatus.totalRead,
            totalUniqueContentRead: newsReadStatus.totalUniqueContentRead,
            totalTimeSpent: newsReadStatus.totalTimeSpent,
            totalTimeSpentSeconds: newsReadStatus.totalTimeSpentSeconds,
            dailyBreakdown: newsReadStatus.dailyBreakdown,
            last7Days: last7DaysNews,
            details: newsReadStatus.details.slice(0, 20)
          }
        },
        facts: {
          read: factReadCount,
          coinsEarned: factCoins,
          timeSpent: formatTimeSpent(factTimeSeconds),
          timeSpentSeconds: factTimeSeconds,
          readStatus: {
            totalRead: factReadStatus.totalRead,
            totalUniqueContentRead: factReadStatus.totalUniqueContentRead,
            totalTimeSpent: factReadStatus.totalTimeSpent,
            totalTimeSpentSeconds: factReadStatus.totalTimeSpentSeconds,
            dailyBreakdown: factReadStatus.dailyBreakdown,
            last7Days: last7DaysFacts,
            details: factReadStatus.details.slice(0, 20)
          }
        },
        totalTimeSpent: formatTimeSpent(totalTimeSeconds),
      },
      
      dailyActivity: dailyActivity
    };

    console.log(`✅ Returning enhanced user data for ${user.name} with ${quizAttempted} quizzes, ${newsReadCount} news, ${factReadCount} facts`);

    return res.status(200).json({
      message: 'User retrieved successfully!',
      user: formatted,
    });

  } catch (error) {
    console.error('Error fetching user by ID:', error);
    return res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
};

export const getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().select("-password -otp -otpExpiry");

    return res.status(200).json({
      message: "Vendors fetched successfully",
      vendors,
    });

  } catch (error) {
    console.error("Error fetching vendors:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAllPendingVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({ isApproved: false })
      .select("-password -otp -otpExpiry");

    return res.status(200).json({
      message: "Pending vendors fetched successfully",
      vendors
    });

  } catch (error) {
    console.error("Get Pending Vendors Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const approveVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      { isApproved: true },
      { new: true }
    ).select("-password -otp -otpExpiry");

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // Replace this:
    await Notification.create({
      vendorId,
      vendorName: vendor.businessName || vendor.name,
      title: '✅ Vendor Approved',
      message: `Vendor "${vendor.businessName}" has been approved.`,
      type: 'vendor_approved',
      isRead: false,
    });

    // With:
    await notifyAdmin(
      vendorId,
      '✅ Vendor Approved',
      `Vendor "${vendor.businessName}" has been approved.`,
      'vendor_approved'
    );

    // 🔔 NOTIFY VENDOR about approval
    await notifyVendor({
      vendorId: vendor._id,
      title: '✅ Vendor Account Approved',
      message: `Your vendor account "${vendor.businessName}" has been approved by admin. You can now login.`,
      type: 'vendor_approved',
      metadata: {
        vendorId: vendor._id,
        businessName: vendor.businessName
      }
    });

    return res.status(200).json({
      message: "Vendor approved successfully",
      vendor,
    });

  } catch (error) {
    console.error("Approve Vendor Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const rejectVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // 🔔 NOTIFY VENDOR before deleting
    await notifyVendor({
      vendorId: vendor._id,
      title: '❌ Vendor Registration Rejected',
      message: `Your vendor registration for "${vendor.businessName}" has been rejected.`,
      type: 'vendor_rejected',
      metadata: {
        vendorId: vendor._id,
        businessName: vendor.businessName
      }
    });

    // Delete vendor
    await Vendor.findByIdAndDelete(vendorId);

    return res.status(200).json({
      message: "Vendor rejected & removed successfully"
    });

  } catch (error) {
    console.error("Reject Vendor Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};



//----------------------------------------------------------------------------------------------------



export const getVendorById = async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Fetch all coupons for this vendor
    const coupons = await Coupon.find({ vendorId: id }).sort({ createdAt: -1 });

    // Fetch all feedbacks for this vendor and populate user details
    const feedbacks = await Feedback.find({ vendorId: id })
      .populate('userId', 'name profileImage') // populate name and profileImage of user
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: 'Vendor fetched successfully',
      vendor,
      coupons,
      feedbacks,
    });
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({
      vendorId: { $ne: null }   // ✅ FILTER
    })
      .populate("vendorId", "name businessName businessLogo");

    res.status(200).json({
      message: "All coupons fetched successfully",
      total: coupons.length,
      coupons
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};






// export const updateCouponStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const {
//       status,
//       requiredCoins,
//       limitForSameUser,
//       maxUsage,
//       rejectionReason
//     } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({ message: "Invalid coupon ID" });
//     }

//     const allowedStatuses = ["approved", "rejected", "pending"];
//     if (!allowedStatuses.includes(status)) {
//       return res.status(400).json({ message: "Invalid status value" });
//     }

//     // Build update object dynamically
//     const updateData = { status };

//     // Admin-only fields (set ONLY on approval)
//     if (status === "approved") {
//       updateData.requiredCoins = requiredCoins ?? 0;
//       updateData.limitForSameUser = limitForSameUser ?? 1;
//       updateData.maxUsage = maxUsage ?? 1000;
//     }

//     // Store rejection reason if provided
//     if (status === "rejected" && rejectionReason) {
//       updateData.rejectionReason = rejectionReason;
//     }

//     const coupon = await Coupon.findByIdAndUpdate(
//       id,
//       updateData,
//       { new: true }
//     ).populate({
//       path: "vendorId",
//       select: "name businessName businessLogo"
//     });

//     if (!coupon) {
//       return res.status(404).json({ message: "Coupon not found" });
//     }

//     // ✅ FIXED: Send APPROVED notification when status is approved
//     if (status === "approved") {
//       // Admin notification
//       await notifyAdmin(
//         coupon.vendorId._id,
//         '✅ Coupon Approved',
//         `Coupon "${coupon.name}" has been approved and is now live.`,
//         'coupon_approved',
//         {
//           couponId: coupon._id,
//           status: 'approved'
//         }
//       );

//       // Vendor notification - APPROVED
//       await notifyVendor({
//         vendorId: coupon.vendorId._id,
//         title: '🎉 Coupon Approved!',
//         message: `Your coupon "${coupon.name}" has been approved by admin and is now live.`,
//         type: 'coupon_approved',
//         couponId: coupon._id,
//         metadata: {
//           couponId: coupon._id,
//           status: 'approved'
//         }
//       });
//     } 
//     // Send REJECTED notification when status is rejected
//     else if (status === "rejected") {
//       // Admin notification
//       await notifyAdmin(
//         coupon.vendorId._id,
//         '❌ Coupon Rejected',
//         `Coupon "${coupon.name}" has been rejected. ${rejectionReason ? 'Reason: ' + rejectionReason : ''}`,
//         'coupon_rejected',
//         {
//           couponId: coupon._id,
//           status: 'rejected',
//           rejectionReason: rejectionReason || null
//         }
//       );

//       // Vendor notification - REJECTED
//       await notifyVendor({
//         vendorId: coupon.vendorId._id,
//         title: '⚠️ Coupon Rejected',
//         message: `Your coupon "${coupon.name}" has been rejected. ${rejectionReason ? 'Reason: ' + rejectionReason : ''}`,
//         type: 'coupon_rejected',
//         couponId: coupon._id,
//         metadata: {
//           couponId: coupon._id,
//           status: 'rejected',
//           rejectionReason: rejectionReason || null
//         }
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: `Coupon ${status} successfully`,
//       coupon
//     });

//   } catch (error) {
//     console.error("Update coupon status error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message
//     });
//   }
// };


// Delete coupon controller


// In AdminController.js - Make sure this is your exact function


export const updateCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      requiredCoins,
      limitForSameUser,
      maxUsage,
      rejectionReason
    } = req.body;

    console.log("🔥 ADMIN APPROVAL CALLED");
    console.log("🔥 Coupon ID:", id);
    console.log("🔥 New Status:", status);
    console.log("🔥 Request Body:", req.body);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid coupon ID" });
    }

    const allowedStatuses = ["approved", "rejected", "pending"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // FIRST get the coupon to have vendor info
    const existingCoupon = await Coupon.findById(id);
    if (!existingCoupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    console.log("📊 Current status:", existingCoupon.status);
    console.log("📊 Vendor ID:", existingCoupon.vendorId);

    const vendorId = existingCoupon.vendorId;
    const couponName = existingCoupon.name;

    // Build update object
    const updateData = { status };

    if (status === "approved") {
      updateData.requiredCoins = requiredCoins ?? existingCoupon.requiredCoins ?? 0;
      updateData.limitForSameUser = limitForSameUser ?? existingCoupon.limitForSameUser ?? 1;
      updateData.maxUsage = maxUsage ?? existingCoupon.maxUsage ?? 1000;
      // Clear any rejection reason
      updateData.rejectionReason = null;
      updateData.deleteRequested = false;
    }

    if (status === "rejected" && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    console.log("📝 Update Data:", updateData);

    // UPDATE the coupon using findByIdAndUpdate (direct DB update, no hooks)
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      id,
      { $set: updateData },  // ✅ Use $set to ensure fields are set correctly
      { new: true, runValidators: false } // ✅ runValidators: false to avoid schema issues
    ).populate('vendorId', 'name businessName businessLogo');

    if (!updatedCoupon) {
      return res.status(404).json({ message: "Coupon not found after update" });
    }

    console.log(`✅ Coupon "${couponName}" status updated to: ${updatedCoupon.status}`);
    console.log(`✅ Full updated coupon:`, JSON.stringify(updatedCoupon, null, 2));

    // Send notification to vendor
    if (status === "approved") {
      console.log("📧 Sending approval notification to vendor:", vendorId);
      try {
        await Notification.create({
          vendorId: vendorId,
          vendorName: updatedCoupon.vendorId?.businessName || updatedCoupon.vendorId?.name || "Vendor",
          title: '🎉 Coupon Approved!',
          message: `Your coupon "${couponName}" has been approved by admin and is now live.`,
          type: 'coupon_approved',
          couponId: updatedCoupon._id,
          isRead: false,
        });
        console.log("✅ Approval notification sent");
      } catch (notifErr) {
        console.error("⚠️ Notification error:", notifErr.message);
      }
    } else if (status === "rejected") {
      console.log("📧 Sending rejection notification to vendor:", vendorId);
      try {
        await Notification.create({
          vendorId: vendorId,
          vendorName: updatedCoupon.vendorId?.businessName || updatedCoupon.vendorId?.name || "Vendor",
          title: '❌ Coupon Rejected',
          message: `Your coupon "${couponName}" has been rejected. ${rejectionReason ? 'Reason: ' + rejectionReason : 'Please review and resubmit.'}`,
          type: 'coupon_rejected',
          couponId: updatedCoupon._id,
          isRead: false,
        });
        console.log("✅ Rejection notification sent");
      } catch (notifErr) {
        console.error("⚠️ Notification error:", notifErr.message);
      }
    } else if (status === "pending") {
      console.log("📧 Sending pending notification to vendor:", vendorId);
      try {
        await Notification.create({
          vendorId: vendorId,
          vendorName: updatedCoupon.vendorId?.businessName || updatedCoupon.vendorId?.name || "Vendor",
          title: '⏳ Coupon Under Review',
          message: `Your coupon "${couponName}" is currently under review by admin.`,
          type: 'coupon_submitted',
          couponId: updatedCoupon._id,
          isRead: false,
        });
      } catch (notifErr) {
        console.error("⚠️ Notification error:", notifErr.message);
      }
    }

    // ✅ Verify the update actually happened by re-fetching
    const verifiedCoupon = await Coupon.findById(id).lean();
    console.log(`✅ VERIFIED - Coupon status in DB: ${verifiedCoupon?.status}`);

    // Return the updated coupon
    return res.status(200).json({
      success: true,
      message: `Coupon ${status} successfully`,
      coupon: updatedCoupon,
      verifiedStatus: verifiedCoupon?.status // Extra confirmation field
    });

  } catch (error) {
    console.error("❌ Update coupon status error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid coupon ID" });
    }

    const deletedCoupon = await Coupon.findByIdAndDelete(id);

    if (!deletedCoupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Coupon deleted permanently from database",
      deletedCouponId: deletedCoupon._id
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



export const createCouponByAdmin = async (req, res) => {
  try {
    const { vendorId } = req.body;
    if (!vendorId) {
      return res.status(400).json({ message: 'vendorId is required' });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const {
      name,
      category,
      discountPercentage,
      requiredCoins,
      validityDate,
      couponCodeType = '%',
      limitForSameUser = 1,
      maxUsage = 1000,
    } = req.body;

    const validity = new Date(validityDate);
    if (isNaN(validity.getTime())) {
      return res.status(400).json({ message: 'Invalid validityDate format' });
    }

    let couponCode;
    let isUnique = false;
    while (!isUnique) {
      couponCode = generateCouponCode(8);
      const exists = await Coupon.findOne({ couponCode });
      if (!exists) isUnique = true;
    }

    const coupon = new Coupon({
      vendorId,
      name,
      category,
      discountPercentage,
      requiredCoins,
      couponCode,
      validityDate: validity,
      couponCodeType,
      limitForSameUser,
      maxUsage,

      // ✅ ADMIN CREATED = APPROVED
      status: 'approved',

      // ✅ Vendor business image
      couponImage: vendor.businessLogo,
    });

    await coupon.save();

    await notifyVendor({
      vendorId,
      title: '✅ Coupon Created by Admin',
      message: `Admin created a coupon "${name}" for your business.`,
      type: 'coupon_approved',  // Already approved since admin created it
      metadata: {
        couponId: coupon._id,
        couponName: name
      }
    });

    res.status(201).json({
      message: 'Coupon created successfully by admin',
      coupon,
    });

  } catch (error) {
    console.error('Create coupon by admin error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


export const createBulkCouponsByAdmin = async (req, res) => {
  try {
    const { vendorId } = req.body;

    if (!vendorId) {
      return res.status(400).json({ message: "vendorId is required" });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const {
      count = 1,
      namePrefix = "",
      nameSuffix = "COUPON",
      category,
      discountPercentage,
      requiredCoins,
      validityDate,
      couponCodeType = "%",
      limitForSameUser = 1,
      maxUsage = 1000,
    } = req.body;

    // limit protection
    if (count < 1 || count > 1000) {
      return res.status(400).json({ message: "Count must be between 1 and 1000" });
    }

    const validity = new Date(validityDate);
    if (isNaN(validity.getTime())) {
      return res.status(400).json({ message: "Invalid validityDate format" });
    }

    const createdCoupons = [];
    const failedCoupons = [];
    const padLength = String(count).length;

    for (let i = 1; i <= count; i++) {
      try {
        // ---------- Coupon Name ----------
        const paddedIndex = String(i).padStart(padLength, "0");
        const name = `${namePrefix}${namePrefix ? "_" : ""}${nameSuffix}_${paddedIndex}`;

        // ---------- Unique Coupon Code ----------
        let couponCode;
        let isUnique = false;

        while (!isUnique) {
          couponCode = generateCouponCode(8);
          const exists = await Coupon.findOne({ couponCode });
          if (!exists) isUnique = true;
        }

        // ---------- Create Coupon ----------
        const coupon = new Coupon({
          vendorId,
          name,
          category,
          discountPercentage,
          requiredCoins,
          couponCode,
          validityDate: validity,
          couponCodeType,
          limitForSameUser,
          maxUsage,

          // ✅ Admin created = approved
          status: "approved",

          // Vendor image
          couponImage: vendor.businessLogo,
        });

        await coupon.save();
        createdCoupons.push(coupon);

      } catch (err) {
        failedCoupons.push({ index: i, error: err.message });
      }
    }

    // 🔔 Notify Vendor
    await notifyVendor({
      vendorId,
      title: "📦 Bulk Coupons Created by Admin",
      message: `Admin created ${createdCoupons.length} coupons for your business.`,
      type: "coupon_approved",
      metadata: {
        totalCoupons: createdCoupons.length
      }
    });

    return res.status(201).json({
      success: true,
      message: "Bulk coupons created successfully by admin",
      created: createdCoupons.length,
      failed: failedCoupons.length,
      coupons: createdCoupons,
      failures: failedCoupons
    });

  } catch (error) {
    console.error("Bulk admin coupon error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};



// Create new category
export const createCategory = async (req, res) => {
  try {
    const { categoryName } = req.body;

    if (!categoryName) {
      return res.status(400).json({ message: 'categoryName is required' });
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({ categoryName });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    const category = new Category({ categoryName });
    await category.save();

    res.status(201).json({
      message: 'Category created successfully',
      category,
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all categories
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ categoryName: 1 });
    res.status(200).json({
      message: 'Categories fetched successfully',
      categories,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update category by ID
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryName } = req.body;

    if (!categoryName) {
      return res.status(400).json({ message: 'categoryName is required' });
    }

    // Check if categoryName already exists for some other category
    const existingCategory = await Category.findOne({ categoryName, _id: { $ne: id } });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category name already in use' });
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { categoryName },
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({
      message: 'Category updated successfully',
      category: updatedCategory,
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete category by ID
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCategory = await Category.findByIdAndDelete(id);

    if (!deletedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({
      message: 'Category deleted successfully',
      category: deletedCategory,
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// ==================== IMPROVED BULK QUIZ UPLOAD ====================
// In AdminController.js - update addBulkQuizzes
export const addBulkQuizzes = async (req, res) => {
  try {
    const { quizzes } = req.body;

    if (!quizzes || !Array.isArray(quizzes) || quizzes.length === 0) {
      return res.status(400).json({
        message: 'Quizzes array is required and cannot be empty.',
      });
    }

    if (quizzes.length > 5000) {
      return res.status(400).json({
        message: 'Maximum 5000 quizzes can be uploaded at once. Please split your data.',
      });
    }

    const validationErrors = [];
    const validQuizzes = [];

    for (let i = 0; i < quizzes.length; i++) {
      const quiz = quizzes[i];
      const { topic, question, options, answer, explanation } = quiz;

      if (!topic || !question || !options || !answer || options.length !== 4) {
        validationErrors.push({
          index: i,
          error: 'Each quiz must include topic, question, exactly 4 options, and answer.'
        });
      } else {
        validQuizzes.push({
          ...quiz,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed for some quizzes',
        errors: validationErrors
      });
    }

    // IMPORTANT: Insert in order and keep original sequence
    // For large inserts, use bulkWrite with ordered: true to preserve insertion order
    if (validQuizzes.length > 100) {
      const bulkOps = validQuizzes.map(quiz => ({
        insertOne: {
          document: quiz
        }
      }));

      // ordered: true ensures documents are inserted in the order they appear
      const result = await Quiz.bulkWrite(bulkOps, { ordered: true });

      // Fetch inserted quizzes in the same order they were inserted
      const insertedQuizzes = await Quiz.find()
        .sort({ createdAt: 1 }) // ASC - oldest first (preserves original order)
        .limit(validQuizzes.length)
        .lean();

      return res.status(201).json({
        message: 'Bulk quizzes uploaded successfully',
        summary: {
          totalInserted: result.insertedCount,
          totalFailed: validQuizzes.length - result.insertedCount
        },
        quizzes: insertedQuizzes // Same order as input (oldest first)
      });
    } else {
      // For smaller inserts, use insertMany with ordered: true to preserve order
      const inserted = await Quiz.insertMany(validQuizzes, {
        ordered: true,
        timestamps: true
      });

      // Keep the original order (inserted order is preserved)
      res.status(201).json({
        message: 'Quizzes added successfully',
        count: inserted.length,
        quizzes: inserted, // Keeps original insertion order
        note: 'Quizzes maintain upload order (oldest first)'
      });
    }
  } catch (error) {
    console.error('Error adding bulk quizzes:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Duplicate entries detected',
        error: error.message
      });
    }

    res.status(500).json({
      message: 'Server error while adding quizzes',
      error: error.message
    });
  }
};

// In AdminController.js - update getAllQuizzes
export const getAllQuizzes = async (req, res) => {
  try {
    const { 
      query, 
      page = 1, 
      limit = 50000, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      userId,
      excludeSeen = 'true'
    } = req.query;

    // Build filter for category/topic
    const filter = query ? { topic: { $regex: query, $options: 'i' } } : {};

    let seenQuizIds = [];
    let user = null;
    
    if (userId && excludeSeen === 'true') {
      try {
        user = await User.findById(userId).select('seenQuizzes').lean();
        if (user && user.seenQuizzes && user.seenQuizzes.length > 0) {
          seenQuizIds = user.seenQuizzes;
        }
      } catch (err) {
        console.error('Error fetching seen quizzes:', err.message);
      }
    }

    // Get total count of ALL quizzes in this category
    const totalAllQuizzes = await Quiz.countDocuments(filter);
    
    // Build seen filter - EXCLUDE seen quizzes
    const unseenFilter = { ...filter };
    if (seenQuizIds.length > 0) {
      unseenFilter._id = { $nin: seenQuizIds };
    }
    
    // Get count of unseen quizzes
    const totalUnseenQuizzes = await Quiz.countDocuments(unseenFilter);
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    let quizzes = [];
    let totalCount = totalUnseenQuizzes;
    let shouldReset = false;
    
    // Case 1: There are unseen quizzes available
    if (totalUnseenQuizzes > 0) {
      quizzes = await Quiz.find(unseenFilter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
    }
    // Case 2: No unseen quizzes left, but there are quizzes in this category
    else if (totalUnseenQuizzes === 0 && totalAllQuizzes > 0) {
      shouldReset = true;
      
      // Reset seen quizzes for this category
      if (user && userId) {
        await User.findByIdAndUpdate(userId, { 
          $set: { seenQuizzes: [] } 
        });
      }
      
      // Now fetch quizzes from beginning (oldest first to maintain order)
      quizzes = await Quiz.find(filter)
        .sort({ createdAt: 1 }) // ASC - oldest first
        .skip(0)
        .limit(parseInt(limit))
        .lean();
      
      totalCount = totalAllQuizzes;
    }

    // If we have quizzes but they're from a reset, pagination needs adjustment
    const finalTotal = shouldReset ? totalAllQuizzes : totalUnseenQuizzes;
    const finalPage = shouldReset ? 1 : parseInt(page);

    res.status(200).json({
      success: true,
      quizzes: quizzes, // EXACT SAME PAYLOAD STRUCTURE
      pagination: {
        total: finalTotal,
        page: finalPage,
        limit: parseInt(limit),
        totalPages: Math.ceil(finalTotal / parseInt(limit)),
        hasNextPage: skip + parseInt(limit) < finalTotal,
        hasPrevPage: finalPage > 1
      },
      sort: {
        by: sortBy,
        order: sortOrder
      },
      // Optional: Add metadata to indicate reset (doesn't break existing payload)
      ...(shouldReset && { 
        _meta: { completed: true, reset: true } 
      })
    });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({
      message: 'Server error while fetching quizzes',
      error: error.message
    });
  }
};


// In AdminController.js - update addBulkFunFacts
export const addBulkFunFacts = async (req, res) => {
  try {
    const { funFacts } = req.body;

    if (!funFacts || !Array.isArray(funFacts) || funFacts.length === 0) {
      return res.status(400).json({
        message: 'funFacts array is required and cannot be empty.',
      });
    }

    if (funFacts.length > 5000) {
      return res.status(400).json({
        message: 'Maximum 5000 fun facts can be uploaded at once. Please split your data.',
      });
    }

    const validationErrors = [];
    const validFunFacts = [];

    for (let i = 0; i < funFacts.length; i++) {
      const fact = funFacts[i];
      const { id, fact: title, description, source, image, link, category } = fact;

      if (!id || !title || !description || !source || !image) {
        validationErrors.push({
          index: i,
          error: 'Each funFact must include id, fact, description, source, and image.',
          received: fact
        });
      } else {
        validFunFacts.push({
          id: parseInt(id) || i + 1,
          fact: title,
          description: description,
          source: source,
          link: link || '',
          image: image,
          category: category || 'General',
          pubDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed for some fun facts',
        errors: validationErrors,
        totalValid: validFunFacts.length,
        totalInvalid: validationErrors.length
      });
    }

    let insertedFacts;
    let summary = {};

    // For large inserts, use bulkWrite with ordered: true to preserve order
    if (validFunFacts.length > 100) {
      const bulkOps = validFunFacts.map(fact => ({
        insertOne: {
          document: fact
        }
      }));

      const result = await FunFact.bulkWrite(bulkOps, { ordered: true });

      summary = {
        totalInserted: result.insertedCount,
        totalFailed: validFunFacts.length - result.insertedCount
      };

      // Fetch inserted facts in the order they were inserted (oldest first)
      insertedFacts = await FunFact.find()
        .sort({ createdAt: 1 }) // ASC - oldest first
        .limit(validFunFacts.length)
        .lean();
    } else {
      // For smaller inserts, use insertMany with ordered: true
      insertedFacts = await FunFact.insertMany(validFunFacts, {
        ordered: true,
        timestamps: true
      });
    }

    // Return in the same order as insertion (oldest first)
    res.status(201).json({
      success: true,
      message: 'FunFacts added successfully',
      summary: summary,
      count: insertedFacts.length,
      funFacts: insertedFacts, // Maintains upload order
      note: 'Fun facts maintain upload order (oldest first)'
    });

  } catch (error) {
    console.error('Error adding fun facts:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entries detected',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while adding fun facts',
      error: error.message
    });
  }
};

// In your AdminController.js - update getAllFunFacts
// In AdminController.js - update getAllFunFacts
export const getAllFunFacts = async (req, res) => {
  try {
    const {
      category,
      page = 1,
      limit = 50000,
      sortBy = 'pubDate',
      sortOrder = 'desc',
      search,
      userId,
      excludeSeen = 'true'
    } = req.query;

    // Build filter
    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { fact: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { source: { $regex: search, $options: 'i' } }
      ];
    }

    let seenFactIds = [];
    let user = null;
    
    if (userId && excludeSeen === 'true') {
      try {
        user = await User.findById(userId).select('seenFacts').lean();
        if (user && user.seenFacts && user.seenFacts.length > 0) {
          seenFactIds = user.seenFacts;
        }
      } catch (err) {
        console.error('Error fetching seen facts:', err.message);
      }
    }

    // Get total count of ALL facts in this category
    const totalAllFacts = await FunFact.countDocuments(filter);
    
    // Build unseen filter
    const unseenFilter = { ...filter };
    if (seenFactIds.length > 0) {
      unseenFilter._id = { $nin: seenFactIds };
    }
    
    // Get count of unseen facts
    const totalUnseenFacts = await FunFact.countDocuments(unseenFilter);
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    let funFacts = [];
    let totalCount = totalUnseenFacts;
    let shouldReset = false;
    
    // Case 1: There are unseen facts available
    if (totalUnseenFacts > 0) {
      funFacts = await FunFact.find(unseenFilter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
    }
    // Case 2: No unseen facts left, but there are facts in this category
    else if (totalUnseenFacts === 0 && totalAllFacts > 0) {
      shouldReset = true;
      
      // Reset seen facts for this category
      if (user && userId) {
        await User.findByIdAndUpdate(userId, { 
          $set: { seenFacts: [] } 
        });
      }
      
      // Now fetch facts from beginning (oldest first)
      funFacts = await FunFact.find(filter)
        .sort({ createdAt: 1 }) // ASC - oldest first
        .skip(0)
        .limit(parseInt(limit))
        .lean();
      
      totalCount = totalAllFacts;
    }

    // Get distinct categories for filtering
    const categories = await FunFact.distinct('category');
    
    const finalPage = shouldReset ? 1 : parseInt(page);
    const finalTotal = shouldReset ? totalAllFacts : totalUnseenFacts;

    res.status(200).json({
      success: true,
      funFacts: funFacts, // EXACT SAME PAYLOAD STRUCTURE
      pagination: {
        total: finalTotal,
        page: finalPage,
        limit: parseInt(limit),
        totalPages: Math.ceil(finalTotal / parseInt(limit)),
        hasNextPage: skip + parseInt(limit) < finalTotal,
        hasPrevPage: finalPage > 1
      },
      filters: {
        categories: categories.filter(Boolean),
        currentCategory: category || 'all',
        search: search || null
      },
      sort: {
        by: sortBy,
        order: sortOrder
      },
      defaultSort: 'Newest first (by pubDate)',
      // Optional metadata (doesn't break existing structure)
      ...(shouldReset && { 
        _meta: { completed: true, reset: true } 
      })
    });
  } catch (error) {
    console.error('Error fetching fun facts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching fun facts',
      error: error.message
    });
  }
}; 


const FUNFACTCATEGORIES = [
  "Indian Food", "Cricket", "Culture", "Tech", "Success Stories", "Accidental Inventions",
  "U.S. vs. Indian Pop Culture", "Navigating Life in the U.S.", "Global Tech & Startups",
  "World History & Geography", "Famous Indian-Americans", "Food Fusion"
];

const FUNFACTPROMPTS = {
  "Indian Food": "You are a food historian. Provide a specific theme for a fun fact (e.g., 'Origin of Samosa,' 'History of Chai,' 'Ancient Spices of India'). Avoid: {avoid_topics_str}",
  "Cricket": "You are a cricket analyst. Provide a specific theme for a fun fact (e.g., 'First Indian Captain,' 'The Ashes Trophy Story,' 'Invention of the Googly'). Avoid: {avoid_topics_str}",
  "Culture": "You are a cultural expert for India. Provide a specific theme (e.g., 'History of Diwali,' 'Meaning of Namaste,' 'Indian Wedding Traditions'). Avoid: {avoid_topics_str}",
  "Tech": "You are a tech journalist. Provide a specific theme (e.g., 'India's First Supercomputer,' 'The Story of UPI,' 'Bangalore's Silicon Valley Nickname'). Avoid: {avoid_topics_str}",
  "Success Stories": "You are a biographer. Provide a theme about an Indian success story (e.g., 'Dhirubhai Ambani's Beginnings,' 'The ISRO Mars Mission Story,' 'Verghese Kurien and Amul'). Avoid: {avoid_topics_str}",
  "Accidental Inventions": "You are a science historian. Provide a theme about an accidental invention (e.g., 'The Invention of the Microwave,' 'The Story of Penicillin,' 'How Post-It Notes Were Created'). Avoid: {avoid_topics_str}",
  "U.S. vs. Indian Pop Culture": "You are a pop culture expert. Provide a theme comparing U.S. and Indian culture (e.g., 'Hollywood vs. Bollywood Box Office,' 'American Rap vs. Desi Hip Hop,' 'Comic Con vs. Local Festivals'). Avoid: {avoid_topics_str}",
  "Navigating Life in the U.S.": "You are a cultural guide. Provide a theme about navigating American life (e.g., 'The Origin of Tipping Culture,' 'Understanding American Football,' 'The Story of Black Friday Shopping'). Avoid: {avoid_topics_str}",
  "Global Tech & Startups": "You are a tech analyst. Provide a theme about the global tech scene (e.g., 'The Founding of Google,' 'What is a Unicorn Startup?',' 'The Rise of Silicon Valley'). Avoid: {avoid_topics_str}",
  "World History & Geography": "You are a historian. Provide a specific, interesting historical theme (e.g., 'The Silk Road,' 'The Fall of the Berlin Wall,' 'The Seven Wonders of the Ancient World'). Avoid: {avoid_topics_str}",
  "Famous Indian-Americans": "You are a biographer. Provide a theme about a famous Indian-American's achievement (e.g., 'Satya Nadella's Microsoft Story,' 'Mindy Kaling's Writing Career,' 'Sunita Williams in Space'). Avoid: {avoid_topics_str}",
  "Food Fusion": "You are a chef. Provide a theme about food fusion (e.g., 'The Origin of Chicken Tikka Masala,' 'The Story of the California Roll,' 'Indo-Chinese Cuisine'). Avoid: {avoid_topics_str}"
};

const getGeminiApiKey = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }
  return apiKey;
};
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.0-flash';

// function cleanJsonString(str) {
//   return str
//     .trim()
//     .replace(/^```json\s*/, '')
//     .replace(/^```\s*/, '')
//     .replace(/```$/, '')
//     .trim();
// }

export const generateFunFacts = async (req, res) => {
  try {
    const category = req.query.category;

    // Check if category is valid
    let promptBase = `
Generate 20 fun facts as a JSON object with key "funFacts", which is an array of objects. Each object should have:
- id: unique number starting from 1,
- fact: a short title of the fact,
- description: a brief description (1-2 sentences),
- source: credible source name,
- image: URL of a relevant image,
`;

    if (category && FUNFACTCATEGORIES.includes(category)) {
      // Use prompt for specific category, replace {avoid_topics_str} with empty or your avoid list
      const categoryPrompt = FUNFACTPROMPTS[category].replace('{avoid_topics_str}', '');
      promptBase += `\nOnly generate fun facts related to the category "${category}".\nTheme prompt for model: ${categoryPrompt}\n`;
    } else {
      // If no valid category, generate mixed category facts or all
      promptBase += `\nGenerate fun facts from all categories: ${FUNFACTCATEGORIES.join(', ')}.\n`;
    }

    promptBase += `\nReturn ONLY a valid JSON object.`;

    const response = await axios.post(
      `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`,
      { contents: [{ parts: [{ text: promptBase }] }] }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanedText = cleanJsonString(rawText);

    let json;
    try {
      json = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      return res.status(500).json({
        success: false,
        message: 'Failed to parse JSON from model response',
        rawText
      });
    }

    res.status(200).json({
      success: true,
      funFacts: json.funFacts || []
    });

  } catch (error) {
    console.error('Gemini error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to generate fun facts' });
  }
};


const CATEGORIES = [
  "General Knowledge", "Tollywood", "Bollywood", "Python & Java", "SQL", "Startups",
  "Math", "Indian Food", "Cricket", "Culture", "Tech", "Success Stories",
  "Accidental Inventions", "U.S. vs. Indian Pop Culture", "Navigating Life in the U.S.",
  "Global Tech & Startups", "World History & Geography", "Famous Indian-Americans", "Food Fusion"
];

const QUIZZES_PER_REQUEST = 20;

const PROMPTS = {
  // Prompts for New Categories
  "General Knowledge": {
    "probe": "You are a quizmaster for an Indian audience. Provide a specific GK theme (e.g., 'Indian History Milestones,' 'Geography of India,' 'Indian Politics Basics,' 'National Symbols'). Avoid: {avoid_topics_str}",
    "main": `
        You are an expert quizmaster creating a General Knowledge quiz for an Indian audience, with a focus on relatability for Telugu speakers. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** Questions should be relevant to India. Include topics, people, and places familiar to a Telugu audience where appropriate.
        2.  **Difficulty:** The vast majority of questions (approx. 95%) must be easy to medium. Only include 1, or at most 2, hard questions per batch.
        3.  **Copyright & Originality:** Synthesize information to create original questions. Do NOT copy or closely paraphrase from any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "Tollywood": {
    "probe": "You are a Tollywood (Telugu Cinema) historian. Provide a specific, interesting theme for a quiz (e.g., 'Chiranjeevi's 90s Films,' 'Mahesh Babu's Dialogues,' 'S.S. Thaman's Music,' 'Allu Arjun's Dance Hits'). Avoid: {avoid_topics_str}",
    "main": `
        You are a Tollywood expert creating a quiz for Telugu movie fans. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The quiz is for Telugu movie fans. Questions should be culturally relevant and interesting.
        2.  **Difficulty:** Mostly easy to medium. Hard questions (1-2 per batch) should be for die-hard fans.
        3.  **Copyright & Originality:** Synthesize information to create original questions. Do NOT copy or closely paraphrase from any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "Bollywood": {
    "probe": "You are a Bollywood film critic. Provide a specific theme for a quiz (e.g., 'Shah Rukh Khan's Iconic Roles,' 'A.R. Rahman's Bollywood Hits,' '90s Bollywood Comedy Films,' 'Famous Movie Endings'). Avoid: {avoid_topics_str}",
    "main": `
        You are a Bollywood expert creating a quiz for a general Indian audience. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The quiz is for all Indian movie fans. Ensure questions are widely understandable.
        2.  **Difficulty:** Mostly easy to medium. Hard questions (1-2 per batch) can be about behind-the-scenes trivia or classic film history.
        3.  **Copyright & Originality:** Synthesize information to create original questions. Do NOT copy or closely paraphrase from any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "Python & Java": {
    "probe": "You are a senior technical interviewer. Provide a specific programming topic for a quiz (e.g., 'Python Dictionaries vs. Java HashMaps,' 'Core Java OOP Concepts,' 'Python List Comprehensions,' 'Exception Handling in Java'). Avoid: {avoid_topics_str}",
    "main": `
        You are a senior software engineer conducting a technical interview. Generate {quizzes_per_request} questions about **'{sub_topic}'** for job seekers.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The questions are for developers preparing for interviews. They should test core concepts and practical knowledge.
        2.  **Difficulty:** Mostly medium difficulty, typical of a first-round technical interview. Include 1-2 hard questions per batch that test deeper understanding or edge cases, suitable for experienced pros.
        3.  **Copyright & Originality:** Create original problem scenarios. Do NOT copy questions from LeetCode, HackerRank, or other platforms. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'. The explanation must clarify *why* the answer is correct, often with a code snippet.
        `
  },
  "SQL": {
    "probe": "You are a database administrator. Provide a specific SQL topic for a quiz (e.g., 'INNER vs. OUTER JOINs,' 'SQL Aggregate Functions,' 'Database Normalization,' 'Writing Subqueries'). Avoid: {avoid_topics_str}",
    "main": `
        You are a data analyst conducting a SQL interview. Generate {quizzes_per_request} questions about **'{sub_topic}'** for job seekers.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The questions are for data professionals preparing for interviews. Test their logical and practical query-writing skills.
        2.  **Difficulty:** Mostly medium difficulty. Include 1-2 hard questions per batch on performance optimization or complex window functions.
        3.  **Copyright & Originality:** Create unique table schemas and query problems. Do NOT copy from existing interview prep sites. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'. The explanation should clarify the query logic.
        `
  },
  "Startups": {
    "probe": "You are a venture capitalist. Provide a specific theme for a startup quiz (e.g., 'Startup Funding Stages,' 'Famous Indian Unicorns,' 'Lean Startup Methodology,' 'Building an MVP'). Avoid: {avoid_topics_str}",
    "main": `
        You are a startup mentor advising new founders. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The quiz is for aspiring entrepreneurs in India. Use relevant examples of Indian startups and terminology.
        2.  **Difficulty:** Mostly easy to medium, focusing on foundational knowledge. Hard questions (1-2 per batch) can be about specific business metrics or venture capital terms.
        3.  **Copyright & Originality:** Synthesize information to create original questions. Do NOT copy or closely paraphrase from any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  // Prompts for Previously Used Categories
  "Math": {
    "probe": "You are a math curriculum designer. Provide a specific math topic suitable for a quiz for an Indian audience (from school level to competitive exams). Avoid these topics: {avoid_topics_str}",
    "main": `
        You are an expert math tutor creating an engaging quiz for an Indian audience. Generate {quizzes_per_request} multiple-choice math questions based on the specific topic of: **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** Make it relatable to an Indian context. Use Indian names, cities, and scenarios.
        2.  **Difficulty:** The vast majority of questions (approx. 95%) must be easy to medium. Only include 1, or at most 2, hard questions per batch.
        3.  **Copyright & Originality:** Synthesize information to create original questions. Do NOT copy from any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "Indian Food": {
    "probe": "You are a food historian specializing in Indian cuisine. Provide a specific theme for a quiz (e.g., 'Hyderabadi Biryanis,' 'Andhra Pickles,' 'Sweets of South India'). Avoid these themes: {avoid_topics_str}",
    "main": `
        You are an expert on Indian food, creating a quiz for a Telugu-speaking audience. Generate {quizzes_per_request} multiple-choice questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** Make it relatable to Telugu people. Refer to local dishes, ingredients, and festivals.
        2.  **Difficulty:** 90% of questions must be easy to medium. Only 1-2 questions per batch can be hard.
        3.  **Copyright & Originality:** Synthesize information to create original questions. Do NOT copy from any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "Cricket": {
    "probe": "You are a cricket analyst. Provide a specific cricket-related theme for a quiz (e.g., 'IPL Records,' 'Famous Indian Captains,' 'Cricket Rules Basics,' 'T20 World Cup Highlights'). Avoid these themes: {avoid_topics_str}",
    "main": `
        You are a cricket expert creating a quiz for Indian cricket fans. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** Questions should be relevant to Indian cricket fans, especially Telugu audiences.
        2.  **Difficulty:** Most questions should be easy to medium. Include 1-2 hard questions for cricket buffs.
        3.  **Copyright & Originality:** Synthesize information to create original questions. Do NOT copy or closely paraphrase from any source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "Culture": {
    "probe": "You are a cultural historian focusing on Indian traditions. Provide a specific theme for a quiz (e.g., 'Festivals of Andhra Pradesh,' 'Traditional Telugu Art Forms,' 'Indian Wedding Customs'). Avoid these themes: {avoid_topics_str}",
    "main": `
        You are an expert on Indian culture creating a quiz for Telugu-speaking audiences. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The quiz is for Telugu speakers interested in their cultural heritage.
        2.  **Difficulty:** Mostly easy to medium. Include 1-2 challenging questions per batch.
        3.  **Copyright & Originality:** Create original questions. Avoid copying any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "Tech": {
    "probe": "You are a tech blogger. Provide a specific technology theme for a quiz (e.g., 'Indian Tech Startups,' 'Blockchain Basics,' 'Artificial Intelligence in India'). Avoid these themes: {avoid_topics_str}",
    "main": `
        You are a tech enthusiast creating a quiz for Indian tech-savvy audiences. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The quiz is for Indian tech enthusiasts. Use examples from Indian companies where relevant.
        2.  **Difficulty:** Mostly easy to medium. 1-2 hard questions per batch allowed.
        3.  **Copyright & Originality:** Create original questions. Avoid copying any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "Success Stories": {
    "probe": "You are a business journalist. Provide a specific theme for a quiz (e.g., 'Indian Entrepreneurs,' 'Startup Success Stories,' 'Famous Indian CEOs'). Avoid these themes: {avoid_topics_str}",
    "main": `
        You are an expert on Indian business success stories. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The quiz is for Indian business enthusiasts. Use real-world Indian examples.
        2.  **Difficulty:** Mostly easy to medium.
        3.  **Copyright & Originality:** Create original questions. Avoid copying any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "Accidental Inventions": {
    "probe": "You are a science historian. Provide a specific theme for a quiz on accidental inventions (e.g., 'Famous Accidental Discoveries,' 'Inventions by Mistake,' 'Serendipitous Scientific Breakthroughs'). Avoid these themes: {avoid_topics_str}",
    "main": `
        You are an expert quizmaster on science history. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The quiz is for science lovers interested in quirky history.
        2.  **Difficulty:** Mostly easy to medium.
        3.  **Copyright & Originality:** Create original questions. Avoid copying any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "U.S. vs. Indian Pop Culture": {
    "probe": "You are a pop culture expert. Provide a specific theme comparing U.S. and Indian pop culture (e.g., 'Bollywood vs. Hollywood Music,' 'American vs. Indian TV Shows,' 'Celebrities in Both Countries'). Avoid these themes: {avoid_topics_str}",
    "main": `
        You are a cultural expert comparing U.S. and Indian pop culture. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The quiz is for Indian audiences curious about cross-cultural entertainment.
        2.  **Difficulty:** Mostly easy to medium.
        3.  **Copyright & Originality:** Create original questions. Avoid copying any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "Navigating Life in the U.S.": {
    "probe": "You are an immigration expert. Provide a specific theme about Indian life in the U.S. (e.g., 'Indian-American Festivals,' 'Challenges for Indian Students,' 'Work Visa Basics'). Avoid these themes: {avoid_topics_str}",
    "main": `
        You are an expert on Indian diaspora life in the U.S. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The quiz is for Indians living or planning to live in the U.S.
        2.  **Difficulty:** Mostly easy to medium.
        3.  **Copyright & Originality:** Create original questions. Avoid copying any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "Global Tech & Startups": {
    "probe": "You are a global tech analyst. Provide a specific theme for a quiz (e.g., 'Silicon Valley Giants,' 'Emerging Tech in Asia,' 'Global Startup Ecosystems'). Avoid these themes: {avoid_topics_str}",
    "main": `
        You are a tech and startup expert creating a global quiz. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The quiz is for tech enthusiasts interested in global trends.
        2.  **Difficulty:** Mostly easy to medium.
        3.  **Copyright & Originality:** Create original questions. Avoid copying any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "World History & Geography": {
    "probe": "You are a historian. Provide a specific theme for a quiz (e.g., 'Ancient Civilizations,' 'Famous Explorers,' 'World War II Key Events'). Avoid these themes: {avoid_topics_str}",
    "main": `
        You are an expert historian creating a quiz. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The quiz is for history lovers.
        2.  **Difficulty:** Mostly easy to medium.
        3.  **Copyright & Originality:** Create original questions. Avoid copying any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "Famous Indian-Americans": {
    "probe": "You are a cultural expert on Indian-Americans. Provide a specific theme for a quiz (e.g., 'Indian-American Scientists,' 'Famous Indian-American Entrepreneurs,' 'Indian-Americans in Politics'). Avoid these themes: {avoid_topics_str}",
    "main": `
        You are an expert on Indian-American culture creating a quiz. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The quiz is for Indian-Americans and those interested in the diaspora.
        2.  **Difficulty:** Mostly easy to medium.
        3.  **Copyright & Originality:** Create original questions. Avoid copying any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  },
  "Food Fusion": {
    "probe": "You are a food critic. Provide a specific theme for a quiz on fusion cuisines (e.g., 'Indo-Chinese Dishes,' 'Tex-Mex in India,' 'Fusion Street Foods'). Avoid these themes: {avoid_topics_str}",
    "main": `
        You are a food expert creating a quiz on fusion cuisines. Generate {quizzes_per_request} questions about **'{sub_topic}'**.
        **CRITICAL INSTRUCTIONS:**
        1.  **Audience:** The quiz is for food lovers interested in fusion cuisines.
        2.  **Difficulty:** Mostly easy to medium.
        3.  **Copyright & Originality:** Create original questions. Avoid copying any single source. Avoid questions similar to these: {context_questions_str}
        4.  **Format:** Output ONLY a valid JSON array. Each object needs 'question', 'options', 'answer', 'explanation'.
        `
  }
};

// ==================== DELETE SINGLE FUN FACT ====================
export const deleteFunFact = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Fun fact ID is required' 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid fun fact ID format' 
      });
    }

    // Find and delete
    const deletedFact = await FunFact.findByIdAndDelete(id);

    if (!deletedFact) {
      return res.status(404).json({ 
        success: false, 
        message: 'Fun fact not found' 
      });
    }

    // Success response - MATCHES YOUR EXISTING PATTERN
    return res.status(200).json({
      success: true,
      message: 'Fun fact deleted successfully',
      data: deletedFact
    });

  } catch (error) {
    console.error('Error deleting fun fact:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting fun fact',
      error: error.message 
    });
  }
};

// ==================== BULK DELETE FUN FACTS ====================
export const deleteBulkFunFacts = async (req, res) => {
  try {
    const { ids } = req.body;

    // Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide an array of fun fact IDs to delete' 
      });
    }

    // Filter valid ObjectIds
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid fun fact IDs provided' 
      });
    }

    // Perform bulk delete
    const result = await FunFact.deleteMany({
      _id: { $in: validIds }
    });

    // Check if any were deleted
    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No fun facts found with the provided IDs' 
      });
    }

    // Success response
    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} fun fact(s) deleted successfully`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Error bulk deleting fun facts:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting fun facts',
      error: error.message 
    });
  }
};


export const generateQuizzes = async (req, res) => {
  try {
    const category = req.query.category || '';

    // Validate category
    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Valid options: ${CATEGORIES.join(', ')}`
      });
    }

    const avoidTopicsStr = '';
    const contextQuestionsStr = '';
    const sub_topic = category || 'General Knowledge';

    let prompt = '';

    if (category && PROMPTS[category]) {
      const promptTemplate = PROMPTS[category];

      const probeText = promptTemplate.probe.replace('{avoid_topics_str}', avoidTopicsStr);
      const mainText = promptTemplate.main
        .replace('{quizzes_per_request}', QUIZZES_PER_REQUEST)
        .replace('{sub_topic}', sub_topic)
        .replace('{avoid_topics_str}', avoidTopicsStr)
        .replace('{context_questions_str}', contextQuestionsStr);

      prompt = `${probeText}\n\n${mainText}\n\nReturn ONLY a valid JSON array.`;
    } else {
      prompt = `
Generate ${QUIZZES_PER_REQUEST} quiz questions as a JSON array. Each object should have:

- question: text,
- options: array of 4 possible answers,
- answer: correct answer,
- explanation: brief explanation.

Only generate quiz questions related to the topic "${sub_topic}".

Return ONLY a valid JSON array.
      `;
    }

    // Call Gemini API using your hardcoded constants
    const response = await axios.post(
      `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`,
      { contents: [{ parts: [{ text: prompt }] }] }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanedText = cleanJsonString(rawText);

    let quizzesArray;
    try {
      quizzesArray = JSON.parse(cleanedText);
      if (!Array.isArray(quizzesArray)) {
        throw new Error('Parsed JSON is not an array');
      }
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      return res.status(500).json({
        success: false,
        message: 'Failed to parse JSON from model response',
        rawText
      });
    }

    res.status(200).json({
      success: true,
      quizzes: quizzesArray
    });

  } catch (error) {
    console.error('Gemini error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to generate quizzes' });
  }
};

// ==================== DELETE SINGLE QUIZ ====================
export const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Quiz ID is required' 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid quiz ID format' 
      });
    }

    // Find and delete
    const deletedQuiz = await Quiz.findByIdAndDelete(id);

    if (!deletedQuiz) {
      return res.status(404).json({ 
        success: false, 
        message: 'Quiz not found' 
      });
    }

    // Success response - MATCHES YOUR EXISTING PATTERN
    return res.status(200).json({
      success: true,
      message: 'Quiz deleted successfully',
      data: deletedQuiz
    });

  } catch (error) {
    console.error('Error deleting quiz:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting quiz',
      error: error.message 
    });
  }
};

// ==================== BULK DELETE QUIZZES ====================
export const deleteBulkQuizzes = async (req, res) => {
  try {
    const { ids } = req.body;

    // Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide an array of quiz IDs to delete' 
      });
    }

    // Filter valid ObjectIds
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid quiz IDs provided' 
      });
    }

    // Perform bulk delete
    const result = await Quiz.deleteMany({
      _id: { $in: validIds }
    });

    // Check if any were deleted
    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No quizzes found with the provided IDs' 
      });
    }

    // Success response
    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} quiz(zes) deleted successfully`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Error bulk deleting quizzes:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting quizzes',
      error: error.message 
    });
  }
};



export const generateNews = async (req, res) => {
  try {
    // Optional category or topic query
    const category = req.query.category || '';

    let prompt = `
Generate 20 latest news articles as a JSON object with a key "news" which is an array of objects. Each object should have:

- title: headline of the news,
- description: a brief summary (2-3 sentences),
- pubDate: publication date in "YYYY-MM-DD HH:mm:ss" format,
- source: credible news source name,
- link: URL of the news article,
- image: URL of a relevant image.

`;

    if (category) {
      prompt += `Only include news related to the topic "${category}".\n`;
    }

    prompt += `Return ONLY the valid JSON object.`;

    const response = await axios.post(
      `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`,
      { contents: [{ parts: [{ text: prompt }] }] }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanedText = cleanJsonString(rawText);

    let json;
    try {
      json = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      return res.status(500).json({
        success: false,
        message: 'Failed to parse JSON from model response',
        rawText
      });
    }

    res.status(200).json({
      success: true,
      news: json.news || []
    });
  } catch (error) {
    console.error('Gemini error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to generate news' });
  }
};



export const getAllUsersWithCoupons = async (req, res) => {
  try {
    // Find all users and populate both MyCoupons and claimedCoupons
    const users = await User.find({})
      .populate({
        path: 'MyCoupons.couponId',
        select: 'name category discountPercentage requiredCoins couponCode validityDate status couponCodeType couponImage limitForSameUser createdAt updatedAt vendorId'
      })
      .populate({
        path: 'claimedCoupons',
        select: 'name category discountPercentage requiredCoins couponCode validityDate status couponCodeType couponImage limitForSameUser createdAt updatedAt vendorId'
      })
      .select('-password -otp -otpExpiry')
      .lean();

    // Format the response
    const formattedUsers = users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profileImage: user.profileImage,
      coins: user.coins,
      stats: {
        totalCouponsClaimed: user.claimedCoupons.length,
        totalActiveCoupons: user.MyCoupons.length,
      },
      activeCoupons: user.MyCoupons.map(coupon => ({
        _id: coupon.couponId?._id,
        name: coupon.couponId?.name,
        category: coupon.couponId?.category,
        discount: `${coupon.couponId?.discountPercentage}${coupon.couponId?.couponCodeType === '%' ? '% off' : ''}`,
        coinsCost: coupon.couponId?.requiredCoins,
        code: coupon.couponId?.couponCode,
        validUntil: coupon.couponId?.validityDate,
        status: coupon.status, // Active/Used/Expired
        image: coupon.couponId?.couponImage,
        claimedAt: coupon.claimedAt,
        vendorId: coupon.couponId?.vendorId,
      })).filter(coupon => coupon._id),

      couponHistory: user.claimedCoupons.map(coupon => ({
        _id: coupon._id,
        name: coupon.name,
        category: coupon.category,
        discount: `${coupon.discountPercentage}${coupon.couponCodeType === '%' ? '% off' : ''}`,
        coinsUsed: coupon.requiredCoins,
        code: coupon.couponCode,
        usedOn: coupon.validityDate, // Assuming validityDate is when it was used
        status: 'Used', // Marking as used since it's in claimedCoupons
        image: coupon.couponImage,
        vendorId: coupon.vendorId,
      }))
    }));

    res.status(200).json({
      success: true,
      count: formattedUsers.length,
      users: formattedUsers
    });

  } catch (error) {
    console.error('Error fetching users with coupons:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


export const getCouponUsageHistory = async (req, res) => {
  try {
    // Get all users with their coupon data
    const users = await User.find({})
      .populate({
        path: 'MyCoupons.couponId',
        select: 'name category discountPercentage requiredCoins couponCode validityDate status couponCodeType couponImage vendorId'
      })
      .populate({
        path: 'claimedCoupons',
        select: 'name category discountPercentage requiredCoins couponCode validityDate status couponCodeType couponImage vendorId'
      })
      .select('_id name email phone MyCoupons claimedCoupons')
      .lean();

    let history = [];
    let counter = 1;

    // Process each user's coupon data
    for (const user of users) {
      const customerId = `C${user._id.toString().slice(-3)}`;

      // Process ACTIVE coupons (MyCoupons)
      for (const mc of (user.MyCoupons || [])) {
        const coupon = mc.couponId;
        if (!coupon) continue;

        // Get vendor info for this coupon
        let vendorName = 'N/A';
        if (coupon.vendorId) {
          const vendor = await Vendor.findById(coupon.vendorId).select('businessName name').lean();
          if (vendor) {
            vendorName = vendor.businessName || vendor.name || 'N/A';
          }
        }

        // ========== FIXED: Determine coupon status based on actual redemption and validity ==========
        const now = new Date();
        const validityDate = new Date(coupon.validityDate);
        let couponStatus = 'Active'; // Default status
        
        // Priority 1: Check if user has redeemed this coupon (isClaimed = true)
        if (mc.isClaimed === true && mc.claimedAt) {
          couponStatus = 'Used';
        }
        // Priority 2: Check if user has marked it as used/redeemed in status field
        else if (mc.status && (mc.status === 'Used' || mc.status === 'Redeemed')) {
          couponStatus = mc.status;
        }
        // Priority 3: Check if coupon is expired (validity date passed)
        else if (validityDate < now) {
          couponStatus = 'Expired';
        }
        // Priority 4: Check if coupon from database is approved and not expired
        else if (coupon.status === 'approved' && validityDate >= now) {
          couponStatus = 'Active';
        }
        // Default: Active if validity date is in future
        else if (validityDate >= now) {
          couponStatus = 'Active';
        }

        // Get redemption details if available
        let redemptionDate = 'N/A';
        let redemptionTime = 'N/A';
        let orderDetails = 'N/A';
        let orderValue = '$0.00';
        let feedback = 'N/A';

        if (couponStatus === 'Used') {
          redemptionDate = formatDate(mc.claimedAt || mc.redeemedAt);
          redemptionTime = formatTime(mc.claimedAt || mc.redeemedAt);

          if (mc.orderDetails) orderDetails = mc.orderDetails;
          if (mc.orderValue) orderValue = `$${mc.orderValue}`;
          if (mc.feedback) feedback = mc.feedback;
        }

        // ========== FIXED: Get proper download date for sorting ==========
        // Use purchasedAt first (when user bought), then claimedAt, then createdAt
        let downloadDateObj = null;
        let downloadDateStr = 'N/A';
        
        if (mc.purchasedAt) {
          downloadDateObj = new Date(mc.purchasedAt);
          downloadDateStr = formatDate(mc.purchasedAt);
        } else if (mc.createdAt) {
          downloadDateObj = new Date(mc.createdAt);
          downloadDateStr = formatDate(mc.createdAt);
        } else if (mc.claimedAt) {
          downloadDateObj = new Date(mc.claimedAt);
          downloadDateStr = formatDate(mc.claimedAt);
        } else if (coupon.createdAt) {
          downloadDateObj = new Date(coupon.createdAt);
          downloadDateStr = formatDate(coupon.createdAt);
        } else {
          downloadDateObj = new Date(0); // fallback
        }

        history.push({
          "SI_No": counter++,
          "Customer_ID": customerId,
          "Customer_Name": user.name || 'Unknown',
          "Customer_Email": user.email || 'N/A',
          "Customer_Phone": user.phone || 'N/A',
          "Vendor_Name": vendorName,
          "Coupon_ID": coupon.couponCode || 'N/A',
          "Coupon_Name": coupon.name || 'N/A',
          "Category": coupon.category || 'N/A',
          "Discount": `${coupon.discountPercentage || 0}${coupon.couponCodeType === '%' ? '%' : ''}`,
          "Coins_Cost": coupon.requiredCoins || 0,
          "Download_Date": downloadDateStr,
          "Status": couponStatus,
          "Redeemed_Date": redemptionDate,
          "Redeemed_Time": redemptionTime,
          "Order_Details": orderDetails,
          "Order_Value": orderValue,
          "Feedback": feedback,
          "Validity_Date": formatDate(coupon.validityDate),
          "Image": coupon.couponImage || null,
          "Vendor_ID": coupon.vendorId || null,
          "_sortDate": downloadDateObj  // Hidden field for sorting
        });
      }

      // Process CLAIMED coupons (claimedCoupons)
      for (const cc of (user.claimedCoupons || [])) {
        const coupon = cc;
        if (!coupon) continue;

        let vendorName = 'N/A';
        if (coupon.vendorId) {
          const vendor = await Vendor.findById(coupon.vendorId).select('businessName name').lean();
          if (vendor) {
            vendorName = vendor.businessName || vendor.name || 'N/A';
          }
        }

        const now = new Date();
        const validityDate = new Date(coupon.validityDate);
        let couponStatus = 'Used';
        
        if (validityDate < now) {
          couponStatus = 'Expired';
        }

        let redemptionDate = formatDate(coupon.redeemedAt || coupon.validityDate);
        let redemptionTime = formatTime(coupon.redeemedAt || coupon.validityDate);
        let orderDetails = 'N/A';
        let orderValue = '$0.00';
        let feedback = 'N/A';

        if (coupon.redeemedAt) {
          redemptionDate = formatDate(coupon.redeemedAt);
          redemptionTime = formatTime(coupon.redeemedAt);
        }

        const userCoupon = user.MyCoupons?.find(mc =>
          mc.couponId && mc.couponId._id && mc.couponId._id.toString() === coupon._id.toString()
        );

        if (userCoupon) {
          if (userCoupon.orderDetails) orderDetails = userCoupon.orderDetails;
          if (userCoupon.orderValue) orderValue = `$${userCoupon.orderValue}`;
          if (userCoupon.feedback) feedback = userCoupon.feedback;
        }

        // ========== FIXED: Get proper download date for sorting ==========
        let downloadDateObj = null;
        let downloadDateStr = 'N/A';
        
        if (coupon.createdAt) {
          downloadDateObj = new Date(coupon.createdAt);
          downloadDateStr = formatDate(coupon.createdAt);
        } else if (coupon.purchasedAt) {
          downloadDateObj = new Date(coupon.purchasedAt);
          downloadDateStr = formatDate(coupon.purchasedAt);
        } else {
          downloadDateObj = new Date(0);
        }

        history.push({
          "SI_No": counter++,
          "Customer_ID": customerId,
          "Customer_Name": user.name || 'Unknown',
          "Customer_Email": user.email || 'N/A',
          "Customer_Phone": user.phone || 'N/A',
          "Vendor_Name": vendorName,
          "Coupon_ID": coupon.couponCode || 'N/A',
          "Coupon_Name": coupon.name || 'N/A',
          "Category": coupon.category || 'N/A',
          "Discount": `${coupon.discountPercentage || 0}${coupon.couponCodeType === '%' ? '%' : ''}`,
          "Coins_Cost": coupon.requiredCoins || 0,
          "Download_Date": downloadDateStr,
          "Status": couponStatus,
          "Redeemed_Date": redemptionDate,
          "Redeemed_Time": redemptionTime,
          "Order_Details": orderDetails,
          "Order_Value": orderValue,
          "Feedback": feedback,
          "Validity_Date": formatDate(coupon.validityDate),
          "Image": coupon.couponImage || null,
          "Vendor_ID": coupon.vendorId || null,
          "_sortDate": downloadDateObj  // Hidden field for sorting
        });
      }
    }

    // ========== FIXED: Sort by download date - NEWEST FIRST ==========
    history.sort((a, b) => {
      const dateA = a._sortDate instanceof Date ? a._sortDate : new Date(0);
      const dateB = b._sortDate instanceof Date ? b._sortDate : new Date(0);
      // Return negative if dateB is newer (greater) than dateA
      return dateB - dateA;
    });

    // Remove hidden sort field and update SI numbers
    history = history.map((item, index) => {
      const { _sortDate, ...cleanItem } = item;
      return {
        ...cleanItem,
        "SI_No": index + 1
      };
    });

    console.log(`✅ Sorted ${history.length} entries - Latest purchases first`);

    res.status(200).json({
      success: true,
      count: history.length,
      history
    });

  } catch (error) {
    console.error('getCouponUsageHistory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupon usage history',
      error: error.message
    });
  }
};

// Helper function to format date
function formatDate(date) {
  if (!date) return 'N/A';

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';

    // Format: YYYY-MM-DD
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (err) {
    return 'N/A';
  }
}

// Helper function to format time
function formatTime(date) {
  if (!date) return 'N/A';

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';

    // Format: HH:MM AM/PM
    return d.toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (err) {
    return 'N/A';
  }
}

// export const getCouponRedemptionReport = async (req, res) => {
//   try {
//     // Get all users with their claimed coupons (isClaimed = true)
//     const users = await User.find({})
//       .select('_id name email phone MyCoupons')
//       .lean();

//     let report = [];
//     let siNo = 1;

//     for (const user of users) {
//       // Only process coupons that are ACTUALLY claimed (isClaimed = true)
//       const claimedCoupons = (user.MyCoupons || []).filter(
//         coupon => coupon.isClaimed === true
//       );

//       if (claimedCoupons.length === 0) continue;

//       // Use actual userId instead of formatted CUSTxxxx
//       const customerId = user._id.toString();

//       for (const userCoupon of claimedCoupons) {
//         // Fetch full coupon details
//         const coupon = await Coupon.findById(userCoupon.couponId)
//           .populate('vendorId', 'businessName name')
//           .lean();

//         if (!coupon) continue;

//         // Fetch feedback from UserCouponFeedback collection
//         const feedback = await UserCouponFeedback.findOne({
//           userId: user._id,
//           couponId: coupon._id
//         }).lean();

//         let vendorName = 'N/A';
//         let vendorCategory = 'N/A';

//         if (coupon.vendorId) {
//           vendorName = coupon.vendorId.businessName || coupon.vendorId.name || 'N/A';
//           vendorCategory = coupon.vendorId.category || coupon.category || 'N/A';
//         }

//         report.push({
//           "SI_No": siNo++,
//           "Customer_ID": customerId,  // Now contains actual userId (e.g., "695ff7553eb47bfe0328c54d")
//           "Customer_Name": user.name || 'Unknown',
//           "Customer_Email": user.email || 'N/A',
//           "Customer_Phone": user.phone || 'N/A',
//           "Vendor_Name": vendorName,
//           "Vendor_Category": vendorCategory,
//           "Product_Name": coupon.name || 'N/A',
//           "Coupon_ID": coupon._id?.toString() || 'N/A',
//           "Coupon_Name": coupon.name || 'N/A',
//           "Coupon_Code": userCoupon.couponCode || coupon.couponCode || 'N/A',
//           "Discount (%)": `${coupon.discountPercentage || 0}${coupon.couponCodeType === '%' ? '%' : ''}`,
//           "Download_Date": formatDate(userCoupon.purchasedAt || userCoupon.createdAt),
//           "Redeemed_Date": formatDate(userCoupon.claimedAt || userCoupon.activatedAt),
//           "Redeemed_Time": formatTime(userCoupon.claimedAt || userCoupon.activatedAt),
//           "Order_Details": userCoupon.orderDetails || 'N/A',
//           "Order_Value": userCoupon.orderValue ? `₹${userCoupon.orderValue}` : '₹0.00',
//           "Feedback": feedback?.description || userCoupon.feedback || 'N/A'
//         });
//       }
//     }



//     // Sort by redeemed date - newest first
//     report.sort((a, b) => {
//       const dateA = new Date(a.Redeemed_Date);
//       const dateB = new Date(b.Redeemed_Date);
//       return dateB - dateA;
//     });

//     // Re-index SI numbers after sorting
//     report = report.map((item, index) => ({
//       ...item,
//       "SI_No": index + 1
//     }));

//     return res.status(200).json({
//       success: true,
//       count: report.length,
//       data: report
//     });

//   } catch (error) {
//     console.error("getCouponRedemptionReport error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message
//     });
//   }
// };




// export const getCouponRedemptionReport = async (req, res) => {
//   try {
//     const users = await User.find({})
//       .populate({
//         path: 'claimedCoupons',
//         select: 'name category discountPercentage requiredCoins couponCode validityDate status couponCodeType couponImage limitForSameUser createdAt updatedAt vendorId orderDetails orderValue feedback'
//       })
//       .select('_id name email phone claimedCoupons')
//       .lean();

//     let report = [];
//     let siNo = 1;

//     for (const user of users) {
//       const customerId = `CUST${user._id.toString().slice(-3)}`;

//       for (const coupon of user.claimedCoupons || []) {
//         let vendorName = 'N/A';

//         // ✅ Only fetch vendor name (no need for category)
//         if (coupon.vendorId) {
//           const vendor = await Vendor.findById(coupon.vendorId).select('name').lean();
//           if (vendor) {
//             vendorName = vendor.name || 'N/A';
//           }
//         }

//         report.push({
//           "SI_No": siNo++,
//           "Customer_ID": customerId,
//           "Vendor_Name": vendorName,
//           "Coupon_Category": coupon.category || 'N/A', // ✅ replaced Vendor_Category
//           "Product_Name": coupon.name || 'N/A',
//           "Coupon_ID": coupon._id?.toString(),
//           "Coupon_Name": coupon.name || 'N/A',
//           "Coupon_Code": coupon.couponCode || 'N/A',
//           "Discount (%)": `${coupon.discountPercentage || 0}${coupon.couponCodeType === '%' ? '%' : ''}`,
//           "Download_Date": formatDate(coupon.createdAt),
//           "Redeemed_Date": formatDate(coupon.validityDate),
//           "Redeemed_Time": formatTime(coupon.validityDate),
//           "Order_Details": coupon.orderDetails || 'N/A',
//           "Order_Value": coupon.orderValue ? `₹${coupon.orderValue}` : '₹0.00',
//           "Feedback": coupon.feedback || 'N/A'
//         });
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       count: report.length,
//       data: report
//     });

//   } catch (error) {
//     console.error("getCouponRedemptionReport error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message
//     });
//   }
// };



// export const getDashboardStats = async (req, res) => {
//   try {
//     // ===== DATE CALCULATIONS =====
//     const now = new Date();
//     const todayStart = new Date(now);
//     todayStart.setHours(0, 0, 0, 0);

//     const yesterdayStart = new Date(todayStart);
//     yesterdayStart.setDate(todayStart.getDate() - 1);

//     // Week calculation (Monday to Sunday)
//     const dayOfWeek = todayStart.getDay() === 0 ? 7 : todayStart.getDay();
//     const thisWeekStart = new Date(todayStart);
//     thisWeekStart.setDate(todayStart.getDate() - (dayOfWeek - 1));

//     const lastWeekStart = new Date(thisWeekStart);
//     lastWeekStart.setDate(thisWeekStart.getDate() - 7);
//     const lastWeekEnd = new Date(thisWeekStart);
//     lastWeekEnd.setMilliseconds(-1);

//     // Month calculation
//     const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
//     const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//     const lastMonthEnd = new Date(thisMonthStart);
//     lastMonthEnd.setMilliseconds(-1);

//     // Current month string (YYYY-MM)
//     const currentMonth = new Date().toISOString().slice(0, 7);

//     // ===== BASIC TOTALS (Parallel) =====
//     const [totalUsers, totalCoupons, totalVendors, totalCategories] = await Promise.all([
//       User.countDocuments(),
//       Coupon.countDocuments(),
//       Vendor.countDocuments(),
//       Category.countDocuments(),
//     ]);

//     // ===== TODAY'S STATS =====
//     const [todaysCoupons, dailyActiveUsers] = await Promise.all([
//       Coupon.countDocuments({ createdAt: { $gte: todayStart } }),
//       User.countDocuments({ updatedAt: { $gte: todayStart } })
//     ]);

//     // ===== ACTIVE USERS (Parallel) =====
//     const [weeklyActiveUsers, monthlyActiveUsers] = await Promise.all([
//       User.countDocuments({ updatedAt: { $gte: thisWeekStart } }),
//       User.countDocuments({ updatedAt: { $gte: thisMonthStart } })
//     ]);

//     // ===== PAYMENT REVENUE STATS =====
//     // Get current price configuration
//     const priceConfig = await PaymentConfig.findOne({ isActive: true });
//     const currentPrice = priceConfig?.pricePerCoupon || 1.0;

//     // Today's payment revenue (paid/verified payments today)
//     const todayRevenue = await PaymentRecord.aggregate([
//       {
//         $match: {
//           $or: [
//             { paymentStatus: 'paid' },
//             { paymentStatus: 'verified' }
//           ],
//           $or: [
//             { paymentDate: { $gte: todayStart, $lte: now } },
//             { verificationDate: { $gte: todayStart, $lte: now } }
//           ]
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           revenueUSD: { $sum: '$pricePerCoupon' },
//           transactions: { $sum: 1 },
//           cashRevenue: {
//             $sum: {
//               $cond: [
//                 { $eq: ['$paymentMethod', 'cash'] },
//                 '$pricePerCoupon',
//                 0
//               ]
//             }
//           },
//           onlineRevenue: {
//             $sum: {
//               $cond: [
//                 { $eq: ['$paymentMethod', 'online'] },
//                 '$pricePerpon',
//                 0
//               ]
//             }
//           }
//         }
//       }
//     ]);

//     const todayRevenueStats = todayRevenue[0] || {
//       revenueUSD: 0,
//       transactions: 0,
//       cashRevenue: 0,
//       onlineRevenue: 0
//     };

//     // Weekly payment revenue
//     const weeklyRevenue = await PaymentRecord.aggregate([
//       {
//         $match: {
//           $or: [
//             { paymentStatus: 'paid' },
//             { paymentStatus: 'verified' }
//           ],
//           $or: [
//             { paymentDate: { $gte: thisWeekStart, $lte: now } },
//             { verificationDate: { $gte: thisWeekStart, $lte: now } }
//           ]
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           revenueUSD: { $sum: '$pricePerCoupon' },
//           transactions: { $sum: 1 },
//           vendorsCount: { $addToSet: '$vendorId' }
//         }
//       }
//     ]);

//     const weeklyRevenueStats = weeklyRevenue[0] || {
//       revenueUSD: 0,
//       transactions: 0,
//       vendorsCount: []
//     };

//     // Monthly payment revenue
//     const monthlyRevenue = await PaymentRecord.aggregate([
//       {
//         $match: {
//           $or: [
//             { paymentStatus: 'paid' },
//             { paymentStatus: 'verified' }
//           ],
//           month: currentMonth
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           revenueUSD: { $sum: '$pricePerCoupon' },
//           transactions: { $sum: 1 },
//           vendorsCount: { $addToSet: '$vendorId' },
//           cashRevenue: {
//             $sum: {
//               $cond: [
//                 { $eq: ['$paymentMethod', 'cash'] },
//                 '$pricePerCoupon',
//                 0
//               ]
//             }
//           },
//           onlineRevenue: {
//             $sum: {
//               $cond: [
//                 { $eq: ['$paymentMethod', 'online'] },
//                 '$pricePerCoupon',
//                 0
//               ]
//             }
//           }
//         }
//       }
//     ]);

//     const monthlyRevenueStats = monthlyRevenue[0] || {
//       revenueUSD: 0,
//       transactions: 0,
//       vendorsCount: [],
//       cashRevenue: 0,
//       onlineRevenue: 0
//     };

//     // Pending payments (money not yet received)
//     const pendingPayments = await VendorMonthlyPayment.aggregate([
//       {
//         $match: {
//           month: currentMonth,
//           amountPending: { $gt: 0 }
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           totalPendingUSD: { $sum: '$amountPending' },
//           vendorsCount: { $sum: 1 }
//         }
//       }
//     ]);

//     const pendingStats = pendingPayments[0] || {
//       totalPendingUSD: 0,
//       vendorsCount: 0
//     };

//     // ===== REDEMPTIONS & REVENUE =====
//     const todayRedemptionStats = await User.aggregate([
//       { $unwind: '$MyCoupons' },
//       { $match: { 'MyCoupons.claimedAt': { $gte: todayStart } } },
//       {
//         $group: {
//           _id: null,
//           totalRedemptions: {
//             $sum: {
//               $cond: [
//                 { $in: ['$MyCoupons.status', ['Used', 'Redeemed']] },
//                 1,
//                 0
//               ]
//             }
//           },
//           totalRevenue: {
//             $sum: {
//               $cond: [
//                 { $eq: ['$MyCoupons.redeemedWith', 'coins'] },
//                 1,
//                 0
//               ]
//             }
//           }
//         }
//       }
//     ]);

//     const redeemedCouponsToday = todayRedemptionStats[0]?.totalRedemptions || 0;
//     const revenueToday = todayRedemptionStats[0]?.totalRevenue || 0;

//     // ===== WEEKLY EARNINGS CHART =====
//     const earningsThisWeek = await User.aggregate([
//       { $unwind: '$MyCoupons' },
//       {
//         $match: {
//           'MyCoupons.claimedAt': { $gte: thisWeekStart, $lte: now },
//           'MyCoupons.redeemedWith': 'coins'
//         }
//       },
//       {
//         $group: {
//           _id: { $dayOfWeek: '$MyCoupons.claimedAt' },
//           revenue: { $sum: 1 }
//         }
//       },
//       { $sort: { _id: 1 } }
//     ]);

//     const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
//     const earningsWeeklyFormatted = dayNames.map((day, idx) => {
//       const dayData = earningsThisWeek.find(e => e._id === (idx + 1));
//       return { day, revenue: dayData ? dayData.revenue : 0 };
//     });

//     // ===== PAYMENT REVENUE WEEKLY CHART =====
//     const paymentRevenueWeekly = await PaymentRecord.aggregate([
//       {
//         $match: {
//           $or: [
//             { paymentStatus: 'paid' },
//             { paymentStatus: 'verified' }
//           ],
//           $or: [
//             { paymentDate: { $gte: thisWeekStart, $lte: now } },
//             { verificationDate: { $gte: thisWeekStart, $lte: now } }
//           ]
//         }
//       },
//       {
//         $group: {
//           _id: { $dayOfWeek: '$paymentDate' },
//           revenue: { $sum: '$pricePerCoupon' },
//           transactions: { $sum: 1 }
//         }
//       },
//       { $sort: { _id: 1 } }
//     ]);

//     const paymentRevenueWeeklyFormatted = dayNames.map((day, idx) => {
//       const dayData = paymentRevenueWeekly.find(e => e._id === (idx + 1));
//       return { 
//         day, 
//         revenue: dayData ? parseFloat(dayData.revenue.toFixed(2)) : 0,
//         transactions: dayData ? dayData.transactions : 0
//       };
//     });

//     // ===== MONTHLY EARNINGS CHART =====
//     const earningsThisMonth = await User.aggregate([
//       { $unwind: '$MyCoupons' },
//       {
//         $match: {
//           'MyCoupons.claimedAt': { $gte: thisMonthStart, $lte: now },
//           'MyCoupons.redeemedWith': 'coins'
//         }
//       },
//       {
//         $group: {
//           _id: { $week: '$MyCoupons.claimedAt' },
//           revenue: { $sum: 1 }
//         }
//       },
//       { $sort: { _id: 1 } }
//     ]);

//     const earningsMonthlyFormatted = Array.from({ length: 4 }, (_, i) => {
//       const weekData = earningsThisMonth.find(e => e._id === (i + 1));
//       return { week: `Week ${i + 1}`, revenue: weekData ? weekData.revenue : 0 };
//     });

//     // ===== WEEKLY REDEMPTIONS CHART =====
//     const redemptionThisWeek = await User.aggregate([
//       { $unwind: '$MyCoupons' },
//       {
//         $match: {
//           'MyCoupons.claimedAt': { $gte: thisWeekStart, $lte: now },
//           'MyCoupons.status': { $in: ['Used', 'Redeemed'] }
//         }
//       },
//       {
//         $group: {
//           _id: { $dayOfWeek: '$MyCoupons.claimedAt' },
//           redeemed: { $sum: 1 }
//         }
//       },
//       { $sort: { _id: 1 } }
//     ]);

//     const redemptionWeeklyFormatted = dayNames.map((day, idx) => {
//       const dayData = redemptionThisWeek.find(e => e._id === (idx + 1));
//       return { day, redeemed: dayData ? dayData.redeemed : 0 };
//     });

//     // ===== MONTHLY REDEMPTIONS CHART =====
//     const redemptionThisMonth = await User.aggregate([
//       { $unwind: '$MyCoupons' },
//       {
//         $match: {
//           'MyCoupons.claimedAt': { $gte: thisMonthStart, $lte: now },
//           'MyCoupons.status': { $in: ['Used', 'Redeemed'] }
//         }
//       },
//       {
//         $group: {
//           _id: { $week: '$MyCoupons.claimedAt' },
//           redeemed: { $sum: 1 }
//         }
//       },
//       { $sort: { _id: 1 } }
//     ]);

//     const redemptionMonthlyFormatted = Array.from({ length: 4 }, (_, i) => {
//       const weekData = redemptionThisMonth.find(e => e._id === (i + 1));
//       return { week: `Week ${i + 1}`, redeemed: weekData ? weekData.redeemed : 0 };
//     });

//     // ===== PAYMENT METHOD DISTRIBUTION =====
//     const paymentMethodDistribution = await PaymentRecord.aggregate([
//       {
//         $match: {
//           $or: [
//             { paymentStatus: 'paid' },
//             { paymentStatus: 'verified' }
//           ],
//           month: currentMonth
//         }
//       },
//       {
//         $group: {
//           _id: '$paymentMethod',
//           method: { $first: '$paymentMethod' },
//           revenue: { $sum: '$pricePerCoupon' },
//           transactions: { $sum: 1 }
//         }
//       },
//       {
//         $project: {
//           method: { $ifNull: ['$method', 'other'] },
//           revenue: { $round: ['$revenue', 2] },
//           transactions: 1,
//           percentage: {
//             $multiply: [
//               {
//                 $divide: [
//                   '$revenue',
//                   monthlyRevenueStats.revenueUSD || 1
//                 ]
//               },
//               100
//             ]
//           }
//         }
//       },
//       { $sort: { revenue: -1 } }
//     ]);

//     // ===== TOP PAYING VENDORS (Monthly) =====
//     const topPayingVendors = await PaymentRecord.aggregate([
//       {
//         $match: {
//           $or: [
//             { paymentStatus: 'paid' },
//             { paymentStatus: 'verified' }
//           ],
//           month: currentMonth
//         }
//       },
//       {
//         $group: {
//           _id: '$vendorId',
//           vendorName: { $first: '$vendorName' },
//           totalPaid: { $sum: '$pricePerCoupon' },
//           transactions: { $sum: 1 },
//           lastPayment: { $max: '$paymentDate' }
//         }
//       },
//       {
//         $lookup: {
//           from: 'vendors',
//           localField: '_id',
//           foreignField: '_id',
//           as: 'vendorDetails'
//         }
//       },
//       { $unwind: { path: '$vendorDetails', preserveNullAndEmptyArrays: true } },
//       {
//         $project: {
//           vendorId: '$_id',
//           vendorName: { $ifNull: ['$vendorDetails.businessName', '$vendorName'] },
//           totalPaid: { $round: ['$totalPaid', 2] },
//           transactions: 1,
//           lastPayment: 1,
//           vendorEmail: '$vendorDetails.email',
//           vendorPhone: '$vendorDetails.phone'
//         }
//       },
//       { $sort: { totalPaid: -1 } },
//       { $limit: 5 }
//     ]);

//     // ===== RECENT PAYMENTS =====
//     const recentPayments = await PaymentRecord.find({
//       $or: [
//         { paymentStatus: 'paid' },
//         { paymentStatus: 'verified' }
//       ]
//     })
//       .populate('vendorId', 'businessName name')
//       .sort({ paymentDate: -1, verificationDate: -1 })
//       .limit(5)
//       .select('vendorId vendorName pricePerCoupon paymentMethod paymentStatus paymentDate month');

//     // ===== TOP RESTAURANTS BY REVENUE (TODAY) =====
//     const topRestaurantsToday = await User.aggregate([
//       { $unwind: '$MyCoupons' },
//       {
//         $match: {
//           'MyCoupons.claimedAt': { $gte: todayStart },
//           'MyCoupons.redeemedWith': 'coins'
//         }
//       },
//       {
//         $lookup: {
//           from: 'coupons',
//           localField: 'MyCoupons.couponId',
//           foreignField: '_id',
//           as: 'couponDetails'
//         }
//       },
//       { $unwind: '$couponDetails' },
//       {
//         $lookup: {
//           from: 'vendors',
//           localField: 'couponDetails.vendorId',
//           foreignField: '_id',
//           as: 'vendorDetails'
//         }
//       },
//       { $unwind: '$vendorDetails' },
//       {
//         $group: {
//           _id: '$vendorDetails._id',
//           name: { $first: '$vendorDetails.businessName' },
//           revenue: { $sum: 1 },
//           coupons: { $sum: 1 }
//         }
//       },
//       { $sort: { revenue: -1 } },
//       { $limit: 5 }
//     ]);

//     // ===== TOP RESTAURANTS BY REVENUE (WEEKLY) =====
//     const topRestaurantsWeekly = await User.aggregate([
//       { $unwind: '$MyCoupons' },
//       {
//         $match: {
//           'MyCoupons.claimedAt': { $gte: thisWeekStart, $lte: now },
//           'MyCoupons.redeemedWith': 'coins'
//         }
//       },
//       {
//         $lookup: {
//           from: 'coupons',
//           localField: 'MyCoupons.couponId',
//           foreignField: '_id',
//           as: 'couponDetails'
//         }
//       },
//       { $unwind: '$couponDetails' },
//       {
//         $lookup: {
//           from: 'vendors',
//           localField: 'couponDetails.vendorId',
//           foreignField: '_id',
//           as: 'vendorDetails'
//         }
//       },
//       { $unwind: '$vendorDetails' },
//       {
//         $group: {
//           _id: '$vendorDetails._id',
//           name: { $first: '$vendorDetails.businessName' },
//           revenue: { $sum: 1 },
//           coupons: { $sum: 1 }
//         }
//       },
//       { $sort: { revenue: -1 } },
//       { $limit: 5 }
//     ]);

//     // ===== TOP RESTAURANTS BY REVENUE (MONTHLY) =====
//     const topRestaurantsMonthly = await User.aggregate([
//       { $unwind: '$MyCoupons' },
//       {
//         $match: {
//           'MyCoupons.claimedAt': { $gte: thisMonthStart, $lte: now },
//           'MyCoupons.redeemedWith': 'coins'
//         }
//       },
//       {
//         $lookup: {
//           from: 'coupons',
//           localField: 'MyCoupons.couponId',
//           foreignField: '_id',
//           as: 'couponDetails'
//         }
//       },
//       { $unwind: '$couponDetails' },
//       {
//         $lookup: {
//           from: 'vendors',
//           localField: 'couponDetails.vendorId',
//           foreignField: '_id',
//           as: 'vendorDetails'
//         }
//       },
//       { $unwind: '$vendorDetails' },
//       {
//         $group: {
//           _id: '$vendorDetails._id',
//           name: { $first: '$vendorDetails.businessName' },
//           revenue: { $sum: 1 },
//           coupons: { $sum: 1 }
//         }
//       },
//       { $sort: { revenue: -1 } },
//       { $limit: 5 }
//     ]);

//     // ===== RESTAURANT REDEMPTION DATA (TODAY) =====
//     const restaurantRedemptionToday = await User.aggregate([
//       { $unwind: '$MyCoupons' },
//       {
//         $match: {
//           'MyCoupons.claimedAt': { $gte: todayStart },
//           'MyCoupons.status': { $in: ['Used', 'Redeemed'] }
//         }
//       },
//       {
//         $lookup: {
//           from: 'coupons',
//           localField: 'MyCoupons.couponId',
//           foreignField: '_id',
//           as: 'couponDetails'
//         }
//       },
//       { $unwind: '$couponDetails' },
//       {
//         $lookup: {
//           from: 'vendors',
//           localField: 'couponDetails.vendorId',
//           foreignField: '_id',
//           as: 'vendorDetails'
//         }
//       },
//       { $unwind: '$vendorDetails' },
//       {
//         $group: {
//           _id: '$vendorDetails._id',
//           name: { $first: '$vendorDetails.businessName' },
//           redeemed: { $sum: 1 }
//         }
//       },
//       { $sort: { redeemed: -1 } },
//       { $limit: 10 }
//     ]);

//     // ===== RESTAURANT REDEMPTION DATA (WEEKLY) =====
//     const restaurantRedemptionWeekly = await User.aggregate([
//       { $unwind: '$MyCoupons' },
//       {
//         $match: {
//           'MyCoupons.claimedAt': { $gte: thisWeekStart, $lte: now },
//           'MyCoupons.status': { $in: ['Used', 'Redeemed'] }
//         }
//       },
//       {
//         $lookup: {
//           from: 'coupons',
//           localField: 'MyCoupons.couponId',
//           foreignField: '_id',
//           as: 'couponDetails'
//         }
//       },
//       { $unwind: '$couponDetails' },
//       {
//         $lookup: {
//           from: 'vendors',
//           localField: 'couponDetails.vendorId',
//           foreignField: '_id',
//           as: 'vendorDetails'
//         }
//       },
//       { $unwind: '$vendorDetails' },
//       {
//         $group: {
//           _id: '$vendorDetails._id',
//           name: { $first: '$vendorDetails.businessName' },
//           redeemed: { $sum: 1 }
//         }
//       },
//       { $sort: { redeemed: -1 } },
//       { $limit: 10 }
//     ]);

//     // ===== RESTAURANT REDEMPTION DATA (MONTHLY) =====
//     const restaurantRedemptionMonthly = await User.aggregate([
//       { $unwind: '$MyCoupons' },
//       {
//         $match: {
//           'MyCoupons.claimedAt': { $gte: thisMonthStart, $lte: now },
//           'MyCoupons.status': { $in: ['Used', 'Redeemed'] }
//         }
//       },
//       {
//         $lookup: {
//           from: 'coupons',
//           localField: 'MyCoupons.couponId',
//           foreignField: '_id',
//           as: 'couponDetails'
//         }
//       },
//       { $unwind: '$couponDetails' },
//       {
//         $lookup: {
//           from: 'vendors',
//           localField: 'couponDetails.vendorId',
//           foreignField: '_id',
//           as: 'vendorDetails'
//         }
//       },
//       { $unwind: '$vendorDetails' },
//       {
//         $group: {
//           _id: '$vendorDetails._id',
//           name: { $first: '$vendorDetails.businessName' },
//           redeemed: { $sum: 1 }
//         }
//       },
//       { $sort: { redeemed: -1 } },
//       { $limit: 10 }
//     ]);

//     // ===== USER INSIGHTS =====
//     const userInsights = await User.find()
//       .sort({ updatedAt: -1 })
//       .limit(10)
//       .select('_id name email updatedAt createdAt MyCoupons steps stepHistory')
//       .lean();

//     const userInsightsData = userInsights.map(user => {
//       let totalSteps = 0;

//       // Handle steps calculation based on User model structure
//       if (user.steps) {
//         // If steps is an array of objects
//         if (Array.isArray(user.steps)) {
//           totalSteps = user.steps.reduce((sum, s) => {
//             if (typeof s === 'object' && s !== null) {
//               return sum + (s.stepsCount || s.count || s.steps || 0);
//             }
//             return sum + (s || 0);
//           }, 0);
//         }
//         // If steps is an object with stepsCount property
//         else if (typeof user.steps === 'object' && user.steps !== null) {
//           totalSteps = user.steps.stepsCount || user.steps.count || user.steps.totalSteps || 0;
//         }
//         // If steps is a number
//         else if (typeof user.steps === 'number') {
//           totalSteps = user.steps;
//         }
//       }

//       // Also check stepHistory if it exists
//       if (user.stepHistory && Array.isArray(user.stepHistory)) {
//         totalSteps += user.stepHistory.reduce((sum, entry) => {
//           return sum + (entry.stepsCount || entry.steps || 0);
//         }, 0);
//       }

//       // Calculate coupon redemptions
//       const offerRedeemed = user.MyCoupons?.filter(c => 
//         ['Used', 'Redeemed'].includes(c.status)
//       ).length || 0;

//       // For quiz, news, facts - you'll need to query from respective models
//       // For now, we'll set them to 0
//       const quizCount = 0;
//       const newsCount = 0;
//       const factsCount = 0;

//       return {
//         userId: user._id,
//         user: user.name || 'Unknown',
//         email: user.email || 'N/A',
//         lastLogin: user.updatedAt?.toISOString().split('T')[0] || 'N/A',
//         lastLoginFull: user.updatedAt || null,
//         offerRedeemed: offerRedeemed,
//         reviewGiven: 0,
//         accountCreated: user.createdAt?.toISOString().split('T')[0] || 'N/A',
//         accountCreatedFull: user.createdAt || null,
//         activities: {
//           steps: totalSteps,
//           quiz: quizCount,
//           news: newsCount,
//           facts: factsCount,
//         },
//       };
//     });

//     // ===== RESTAURANT INSIGHTS =====
//     const restaurantInsights = await Vendor.aggregate([
//       {
//         $lookup: {
//           from: 'coupons',
//           localField: '_id',
//           foreignField: 'vendorId',
//           as: 'coupons'
//         }
//       },
//       {
//         $lookup: {
//           from: 'feedbacks',
//           localField: '_id',
//           foreignField: 'vendorId',
//           as: 'feedbacks'
//         }
//       },
//       {
//         $project: {
//           restaurant: '$businessName',
//           redemption: { $size: '$coupons' },
//           avgRating: { $avg: '$feedbacks.stars' },
//           activeOffer: {
//             $size: {
//               $filter: {
//                 input: '$coupons',
//                 as: 'coupon',
//                 cond: { $eq: ['$$coupon.status', 'approved'] }
//               }
//             }
//           },
//           joinedDate: '$createdAt'
//         }
//       },
//       { $sort: { redemption: -1 } },
//       { $limit: 10 }
//     ]);

//     const restaurantInsightsData = restaurantInsights.map(r => ({
//       restaurant: r.restaurant || 'Unknown',
//       redemption: r.redemption || 0,
//       avgRating: r.avgRating ? Number(r.avgRating.toFixed(1)) : 0,
//       activeOffer: r.activeOffer || 0,
//       joinedDate: r.joinedDate?.toISOString().split('T')[0] || 'N/A'
//     }));

//     // ===== FINAL RESPONSE =====
//     res.status(200).json({
//       success: true,
//       data: {
//         // Basic totals
//         totals: {
//           users: totalUsers,
//           vendors: totalVendors,
//           coupons: totalCoupons,
//           categories: totalCategories,
//           currentPricePerCoupon: currentPrice
//         },

//         // Today's stats
//         todayStats: {
//           todaysCoupons,
//           redeemedCouponsToday,
//           revenueToday: Math.round(revenueToday),
//         },

//         // Payment revenue stats
//         paymentRevenue: {
//           today: {
//             revenueUSD: parseFloat(todayRevenueStats.revenueUSD.toFixed(2)),
//             transactions: todayRevenueStats.transactions,
//             cashRevenue: parseFloat(todayRevenueStats.cashRevenue.toFixed(2)),
//             onlineRevenue: parseFloat(todayRevenueStats.onlineRevenue.toFixed(2)),
//             currency: "USD"
//           },
//           weekly: {
//             revenueUSD: parseFloat(weeklyRevenueStats.revenueUSD.toFixed(2)),
//             transactions: weeklyRevenueStats.transactions,
//             vendorsCount: weeklyRevenueStats.vendorsCount?.length || 0,
//             averagePerVendor: weeklyRevenueStats.vendorsCount?.length > 0 
//               ? parseFloat((weeklyRevenueStats.revenueUSD / weeklyRevenueStats.vendorsCount.length).toFixed(2))
//               : 0,
//             currency: "USD"
//           },
//           monthly: {
//             revenueUSD: parseFloat(monthlyRevenueStats.revenueUSD.toFixed(2)),
//             transactions: monthlyRevenueStats.transactions,
//             vendorsCount: monthlyRevenueStats.vendorsCount?.length || 0,
//             cashRevenue: parseFloat(monthlyRevenueStats.cashRevenue.toFixed(2)),
//             onlineRevenue: parseFloat(monthlyRevenueStats.onlineRevenue.toFixed(2)),
//             currency: "USD"
//           },
//           pending: {
//             totalPendingUSD: parseFloat(pendingStats.totalPendingUSD.toFixed(2)),
//             vendorsCount: pendingStats.vendorsCount,
//             currency: "USD"
//           },
//           collectionRate: monthlyRevenueStats.revenueUSD > 0 
//             ? parseFloat(((monthlyRevenueStats.revenueUSD / (monthlyRevenueStats.revenueUSD + pendingStats.totalPendingUSD)) * 100).toFixed(2))
//             : 0
//         },

//         // Active users
//         activeUsers: {
//           daily: dailyActiveUsers,
//           weekly: weeklyActiveUsers,
//           monthly: monthlyActiveUsers,
//         },

//         // Charts data
//         charts: {
//           earningsData: {
//             today: [{ day: "Today", revenue: revenueToday }],
//             weekly: earningsWeeklyFormatted,
//             monthly: earningsMonthlyFormatted,
//           },
//           paymentRevenueData: {
//             weekly: paymentRevenueWeeklyFormatted,
//             methodDistribution: paymentMethodDistribution.map(m => ({
//               method: m.method,
//               revenue: m.revenue,
//               transactions: m.transactions,
//               percentage: parseFloat(m.percentage.toFixed(2))
//             }))
//           },
//           redemptionData: {
//             today: [{ day: "Today", redeemed: redeemedCouponsToday }],
//             weekly: redemptionWeeklyFormatted,
//             monthly: redemptionMonthlyFormatted,
//           },
//           restaurantRedemptionData: {
//             today: restaurantRedemptionToday,
//             weekly: restaurantRedemptionWeekly,
//             monthly: restaurantRedemptionMonthly,
//           },
//           topRestaurantsData: {
//             today: topRestaurantsToday,
//             weekly: topRestaurantsWeekly,
//             monthly: topRestaurantsMonthly,
//           },
//         },

//         // Payment dashboard data
//         paymentDashboard: {
//           topPayingVendors: topPayingVendors.map(v => ({
//             vendorId: v.vendorId,
//             vendorName: v.vendorName,
//             totalPaid: v.totalPaid,
//             transactions: v.transactions,
//             lastPayment: v.lastPayment,
//             vendorEmail: v.vendorEmail,
//             vendorPhone: v.vendorPhone
//           })),
//           recentPayments: recentPayments.map(p => ({
//             id: p._id,
//             vendorId: p.vendorId?._id,
//             vendorName: p.vendorId?.businessName || p.vendorName,
//             amount: p.pricePerCoupon,
//             method: p.paymentMethod,
//             status: p.paymentStatus,
//             date: p.paymentDate || p.verificationDate,
//             month: p.month
//           }))
//         },

//         // Tables data
//         tables: {
//           userInsightsData,
//           restaurantInsightsData,
//         },

//         // Metadata
//         metadata: {
//           currentDate: now.toISOString(),
//           currentMonth: currentMonth,
//           period: {
//             todayStart: todayStart.toISOString(),
//             weekStart: thisWeekStart.toISOString(),
//             monthStart: thisMonthStart.toISOString()
//           }
//         }
//       },
//     });

//   } catch (error) {
//     console.error("Dashboard Stats Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     });
//   }
// };

export const getCouponRedemptionReport = async (req, res) => {
  try {
    // Get all users with their coupon data
    const users = await User.find({})
      .select('_id name email phone MyCoupons')
      .lean();

    let report = [];
    let siNo = 1;

    // Get all feedback for vendor's coupons - FRESH DATA every time
    let allFeedbacks = [];
    try {
      allFeedbacks = await UserCouponFeedback.find({}).lean();
    } catch (fbError) {
      console.log('⚠️ Could not fetch feedback:', fbError.message);
    }

    // Create map for feedback by userCouponId for quick lookup
    const feedbackByUserCouponId = new Map();
    
    allFeedbacks.forEach(fb => {
      if (fb.userCouponId) {
        feedbackByUserCouponId.set(fb.userCouponId.toString(), fb);
      }
    });

    for (const user of users) {
      if (!user || !user._id) continue;
      
      // ✅ FIX: Generate Customer_ID as C + last 6 digits of userId
      const userIdStr = user._id.toString();
      const customerId = `C${userIdStr.slice(-6)}`;
      
      if (user.MyCoupons && Array.isArray(user.MyCoupons)) {
        for (const mc of user.MyCoupons) {
          if (!mc || !mc.couponId) continue;
          
          // Fetch full coupon details
          const coupon = await Coupon.findById(mc.couponId)
            .populate('vendorId', 'businessName name')
            .lean();
          
          if (!coupon) continue;
          
          let vendorName = 'N/A';
          let vendorCategory = coupon.category || 'N/A';
          
          if (coupon.vendorId) {
            vendorName = coupon.vendorId.businessName || coupon.vendorId.name || 'N/A';
          }
          
          // Get download/purchase date - this is the primary sort field
          let downloadDate = mc.purchasedAt || mc.createdAt || mc.claimedAt || coupon.createdAt;
          
          // Store original date object for sorting
          const sortDate = new Date(downloadDate);
          
          // Determine redeem date and status
          let redeemDate = null;
          let redeemTime = null;
          let redeemStatus = 'Active';
          
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
          } else if (mc.status === 'Expired') {
            redeemStatus = 'Expired';
          }
          
          // Feedback handling
          let feedbackText = 'N/A';
          
          if (mc._id) {
            const feedback = feedbackByUserCouponId.get(mc._id.toString());
            if (feedback) {
              const rating = feedback.rating || 0;
              const description = feedback.description || '';
              const stars = '⭐'.repeat(Math.min(Math.floor(rating), 5));
              const descText = description ? ` - ${description}` : '';
              feedbackText = `${rating}${stars}${descText}`;
            } else if (redeemStatus === 'Redeemed') {
              feedbackText = 'Awaiting Feedback';
            } else if (redeemStatus === 'Active') {
              feedbackText = 'Not Yet Used';
            } else if (redeemStatus === 'Expired') {
              feedbackText = 'Expired - No Feedback';
            }
          }

          // Format dates in CST timezone
          const downloadedFormatted = formatDateInCST(downloadDate);
          const downloadedTimeFormatted = formatTimeInCST(downloadDate);
          const redeemedDateFormatted = redeemDate ? formatDateInCST(redeemDate) : 'N/A';
          const redeemedTimeFormatted = redeemTime ? formatTimeInCST(redeemTime) : 'N/A';

          // Get order details
          const orderDetails = mc.orderDetails || 'N/A';
          const orderValue = mc.orderValue ? `₹${mc.orderValue}` : '₹0.00';

          report.push({
            "SI_No": siNo++,
            "Customer_ID": customerId,  // ✅ Now using C + last 6 digits
            "Customer_Name": user.name || 'Unknown',
            "Customer_Email": user.email || 'N/A',
            "Customer_Phone": user.phone || 'N/A',
            "Vendor_Name": vendorName,
            "Vendor_Category": vendorCategory,
            "Product_Name": coupon.name || 'N/A',
            "Coupon_ID": coupon._id?.toString() || 'N/A',
            "Coupon_Name": coupon.name || 'N/A',
            "Coupon_Code": mc.couponCode || coupon.couponCode || 'N/A',
            "Discount (%)": `${coupon.discountPercentage || 0}${coupon.couponCodeType === '%' ? '%' : ''}`,
            "Download_Date": downloadedFormatted,
            "Download_Time": downloadedTimeFormatted,
            "Redeemed_Date": redeemedDateFormatted,
            "Redeemed_Time": redeemedTimeFormatted,
            "Order_Details": orderDetails,
            "Order_Value": orderValue,
            "Feedback": feedbackText,
            "_sortDate": sortDate
          });
        }
      }
    }

    // Sort by download date - LATEST FIRST
    report.sort((a, b) => {
      const dateA = a._sortDate instanceof Date ? a._sortDate : new Date(a.Download_Date);
      const dateB = b._sortDate instanceof Date ? b._sortDate : new Date(b.Download_Date);
      return dateB - dateA;
    });

    // Re-index SI numbers after sorting
    report = report.map((item, index) => {
      const { _sortDate, ...cleanItem } = item;
      return {
        ...cleanItem,
        "SI_No": index + 1
      };
    });

    console.log(`✅ Sorted ${report.length} entries - Latest purchases first`);

    return res.status(200).json({
      success: true,
      count: report.length,
      data: report
    });

  } catch (error) {
    console.error("getCouponRedemptionReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
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
    // But since JavaScript Date objects are always UTC, we need to adjust
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

export const getDashboardStats = async (req, res) => {
  try {
    // ===== DATE CALCULATIONS (UTC-safe to match MongoDB storage) =====
    const now = new Date();

    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    );

    const thisWeekStart = (() => {
      const d = new Date(todayStart);
      const day = d.getUTCDay();
      const daysFromMon = day === 0 ? 6 : day - 1;
      d.setUTCDate(d.getUTCDate() - daysFromMon);
      return d;
    })();

    const thisMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
    );

    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    // ===== BASIC TOTALS =====
    const [totalUsers, totalCoupons, totalVendors, totalCategories] = await Promise.all([
      User.countDocuments(),
      Coupon.countDocuments(),
      Vendor.countDocuments(),
      Category.countDocuments(),
    ]);

    // ===== TODAY'S COUPONS DOWNLOADED BY USERS =====
    const todaysCouponsResult = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.purchasedAt': { $gte: todayStart, $lte: now }
        }
      },
      {
        $group: {
          _id: null,
          totalDownloadedToday: { $sum: 1 },
          byCoins: {
            $sum: { $cond: [{ $eq: ['$MyCoupons.redeemedWith', 'coins'] }, 1, 0] }
          },
          byCoupons: {
            $sum: { $cond: [{ $eq: ['$MyCoupons.redeemedWith', 'coupons'] }, 1, 0] }
          }
        }
      }
    ]);

    const todaysCoupons = todaysCouponsResult[0]?.totalDownloadedToday || 0;
    const todaysPurchaseBreakdown = {
      byCoins: todaysCouponsResult[0]?.byCoins || 0,
      byCoupons: todaysCouponsResult[0]?.byCoupons || 0
    };

    // ===== REUSABLE: 3-condition redemption match builder =====
    // Catches ALL claimed coupons regardless of which field was saved:
    // - isClaimed=true + claimedAt  (standard path)
    // - claimVerified=true + claimedAt  (safety fallback)
    // - activatedAt exists + expiresAt exists  (in case isClaimed didn't persist)
    const buildRedemptionMatch = (start, end) => ({
      $or: [
        {
          'MyCoupons.isClaimed': true,
          'MyCoupons.claimedAt': { $gte: start, $lte: end }
        },
        {
          'MyCoupons.claimVerified': true,
          'MyCoupons.claimedAt': { $gte: start, $lte: end }
        },
        {
          'MyCoupons.activatedAt': { $gte: start, $lte: end },
          'MyCoupons.expiresAt': { $exists: true, $ne: null }
        }
      ]
    });

    // ===== TODAY'S REDEEMED COUPONS =====
    const todayRedemptionResult = await User.aggregate([
      { $unwind: '$MyCoupons' },
      { $match: buildRedemptionMatch(todayStart, now) },
      {
        $group: {
          _id: null,
          totalClaimedAtVendor: { $sum: 1 }
        }
      }
    ]);

    const redeemedCouponsToday = todayRedemptionResult[0]?.totalClaimedAtVendor || 0;
    const revenueToday = redeemedCouponsToday;

    // ===== ACTIVE USERS =====
const [dailyActiveResult, weeklyActiveResult, monthlyActiveResult] = await Promise.all([
  // DAILY: users who downloaded/used a coupon OR earned coins today
  User.aggregate([
    {
      $match: {
        $or: [
          { 'MyCoupons.purchasedAt': { $gte: todayStart, $lte: now } },
          { 'MyCoupons.claimedAt': { $gte: todayStart, $lte: now } },
          { 'coinHistory.createdAt': { $gte: todayStart, $lte: now } },
          { 'notifications.createdAt': { $gte: todayStart, $lte: now } },
        ]
      }
    },
    { $count: 'count' }
  ]),
  // WEEKLY
  User.aggregate([
    {
      $match: {
        $or: [
          { 'MyCoupons.purchasedAt': { $gte: thisWeekStart, $lte: now } },
          { 'MyCoupons.claimedAt': { $gte: thisWeekStart, $lte: now } },
          { 'coinHistory.createdAt': { $gte: thisWeekStart, $lte: now } },
          { 'notifications.createdAt': { $gte: thisWeekStart, $lte: now } },
        ]
      }
    },
    { $count: 'count' }
  ]),
  // MONTHLY
  User.aggregate([
    {
      $match: {
        $or: [
          { 'MyCoupons.purchasedAt': { $gte: thisMonthStart, $lte: now } },
          { 'MyCoupons.claimedAt': { $gte: thisMonthStart, $lte: now } },
          { 'coinHistory.createdAt': { $gte: thisMonthStart, $lte: now } },
          { 'notifications.createdAt': { $gte: thisMonthStart, $lte: now } },
        ]
      }
    },
    { $count: 'count' }
  ]),
]);

const dailyActiveUsers = dailyActiveResult[0]?.count || 0;
const weeklyActiveUsers = weeklyActiveResult[0]?.count || 0;
const monthlyActiveUsers = monthlyActiveResult[0]?.count || 0;

    // ===== PAYMENT CONFIG =====
    const priceConfig = await PaymentConfig.findOne({ isActive: true });
    const currentPrice = priceConfig?.pricePerCoupon || 1.0;

    // ===== TODAY'S PAYMENT REVENUE =====
    const todayRevenue = await PaymentRecord.aggregate([
      {
        $match: {
          $and: [
            { $or: [{ paymentStatus: 'paid' }, { paymentStatus: 'verified' }] },
            {
              $or: [
                { paymentDate: { $gte: todayStart, $lte: now } },
                { verificationDate: { $gte: todayStart, $lte: now } }
              ]
            }
          ]
        }
      },
      {
        $group: {
          _id: null,
          revenueUSD: { $sum: '$pricePerCoupon' },
          transactions: { $sum: 1 },
          cashRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$pricePerCoupon', 0] }
          },
          onlineRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'online'] }, '$pricePerCoupon', 0] }
          }
        }
      }
    ]);

    const todayRevenueStats = todayRevenue[0] || {
      revenueUSD: 0, transactions: 0, cashRevenue: 0, onlineRevenue: 0
    };

    // ===== WEEKLY PAYMENT REVENUE =====
    const weeklyRevenue = await PaymentRecord.aggregate([
      {
        $match: {
          $and: [
            { $or: [{ paymentStatus: 'paid' }, { paymentStatus: 'verified' }] },
            {
              $or: [
                { paymentDate: { $gte: thisWeekStart, $lte: now } },
                { verificationDate: { $gte: thisWeekStart, $lte: now } }
              ]
            }
          ]
        }
      },
      {
        $group: {
          _id: null,
          revenueUSD: { $sum: '$pricePerCoupon' },
          transactions: { $sum: 1 },
          vendorsCount: { $addToSet: '$vendorId' }
        }
      }
    ]);

    const weeklyRevenueStats = weeklyRevenue[0] || {
      revenueUSD: 0, transactions: 0, vendorsCount: []
    };

    // ===== MONTHLY PAYMENT REVENUE =====
    const monthlyRevenue = await PaymentRecord.aggregate([
      {
        $match: {
          $and: [
            { $or: [{ paymentStatus: 'paid' }, { paymentStatus: 'verified' }] },
            { month: currentMonth }
          ]
        }
      },
      {
        $group: {
          _id: null,
          revenueUSD: { $sum: '$pricePerCoupon' },
          transactions: { $sum: 1 },
          vendorsCount: { $addToSet: '$vendorId' },
          cashRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$pricePerCoupon', 0] }
          },
          onlineRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'online'] }, '$pricePerCoupon', 0] }
          }
        }
      }
    ]);

    const monthlyRevenueStats = monthlyRevenue[0] || {
      revenueUSD: 0, transactions: 0, vendorsCount: [], cashRevenue: 0, onlineRevenue: 0
    };

    // ===== ALL TIME REVENUE =====
    const allTimeRevenue = await PaymentRecord.aggregate([
      {
        $match: {
          $or: [{ paymentStatus: 'paid' }, { paymentStatus: 'verified' }]
        }
      },
      {
        $group: {
          _id: null,
          revenueUSD: { $sum: '$pricePerCoupon' },
          transactions: { $sum: 1 },
          cashRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$pricePerCoupon', 0] }
          },
          onlineRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'online'] }, '$pricePerCoupon', 0] }
          }
        }
      }
    ]);

    const allTimeRevenueStats = allTimeRevenue[0] || {
      revenueUSD: 0, transactions: 0, cashRevenue: 0, onlineRevenue: 0
    };

    // ===== PENDING PAYMENTS =====
    const pendingPayments = await VendorMonthlyPayment.aggregate([
      {
        $match: {
          month: currentMonth,
          amountPending: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          totalPendingUSD: { $sum: '$amountPending' },
          vendorsCount: { $sum: 1 }
        }
      }
    ]);

    const pendingStats = pendingPayments[0] || { totalPendingUSD: 0, vendorsCount: 0 };

    // ===== EARNINGS CHARTS (purchases, not claims) =====
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const earningsThisWeek = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.purchasedAt': { $gte: thisWeekStart, $lte: now }
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: '$MyCoupons.purchasedAt' },
          revenue: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const earningsWeeklyFormatted = dayNames.map((day, idx) => {
      const d = earningsThisWeek.find(e => e._id === (idx + 1));
      return { day, revenue: d ? d.revenue : 0 };
    });

    const earningsThisMonth = await User.aggregate([
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.purchasedAt': { $gte: thisMonthStart, $lte: now }
        }
      },
      {
        $group: {
          _id: { $week: '$MyCoupons.purchasedAt' },
          revenue: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const earningsMonthlyFormatted = Array.from({ length: 4 }, (_, i) => {
      const w = earningsThisMonth.find(e => e._id === (i + 1));
      return { week: `Week ${i + 1}`, revenue: w ? w.revenue : 0 };
    });

    // ===== PAYMENT REVENUE WEEKLY CHART =====
    const paymentRevenueWeekly = await PaymentRecord.aggregate([
      {
        $match: {
          $and: [
            { $or: [{ paymentStatus: 'paid' }, { paymentStatus: 'verified' }] },
            {
              $or: [
                { paymentDate: { $gte: thisWeekStart, $lte: now } },
                { verificationDate: { $gte: thisWeekStart, $lte: now } }
              ]
            }
          ]
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: '$paymentDate' },
          revenue: { $sum: '$pricePerCoupon' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const paymentRevenueWeeklyFormatted = dayNames.map((day, idx) => {
      const d = paymentRevenueWeekly.find(e => e._id === (idx + 1));
      return {
        day,
        revenue: d ? parseFloat(d.revenue.toFixed(2)) : 0,
        transactions: d ? d.transactions : 0
      };
    });

    // ===== WEEKLY REDEMPTIONS CHART =====
    const redemptionThisWeek = await User.aggregate([
      { $unwind: '$MyCoupons' },
      { $match: buildRedemptionMatch(thisWeekStart, now) },
      {
        $group: {
          _id: {
            $dayOfWeek: {
              $ifNull: ['$MyCoupons.claimedAt', '$MyCoupons.activatedAt']
            }
          },
          redeemed: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const redemptionWeeklyFormatted = dayNames.map((day, idx) => {
      const d = redemptionThisWeek.find(e => e._id === (idx + 1));
      return { day, redeemed: d ? d.redeemed : 0 };
    });

    // ===== MONTHLY REDEMPTIONS CHART =====
    const redemptionThisMonth = await User.aggregate([
      { $unwind: '$MyCoupons' },
      { $match: buildRedemptionMatch(thisMonthStart, now) },
      {
        $group: {
          _id: {
            $week: {
              $ifNull: ['$MyCoupons.claimedAt', '$MyCoupons.activatedAt']
            }
          },
          redeemed: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const redemptionMonthlyFormatted = Array.from({ length: 4 }, (_, i) => {
      const w = redemptionThisMonth.find(e => e._id === (i + 1));
      return { week: `Week ${i + 1}`, redeemed: w ? w.redeemed : 0 };
    });

    // ===== PAYMENT METHOD DISTRIBUTION =====
    const paymentMethodDistribution = await PaymentRecord.aggregate([
      {
        $match: {
          $or: [{ paymentStatus: 'paid' }, { paymentStatus: 'verified' }],
          month: currentMonth
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          revenue: { $sum: '$pricePerCoupon' },
          transactions: { $sum: 1 }
        }
      },
      {
        $project: {
          method: { $ifNull: ['$_id', 'other'] },
          revenue: { $round: ['$revenue', 2] },
          transactions: 1,
          percentage: {
            $cond: [
              { $gt: [monthlyRevenueStats.revenueUSD, 0] },
              {
                $multiply: [
                  { $divide: ['$revenue', monthlyRevenueStats.revenueUSD] },
                  100
                ]
              },
              0
            ]
          }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // ===== TOP PAYING VENDORS =====
    const topPayingVendors = await PaymentRecord.aggregate([
      {
        $match: {
          $or: [{ paymentStatus: 'paid' }, { paymentStatus: 'verified' }],
          month: currentMonth
        }
      },
      {
        $group: {
          _id: '$vendorId',
          vendorName: { $first: '$vendorName' },
          totalPaid: { $sum: '$pricePerCoupon' },
          transactions: { $sum: 1 },
          lastPayment: { $max: '$paymentDate' }
        }
      },
      {
        $lookup: {
          from: 'vendors',
          localField: '_id',
          foreignField: '_id',
          as: 'vendorDetails'
        }
      },
      { $unwind: { path: '$vendorDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          vendorId: '$_id',
          vendorName: { $ifNull: ['$vendorDetails.businessName', '$vendorName'] },
          totalPaid: { $round: ['$totalPaid', 2] },
          transactions: 1,
          lastPayment: 1,
          vendorEmail: '$vendorDetails.email',
          vendorPhone: '$vendorDetails.phone'
        }
      },
      { $sort: { totalPaid: -1 } },
      { $limit: 5 }
    ]);

    // ===== RECENT PAYMENTS =====
    const recentPayments = await PaymentRecord.find({
      $or: [{ paymentStatus: 'paid' }, { paymentStatus: 'verified' }]
    })
      .populate('vendorId', 'businessName name')
      .sort({ paymentDate: -1, verificationDate: -1 })
      .limit(5)
      .select('vendorId vendorName pricePerCoupon paymentMethod paymentStatus paymentDate month');

    // ===== RESTAURANT REDEMPTION PIPELINE (reusable) =====
    const restaurantRedemptionPipeline = (matchCondition) => [
      { $unwind: '$MyCoupons' },
      { $match: matchCondition },
      {
        $lookup: {
          from: 'coupons',
          localField: 'MyCoupons.couponId',
          foreignField: '_id',
          as: 'couponDetails'
        }
      },
      { $unwind: { path: '$couponDetails', preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: 'vendors',
          localField: 'couponDetails.vendorId',
          foreignField: '_id',
          as: 'vendorDetails'
        }
      },
      { $unwind: { path: '$vendorDetails', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$vendorDetails._id',
          name: { $first: '$vendorDetails.businessName' },
          redeemed: { $sum: 1 }
        }
      },
      { $sort: { redeemed: -1 } },
      { $limit: 10 }
    ];

    // ===== TOP RESTAURANTS PIPELINE (reusable) =====
    const topRestaurantsPipeline = (start, end) => [
      { $unwind: '$MyCoupons' },
      {
        $match: {
          'MyCoupons.purchasedAt': { $gte: start, $lte: end }
        }
      },
      {
        $lookup: {
          from: 'coupons',
          localField: 'MyCoupons.couponId',
          foreignField: '_id',
          as: 'couponDetails'
        }
      },
      { $unwind: { path: '$couponDetails', preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: 'vendors',
          localField: 'couponDetails.vendorId',
          foreignField: '_id',
          as: 'vendorDetails'
        }
      },
      { $unwind: { path: '$vendorDetails', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$vendorDetails._id',
          name: { $first: '$vendorDetails.businessName' },
          revenue: { $sum: 1 },
          coupons: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ];

    // Run restaurant aggregates in parallel
    const [
      restaurantRedemptionToday,
      restaurantRedemptionWeekly,
      restaurantRedemptionMonthly,
      topRestaurantsToday,
      topRestaurantsWeekly,
      topRestaurantsMonthly
    ] = await Promise.all([
      User.aggregate(restaurantRedemptionPipeline(buildRedemptionMatch(todayStart, now))),
      User.aggregate(restaurantRedemptionPipeline(buildRedemptionMatch(thisWeekStart, now))),
      User.aggregate(restaurantRedemptionPipeline(buildRedemptionMatch(thisMonthStart, now))),
      User.aggregate(topRestaurantsPipeline(todayStart, now)),
      User.aggregate(topRestaurantsPipeline(thisWeekStart, now)),
      User.aggregate(topRestaurantsPipeline(thisMonthStart, now))
    ]);

    // ===== USER INSIGHTS =====
    const userInsights = await User.find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('_id name email updatedAt createdAt MyCoupons steps stepHistory')
      .lean();

    const userInsightsData = userInsights.map(user => {
      let totalSteps = 0;

      if (user.steps) {
        if (Array.isArray(user.steps)) {
          totalSteps = user.steps.reduce((sum, s) => {
            if (typeof s === 'object' && s !== null) {
              return sum + (s.stepsCount || s.count || s.steps || 0);
            }
            return sum + (s || 0);
          }, 0);
        } else if (typeof user.steps === 'object' && user.steps !== null) {
          totalSteps = user.steps.stepsCount || user.steps.count || user.steps.totalSteps || 0;
        } else if (typeof user.steps === 'number') {
          totalSteps = user.steps;
        }
      }

      if (user.stepHistory && Array.isArray(user.stepHistory)) {
        totalSteps += user.stepHistory.reduce((sum, entry) => {
          return sum + (entry.stepsCount || entry.steps || 0);
        }, 0);
      }

      // Count coupons that were actually claimed at vendor
      const offerRedeemed = user.MyCoupons?.filter(c =>
        c && (c.isClaimed === true || c.claimVerified === true)
      ).length || 0;

      return {
        userId: user._id,
        user: user.name || 'Unknown',
        email: user.email || 'N/A',
        lastLogin: user.updatedAt?.toISOString().split('T')[0] || 'N/A',
        lastLoginFull: user.updatedAt || null,
        offerRedeemed,
        reviewGiven: 0,
        accountCreated: user.createdAt?.toISOString().split('T')[0] || 'N/A',
        accountCreatedFull: user.createdAt || null,
        activities: { steps: totalSteps, quiz: 0, news: 0, facts: 0 }
      };
    });

    // ===== RESTAURANT INSIGHTS =====
    const restaurantInsights = await Vendor.aggregate([
      {
        $lookup: {
          from: 'coupons',
          localField: '_id',
          foreignField: 'vendorId',
          as: 'coupons'
        }
      },
      {
        $lookup: {
          from: 'feedbacks',
          localField: '_id',
          foreignField: 'vendorId',
          as: 'feedbacks'
        }
      },
      {
        $project: {
          vendorId: '$_id',
          restaurant: '$businessName',
          redemption: { $size: '$coupons' },
          avgRating: { $avg: '$feedbacks.stars' },
          activeOffer: {
            $size: {
              $filter: {
                input: '$coupons',
                as: 'coupon',
                cond: { $eq: ['$$coupon.status', 'approved'] }
              }
            }
          },
          joinedDate: '$createdAt'
        }
      },
      { $sort: { redemption: -1 } },
      { $limit: 10 }
    ]);

    const restaurantInsightsData = restaurantInsights.map(r => ({
       vendorId: r.vendorId,  
      restaurant: r.restaurant || 'Unknown',
      redemption: r.redemption || 0,
      avgRating: r.avgRating ? Number(r.avgRating.toFixed(1)) : 0,
      activeOffer: r.activeOffer || 0,
      joinedDate: r.joinedDate?.toISOString().split('T')[0] || 'N/A'
    }));

    // ===== FINAL RESPONSE =====
    res.status(200).json({
      success: true,
      data: {
        totals: {
          users: totalUsers,
          vendors: totalVendors,
          coupons: totalCoupons,
          categories: totalCategories,
          currentPricePerCoupon: currentPrice,
          todaysCouponsDownloaded: todaysCoupons,
          todaysPurchaseBreakdown
        },

        revenue: {
          today: {
            amount: parseFloat(todayRevenueStats.revenueUSD.toFixed(2)),
            transactions: todayRevenueStats.transactions,
            cash: parseFloat(todayRevenueStats.cashRevenue.toFixed(2)),
            online: parseFloat(todayRevenueStats.onlineRevenue.toFixed(2))
          },
          weekly: {
            amount: parseFloat(weeklyRevenueStats.revenueUSD.toFixed(2)),
            transactions: weeklyRevenueStats.transactions,
            vendorsCount: weeklyRevenueStats.vendorsCount?.length || 0
          },
          monthly: {
            amount: parseFloat(monthlyRevenueStats.revenueUSD.toFixed(2)),
            transactions: monthlyRevenueStats.transactions,
            vendorsCount: monthlyRevenueStats.vendorsCount?.length || 0,
            cash: parseFloat(monthlyRevenueStats.cashRevenue.toFixed(2)),
            online: parseFloat(monthlyRevenueStats.onlineRevenue.toFixed(2))
          },
          allTime: {
            amount: parseFloat(allTimeRevenueStats.revenueUSD.toFixed(2)),
            transactions: allTimeRevenueStats.transactions,
            cash: parseFloat(allTimeRevenueStats.cashRevenue.toFixed(2)),
            online: parseFloat(allTimeRevenueStats.onlineRevenue.toFixed(2))
          },
          pending: {
            amount: parseFloat(pendingStats.totalPendingUSD.toFixed(2)),
            vendorsCount: pendingStats.vendorsCount
          },
          collectionRate: (monthlyRevenueStats.revenueUSD + pendingStats.totalPendingUSD) > 0
            ? parseFloat(
              (
                monthlyRevenueStats.revenueUSD /
                (monthlyRevenueStats.revenueUSD + pendingStats.totalPendingUSD) *
                100
              ).toFixed(2)
            )
            : 0
        },

        redemptions: {
          today: redeemedCouponsToday,
          downloadedToday: todaysCoupons,
          revenueToday,
          weekly: {
            total: redemptionThisWeek.reduce((s, d) => s + (d.redeemed || 0), 0),
            byDay: redemptionWeeklyFormatted
          },
          monthly: {
            total: redemptionThisMonth.reduce((s, w) => s + (w.redeemed || 0), 0),
            byWeek: redemptionMonthlyFormatted
          }
        },

        activeUsers: {
          daily: dailyActiveUsers,
          weekly: weeklyActiveUsers,
          monthly: monthlyActiveUsers
        },

        charts: {
          earningsData: {
            today: [{ day: 'Today', revenue: todaysCoupons }],
            weekly: earningsWeeklyFormatted,
            monthly: earningsMonthlyFormatted
          },
          paymentRevenueData: {
            weekly: paymentRevenueWeeklyFormatted,
            methodDistribution: paymentMethodDistribution.map(m => ({
              method: m.method,
              revenue: m.revenue,
              transactions: m.transactions,
              percentage: parseFloat((m.percentage || 0).toFixed(2))
            }))
          },
          redemptionData: {
            today: [{ day: 'Today', redeemed: redeemedCouponsToday }],
            weekly: redemptionWeeklyFormatted,
            monthly: redemptionMonthlyFormatted
          },
          restaurantRedemptionData: {
            today: restaurantRedemptionToday,
            weekly: restaurantRedemptionWeekly,
            monthly: restaurantRedemptionMonthly
          },
          topRestaurantsData: {
            today: topRestaurantsToday,
            weekly: topRestaurantsWeekly,
            monthly: topRestaurantsMonthly
          }
        },

        paymentDashboard: {
          topPayingVendors: topPayingVendors.map(v => ({
            vendorId: v.vendorId,
            vendorName: v.vendorName,
            totalPaid: v.totalPaid,
            transactions: v.transactions,
            lastPayment: v.lastPayment,
            vendorEmail: v.vendorEmail,
            vendorPhone: v.vendorPhone
          })),
          recentPayments: recentPayments.map(p => ({
            id: p._id,
            vendorId: p.vendorId?._id,
            vendorName: p.vendorId?.businessName || p.vendorName,
            amount: p.pricePerCoupon,
            method: p.paymentMethod,
            status: p.paymentStatus,
            date: p.paymentDate || p.verificationDate,
            month: p.month
          }))
        },

        tables: {
          userInsightsData,
          restaurantInsightsData
        },

        metadata: {
          currentDate: now.toISOString(),
          currentMonth,
          period: {
            todayStart: todayStart.toISOString(),
            weekStart: thisWeekStart.toISOString(),
            monthStart: thisMonthStart.toISOString()
          }
        }
      }
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const savePrivacyPolicy = async (req, res) => {
  try {
    const { title, content, date } = req.body;

    if (!title || !content || !date) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // Check if a policy already exists
    const existingPolicy = await PrivacyPolicy.findOne();

    let policy;
    if (existingPolicy) {
      // Update existing
      existingPolicy.title = title;
      existingPolicy.content = content;
      existingPolicy.date = date;
      policy = await existingPolicy.save();
    } else {
      // Create new
      policy = await PrivacyPolicy.create({ title, content, date });
    }

    res.status(200).json({ success: true, message: "Privacy Policy saved successfully.", data: policy });
  } catch (error) {
    console.error("Error saving privacy policy:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Get Privacy Policy
export const getPrivacyPolicy = async (req, res) => {
  try {
    const policy = await PrivacyPolicy.findOne();

    if (!policy) {
      return res.status(404).json({ success: false, message: "Privacy Policy not found." });
    }

    res.status(200).json({ success: true, data: policy });
  } catch (error) {
    console.error("Error fetching privacy policy:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};


export const updatePrivacyPolicy = async (req, res) => {
  const { title, content, date } = req.body;
  try {
    const policy = await PrivacyPolicy.findByIdAndUpdate(
      req.params.id,
      { title, content, date },
      { new: true }
    );
    if (!policy) return res.status(404).json({ success: false, message: "Policy not found" });
    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete Privacy Policy by ID
export const deletePrivacyPolicy = async (req, res) => {
  try {
    const policy = await PrivacyPolicy.findByIdAndDelete(req.params.id);
    if (!policy) return res.status(404).json({ success: false, message: "Policy not found" });
    res.json({ success: true, message: "Privacy policy deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Update user by ID
export const updateUserById = async (req, res) => {
  const userId = req.params.userId;
  const updateData = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true, // return the updated document
      runValidators: true, // validate before update
    });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found!' });
    }

    return res.status(200).json({
      message: 'User updated successfully!',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Delete user by ID
export const deleteUserById = async (req, res) => {
  const userId = req.params.userId;

  try {
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found!' });
    }

    return res.status(200).json({
      message: 'User deleted successfully!',
      data: deletedUser,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};



// Update vendor by ID
export const updateVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const updates = req.body;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor)
      return res.status(404).json({ message: "Vendor not found" });

    // If businessLogo is updated
    if (req.files && req.files.businessLogo) {
      const upload = await cloudinary.uploader.upload(
        req.files.businessLogo.tempFilePath,
        { folder: "vendorLogos" }
      );
      updates.businessLogo = upload.secure_url;
    }

    Object.assign(vendor, updates);
    await vendor.save();

    res.status(200).json({
      message: "Vendor updated successfully",
      vendor
    });

  } catch (err) {
    console.error("Update Vendor Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// Delete vendor by ID
export const deleteVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor)
      return res.status(404).json({ message: "Vendor not found" });

    await Vendor.findByIdAndDelete(vendorId);

    res.status(200).json({
      message: "Vendor deleted successfully"
    });

  } catch (err) {
    console.error("Delete Vendor Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


export const getAllVendorDocuments = async (req, res) => {
  try {
    // Fetch all vendors and select name and documents
    const vendors = await Vendor.find({}, 'name documents');

    if (!vendors || vendors.length === 0) {
      return res.status(404).json({ message: 'No vendor documents found' });
    }

    res.status(200).json({
      message: 'All vendor documents fetched successfully',
      data: vendors,
    });
  } catch (error) {
    console.error('getAllVendorDocuments error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
    });
  }
};



export const getAllNotifications = async (req, res) => {
  try {
    const { type, isRead, limit = 50, page = 1 } = req.query;

    // Build filter
    let filter = {
      userId: { $exists: false }  // ✅ Exclude user notifications
    };
    if (type) filter.type = type;
    if (isRead !== undefined) filter.isRead = isRead === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find(filter)
      .populate({ path: 'vendorId', select: 'name businessName businessLogo email phone' })
      .populate({ path: 'userId', select: 'name profileImage email phone' })
      .populate({ path: 'couponId', select: 'name couponCode discountPercentage category' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ ...filter, isRead: false });

    res.status(200).json({
      success: true,
      message: 'Admin notifications fetched successfully',
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
    console.error('Get admin notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications',
      error: error.message
    });
  }
};




// Mark admin notification as read
export const markAdminNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    ).populate('vendorId userId couponId');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Mark admin notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
// Mark all admin notifications as read
export const markAllAdminNotificationsAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: `All notifications marked as read (${result.modifiedCount} updated)`
    });
  } catch (error) {
    console.error('Mark all admin notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};





export const deleteNotificationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Notification ID is required' });
    }

    const deleted = await Notification.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
      deletedId: id
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      message: 'Server error while deleting notification',
      error: error.message,
    });
  }
};



const cleanJsonString = (str) => {
  const first = str.indexOf('[');
  const last = str.lastIndexOf(']');
  return str.slice(first, last + 1);
};

export const getQuizQuestions = async (req, res) => {
  try {
    const prompt = `
Generate 15 multiple-choice quiz questions in JSON array format.
Each object should have:
- question (string)
- options (array of 4 strings)
- answer (string)
Return ONLY the JSON array.
`;

    const response = await axios.post(
      `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanedText = cleanJsonString(rawText);

    let questions;
    try {
      questions = JSON.parse(cleanedText);
    } catch (err) {
      return res.status(500).json({
        message: 'Failed to parse quiz questions from AI response',
        rawResponse: rawText,
      });
    }

    return res.status(200).json({
      message: 'Quiz questions fetched successfully',
      questions,
    });
  } catch (error) {
    console.error('Error fetching quiz questions:', error.response?.data || error.message);
    return res.status(500).json({
      message: 'Failed to fetch quiz questions',
      error: error.response?.data || error.message,
    });
  }
};


export const createSpinReward = async (req, res) => {
  try {
    const { coins, coupons } = req.body;

    if ((!coins || coins.length === 0) && (!coupons || coupons.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "Please provide coins or coupons to create a spin reward"
      });
    }

    // Create new spin reward document
    const newSpinReward = new SpinCoin({
      coins: coins || [],
      coupons: coupons || []
    });

    await newSpinReward.save();

    res.status(201).json({
      success: true,
      message: "Spin reward created successfully",
      data: newSpinReward
    });
  } catch (error) {
    console.error("❌ Error creating spin reward:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};




export const setDailySpinLimit = async (req, res) => {
  try {
    const { dailySpinLimit } = req.body;

    if (!Number.isInteger(dailySpinLimit) || dailySpinLimit < 1) {
      return res.status(400).json({
        success: false,
        message: "dailySpinLimit must be a positive integer",
      });
    }

    let config = await SpinConfig.findOne();

    if (!config) {
      config = await SpinConfig.create({ dailySpinLimit });
    } else {
      config.dailySpinLimit = dailySpinLimit;
      await config.save();
    }

    return res.status(200).json({
      success: true,
      message: "Daily spin limit updated",
      dailySpinLimit: config.dailySpinLimit,
    });

  } catch (error) {
    console.error("Set Daily Spin Limit Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// Get admin notification statistics
export const getAdminNotificationStats = async (req, res) => {
  try {
    const stats = await Notification.aggregate([
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
                vendorName: 1
              }
            }
          ],
          dailyStats: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: -1 } },
            { $limit: 7 }
          ]
        }
      }
    ]);

    const result = {
      total: stats[0]?.totalStats[0]?.total || 0,
      unread: stats[0]?.totalStats[0]?.unread || 0,
      read: stats[0]?.totalStats[0]?.read || 0,
      byType: stats[0]?.typeStats || [],
      recent: stats[0]?.recentActivity || [],
      daily: stats[0]?.dailyStats || []
    };

    res.status(200).json({
      success: true,
      message: 'Notification statistics fetched successfully',
      data: result
    });
  } catch (error) {
    console.error('Get admin notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


/**
 * CREATE BANNER
 * Payload: multipart/form-data with files (images)
 * Response: { success: true, message: string, data: banner }
 */
export const createBanner = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Images are required"
      });
    }

    const images = [];

    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "admin_banners",
      });

      images.push({
        url: result.secure_url,
        public_id: result.public_id,
      });
    }

    const banner = await AdminBanner.create({ images });

    return res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: banner, // Contains _id from MongoDB
    });
  } catch (error) {
    console.error("Banner Upload Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET ALL BANNERS (Admin)
 * Response: { success: true, count: number, data: banner[] }
 */
export const getAllBanners = async (req, res) => {
  try {
    const banners = await AdminBanner.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners, // Each banner has its own _id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET SINGLE BANNER
 * Response: { success: true, data: banner }
 */
export const getBannerById = async (req, res) => {
  try {
    const banner = await AdminBanner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    res.status(200).json({
      success: true,
      data: banner // Uses the _id from params
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * UPDATE BANNER (Replace Images)
 * Payload: multipart/form-data with files (images)
 * Response: { success: true, message: string, data: banner }
 */
export const updateBanner = async (req, res) => {
  try {
    const banner = await AdminBanner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Images are required"
      });
    }

    // Delete old images from Cloudinary
    for (const img of banner.images) {
      await cloudinary.uploader.destroy(img.public_id);
    }

    // Upload new images
    const newImages = [];
    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "admin_banners",
      });

      newImages.push({
        url: result.secure_url,
        public_id: result.public_id,
      });
    }

    banner.images = newImages;
    await banner.save();

    res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      data: banner, // Returns updated banner with same _id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * TOGGLE BANNER ACTIVE STATUS
 * Payload: { "isActive": boolean }
 * Response: { success: true, message: string, data: banner }
 */
export const toggleBannerStatus = async (req, res) => {
 try {
    const { bannerId, imageId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value"
      });
    }

    // Find the banner
    const banner = await AdminBanner.findById(bannerId);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    // Find the specific image in the images array
    const imageIndex = banner.images.findIndex(
      img => img._id.toString() === imageId
    );

    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Image not found in this banner"
      });
    }

    // Update the image's isActive status
    banner.images[imageIndex].isActive = isActive;
    await banner.save();

    res.status(200).json({
      success: true,
      message: `Image ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: banner
    });
  } catch (error) {
    console.error('Toggle banner image error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET ACTIVE BANNERS (For App/Frontend)
 * Response: { success: true, count: number, data: banner[] }
 */
export const getActiveBannersForApp = async (req, res) => {
  try {
    const banners = await AdminBanner.find({ isActive: true }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners, // Each banner has its own _id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * DELETE BANNER
 * Response: { success: true, message: string }
 */
export const deleteBanner = async (req, res) => {
  try {
    const banner = await AdminBanner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    // Delete images from Cloudinary
    for (const img of banner.images) {
      await cloudinary.uploader.destroy(img.public_id);
    }

    await banner.deleteOne();

    res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ADMIN: Get all users spin data
export const getDailySpinLimit = async (req, res) => {
  try {
    const config = await SpinConfig.findOne();

    if (!config) {
      return res.status(200).json({
        success: true,
        dailySpinLimit: 0,
        message: "Daily spin limit not set yet",
      });
    }

    return res.status(200).json({
      success: true,
      dailySpinLimit: config.dailySpinLimit,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });

  } catch (err) {
    console.error("Get daily spin limit error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};




// ────────────────────────────────────────────────────────────
// ADMIN: Set price per coupon
// POST /api/admin/payments/set-price
// ────────────────────────────────────────────────────────────
export const setPricePerCoupon = async (req, res) => {
  try {
    const { pricePerCoupon, note } = req.body;

    if (!pricePerCoupon || pricePerCoupon <= 0) {
      return res.status(400).json({ success: false, message: 'Valid price per coupon is required' });
    }

    await PaymentConfig.updateMany({ isActive: true }, { isActive: false });

    const newPrice = await PaymentConfig.create({
      pricePerCoupon,
      note,
      validFrom: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: `Vendors will now pay $${pricePerCoupon} per coupon claimed`,
      data: newPrice,
    });
  } catch (err) {
    console.error('setPricePerCoupon error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ────────────────────────────────────────────────────────────
// ADMIN: Get current price
// GET /api/admin/payments/current-price
// ────────────────────────────────────────────────────────────
export const getCurrentPrice = async (req, res) => {
  try {
    const config = await PaymentConfig.findOne({ isActive: true });
    if (!config) return res.status(404).json({ success: false, message: 'No price configuration found' });

    return res.status(200).json({ success: true, data: config });
  } catch (err) {
    console.error('getCurrentPrice error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ────────────────────────────────────────────────────────────
// ADMIN: Get all vendors with pending payments
// GET /api/admin/payments/pending-vendors?month=YYYY-MM
// ────────────────────────────────────────────────────────────
export const getVendorsWithPendingPayments = async (req, res) => {
  try {
    const { month, week, period } = req.query;

    // Parse period parameter if provided
    const periodInfo = parsePeriodParameter(period || month);

    // Determine the filter value
    let filterValue = periodInfo.periodValue;
    let responseMonth = filterValue;

    // If week is explicitly provided, use it
    if (week) {
      filterValue = week;
      responseMonth = week; // Keep same field name for backward compatibility
    } else if (month) {
      filterValue = month;
      responseMonth = month;
    } else if (!period) {
      // Default to current month
      filterValue = new Date().toISOString().slice(0, 7);
      responseMonth = filterValue;
    }

    const summaries = await VendorMonthlyPayment.find({
      month: filterValue, // month field now stores both month and week values
      amountPending: { $gt: 0 }
    })
      .populate('vendorId', 'businessName name email phone')
      .sort({ amountPending: -1 })
      .lean();

    const totalPending = summaries.reduce((s, m) => s + (m.amountPending || 0), 0);

    return res.status(200).json({
      success: true,
      month: responseMonth, // Keep field name same but now can be week too
      periodType: periodInfo.periodType || (week ? 'weekly' : 'monthly'),
      summary: {
        totalPending: parseFloat(totalPending.toFixed(2)),
        vendorCount: summaries.length,
        currency: 'USD'
      },
      data: summaries.map(s => ({
        vendorId: s.vendorId?._id,
        vendorDetails: {
          businessName: s.vendorId?.businessName || 'N/A',
          name: s.vendorId?.name || 'N/A',
          email: s.vendorId?.email || 'N/A',
          phone: s.vendorId?.phone || 'N/A'
        },
        paymentSummary: {
          month: s.month, // This will now show the week value too
          totalCouponsClaimed: s.totalCouponsClaimed,
          totalAmount: parseFloat((s.totalAmount || 0).toFixed(2)),
          amountPaid: parseFloat((s.amountPaid || 0).toFixed(2)),
          amountPending: parseFloat((s.amountPending || 0).toFixed(2)),
          paymentStatus: s.paymentStatus,
          lastUpdated: s.lastUpdated
        }
      }))
    });

  } catch (error) {
    console.error('getVendorsWithPendingPayments error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};



export const getAllPaymentsAdmin = async (req, res) => {
  try {
    const { vendorId, paymentStatus, paymentMethod, month, week, period, page = 1, limit = 20 } = req.query;

    // Parse period
    const periodInfo = parsePeriodParameter(period || month || week);

    const filter = {};

    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      filter.vendorId = new mongoose.Types.ObjectId(vendorId);
    }
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Apply period filter
    if (periodInfo.periodValue) {
      filter.month = periodInfo.periodValue;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await PaymentRecord.countDocuments(filter);

    const payments = await PaymentRecord.find(filter)
      .populate('vendorId', 'businessName name email phone')
      .populate('userId', 'name email')
      .populate('couponId', 'name couponCode discountPercentage')
      .sort({ claimedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const [agg] = await PaymentRecord.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$pricePerCoupon' },
          totalRecords: { $sum: 1 },
          pendingAmount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, '$pricePerCoupon', 0] } },
          paidAmount: { $sum: { $cond: [{ $in: ['$paymentStatus', ['paid', 'verified']] }, '$pricePerCoupon', 0] } }
        }
      }
    ]) || [{}];

    return res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        },
        summary: {
          totalAmount: parseFloat((agg?.totalAmount || 0).toFixed(2)),
          totalRecords: agg?.totalRecords || 0,
          pendingAmount: parseFloat((agg?.pendingAmount || 0).toFixed(2)),
          paidAmount: parseFloat((agg?.paidAmount || 0).toFixed(2))
        },
        periodInfo: {
          type: periodInfo.periodType,
          value: periodInfo.periodValue
        }
      }
    });

  } catch (error) {
    console.error('getAllPaymentsAdmin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ────────────────────────────────────────────────────────────
// ADMIN: Get all PENDING payments
// GET /api/admin/payments/pending?vendorId=&month=&page=&limit=
// ────────────────────────────────────────────────────────────
export const getPendingPaymentsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20, vendorId, month, week, period } = req.query;

    const periodInfo = parsePeriodParameter(period || month || week);

    const query = { paymentStatus: 'pending' };

    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      query.vendorId = new mongoose.Types.ObjectId(vendorId);
    }
    if (periodInfo.periodValue) {
      query.month = periodInfo.periodValue;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await PaymentRecord.find(query)
      .populate('vendorId', 'businessName businessLogo email phone')
      .populate('userId', 'name phone')
      .sort({ claimedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await PaymentRecord.countDocuments(query);

    const summary = await PaymentRecord.aggregate([
      { $match: query },
      {
        $group: {
          _id: { vendorId: '$vendorId', month: '$month' },
          totalAmount: { $sum: '$pricePerCoupon' },
          couponCount: { $sum: 1 },
          vendorName: { $first: '$vendorName' }
        }
      },
      { $sort: { '_id.month': -1 } }
    ]);

    return res.status(200).json({
      success: true,
      payments,
      summary,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      },
      periodInfo: {
        type: periodInfo.periodType,
        value: periodInfo.periodValue
      }
    });

  } catch (error) {
    console.error('getPendingPaymentsAdmin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

export const getPaidPaymentsAdmin = async (req, res) => {
  try {
    const { vendorId, month, week, period, paymentMethod, page = 1, limit = 20 } = req.query;

    const periodInfo = parsePeriodParameter(period || month || week);

    const filter = { paymentStatus: { $in: ['paid', 'verified'] } };

    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      filter.vendorId = new mongoose.Types.ObjectId(vendorId);
    }
    if (periodInfo.periodValue) {
      filter.month = periodInfo.periodValue;
    }
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await PaymentRecord.countDocuments(filter);

    const paidPayments = await PaymentRecord.find(filter)
      .populate('vendorId', 'businessName name email phone')
      .populate('userId', 'name email')
      .populate('couponId', 'name couponCode discountPercentage')
      .sort({ claimedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const [agg] = await PaymentRecord.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$pricePerCoupon' },
          totalRecords: { $sum: 1 },
          cashRevenue: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$pricePerCoupon', 0] } },
          onlineRevenue: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'online'] }, '$pricePerCoupon', 0] } }
        }
      }
    ]) || [{}];

    const monthly = await PaymentRecord.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$month',
          month: { $first: '$month' },
          totalAmount: { $sum: '$pricePerCoupon' },
          totalRecords: { $sum: 1 },
          vendorsCount: { $addToSet: '$vendorId' }
        }
      },
      { $sort: { month: -1 } }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        paidPayments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        },
        summary: {
          totalAmount: parseFloat((agg?.totalAmount || 0).toFixed(2)),
          totalRecords: agg?.totalRecords || 0,
          cashRevenue: parseFloat((agg?.cashRevenue || 0).toFixed(2)),
          onlineRevenue: parseFloat((agg?.onlineRevenue || 0).toFixed(2)),
          averagePayment: (agg?.totalRecords || 0) > 0 ? parseFloat(((agg.totalAmount || 0) / agg.totalRecords).toFixed(2)) : 0
        },
        monthlyBreakdown: monthly.map(m => ({
          month: m.month,
          totalAmount: parseFloat(m.totalAmount.toFixed(2)),
          totalRecords: m.totalRecords,
          vendorsCount: m.vendorsCount?.length || 0
        })),
        periodInfo: {
          type: periodInfo.periodType,
          value: periodInfo.periodValue
        }
      }
    });

  } catch (error) {
    console.error('getPaidPaymentsAdmin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// In AdminController.js - Make sure you have only ONE declaration of updateMonthlyPaymentSummary

// PATCH /api/admin/offline/:approvalId/review
// PATCH /api/admin/offline/:approvalId/review
export const reviewOfflinePayment = async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { action, adminNotes } = req.body;
    const adminId = req.admin?._id || req.user?._id;

    console.log('📥 Review Offline Payment Request:', {
      approvalId,
      action,
      adminNotes,
      adminId
    });

    // Validate action
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be 'approve' or 'reject'"
      });
    }

    // Validate approvalId
    if (!mongoose.Types.ObjectId.isValid(approvalId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid approval ID format'
      });
    }

    // Find the approval request
    const approval = await CashPaymentApproval.findById(approvalId)
      .populate('vendorId', 'businessName name email phone');

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approval request not found'
      });
    }

    // Check if already reviewed
    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Request is already ${approval.status}`
      });
    }

    // Update approval status
    approval.status = action === 'approve' ? 'approved' : 'rejected';
    approval.adminNotes = adminNotes || '';
    approval.reviewedAt = new Date();
    if (adminId) approval.reviewedBy = adminId;

    await approval.save();

    // If approved, update the related payment records
    if (action === 'approve') {
      console.log('✅ Approving payment for records:', approval.recordIds);

      // Update payment records to paid
      const updateResult = await PaymentRecord.updateMany(
        {
          _id: { $in: approval.recordIds || [] },
          paymentStatus: 'pending'
        },
        {
          $set: {
            paymentStatus: 'paid',
            paymentMethod: 'offline',
            paidAt: new Date(),
            transactionId: `OFFLINE-${approval._id}`,
            paymentDetails: {
              approvalId: approval._id,
              amountUSD: approval.amountUSD,
              amountINR: approval.amountINR,
              paymentMode: 'offline',
              verifiedByAdmin: true,
              adminNotes: adminNotes || '',
              periodType: approval.periodType,
              month: approval.month,
              reviewedBy: adminId,
              reviewedAt: new Date()
            }
          }
        }
      );

      console.log(`✅ Updated ${updateResult.modifiedCount} payment records`);

      // ========== CRITICAL FIX: Update VendorMonthlyPayment ==========
      // Get all payment records for this vendor and month to recalculate
      const vendorObjectId = new mongoose.Types.ObjectId(approval.vendorId);

      // Get ALL records for this month (not just the approved ones)
      const allMonthRecords = await PaymentRecord.find({
        vendorId: vendorObjectId,
        month: approval.month
      });

      console.log(`📊 Found ${allMonthRecords.length} total records for month ${approval.month}`);

      // Calculate totals
      let totalAmount = 0;
      let amountPaid = 0;
      let amountPending = 0;

      // Get current price
      const priceConfig = await PaymentConfig.findOne({ isActive: true });
      const currentPrice = priceConfig?.pricePerCoupon || 1.0;

      allMonthRecords.forEach(record => {
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
      if (allMonthRecords.length === 0) {
        paymentStatus = 'pending';
      } else if (amountPending <= 0 && totalAmount > 0) {
        paymentStatus = 'fully_paid';
      } else if (amountPaid > 0) {
        paymentStatus = 'partially_paid';
      }

      // Update or create monthly summary
      const updatedSummary = await VendorMonthlyPayment.findOneAndUpdate(
        { vendorId: vendorObjectId, month: approval.month },
        {
          vendorId: vendorObjectId,
          month: approval.month,
          totalCouponsClaimed: allMonthRecords.length,
          totalAmount: parseFloat(totalAmount.toFixed(2)),
          amountPaid: parseFloat(amountPaid.toFixed(2)),
          amountPending: parseFloat(amountPending.toFixed(2)),
          paymentStatus,
          lastUpdated: new Date()
        },
        {
          upsert: true,
          new: true
        }
      );

      console.log(`✅ Monthly summary updated:`, {
        month: approval.month,
        totalRecords: allMonthRecords.length,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        amountPaid: parseFloat(amountPaid.toFixed(2)),
        amountPending: parseFloat(amountPending.toFixed(2)),
        paymentStatus
      });

      // Also refresh all summaries to be safe
      await refreshVendorPaymentSummary(approval.vendorId);
    }

    // Send notification to vendor
    try {
      await Notification.create({
        vendorId: approval.vendorId,
        vendorName: approval.vendorName,
        title: action === 'approve' ? '✅ Offline Payment Approved' : '❌ Offline Payment Rejected',
        message: action === 'approve'
          ? `Your offline payment of $${approval.amountUSD} for ${approval.periodLabel || approval.month} has been approved.`
          : `Your offline payment request for ${approval.periodLabel || approval.month} was rejected. ${adminNotes ? 'Reason: ' + adminNotes : ''}`,
        type: 'payment',
        metadata: {
          approvalId: approval._id,
          periodType: approval.periodType,
          month: approval.month,
          periodLabel: approval.periodLabel,
          action,
          amountUSD: approval.amountUSD
        },
        isRead: false,
        createdAt: new Date()
      });
    } catch (notifyError) {
      console.error('Error sending notification:', notifyError);
    }

    // Success response
    return res.status(200).json({
      success: true,
      message: `Offline payment ${action}d successfully`,
      approval: {
        id: approval._id,
        status: approval.status,
        amountUSD: approval.amountUSD,
        amountINR: approval.amountINR,
        periodType: approval.periodType,
        month: approval.month,
        periodLabel: approval.periodLabel,
        reviewedAt: approval.reviewedAt,
        adminNotes: approval.adminNotes
      },
      summary: {
        month: approval.month,
        paymentStatus: action === 'approve' ? 'fully_paid' : 'pending',
        amountPaid: action === 'approve' ? approval.amountUSD : 0
      }
    });

  } catch (error) {
    console.error('reviewOfflinePayment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ========== ENSURE THIS HELPER FUNCTION EXISTS ==========
/**
 * Refresh all payment summaries for a vendor
 */
async function refreshVendorPaymentSummary(vendorId) {
  try {
    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

    // Get all unique months for this vendor
    const months = await PaymentRecord.distinct('month', {
      vendorId: vendorObjectId,
      month: { $exists: true, $ne: null }
    });

    console.log(`📅 Refreshing summaries for ${months.length} months`);

    // Get current price
    const priceConfig = await PaymentConfig.findOne({ isActive: true });
    const currentPrice = priceConfig?.pricePerCoupon || 1.0;

    // Update each month's summary
    for (const month of months) {
      const records = await PaymentRecord.find({
        vendorId: vendorObjectId,
        month: month
      });

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

      let paymentStatus = 'pending';
      if (records.length === 0) {
        paymentStatus = 'pending';
      } else if (amountPending <= 0 && totalAmount > 0) {
        paymentStatus = 'fully_paid';
      } else if (amountPaid > 0) {
        paymentStatus = 'partially_paid';
      }

      await VendorMonthlyPayment.findOneAndUpdate(
        { vendorId: vendorObjectId, month },
        {
          vendorId: vendorObjectId,
          month,
          totalCouponsClaimed: records.length,
          totalAmount: parseFloat(totalAmount.toFixed(2)),
          amountPaid: parseFloat(amountPaid.toFixed(2)),
          amountPending: parseFloat(amountPending.toFixed(2)),
          paymentStatus,
          lastUpdated: new Date()
        },
        { upsert: true }
      );

      console.log(`✅ Refreshed summary for ${month}: ${paymentStatus}`);
    }

    console.log(`✅ Refreshed all payment summaries for vendor ${vendorId}`);
  } catch (error) {
    console.error('refreshVendorPaymentSummary error:', error);
  }
}

/**
 * GET all offline payment requests with filtering
 * GET /api/admin/payments/offline-requests
 * 
 * Query Parameters:
 * - status: 'pending' | 'approved' | 'rejected' (optional)
 * - vendorId: specific vendor ID (optional)
 * - month: YYYY-MM or YYYY-WW format (optional)
 * - periodType: 'monthly' | 'weekly' (optional)
 * - page: page number (default: 1)
 * - limit: items per page (default: 20)
 * - sortBy: 'submittedAt' | 'amountUSD' | 'status' (default: 'submittedAt')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
 */
export const getOfflinePaymentRequests = async (req, res) => {
  try {
    const {
      status,
      vendorId,
      month,
      periodType,
      page = 1,
      limit = 20,
      sortBy = 'submittedAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('📋 Fetching offline payment requests with filters:', {
      status,
      vendorId,
      month,
      periodType,
      page,
      limit
    });

    // Build filter query
    const filter = {};

    // Filter by status
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }

    // Filter by vendor
    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      filter.vendorId = new mongoose.Types.ObjectId(vendorId);
    }

    // Filter by month/week
    if (month) {
      filter.month = month;
    }

    // Filter by period type
    if (periodType && ['monthly', 'weekly'].includes(periodType)) {
      filter.periodType = periodType;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute queries in parallel
    const [requests, totalCount, stats] = await Promise.all([
      // Get paginated requests
      CashPaymentApproval.find(filter)
        .populate('vendorId', 'businessName name email phone businessLogo')
        .populate('reviewedBy', 'name email')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),

      // Get total count
      CashPaymentApproval.countDocuments(filter),

      // Get statistics
      CashPaymentApproval.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmountUSD: { $sum: '$amountUSD' },
            totalAmountINR: { $sum: '$amountINR' },
            avgAmountUSD: { $avg: '$amountUSD' },
            pendingCount: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            approvedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            },
            monthlyCount: {
              $sum: { $cond: [{ $eq: ['$periodType', 'monthly'] }, 1, 0] }
            },
            weeklyCount: {
              $sum: { $cond: [{ $eq: ['$periodType', 'weekly'] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    // Format the response
    const formattedRequests = requests.map(request => ({
      id: request._id,
      vendor: request.vendorId ? {
        id: request.vendorId._id,
        businessName: request.vendorId.businessName,
        name: request.vendorId.name,
        email: request.vendorId.email,
        phone: request.vendorId.phone,
        logo: request.vendorId.businessLogo
      } : {
        id: request.vendorId,
        businessName: request.vendorName
      },
      amount: {
        USD: parseFloat(request.amountUSD.toFixed(2)),
        INR: request.amountINR
      },
      period: {
        type: request.periodType,
        month: request.month,
        label: request.periodLabel
      },
      status: request.status,
      description: request.description,
      paymentProof: request.paymentProof,
      recordCount: request.recordIds?.length || 0,
      submittedAt: request.submittedAt,
      reviewedAt: request.reviewedAt,
      reviewedBy: request.reviewedBy ? {
        id: request.reviewedBy._id,
        name: request.reviewedBy.name,
        email: request.reviewedBy.email
      } : null,
      adminNotes: request.adminNotes
    }));

    const statsData = stats[0] || {
      totalAmountUSD: 0,
      totalAmountINR: 0,
      avgAmountUSD: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      monthlyCount: 0,
      weeklyCount: 0
    };

    return res.status(200).json({
      success: true,
      message: 'Offline payment requests fetched successfully',
      data: {
        requests: formattedRequests,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          hasNextPage: skip + parseInt(limit) < totalCount,
          hasPrevPage: page > 1
        },
        stats: {
          totalAmount: {
            USD: parseFloat(statsData.totalAmountUSD.toFixed(2)),
            INR: statsData.totalAmountINR
          },
          averageAmount: {
            USD: parseFloat(statsData.avgAmountUSD.toFixed(2))
          },
          counts: {
            pending: statsData.pendingCount,
            approved: statsData.approvedCount,
            rejected: statsData.rejectedCount,
            total: statsData.pendingCount + statsData.approvedCount + statsData.rejectedCount
          },
          byPeriodType: {
            monthly: statsData.monthlyCount,
            weekly: statsData.weeklyCount
          }
        },
        filters: {
          applied: {
            status: status || 'all',
            vendorId: vendorId || 'all',
            month: month || 'all',
            periodType: periodType || 'all'
          },
          available: {
            statuses: ['pending', 'approved', 'rejected'],
            periodTypes: ['monthly', 'weekly']
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ getOfflinePaymentRequests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch offline payment requests',
      error: error.message
    });
  }
};

/**
 * GET single offline payment request by ID
 * GET /api/admin/payments/offline-requests/:approvalId
 */
export const getOfflinePaymentRequestById = async (req, res) => {
  try {
    const { approvalId } = req.params;

    console.log(`🔍 Fetching offline payment request: ${approvalId}`);

    if (!mongoose.Types.ObjectId.isValid(approvalId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid approval ID format'
      });
    }

    const request = await CashPaymentApproval.findById(approvalId)
      .populate('vendorId', 'businessName name email phone businessLogo address city state')
      .populate('reviewedBy', 'name email')
      .populate({
        path: 'recordIds',
        model: 'PaymentRecord',
        populate: {
          path: 'couponId',
          select: 'name couponCode discountPercentage category'
        }
      })
      .lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Offline payment request not found'
      });
    }

    // Format the response
    const formattedRequest = {
      id: request._id,
      vendor: request.vendorId ? {
        id: request.vendorId._id,
        businessName: request.vendorId.businessName,
        name: request.vendorId.name,
        email: request.vendorId.email,
        phone: request.vendorId.phone,
        logo: request.vendorId.businessLogo,
        address: request.vendorId.address,
        city: request.vendorId.city,
        state: request.vendorId.state
      } : {
        id: request.vendorId,
        businessName: request.vendorName
      },
      amount: {
        USD: parseFloat(request.amountUSD.toFixed(2)),
        INR: request.amountINR,
        formattedUSD: `$${request.amountUSD.toFixed(2)}`,
        formattedINR: `₹${request.amountINR.toLocaleString('en-IN')}`
      },
      period: {
        type: request.periodType,
        month: request.month,
        label: request.periodLabel,
        startDate: request.startDate,
        endDate: request.endDate
      },
      status: request.status,
      description: request.description,
      paymentProof: request.paymentProof,
      submittedAt: request.submittedAt,
      reviewedAt: request.reviewedAt,
      reviewedBy: request.reviewedBy ? {
        id: request.reviewedBy._id,
        name: request.reviewedBy.name,
        email: request.reviewedBy.email
      } : null,
      adminNotes: request.adminNotes,
      records: (request.recordIds || []).map(record => ({
        id: record._id,
        coupon: record.couponId ? {
          id: record.couponId._id,
          name: record.couponId.name,
          code: record.couponId.couponCode,
          discount: record.couponId.discountPercentage
        } : null,
        amount: record.pricePerCoupon,
        claimedAt: record.claimedAt,
        status: record.paymentStatus
      })),
      timeline: {
        submitted: request.submittedAt,
        reviewed: request.reviewedAt,
        age: request.reviewedAt
          ? Math.round((request.reviewedAt - request.submittedAt) / (1000 * 60 * 60 * 24))
          : Math.round((new Date() - request.submittedAt) / (1000 * 60 * 60 * 24))
      }
    };

    return res.status(200).json({
      success: true,
      message: 'Offline payment request fetched successfully',
      data: formattedRequest
    });

  } catch (error) {
    console.error('❌ getOfflinePaymentRequestById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch offline payment request',
      error: error.message
    });
  }
};

// ────────────────────────────────────────────────────────────
// ADMIN: Update single payment status
// PATCH /api/admin/payments/:paymentId/status
// Body: { action: 'verify_cash'|'mark_as_paid'|'reject_payment', paymentMethod?, paymentDate?, notes? }
// ────────────────────────────────────────────────────────────
export const updatePaymentStatusAdmin = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { action, paymentMethod, paymentDate, notes, transactionId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID'
      });
    }

    const payment = await PaymentRecord.findById(paymentId).populate('vendorId', 'businessName');
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    let updateData = {};
    let notifTitle = '';
    let notifMessage = '';

    switch (action) {
      case 'verify_cash':
        updateData = {
          paymentStatus: 'verified',
          verifiedBy: 'Admin',
          verificationDate: new Date(),
          notes: notes || 'Cash payment verified by admin',
          ...(paymentDate && { paidAt: new Date(paymentDate) })
        };
        notifTitle = '💵 Cash Payment Verified';
        notifMessage = `Your cash payment of $${payment.pricePerCoupon} has been verified by admin.`;
        break;

      case 'mark_as_paid':
        updateData = {
          paymentStatus: 'paid',
          paidAt: paymentDate ? new Date(paymentDate) : new Date(),
          paymentMethod: paymentMethod || payment.paymentMethod || 'manual',
          notes: notes || 'Marked as paid by admin',
          ...(transactionId && { transactionId })
        };
        notifTitle = '✅ Payment Marked as Paid';
        notifMessage = `Your payment of $${payment.pricePerCoupon} has been marked as paid.`;
        break;

      case 'reject_payment':
        updateData = {
          paymentStatus: 'pending',
          verificationDate: null,
          verifiedBy: null,
          notes: notes || 'Payment rejected by admin',
          rejectionReason: notes
        };
        notifTitle = '❌ Payment Rejected';
        notifMessage = `Your payment of $${payment.pricePerCoupon} was rejected. ${notes ? 'Reason: ' + notes : ''}`;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action. Use: 'verify_cash', 'mark_as_paid', 'reject_payment'"
        });
    }

    const updated = await PaymentRecord.findByIdAndUpdate(paymentId, updateData, { new: true });

    await updateMonthlyPaymentSummary(payment.vendorId._id, payment.month);

    await notifyVendor({
      vendorId: payment.vendorId._id,
      title: notifTitle,
      message: notifMessage,
      type: 'payment',
      metadata: { paymentId: payment._id, amount: payment.pricePerCoupon, action, month: payment.month }
    });

    return res.status(200).json({
      success: true,
      message: `Payment ${action.replace(/_/g, ' ')}d successfully`,
      data: {
        payment: updated,
        previousStatus: payment.paymentStatus,
        newStatus: updated.paymentStatus,
        month: payment.month,
        amount: payment.pricePerCoupon
      }
    });

  } catch (error) {
    console.error('updatePaymentStatusAdmin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


// ────────────────────────────────────────────────────────────
// ADMIN: Full revenue dashboard
// GET /api/admin/payments/revenue?period=monthly&month=YYYY-MM&vendorId=
// period options: today | weekly | monthly | yearly | custom
// ────────────────────────────────────────────────────────────
export const getAdminPaymentRevenue = async (req, res) => {
  try {
    const { 
      period = 'monthly', 
      month, 
      week, 
      year = new Date().getFullYear().toString() 
    } = req.query;

    // ── Determine period ──
    let periodType = 'monthly';
    let periodLabel = '';
    let monthFilter = null;

    if (week) {
      periodType = 'weekly';
      periodLabel = week;
      monthFilter = week;
    } else if (month) {
      periodType = 'monthly';
      periodLabel = month;
      monthFilter = month;
    } else if (period === 'weekly') {
      periodType = 'weekly';
      const now = new Date();
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 4 - (d.getDay() || 7));
      const yearStart = new Date(d.getFullYear(), 0, 1);
      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      periodLabel = `${now.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
      monthFilter = periodLabel;
    } else {
      periodType = 'monthly';
      periodLabel = new Date().toISOString().slice(0, 7);
      monthFilter = periodLabel;
    }

    const paidFilter    = { month: monthFilter, paymentStatus: { $in: ['paid', 'verified'] } };
    const pendingFilter = { month: monthFilter, paymentStatus: 'pending' };
    const allFilter     = { month: monthFilter };

    const exchangeRate = 83;

    // ── Run all aggregations in parallel ──
    const [
      revenueResult,
      pendingResult,
      monthlyTrend,
      vendorRevenue,       // NEW: per-vendor paid breakdown
      vendorPending,       // NEW: per-vendor pending breakdown
      vendorAllCoupons,    // NEW: per-vendor total coupons claimed
      topCouponsByVendor   // NEW: which coupons drove revenue
    ] = await Promise.all([

      // 1. Overall paid summary
      PaymentRecord.aggregate([
        { $match: paidFilter },
        {
          $group: {
            _id: null,
            totalRevenue:  { $sum: '$pricePerCoupon' },
            totalTxns:     { $sum: 1 },
            uniqueVendors: { $addToSet: '$vendorId' },
            cashRevenue:   { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] },   '$pricePerCoupon', 0] } },
            onlineRevenue: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'online'] }, '$pricePerCoupon', 0] } }
          }
        }
      ]),

      // 2. Overall pending summary
      PaymentRecord.aggregate([
        { $match: pendingFilter },
        {
          $group: {
            _id: null,
            totalPending:   { $sum: '$pricePerCoupon' },
            pendingTxns:    { $sum: 1 },
            pendingVendors: { $addToSet: '$vendorId' }
          }
        }
      ]),

      // 3. Last 12 months trend
      PaymentRecord.aggregate([
        { $match: { paymentStatus: { $in: ['paid', 'verified'] } } },
        {
          $group: {
            _id:     '$month',
            month:   { $first: '$month' },
            revenue: { $sum: '$pricePerCoupon' },
            txns:    { $sum: 1 },
            vendors: { $addToSet: '$vendorId' }
          }
        },
        { $sort: { month: -1 } },
        { $limit: 12 }
      ]),

      // 4. Per-vendor PAID revenue for this period
      PaymentRecord.aggregate([
        { $match: paidFilter },
        {
          $group: {
            _id:          '$vendorId',
            vendorName:   { $first: '$vendorName' },
            totalPaid:    { $sum: '$pricePerCoupon' },
            transactions: { $sum: 1 },
            cashPaid:     { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] },   '$pricePerCoupon', 0] } },
            onlinePaid:   { $sum: { $cond: [{ $eq: ['$paymentMethod', 'online'] }, '$pricePerCoupon', 0] } },
            lastPaidAt:   { $max: '$paidAt' },
            coupons:      { $addToSet: '$couponId' }
          }
        },
        {
          $lookup: {
            from:         'vendors',
            localField:   '_id',
            foreignField: '_id',
            as:           'vendorDetails'
          }
        },
        { $unwind: { path: '$vendorDetails', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            vendorId:     '$_id',
            businessName: { $ifNull: ['$vendorDetails.businessName', '$vendorName', 'Unknown Vendor'] },
            businessLogo: { $ifNull: ['$vendorDetails.businessLogo', ''] },
            email:        { $ifNull: ['$vendorDetails.email', ''] },
            phone:        { $ifNull: ['$vendorDetails.phone', ''] },
            category:     { $ifNull: ['$vendorDetails.category', ''] },
            totalPaid:    { $round: ['$totalPaid', 2] },
            transactions: 1,
            cashPaid:     { $round: ['$cashPaid', 2] },
            onlinePaid:   { $round: ['$onlinePaid', 2] },
            lastPaidAt:   1,
            uniqueCoupons: { $size: '$coupons' }
          }
        },
        { $sort: { totalPaid: -1 } }
      ]),

      // 5. Per-vendor PENDING for this period
      PaymentRecord.aggregate([
        { $match: pendingFilter },
        {
          $group: {
            _id:            '$vendorId',
            vendorName:     { $first: '$vendorName' },
            totalPending:   { $sum: '$pricePerCoupon' },
            pendingCoupons: { $sum: 1 },
            oldestClaim:    { $min: '$claimedAt' }
          }
        },
        {
          $lookup: {
            from:         'vendors',
            localField:   '_id',
            foreignField: '_id',
            as:           'vendorDetails'
          }
        },
        { $unwind: { path: '$vendorDetails', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            vendorId:       '$_id',
            businessName:   { $ifNull: ['$vendorDetails.businessName', '$vendorName', 'Unknown'] },
            businessLogo:   { $ifNull: ['$vendorDetails.businessLogo', ''] },
            email:          { $ifNull: ['$vendorDetails.email', ''] },
            phone:          { $ifNull: ['$vendorDetails.phone', ''] },
            totalPending:   { $round: ['$totalPending', 2] },
            pendingCoupons: 1,
            oldestClaim:    1
          }
        },
        { $sort: { totalPending: -1 } }
      ]),

      // 6. Per-vendor ALL coupons (paid + pending combined) for this period
      PaymentRecord.aggregate([
        { $match: allFilter },
        {
          $group: {
            _id:          '$vendorId',
            vendorName:   { $first: '$vendorName' },
            totalCoupons: { $sum: 1 },
            totalAmount:  { $sum: '$pricePerCoupon' },
            paidAmount:   { $sum: { $cond: [{ $in: ['$paymentStatus', ['paid', 'verified']] }, '$pricePerCoupon', 0] } },
            pendingAmount:{ $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] },           '$pricePerCoupon', 0] } },
            firstClaim:   { $min: '$claimedAt' },
            lastClaim:    { $max: '$claimedAt' }
          }
        },
        {
          $lookup: {
            from:         'vendors',
            localField:   '_id',
            foreignField: '_id',
            as:           'vendorDetails'
          }
        },
        { $unwind: { path: '$vendorDetails', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            vendorId:      '$_id',
            businessName:  { $ifNull: ['$vendorDetails.businessName', '$vendorName', 'Unknown'] },
            businessLogo:  { $ifNull: ['$vendorDetails.businessLogo', ''] },
            email:         { $ifNull: ['$vendorDetails.email', ''] },
            phone:         { $ifNull: ['$vendorDetails.phone', ''] },
            category:      { $ifNull: ['$vendorDetails.category', ''] },
            totalCoupons:  1,
            totalAmount:   { $round: ['$totalAmount',   2] },
            paidAmount:    { $round: ['$paidAmount',    2] },
            pendingAmount: { $round: ['$pendingAmount', 2] },
            collectionRate: {
              $cond: [
                { $gt: ['$totalAmount', 0] },
                { $round: [{ $multiply: [{ $divide: ['$paidAmount', '$totalAmount'] }, 100] }, 2] },
                0
              ]
            },
            paymentStatus: {
              $switch: {
                branches: [
                  { case: { $eq: ['$pendingAmount', 0] }, then: 'fully_paid' },
                  { case: { $gt: ['$paidAmount',    0] }, then: 'partially_paid' }
                ],
                default: 'pending'
              }
            },
            firstClaim: 1,
            lastClaim:  1
          }
        },
        { $sort: { totalAmount: -1 } }
      ]),

      // 7. Top revenue-generating coupons for this period
      PaymentRecord.aggregate([
        { $match: paidFilter },
        {
          $group: {
            _id:         '$couponId',
            couponName:  { $first: '$couponName' },
            couponCode:  { $first: '$couponCode' },
            vendorId:    { $first: '$vendorId' },
            vendorName:  { $first: '$vendorName' },
            totalEarned: { $sum: '$pricePerCoupon' },
            claimedCount:{ $sum: 1 }
          }
        },
        {
          $lookup: {
            from:         'coupons',
            localField:   '_id',
            foreignField: '_id',
            as:           'couponDetails'
          }
        },
        { $unwind: { path: '$couponDetails', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            couponId:    '$_id',
            couponName:  { $ifNull: ['$couponDetails.name', '$couponName', 'Unknown Coupon'] },
            couponCode:  { $ifNull: ['$couponDetails.couponCode', '$couponCode'] },
            couponImage: { $ifNull: ['$couponDetails.couponImage', ''] },
            discount:    { $ifNull: ['$couponDetails.discountPercentage', 0] },
            category:    { $ifNull: ['$couponDetails.category', ''] },
            vendorId:    1,
            vendorName:  1,
            totalEarned: { $round: ['$totalEarned', 2] },
            claimedCount: 1
          }
        },
        { $sort: { totalEarned: -1 } },
        { $limit: 10 }
      ])
    ]);

    // ── Unpack results ──
    const revenueAgg = revenueResult[0] || {
      totalRevenue: 0, totalTxns: 0, uniqueVendors: [],
      cashRevenue: 0, onlineRevenue: 0
    };
    const pendingAgg = pendingResult[0] || {
      totalPending: 0, pendingTxns: 0, pendingVendors: []
    };

    // ── Merge paid + pending into a single vendorBreakdown list ──
    const vendorMap = new Map();

    vendorAllCoupons.forEach(v => {
      vendorMap.set(v.vendorId.toString(), {
        vendorId:       v.vendorId,
        businessName:   v.businessName,
        businessLogo:   v.businessLogo,
        email:          v.email,
        phone:          v.phone,
        category:       v.category,
        totalCoupons:   v.totalCoupons,
        totalAmount:    v.totalAmount,
        paidAmount:     v.paidAmount,
        pendingAmount:  v.pendingAmount,
        collectionRate: v.collectionRate,
        paymentStatus:  v.paymentStatus,
        firstClaim:     v.firstClaim,
        lastClaim:      v.lastClaim,
        // payment method detail (filled below)
        cashPaid:   0,
        onlinePaid: 0,
        lastPaidAt: null
      });
    });

    // Enrich with payment method detail from vendorRevenue
    vendorRevenue.forEach(v => {
      const key = v.vendorId.toString();
      if (vendorMap.has(key)) {
        const existing = vendorMap.get(key);
        existing.cashPaid    = v.cashPaid;
        existing.onlinePaid  = v.onlinePaid;
        existing.lastPaidAt  = v.lastPaidAt;
        existing.uniqueCoupons = v.uniqueCoupons;
      }
    });

    const vendorBreakdown = Array.from(vendorMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // ── Revenue share % per vendor ──
    const grandTotal = revenueAgg.totalRevenue || 0;
    vendorBreakdown.forEach(v => {
      v.revenueSharePct = grandTotal > 0
        ? parseFloat(((v.paidAmount / grandTotal) * 100).toFixed(2))
        : 0;
    });

    return res.status(200).json({
      success: true,

      period: {
        type:  periodType,
        label: periodLabel,
        month: monthFilter,
        ...(periodType === 'weekly' && { week: monthFilter })
      },

      // ── Overall summary ──
      summary: {
        totalRevenue: {
          USD: parseFloat(revenueAgg.totalRevenue.toFixed(2)),
          INR: Math.round(revenueAgg.totalRevenue * exchangeRate)
        },
        totalTransactions: revenueAgg.totalTxns,
        uniqueVendors:     revenueAgg.uniqueVendors.length,
        averageTransaction: revenueAgg.totalTxns > 0
          ? parseFloat((revenueAgg.totalRevenue / revenueAgg.totalTxns).toFixed(2))
          : 0
      },

      breakdown: {
        cashRevenue:   parseFloat(revenueAgg.cashRevenue.toFixed(2)),
        onlineRevenue: parseFloat(revenueAgg.onlineRevenue.toFixed(2))
      },

      pending: {
        totalPending:        parseFloat(pendingAgg.totalPending.toFixed(2)),
        pendingTransactions: pendingAgg.pendingTxns,
        pendingVendors:      pendingAgg.pendingVendors.length
      },

      // ── Per-vendor revenue details (the new section) ──
      vendorRevenue: {
        count: vendorBreakdown.length,
        breakdown: vendorBreakdown.map(v => ({
          vendorId:      v.vendorId,
          businessName:  v.businessName,
          businessLogo:  v.businessLogo,
          email:         v.email,
          phone:         v.phone,
          category:      v.category,
          coupons: {
            total:   v.totalCoupons,
            unique:  v.uniqueCoupons || v.totalCoupons,
            first:   v.firstClaim,
            last:    v.lastClaim
          },
          revenue: {
            total:   v.totalAmount,
            paid:    v.paidAmount,
            pending: v.pendingAmount,
            cash:    v.cashPaid,
            online:  v.onlinePaid,
            INR: {
              total:   Math.round(v.totalAmount   * exchangeRate),
              paid:    Math.round(v.paidAmount    * exchangeRate),
              pending: Math.round(v.pendingAmount * exchangeRate)
            }
          },
          paymentStatus:  v.paymentStatus,
          collectionRate: v.collectionRate,
          revenueSharePct: v.revenueSharePct,
          lastPaidAt:     v.lastPaidAt
        })),

        // Vendors still unpaid this period
        unpaidVendors: vendorPending.map(v => ({
          vendorId:       v.vendorId,
          businessName:   v.businessName,
          businessLogo:   v.businessLogo,
          email:          v.email,
          phone:          v.phone,
          totalPending:   v.totalPending,
          pendingCoupons: v.pendingCoupons,
          pendingINR:     Math.round(v.totalPending * exchangeRate),
          oldestClaim:    v.oldestClaim,
          daysPending: v.oldestClaim
            ? Math.floor((new Date() - new Date(v.oldestClaim)) / (1000 * 60 * 60 * 24))
            : null
        }))
      },

      // ── Top revenue coupons ──
      topCoupons: topCouponsByVendor.map(c => ({
        couponId:     c.couponId,
        couponName:   c.couponName,
        couponCode:   c.couponCode,
        couponImage:  c.couponImage,
        discount:     c.discount,
        category:     c.category,
        vendorId:     c.vendorId,
        vendorName:   c.vendorName,
        totalEarned:  c.totalEarned,
        claimedCount: c.claimedCount,
        earnedINR:    Math.round(c.totalEarned * exchangeRate)
      })),

      trends: {
        monthly: monthlyTrend
          .reverse()
          .map(m => ({
            month:   m.month,
            revenue: parseFloat(m.revenue.toFixed(2)),
            txns:    m.txns,
            vendors: m.vendors?.length || 0
          }))
      }
    });

  } catch (error) {
    console.error('getAdminPaymentRevenue error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


// GET /api/admin/payments/offline-requests
export const getAllOfflinePaymentRequests = async (req, res) => {
  try {
    const { status, vendorId, month, periodType, page = 1, limit = 20 } = req.query;

    const query = {};

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      query.vendorId = new mongoose.Types.ObjectId(vendorId);
    }

    if (month) {
      query.month = month;
    }

    if (periodType && ['monthly', 'weekly'].includes(periodType)) {
      query.periodType = periodType;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await CashPaymentApproval.countDocuments(query);

    const requests = await CashPaymentApproval.find(query)
      .populate('vendorId', 'businessName name email phone')
      .populate('reviewedBy', 'name email')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Calculate stats
    const [stats] = await CashPaymentApproval.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmountUSD: { $sum: '$amountUSD' },
          totalRequests: { $sum: 1 },
          pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          approvedCount: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          rejectedCount: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
        }
      }
    ]) || [{}];

    // Response payload
    return res.status(200).json({
      success: true,
      data: {
        requests: requests.map(r => ({
          id: r._id,
          vendor: {
            id: r.vendorId?._id || r.vendorId,
            businessName: r.vendorId?.businessName || r.vendorName,
            email: r.vendorId?.email,
            phone: r.vendorId?.phone
          },
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
        })),
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        },
        stats: {
          totalAmountUSD: parseFloat((stats?.totalAmountUSD || 0).toFixed(2)),
          totalRequests: stats?.totalRequests || 0,
          pendingCount: stats?.pendingCount || 0,
          approvedCount: stats?.approvedCount || 0,
          rejectedCount: stats?.rejectedCount || 0
        }
      }
    });

  } catch (error) {
    console.error('getAllOfflinePaymentRequests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ────────────────────────────────────────────────────────────
// ADMIN: Monthly revenue summary for a year
// GET /api/admin/payments/monthly-summary?year=2025
// ────────────────────────────────────────────────────────────
export const getRevenueSummary = async (req, res) => {
  try {
    const {
      type = 'monthly',      // 'daily', 'weekly', 'monthly', 'yearly', 'custom'
      startDate,             // required for 'custom' and 'daily'
      endDate,               // required for 'custom'
      year = new Date().getFullYear().toString(),
      month,                 // for specific month (YYYY-MM) or week (YYYY-WW)
      week,                  // week number (1-52) or YYYY-WW format
      vendorId               // optional filter
    } = req.query;

    console.log(`📊 Generating ${type} revenue summary`);

    // Handle week parameter
    let targetWeek = week;
    let targetYear = year;
    let targetMonth = month;

    // If week is provided in YYYY-WW format
    if (week && week.includes('-W')) {
      const [wYear, wWeek] = week.split('-W');
      targetYear = wYear;
      targetWeek = wWeek;
      targetMonth = week; // Store full week identifier
    }

    // Build match filter
    const matchFilter = {};

    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      matchFilter.vendorId = new mongoose.Types.ObjectId(vendorId);
    }

    let dateRange = {};
    let groupBy = {};
    let responseData = [];

    // ========== DAILY SUMMARY ==========
    if (type === 'daily') {
      // ... existing daily code (no changes needed) ...
    }

    // ========== WEEKLY SUMMARY ==========
    else if (type === 'weekly') {
      const weeks = [];

      // If specific week requested
      if (targetWeek && targetYear) {
        // Handle YYYY-WW format or just week number
        const weekId = targetMonth || `${targetYear}-W${targetWeek}`;

        dateFilter = { month: weekId };

        const weekData = await PaymentRecord.aggregate([
          { $match: { ...matchFilter, ...dateFilter } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$pricePerCoupon' },
              totalCoupons: { $sum: 1 },
              paidAmount: {
                $sum: {
                  $cond: [
                    { $in: ['$paymentStatus', ['paid', 'verified']] },
                    '$pricePerCoupon',
                    0
                  ]
                }
              },
              pendingAmount: {
                $sum: {
                  $cond: [
                    { $eq: ['$paymentStatus', 'pending'] },
                    '$pricePerCoupon',
                    0
                  ]
                }
              },
              uniqueVendors: { $addToSet: '$vendorId' }
            }
          }
        ]);

        const data = weekData[0] || {
          totalRevenue: 0,
          totalCoupons: 0,
          paidAmount: 0,
          pendingAmount: 0,
          uniqueVendors: []
        };

        // Get date range for display
        const weekStart = getWeekStartDate(parseInt(targetYear), parseInt(targetWeek));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        weeks.push({
          weekNumber: parseInt(targetWeek),
          weekId,
          startDate: weekStart,
          endDate: weekEnd,
          totalRevenue: parseFloat(data.totalRevenue.toFixed(2)),
          totalCoupons: data.totalCoupons,
          paidAmount: parseFloat(data.paidAmount.toFixed(2)),
          pendingAmount: parseFloat(data.pendingAmount.toFixed(2)),
          uniqueVendors: data.uniqueVendors.length,
          collectionRate: data.totalRevenue > 0
            ? parseFloat(((data.paidAmount / data.totalRevenue) * 100).toFixed(2))
            : 0
        });

        return res.status(200).json({
          success: true,
          type: 'weekly',
          year: targetYear,
          week: parseInt(targetWeek),
          weeks
        });
      }

      // Otherwise get last 4/8/12 weeks
      const weeksToShow = parseInt(req.query.weeks) || 8;
      const now = new Date();

      for (let i = 0; i < weeksToShow; i++) {
        const weekDate = new Date(now);
        weekDate.setDate(now.getDate() - (7 * i));

        const weekNumber = getWeekNumber(weekDate);
        const weekYear = weekDate.getFullYear();
        const weekId = `${weekYear}-W${weekNumber}`;

        const weekData = await PaymentRecord.aggregate([
          {
            $match: {
              ...matchFilter,
              month: weekId
            }
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$pricePerCoupon' },
              totalCoupons: { $sum: 1 },
              paidAmount: {
                $sum: {
                  $cond: [
                    { $in: ['$paymentStatus', ['paid', 'verified']] },
                    '$pricePerCoupon',
                    0
                  ]
                }
              },
              pendingAmount: {
                $sum: {
                  $cond: [
                    { $eq: ['$paymentStatus', 'pending'] },
                    '$pricePerCoupon',
                    0
                  ]
                }
              },
              uniqueVendors: { $addToSet: '$vendorId' }
            }
          }
        ]);

        const data = weekData[0] || {
          totalRevenue: 0,
          totalCoupons: 0,
          paidAmount: 0,
          pendingAmount: 0,
          uniqueVendors: []
        };

        const weekStart = getWeekStartDate(weekYear, weekNumber);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        weeks.push({
          weekNumber: i === 0 ? 'Current' : `${i} week${i > 1 ? 's' : ''} ago`,
          weekId,
          startDate: weekStart,
          endDate: weekEnd,
          totalRevenue: parseFloat(data.totalRevenue.toFixed(2)),
          totalCoupons: data.totalCoupons,
          paidAmount: parseFloat(data.paidAmount.toFixed(2)),
          pendingAmount: parseFloat(data.pendingAmount.toFixed(2)),
          uniqueVendors: data.uniqueVendors.length,
          collectionRate: data.totalRevenue > 0
            ? parseFloat(((data.paidAmount / data.totalRevenue) * 100).toFixed(2))
            : 0
        });
      }

      return res.status(200).json({
        success: true,
        type: 'weekly',
        weeks: weeks.reverse()
      });
    }

    // ========== CUSTOM DATE RANGE ==========
    else if (type === 'custom') {
      // ... existing custom code (no changes needed) ...
    }

    // ========== YEARLY SUMMARY ==========
    else if (type === 'yearly') {
      // ... existing yearly code (no changes needed) ...
    }

    // ========== MONTHLY SUMMARY (DEFAULT) ==========
    else {
      // Check if we're dealing with a week
      if (targetMonth && targetMonth.includes('-W')) {
        // Handle weekly summary in monthly endpoint
        const weekData = await PaymentRecord.aggregate([
          {
            $match: {
              ...matchFilter,
              month: targetMonth
            }
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$pricePerCoupon' },
              totalCoupons: { $sum: 1 },
              paidAmount: {
                $sum: {
                  $cond: [
                    { $in: ['$paymentStatus', ['paid', 'verified']] },
                    '$pricePerCoupon',
                    0
                  ]
                }
              },
              pendingAmount: {
                $sum: {
                  $cond: [
                    { $eq: ['$paymentStatus', 'pending'] },
                    '$pricePerCoupon',
                    0
                  ]
                }
              },
              uniqueVendors: { $addToSet: '$vendorId' }
            }
          }
        ]);

        const data = weekData[0] || {
          totalRevenue: 0,
          totalCoupons: 0,
          paidAmount: 0,
          pendingAmount: 0,
          uniqueVendors: []
        };

        return res.status(200).json({
          success: true,
          type: 'weekly',
          week: targetMonth,
          summary: {
            totalRevenue: parseFloat(data.totalRevenue.toFixed(2)),
            totalCoupons: data.totalCoupons,
            paidAmount: parseFloat(data.paidAmount.toFixed(2)),
            pendingAmount: parseFloat(data.pendingAmount.toFixed(2)),
            uniqueVendors: data.uniqueVendors.length,
            collectionRate: data.totalRevenue > 0
              ? parseFloat(((data.paidAmount / data.totalRevenue) * 100).toFixed(2))
              : 0
          },
          currency: 'USD'
        });
      }

      // ... rest of existing monthly code ...
    }

  } catch (error) {
    console.error('getRevenueSummary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Helper function for weekly calculations
function getWeekStartDate(year, week) {
  const firstDayOfYear = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7;
  const weekStart = new Date(firstDayOfYear);
  weekStart.setDate(firstDayOfYear.getDate() + daysOffset);

  // Adjust to Monday
  const dayOfWeek = weekStart.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0);

  return weekStart;
}

// ────────────────────────────────────────────────────────────
// ADMIN: Vendor payment history
// GET /api/admin/payments/vendor/:vendorId/history?startMonth=&endMonth=
// ────────────────────────────────────────────────────────────
export const getVendorPaymentHistory = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { startMonth, endMonth } = req.query;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor ID'
      });
    }

    const vendor = await Vendor.findById(vendorId).select('businessName name email');
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const filter = { vendorId: new mongoose.Types.ObjectId(vendorId) };

    if (startMonth || endMonth) {
      filter.month = {};
      if (startMonth) filter.month.$gte = startMonth;
      if (endMonth) filter.month.$lte = endMonth;
    }

    const history = await VendorMonthlyPayment.find(filter)
      .sort({ month: -1 })
      .limit(24)
      .lean();

    const allTime = history.reduce(
      (acc, h) => ({
        totalAmount: acc.totalAmount + (h.totalAmount || 0),
        amountPaid: acc.amountPaid + (h.amountPaid || 0),
        amountPending: acc.amountPending + (h.amountPending || 0),
        totalCoupons: acc.totalCoupons + (h.totalCouponsClaimed || 0)
      }),
      { totalAmount: 0, amountPaid: 0, amountPending: 0, totalCoupons: 0 }
    );

    return res.status(200).json({
      success: true,
      vendor: {
        id: vendor._id,
        businessName: vendor.businessName,
        name: vendor.name,
        email: vendor.email
      },
      allTimeSummary: {
        totalAmount: parseFloat(allTime.totalAmount.toFixed(2)),
        amountPaid: parseFloat(allTime.amountPaid.toFixed(2)),
        amountPending: parseFloat(allTime.amountPending.toFixed(2)),
        totalCoupons: allTime.totalCoupons,
        collectionRate: allTime.totalAmount > 0
          ? parseFloat(((allTime.amountPaid / allTime.totalAmount) * 100).toFixed(2))
          : 0
      },
      history: history.map(h => ({
        month: h.month,
        totalCoupons: h.totalCouponsClaimed,
        totalAmount: parseFloat((h.totalAmount || 0).toFixed(2)),
        amountPaid: parseFloat((h.amountPaid || 0).toFixed(2)),
        amountPending: parseFloat((h.amountPending || 0).toFixed(2)),
        paymentStatus: h.paymentStatus,
        lastUpdated: h.lastUpdated
      })),
      count: history.length
    });

  } catch (error) {
    console.error('getVendorPaymentHistory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// CREATE OR UPDATE
export const upsertReferralSettings = async (req, res) => {
  try {
    const {
      referredUserCoupons,
      referrerUserCoupons,
      registrationCoupons,
      isReferralEnabled
    } = req.body;

    let config = await SystemConfig.findOne();

    if (!config) {
      config = new SystemConfig({
        referralSettings: {
          referredUserCoupons,
          referrerUserCoupons,
          registrationCoupons,
          isReferralEnabled
        }
      });
    } else {
      config.referralSettings = {
        referredUserCoupons,
        referrerUserCoupons,
        registrationCoupons,
        isReferralEnabled
      };
      config.updatedAt = new Date();
    }

    await config.save();

    return res.status(200).json({
      success: true,
      referralSettings: config.referralSettings,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      _id: config._id
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET (for admin panel only)
export const getReferralSettings = async (req, res) => {
  try {
    const config = await SystemConfig.findOne().lean();

    if (!config?.referralSettings) {
      return res.status(200).json({
        success: true,
        referralSettings: null,
        exists: false
      });
    }

    return res.status(200).json({
      success: true,
      referralSettings: config.referralSettings,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      exists: true
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};