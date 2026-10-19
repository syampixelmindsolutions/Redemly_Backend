import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

// 📁 Ensure uploads folder exists
const uploadFolder = './uploads';
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}

// 🧱 Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadFolder); // Save to uploads folder
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname); // unique-name.jpg
    cb(null, uniqueName);
  },
});

// 📄 File filter to allow only images & videos
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|mp4|mov/;
  const isMimeTypeValid = allowedTypes.test(file.mimetype);
  const isExtNameValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (isMimeTypeValid && isExtNameValid) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed!'), false);
  }
};

// 📦 Multer upload middleware with multiple fields
const uploads = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB per file
  fileFilter,
}).fields([
  { name: 'file', maxCount: 5 },         // up to 5 files (image or video)
  { name: 'image', maxCount: 1 },        // 1 image
  { name: 'images', maxCount: 5 },       // up to 5 images
  { name: 'profileImage', maxCount: 1 }, // profile image upload
]);

export default uploads;
