// Add to existing authMiddleware.js

import jwt from 'jsonwebtoken';
import Staff from '../Models/Staff.js';

// ... existing admin verification ...

export const verifyStaffToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    
    if (decoded.role !== 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Staff only.'
      });
    }

    const staff = await Staff.findById(decoded.id).lean();
    
    if (!staff) {
      return res.status(401).json({
        success: false,
        message: 'Staff not found'
      });
    }

    if (!staff.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact admin.'
      });
    }

    req.staff = staff;
    req.user = staff;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Staff Access Check Middleware
export const checkStaffAccess = (module, action) => {
  return async (req, res, next) => {
    try {
      const staffId = req.staff?._id || req.user?._id;
      
      if (!staffId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const staff = await Staff.findById(staffId);
      
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff not found'
        });
      }

      const hasAccess = staff.accessModules[module]?.[action] === true;
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You don't have permission to ${action} ${module}.`
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  };
};