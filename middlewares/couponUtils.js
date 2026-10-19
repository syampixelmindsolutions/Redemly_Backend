// couponUtils.js
import User from '../Models/User.js';

export const generateUniqueUserCouponCode = async (basePrefix = '') => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    let code = basePrefix ? basePrefix.substring(0, 4).toUpperCase() : '';
    const remainingLength = 8 - code.length;
    
    for (let i = 0; i < remainingLength; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const existingCode = await User.findOne({ couponCode: code });
    if (!existingCode) {
      return code;
    }
    attempts++;
  }
  
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${timestamp}${random}`;
};