import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// __dirname fix for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload path for business logos
const businessLogoPath = path.join(__dirname, '../uploads/businessLogo');

// Create folder if not exists
if (!fs.existsSync(businessLogoPath)) {
  fs.mkdirSync(businessLogoPath, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, businessLogoPath);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `businesslogo_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

// File filter for jpg, jpeg, png only
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedTypes.includes(ext)) {
    return cb(new Error('Only JPG, JPEG, and PNG files are allowed'), false);
  }
  cb(null, true);
};

const uploadBusinessLogo = multer({ storage, fileFilter });

// Export middleware for single file upload named "businessLogo"
export const uploadBusinessLogoSingle = uploadBusinessLogo.single('businessLogo');
