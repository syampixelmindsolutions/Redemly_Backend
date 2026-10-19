import express from 'express';
import {
  googleAuth,
  //googleSignIn,
  // verifyToken ,
  registerWithEmail,
  verifyEmailOtp,
  loginWithPassword,
  forgotPassword,
  verifyResetOtp,
  changePassword,
  resendRegistrationOtp,
  registerUser,
  loginUser,
  getUser,
  updateUser,
  getProfile,
  verifyOtps,
  verifyOtp,
  getFirstLoginPopupStatus,
  submitFirstLoginPopupDecision,
  getNearestVendors,
  addCoins,
  getUserCoinsById,
  toggleFavoriteCoupon,
  getAllMyFavoriteCoupons,
  generateQuiz,
  uploadProfile,
  addOrUpdateUserSteps,
  getUserStepsHistory,
  updateUserLocation,
  getAllGuideVideos,
  getCouponByUserId,
  submitFeedback,
  sendCoins,
  getCoinHistory,
  submitVendorFeedback,
  getAllAppFeedback,
  generateContent,
  getChat,
  sendMessage,
  submitContactForm,
  claimCoupon,
  getActiveCoupons,
  addChatMember,
  getChatMembers,
  acceptChatMember,
  //  getNotifications,
  getMCQQuestions,
  getFunFacts,
  getLatestNews,
  getAllSpinRewards,
  addCoupons,
  getUserCouponsById,
  getSurveysByVendor,
  submitSurveyResponse,
  getCoinTransactionHistory,
  sendInfoRequest,
  acceptUserInfoRequest,
  getUserInfoIfAccepted,
  //  deleteNotifications,
  getCouponHistory,
  submitQuiz,
  getTopPerformers,
  getQuiz,
  getUsersExcludingChatMembers,
  getUserCouponCode,
  getAllFunFacts,

  bulkUploadNews,
  getAllNewses,
  deleteNews,
  trackContentTimeSpent,
  getUserTimeSpentStats,

  getAllNews,
  getUserQuizzes,
  deleteAccount,
  confirmDeleteAccount,
  deleteUser,
  getCoinHistoryByUserId,
  declineChatMember,
  spinWheel,
  getUserFeedback,
  getSpinCountToday,

  claimCouponAtVendor,
  // useCoupon,
  getClaimedCoupons,
  // getPurchasedCoupons,
  // getUserCouponDetails,
  getExpiredCoupons,
  getUserCouponStats,
  createRedeemCategory,
  getAllRedeemCategories,
  getRedeemCategoryById,
  updateRedeemCategory,
  deleteRedeemCategory,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  submitCouponFeedback,
  getUserCouponFeedback,
  updateCouponFeedback,
  deleteCouponFeedback,
  getAllUserCouponFeedback,
  getVendorCouponFeedback,

} from '../Controller/UserController.js'; // Import UserController
const router = express.Router();

import { uploadProfileImage } from '../config/multerConfig.js';



// /**
//  * @route   POST /api/auth/google/signup
//  * @desc    Register a new user with Google
//  * @access  Public
//  * @body    { idToken, accessToken, referralCode (optional) }
//  */
// router.post('/google/signup', googleSignup);

// /**
//  * @route   POST /api/auth/google/signin
//  * @desc    Login an existing user with Google
//  * @access  Public
//  * @body    { idToken, accessToken }
//  */
// router.post('/google/signin', googleSignin);

// /**
//  * @route   POST /api/auth/google/verify
//  * @desc    Verify Google token (optional - for debugging)
//  * @access  Public
//  * @body    { idToken }
//  */
// router.post('/google/verify', verifyToken);


// 🔐 Existing users only (LOGIN)
router.post("/google", googleAuth);

// // 🆕 New users only (REGISTER)
// router.post("/google/signup", googleSignUp);

// Email/Password authentication routes
router.post('/register-email', registerWithEmail);
router.post('/verify-email-otp', verifyEmailOtp);
router.post('/login-password', loginWithPassword);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/change-password', changePassword);
router.post("/resend-registration-otp", resendRegistrationOtp);



// Registration Route
router.post('/register', registerUser);

// Login Route
router.post('/login', loginUser);
router.post('/verify-otp/firebase', verifyOtp);   // Firebase route FIRST
router.post('/verify-otp/:userId', verifyOtps); // Param route SECOND
router.get('/first-login-popup/:userId', getFirstLoginPopupStatus);
router.post('/first-login-popup/:userId', submitFirstLoginPopupDecision);

// Get user details (GET)
router.get('/get-user/:userId', getUser);  // Adding a middleware to verify JWT token
router.get('/nearest-vendors/:userId', getNearestVendors);

// Update user details (PUT)
router.put('/update-user/:userId', updateUser);  // Adding a middleware to verify JWT token
// Create a new profile with Form Data (including profile image)

// Get the user profile by userId
router.get('/get-profile/:id', getProfile);  // Get profile by userId

router.post('/addcoins/:userId', addCoins);  // Adding a middleware to verify JWT token
router.post('/addcoupons/:userId', addCoupons);  // Adding a middleware to verify JWT token
router.post('/send-coins/:senderId', sendCoins);
router.get('/transactionhistory/:userId1/:userId2', getCoinTransactionHistory);
router.get('/coin-history/:senderId/:receiverId', getCoinHistory);
router.get('/allcoins/:userId', getUserCoinsById);
router.get('/allcoupons/:userId', getUserCouponsById);  // Adding a middleware to verify JWT token
router.post('/addfvrtcoupon', toggleFavoriteCoupon);  // Adding a middleware to verify JWT token
router.get('/myfvrtcoupons/:userId', getAllMyFavoriteCoupons);  // Adding a middleware to verify JWT token
router.get('/quizz', generateQuiz);

router.post('/create-profileimage/:userId', uploadProfileImage, uploadProfile);

// ✅ Route to add or update user's steps for today
router.post('/addsteps/:userId', addOrUpdateUserSteps);

// ✅ Route to get user's step history
router.get('/usersteps/:userId', getUserStepsHistory);

router.post('/addlocation/:userId', updateUserLocation);

router.get('/guidevideos/:userId', getAllGuideVideos);
router.get('/getcouponcode/:userId', getCouponByUserId);
router.post('/submitfeedback/:userId', submitFeedback);
router.get('/getfeedback/:userId', getUserFeedback);
router.post('/submitvendorfeedback/:userId', submitVendorFeedback);
router.get('/feedback/all', getAllAppFeedback);
router.post('/generate', generateContent);
router.get('/chat/:user1/:user2', getChat); // GET chat history
router.post('/sendmsg', sendMessage); // GET chat history
router.post('/contactus', submitContactForm); // GET chat history
router.post('/claimcoupon/:userId/:couponId', claimCoupon);
router.get('/getactivecoupons/:userId', getActiveCoupons);
router.post('/:userId/claim-coupon/:couponId', claimCouponAtVendor);
// router.post('/:userId/use-coupon/:couponId', useCoupon);
router.get('/:userId/claimed-coupons', getClaimedCoupons); // Missing
// router.get('/:userId/purchased-coupons', getPurchasedCoupons); // Missing
// router.get('/:userId/coupon-details/:userCouponId', getUserCouponDetails); // Missing
router.get('/:userId/expired-coupons', getExpiredCoupons); // Missing
router.get('/:userId/coupon-stats', getUserCouponStats); // Missing


router.get('/couponhistory/:userId', getCouponHistory);
router.post('/add-chat-member', addChatMember);
router.get('/chat-members/:userId', getChatMembers);
router.put('/accept-chat-member', acceptChatMember);
router.put('/decline-chat-member', declineChatMember);
// router.get('/notifications/:userId', getNotifications);
// router.delete('/deletenotifications/:userId', deleteNotifications);

router.get('/generate-quizzes', getMCQQuestions);
router.post('/submit-quizzes', submitQuiz);
router.get("/top-performers/:userId", getTopPerformers)
router.get('/generate-facts', getFunFacts);
router.get('/funfacts', getAllFunFacts);
router.get('/quizz', getQuiz);


router.post("/bulk-upload", bulkUploadNews);
router.get("/getallnews", getAllNewses);
router.delete("/delete-news/:id", deleteNews);
router.post('/:userId/track-time', trackContentTimeSpent);  // Track time spent on content
router.get('/:userId/time-stats', getUserTimeSpentStats);    // Get time spent statistics


router.get('/generate-news', getLatestNews);
router.get('/latestnews', getAllNews);
router.get("/spinrewards/:userId", getAllSpinRewards);
router.get('/getsurvey/:userId/:vendorId', getSurveysByVendor);
router.post('/submit-survey', submitSurveyResponse);


router.post('/request-info/:toUserId', sendInfoRequest);
router.post('/accept-info-request/:userId', acceptUserInfoRequest);
router.get('/getinfo/:targetUserId/:requesterId', getUserInfoIfAccepted);
router.get('/getallusers/:userId', getUsersExcludingChatMembers);
router.get("/reffralcode/:userId", getUserCouponCode);
router.get("/getquizzes/:userId", getUserQuizzes);


router.post('/deleteaccount', deleteAccount)
router.get('/confirm-delete-account/:token', confirmDeleteAccount);
router.delete('/delete-user/:userId', deleteUser);
router.get('/coinhistory/:userId', getCoinHistoryByUserId);
router.post("/spin/:userId", spinWheel);
router.get("/getspin-limit/:userId", getSpinCountToday);



router.post("/redeem-category", createRedeemCategory);
router.get("/redeem-category", getAllRedeemCategories);
router.get("/redeem-category/:categoryId", getRedeemCategoryById);
router.put("/redeem-category/:categoryId", updateRedeemCategory);
router.delete("/redeem-category/:categoryId", deleteRedeemCategory);


// GET /api/users/:userId/notifications?page=1&limit=20&unreadOnly=false
router.get('/:userId/notifications', getUserNotifications);

// PUT /api/users/:userId/notifications/read
router.put('/:userId/notifications/read', markNotificationAsRead);

// PUT /api/users/:userId/notifications/read-all
router.put('/:userId/notifications/read-all', markAllNotificationsAsRead);
router.delete('/notifications/:userId/:notificationId', deleteNotification);

// Add these routes to your user routes file
router.post('/:userId/coupons/:couponId/feedback', submitCouponFeedback);
router.get('/:userId/coupons/:couponId/feedback', getUserCouponFeedback);
router.put('/:userId/coupons/:couponId/feedback', updateCouponFeedback);
router.delete('/:userId/coupons/:couponId/feedback', deleteCouponFeedback);
router.get('/:userId/coupons/feedback', getAllUserCouponFeedback);
router.get('/vendors/:vendorId/feedback', getVendorCouponFeedback); // READ by vendor



export default router;
