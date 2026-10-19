import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const makeDir = (dir) => fs.mkdirSync(dir, { recursive: true });


const vendorLogosDir = path.join(__dirname, '..', 'uploads', 'vendor-logos');
makeDir(vendorLogosDir);

// 📁 Define all directories
const dirs = {
  support: path.join(__dirname, '..', 'uploads', 'support'),
  documents: path.join(__dirname, '..', 'uploads', 'documents'),
  testImages: path.join(__dirname, '..', 'uploads', 'testimages'),
  companyImages: path.join(__dirname, '..', 'uploads', 'company-images'),
  staffImages: path.join(__dirname, '..', 'uploads', 'staff-images'),
  doctorImages: path.join(__dirname, '..', 'uploads', 'doctorimages')
};

// 🔧 Create all directories
Object.values(dirs).forEach(makeDir);

// Generic filename generator
const getFilename = (file) => `${Date.now()}-${file.originalname}`;

// 🧾 Support file upload
export const uploadSupportFile = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirs.support),
    filename: (req, file, cb) => cb(null, getFilename(file))
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('file');

// 📄 Document upload
export const uploadDocuments = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirs.documents),
    filename: (req, file, cb) => cb(null, getFilename(file))
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
}).array('documents', 5);

// 🧪 Test image upload
export const uploadTestImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirs.testImages),
    filename: (req, file, cb) => cb(null, getFilename(file))
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('testImage');

// 🏢 Company assets upload
export const uploadCompanyAssets = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === 'image') cb(null, dirs.companyImages);
      else if (file.fieldname === 'documents') cb(null, dirs.documents);
      else cb(new Error('Invalid field'), null);
    },
    filename: (req, file, cb) => cb(null, getFilename(file))
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'documents', maxCount: 5 }
]);

// 👥 Staff images upload
export const uploadStaffImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirs.staffImages),
    filename: (req, file, cb) => cb(null, getFilename(file))
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'idImage', maxCount: 1 }
]);

// 🧑‍⚕️ Doctor image upload
export const uploadDoctorImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirs.doctorImages),
    filename: (req, file, cb) => cb(null, getFilename(file))
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('image');



// 🩻 X-ray image upload
const xrayImagesDir = path.join(__dirname, '..', 'uploads', 'xray-images');
makeDir(xrayImagesDir); // Create directory if not exists

export const uploadXrayImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, xrayImagesDir),
    filename: (req, file, cb) => cb(null, getFilename(file))
  }),
  limits: { fileSize: 5 * 1024 * 1024 } // Max 5 MB
}).single('image');



const diagnosticImagesDir = path.join(__dirname, '..', 'uploads', 'diagnostic-images');
makeDir(diagnosticImagesDir); // Create directory if it doesn't exist

export const uploadDiagnosticImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, diagnosticImagesDir),
    filename: (req, file, cb) => cb(null, getFilename(file))
  }),
  limits: { fileSize: 5 * 1024 * 1024 } // Max 5 MB
}).single('image');



// 📸 User Profile Image Upload
const profileImagesDir = path.join(__dirname, '..', 'uploads', 'profile-images');
makeDir(profileImagesDir); // Ensure directory exists

export const uploadProfileImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, profileImagesDir),
    filename: (req, file, cb) => cb(null, getFilename(file))
  }),
  limits: { fileSize: 5 * 1024 * 1024 } // Max 5 MB
}).single('profileImage'); // 👈 Field name to be used in frontend/postman



export const uploadVendorLogo = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, vendorLogosDir),
    filename: (req, file, cb) => cb(null, getFilename(file))
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5 MB
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
}).single('businessLogo');

// 📂 Vendor Documents Upload (FILES - NOT IMAGES)
const vendorDocumentsDir = path.join(__dirname, '..', 'uploads', 'vendor-documents');
makeDir(vendorDocumentsDir);

export const uploadVendorDocumentsMulter = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, vendorDocumentsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
}).fields([
  { name: 'Driving License', maxCount: 1 },
  { name: 'State ID', maxCount: 1 },
  { name: 'Tax Certificate', maxCount: 1 },
  { name: 'Business License', maxCount: 1 }
]);


// Add this to your multerConfig.js
const couponImagesDir = path.join(__dirname, '..', 'uploads', 'coupon-images');
makeDir(couponImagesDir);

export const uploadCouponImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, couponImagesDir),
    filename: (req, file, cb) => cb(null, getFilename(file))
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
}).single('couponImage'); // Field name: couponImage
