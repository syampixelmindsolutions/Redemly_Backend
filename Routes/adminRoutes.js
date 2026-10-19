import express from 'express';
import { registerAdmin, loginAdmin, getUserById, getAllVendors, getVendorById,getAllPendingVendors,approveVendor, rejectVendor,updateCouponStatus, deleteCoupon, createCouponByAdmin,createBulkCouponsByAdmin, createCategory, getCategories, updateCategory, deleteCategory, addBulkQuizzes, getAllQuizzes, addBulkFunFacts, getAllFunFacts, generateFunFacts,deleteFunFact,deleteBulkFunFacts, generateQuizzes,deleteQuiz,deleteBulkQuizzes,generateNews, getAllUsersWithCoupons, getCouponUsageHistory, getCouponRedemptionReport, getDashboardStats, savePrivacyPolicy, getPrivacyPolicy, updatePrivacyPolicy, deletePrivacyPolicy, updateUserById, deleteUserById, updateVendor, deleteVendor, getAllVendorDocuments, getAllNotifications,markAdminNotificationAsRead,markAllAdminNotificationsAsRead, deleteNotificationById, getQuizQuestions, createSpinReward, setDailySpinLimit,getAdminNotificationStats  ,
  createBanner,
  getAllBanners,
  getBannerById,
  updateBanner,
  toggleBannerStatus,
  getActiveBannersForApp,
  deleteBanner,
  getDailySpinLimit,
  setPricePerCoupon,
  getCurrentPrice,
  getVendorsWithPendingPayments,
  getAllPaymentsAdmin,
  getPendingPaymentsAdmin,
  getPaidPaymentsAdmin,
  reviewOfflinePayment,
  getOfflinePaymentRequests,
  getOfflinePaymentRequestById,
  updatePaymentStatusAdmin,
  getAdminPaymentRevenue,
  getAllOfflinePaymentRequests,
  getRevenueSummary,
  getVendorPaymentHistory,
 
  upsertReferralSettings,
  getReferralSettings,

} from '../Controller/AdminController.js';
import {    createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
  changeStaffPassword,
  staffLogin,
  getStaffProfile,
  staffChangeOwnPassword,
  updateStaffProfile,
  uploadStaffImage} from '../Controller/StaffController.js';
import uploads from "../middlewares/upload.js";
import { getAllUsers } from '../Controller/AdminController.js';
import { getAllCoupons } from '../Controller/AdminController.js';
import { getCouponHistory } from '../Controller/UserController.js';
// REMOVED the authMiddleware imports since they're not being used
// import { verifyAdminToken, verifyStaffToken } from '../Middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerAdmin);
router.post('/login', loginAdmin);
router.get('/getallusers', getAllUsers);
router.get('/getsingleuser/:userId', getUserById);
router.get('/getvendors', getAllVendors);
router.get('/getvendor/:id', getVendorById);   
router.get("/vendors/pending", getAllPendingVendors);
router.put("/vendors/approve/:vendorId", approveVendor);
router.delete("/vendors/reject/:vendorId", rejectVendor);
router.get('/getallcoupons', getAllCoupons);
router.put('/updatecouponstatus/:id', updateCouponStatus);
router.delete('/deletecoupon/:id', deleteCoupon);
router.post('/createcouponbyadmin', createCouponByAdmin);
router.post("/bulk-create-coupons", createBulkCouponsByAdmin);

router.post('/create-categories', createCategory);
router.get('/categories', getCategories);
router.put('/update-categories/:id', updateCategory);
router.delete('/delete-categories/:id', deleteCategory);
router.post('/add-bulkquizzes', addBulkQuizzes);
router.get('/getallquizes', getAllQuizzes);
router.post('/add-bulkfunfacts', addBulkFunFacts);
router.get('/getallfunfacts', getAllFunFacts);
router.get('/generate-funfacts', generateFunFacts);
router.delete('/delete-funfact/:id', deleteFunFact);
router.post('/delete-funfacts-bulk', deleteBulkFunFacts);

router.get('/generate-quizzes', generateQuizzes);
router.delete('/delete-quiz/:id', deleteQuiz);
router.post('/delete-quizzes-bulk', deleteBulkQuizzes);
router.get('/generate-news', generateNews);
router.get('/getalluserscoupons', getAllUsersWithCoupons);
router.get('/userusage-couponhistory', getCouponUsageHistory);
router.get('/userredeemedcouponhistory', getCouponRedemptionReport);
router.get('/dashboard', getDashboardStats);
router.post("/createprivacy-policy", savePrivacyPolicy);
router.get("/privacy-policy", getPrivacyPolicy);
router.put("/privacy-policy/:id", updatePrivacyPolicy);
router.delete("/privacy-policy/:id", deletePrivacyPolicy);
router.put('/updateusers/:userId', updateUserById);
router.delete('/deleteusers/:userId', deleteUserById);
router.put('/updatevendor/:vendorId', updateVendor);
router.delete('/deletevendor/:vendorId', deleteVendor);
router.get('/allvendordocs', getAllVendorDocuments);
router.get('/notifications', getAllNotifications);

router.put('/notifications/mark-all-read', markAllAdminNotificationsAsRead);
router.put('/notifications/:notificationId/read', markAdminNotificationAsRead);
router.delete('/notifications/:id', deleteNotificationById);
router.get('/quiz-questions', getQuizQuestions);
router.post('/createspin-reward', createSpinReward);

router.post("/spin-limit", setDailySpinLimit);
router.get('/notifications/stats', getAdminNotificationStats);

router.post("/banner", uploads, createBanner);
router.get("/banners", getAllBanners);
router.get("/get/:id", getBannerById);
router.put("/update/:id", uploads, updateBanner);
router.patch('/banners/:bannerId/images/:imageId/toggle', toggleBannerStatus);
router.get('/app/active', getActiveBannersForApp);  
router.delete("/banner/:id", deleteBanner);

router.get("/getallspin", getDailySpinLimit);

// Pricing
router.post('/set-price', setPricePerCoupon);
router.get('/price', getCurrentPrice);

// Pending vendors
router.get('/pending-vendors', getVendorsWithPendingPayments);

// All payments (filterable)
router.get('/all-payments', getAllPaymentsAdmin);
router.get('/pending', getPendingPaymentsAdmin);
router.get('/paid', getPaidPaymentsAdmin);

// Update single payment status
router.patch('/:paymentId/status', updatePaymentStatusAdmin);

// Offline payment approval flow
router.get('/offline-requests', getAllOfflinePaymentRequests);
router.patch('/offline/:approvalId/review', reviewOfflinePayment);
router.get('/payments/offline-requests', getOfflinePaymentRequests);
router.get('/payments/offline-requests/:approvalId', getOfflinePaymentRequestById);

// Revenue dashboard
router.get('/revenue', getAdminPaymentRevenue);

// Monthly summary for a year
router.get('/monthly-summary', getRevenueSummary);

// Per-vendor history
router.get('/vendor/:vendorId/history', getVendorPaymentHistory);

// Referral settings
router.post('/referral-settings', upsertReferralSettings);
router.get('/referral-settings', getReferralSettings);

// ==================== STAFF ROUTES (No Token Required) ====================

// Admin operations for staff management
router.post('/admin/staff/create', uploadStaffImage, createStaff);
router.get('/admin/staff', getAllStaff);
router.get('/admin/staff/:staffId', getStaffById);
router.put('/admin/staff/:staffId', uploadStaffImage, updateStaff);
router.delete('/admin/staff/:staffId', deleteStaff);
router.put('/admin/staff/:staffId/change-password', changeStaffPassword);

// Staff login and profile
router.post('/staff/login', staffLogin);
router.get('/staff/profile/:staffId', getStaffProfile);
router.put('/staff/profile/:staffId', uploadStaffImage, updateStaffProfile);
router.put('/staff/change-password/:staffId', staffChangeOwnPassword);

export default router;