import Staff from '../Models/Staff.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

// Ensure uploads directory exists
const uploadDir = 'uploads/staff';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'staff-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

export const uploadStaffImage = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
}).single('profileImage');

// Helper function to get full image URL
const getImageUrl = (req, filename) => {
  if (!filename) return null;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/staff/${filename}`;
};

// ==================== ADMIN FUNCTIONS ====================

/**
 * CREATE STAFF (Admin only)
 * POST /api/admin/staff/create
 */
export const createStaff = async (req, res) => {
  try {
    const {
      name,
      email,
      mobileNumber,
      password,
      accessModules
    } = req.body;

    // Validate required fields
    if (!name || !email || !mobileNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, mobile number and password are required'
      });
    }

    // Check if staff already exists with same email or mobile
    const existingStaff = await Staff.findOne({
      $or: [{ email: email.toLowerCase() }, { mobileNumber }]
    });

    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: 'Staff already exists with this email or mobile number'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Parse accessModules if sent as JSON string
    let parsedAccessModules = {};
    if (accessModules) {
      try {
        parsedAccessModules = typeof accessModules === 'string' 
          ? JSON.parse(accessModules) 
          : accessModules;
      } catch (e) {
        parsedAccessModules = {};
      }
    }

    // Prepare access modules with defaults
    const defaultAccessModules = {
      users: { view: false, edit: false, delete: false },
      vendors: { view: false, edit: false, delete: false, approve: false },
      coupons: { view: false, edit: false, delete: false, approve: false, create: false },
      categories: { view: false, edit: false, delete: false, create: false },
      quizzes: { view: false, edit: false, delete: false, create: false },
      funFacts: { view: false, edit: false, delete: false, create: false },
      banners: { view: false, edit: false, delete: false, create: false },
      payments: { view: false, edit: false, verify: false },
      reports: { view: false, export: false },
      settings: { view: false, edit: false },
      notifications: { view: false, send: false }
    };

    // Merge provided access modules with defaults
    const mergedAccessModules = { ...defaultAccessModules };
    Object.keys(parsedAccessModules).forEach(module => {
      if (mergedAccessModules[module]) {
        mergedAccessModules[module] = {
          ...mergedAccessModules[module],
          ...parsedAccessModules[module]
        };
      }
    });

    // Create new staff
    const staff = new Staff({
      name,
      email: email.toLowerCase(),
      mobileNumber,
      password: hashedPassword,
      profileImage: req.file ? req.file.filename : null,
      accessModules: mergedAccessModules,
      createdBy: null // No admin ID since no token
    });

    await staff.save();

    // Prepare response (exclude password)
    const staffData = staff.toObject();
    delete staffData.password;

    res.status(201).json({
      success: true,
      message: 'Staff created successfully',
      data: {
        ...staffData,
        profileImageUrl: getImageUrl(req, staff.profileImage)
      }
    });

  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * GET ALL STAFF
 * GET /api/admin/staff
 */
export const getAllStaff = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, search } = req.query;

    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Staff.countDocuments(filter);

    const staffList = await Staff.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Remove passwords from response
    staffList.forEach(staff => {
      delete staff.password;
    });

    // Add image URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const staffWithUrls = staffList.map(staff => ({
      ...staff,
      profileImageUrl: staff.profileImage ? `${baseUrl}/uploads/staff/${staff.profileImage}` : null
    }));

    res.status(200).json({
      success: true,
      data: staffWithUrls,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get all staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * GET STAFF BY ID
 * GET /api/admin/staff/:staffId
 */
export const getStaffById = async (req, res) => {
  try {
    const { staffId } = req.params;

    if (!staffId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID format'
      });
    }

    const staff = await Staff.findById(staffId).lean();

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    delete staff.password;

    res.status(200).json({
      success: true,
      data: {
        ...staff,
        profileImageUrl: getImageUrl(req, staff.profileImage)
      }
    });

  } catch (error) {
    console.error('Get staff by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * UPDATE STAFF
 * PUT /api/admin/staff/:staffId
 */
export const updateStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { name, email, mobileNumber, accessModules, isActive } = req.body;

    if (!staffId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID format'
      });
    }

    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // Check email uniqueness if being changed
    if (email && email.toLowerCase() !== staff.email) {
      const emailExists = await Staff.findOne({ email: email.toLowerCase(), _id: { $ne: staffId } });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
      staff.email = email.toLowerCase();
    }

    // Check mobile uniqueness if being changed
    if (mobileNumber && mobileNumber !== staff.mobileNumber) {
      const mobileExists = await Staff.findOne({ mobileNumber, _id: { $ne: staffId } });
      if (mobileExists) {
        return res.status(400).json({
          success: false,
          message: 'Mobile number already exists'
        });
      }
      staff.mobileNumber = mobileNumber;
    }

    // Update fields
    if (name) staff.name = name;
    if (isActive !== undefined) staff.isActive = isActive;

    // Update profile image if provided
    if (req.file) {
      // Delete old image if exists
      if (staff.profileImage) {
        const oldImagePath = path.join('uploads/staff', staff.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      staff.profileImage = req.file.filename;
    }

    // Parse and update access modules
    if (accessModules) {
      let parsedAccessModules = {};
      try {
        parsedAccessModules = typeof accessModules === 'string' 
          ? JSON.parse(accessModules) 
          : accessModules;
      } catch (e) {
        parsedAccessModules = {};
      }

      Object.keys(parsedAccessModules).forEach(module => {
        if (staff.accessModules[module]) {
          staff.accessModules[module] = {
            ...staff.accessModules[module],
            ...parsedAccessModules[module]
          };
        }
      });
    }

    await staff.save();

    const staffData = staff.toObject();
    delete staffData.password;

    res.status(200).json({
      success: true,
      message: 'Staff updated successfully',
      data: {
        ...staffData,
        profileImageUrl: getImageUrl(req, staff.profileImage)
      }
    });

  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * DELETE STAFF
 * DELETE /api/admin/staff/:staffId
 */
export const deleteStaff = async (req, res) => {
  try {
    const { staffId } = req.params;

    if (!staffId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID format'
      });
    }

    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // Delete profile image if exists
    if (staff.profileImage) {
      const imagePath = path.join('uploads/staff', staff.profileImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Staff.findByIdAndDelete(staffId);

    res.status(200).json({
      success: true,
      message: 'Staff deleted successfully'
    });

  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * CHANGE STAFF PASSWORD (Admin only)
 * PUT /api/admin/staff/:staffId/change-password
 */
export const changeStaffPassword = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { newPassword } = req.body;

    if (!staffId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID format'
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // Hash new password
    staff.password = await bcrypt.hash(newPassword, 10);
    staff.passwordChangedAt = new Date();
    await staff.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change staff password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ==================== STAFF LOGIN FUNCTIONS ====================

/**
 * STAFF LOGIN
 * POST /api/staff/login
 */
export const staffLogin = async (req, res) => {
  try {
    const { mobileNumber, password } = req.body;

    if (!mobileNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and password are required'
      });
    }

    // Find staff by mobile number
    const staff = await Staff.findOne({ mobileNumber });
    
    if (!staff) {
      return res.status(401).json({
        success: false,
        message: 'Invalid mobile number or password'
      });
    }

    // Check if staff is active
    if (!staff.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account is deactivated. Please contact admin.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, staff.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid mobile number or password'
      });
    }

    // Update last login
    staff.lastLogin = new Date();
    await staff.save();

    // Prepare response (exclude password)
    const staffData = staff.toObject();
    delete staffData.password;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      staff: {
        ...staffData,
        profileImageUrl: getImageUrl(req, staff.profileImage)
      }
    });

  } catch (error) {
    console.error('Staff login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * GET STAFF PROFILE (Logged in staff)
 * GET /api/staff/profile/:staffId
 */
export const getStaffProfile = async (req, res) => {
  try {
    const { staffId } = req.params;

    if (!staffId || !staffId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Valid staff ID is required'
      });
    }

    const staff = await Staff.findById(staffId).lean();

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    delete staff.password;

    res.status(200).json({
      success: true,
      data: {
        ...staff,
        profileImageUrl: getImageUrl(req, staff.profileImage)
      }
    });

  } catch (error) {
    console.error('Get staff profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * STAFF CHANGE OWN PASSWORD
 * PUT /api/staff/change-password/:staffId
 */
export const staffChangeOwnPassword = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!staffId || !staffId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Valid staff ID is required'
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, staff.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    staff.password = await bcrypt.hash(newPassword, 10);
    staff.passwordChangedAt = new Date();
    await staff.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Staff change own password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * UPDATE STAFF PROFILE (Logged in staff)
 * PUT /api/staff/profile/:staffId
 */
export const updateStaffProfile = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { name, email, mobileNumber } = req.body;

    if (!staffId || !staffId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Valid staff ID is required'
      });
    }

    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // Check email uniqueness
    if (email && email.toLowerCase() !== staff.email) {
      const emailExists = await Staff.findOne({ email: email.toLowerCase(), _id: { $ne: staffId } });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
      staff.email = email.toLowerCase();
    }

    // Check mobile uniqueness
    if (mobileNumber && mobileNumber !== staff.mobileNumber) {
      const mobileExists = await Staff.findOne({ mobileNumber, _id: { $ne: staffId } });
      if (mobileExists) {
        return res.status(400).json({
          success: false,
          message: 'Mobile number already exists'
        });
      }
      staff.mobileNumber = mobileNumber;
    }

    if (name) staff.name = name;

    // Update profile image if provided
    if (req.file) {
      if (staff.profileImage) {
        const oldImagePath = path.join('uploads/staff', staff.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      staff.profileImage = req.file.filename;
    }

    await staff.save();

    const staffData = staff.toObject();
    delete staffData.password;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        ...staffData,
        profileImageUrl: getImageUrl(req, staff.profileImage)
      }
    });

  } catch (error) {
    console.error('Update staff profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};