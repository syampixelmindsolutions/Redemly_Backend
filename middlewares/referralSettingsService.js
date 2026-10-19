// middleware/referralSettingsService.js

// WRONG - This is what's causing the error
// import SystemConfig from '../models/systemConfigModel.js';

// CORRECT - Use the same path as your controller
import SystemConfig from '../Models/SystemConfig.js';

export const fetchReferralSettings = async () => {
  try {
    const config = await SystemConfig.findOne();
    if (config && config.referralSettings) {
      return config.referralSettings;
    }
    return null;
  } catch (error) {
    console.error("Error fetching referral settings:", error);
    return null;
  }
};

// Helper function that you're already using in your controller
export const getReferralSettings = async () => {
  try {
    const config = await SystemConfig.findOne().lean();
    return config?.referralSettings || null;
  } catch (error) {
    console.error("Error fetching referral settings:", error);
    return null;
  }
};