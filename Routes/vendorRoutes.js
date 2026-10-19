import express from 'express';
import {
  registerVendor,
  verifyOtpAndSetPassword,
  loginVendor,
  vendorForgotPassword,
  vendorResendOtp,
  vendorResetPassword,
  getVendorById,
  updateVendor,
  createCoupon,
  getCouponsByVendor,
  getAllCoupons,
  getCouponById,
  getAllVendorCoupons,
  updateCoupon,
 deleteCoupon,
  updateCouponImage,
  getCouponImage,
  getActiveCoupons,
  uploadGuideVideo,
  spinTheWheel,
  createSurvey,
  updateCouponStatus,
  getVendorCouponUsageHistory,
  uploadVendorDocuments,
  getVendorDocuments,
  getSurveysByVendor,
  getAllNotifications,
  getDashboardData,
  createBulkCoupons,
  deleteSurvey,
   markVendorNotificationAsRead,
  markAllVendorNotificationsAsRead,
  deleteVendorNotification,
  getVendorNotificationStats,
  getVendorPaymentDashboard,
  getVendorPaymentsByMonth,
  getVendorWeeklyPayments,
  getVendorPendingBalance,
  initiateOnlinePayment,
  verifyOnlinePayment,
  requestOfflinePayment,
  getOfflinePaymentRequests,
  getVendorPaymentStats,
  deleteVendorCouponUsageHistory,
  
} from '../Controller/VendorController.js';
import uploadPaymentProof from '../middlewares/uploadPaymentProof.js';
import { uploadVendorLogo ,uploadCouponImage } from '../config/multerConfig.js';
const router = express.Router();
import { uploadVendorDocumentsMulter } from '../config/multerConfig.js';

router.post("/register", uploadVendorLogo, registerVendor);
router.post("/verify-otp", verifyOtpAndSetPassword);
router.post("/login", loginVendor);
router.post("/forgot-password", vendorForgotPassword);
router.post("/resend-otp", vendorResendOtp);
router.post("/reset-password", vendorResetPassword);
router.get("/getById/:vendorId", getVendorById);
router.put("/update/:vendorId", uploadVendorLogo,updateVendor);

router.post('/create-coupon/:vendorId', createCoupon);
router.post('/create-bulkcoupon/:vendorId', createBulkCoupons);
router.get("/:vendorId/coupons", getAllVendorCoupons);
router.put("/update-coupon/:couponId", updateCoupon);
router.put("/update-coupon-image/:couponId",uploadCouponImage , updateCouponImage); // Update only image
router.get('/getCouponImage/:couponId', getCouponImage);

//router.delete("/delete-coupon/:couponId", deleteCoupon);
// Vendor route: get coupons for a specific vendor
router.get('/mycoupons/:vendorId', getCouponsByVendor);
router.get('/coupons/:userId', getAllCoupons);
router.get('/activecoupons', getActiveCoupons);
router.get('/coupon/:couponId', getCouponById);
router.post('/uploadguidevideos', uploadGuideVideo);
router.post('/spinwheel', spinTheWheel);
router.post('/create-survey', createSurvey);
router.put('/updatecouponstatus/:vendorId/:couponId', updateCouponStatus);
router.get('/coupon-usage-history/:vendorId', getVendorCouponUsageHistory);
router.post('/upload-documents/:vendorId', uploadVendorDocumentsMulter,uploadVendorDocuments);
router.get('/get-documents/:vendorId', getVendorDocuments);
router.get('/get-surveys/:vendorId', getSurveysByVendor);
router.get('/notifications/:vendorId', getAllNotifications);
router.get('/dashboard/:vendorId', getDashboardData);
router.delete("/coupon/:couponId", deleteCoupon);
router.delete(
  "/:vendorId/survey/:surveyId",
  deleteSurvey
);


router.get('/:vendorId/notifications/stats', getVendorNotificationStats);
router.put('/:vendorId/notifications/mark-all-read', markAllVendorNotificationsAsRead);
router.put('/:vendorId/notifications/:notificationId/read', markVendorNotificationAsRead);
router.delete('/:vendorId/notifications/:notificationId', deleteVendorNotification);


// Dashboard & summary
router.get('/:vendorId/payment-dashboard',     getVendorPaymentDashboard);
router.get('/:vendorId/payments/pending-balance', getVendorPendingBalance);
router.get('/:vendorId/payments/stats',         getVendorPaymentStats);

// Monthly & weekly history
router.get('/:vendorId/payments/monthly',       getVendorPaymentsByMonth);   // ?month=YYYY-MM
router.get('/:vendorId/payments/weekly',        getVendorWeeklyPayments);    // ?weeks=4

// Online payment (Razorpay)
router.post('/:vendorId/payments/initiate-online',  initiateOnlinePayment);  // body: { month }
router.post('/:vendorId/payments/verify-online',    verifyOnlinePayment);    // body: { razorpay_*, month }

// Offline payment requests
router.post('/:vendorId/payments/request-offline', uploadPaymentProof, requestOfflinePayment);  // body: { month, description, paymentProof }
router.get('/:vendorId/payments/offline-requests',  getOfflinePaymentRequests); // ?status=pending
router.delete('/:vendorId/coupon-usage-history', deleteVendorCouponUsageHistory);


export default router;
