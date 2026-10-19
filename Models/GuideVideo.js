import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const guideVideoSchema = new Schema({
  title: {
    type: String,
    trim: true,  // Optional: trims any leading/trailing spaces from title
  },
  videoUrl: {
    type: String,
  },
}, {
  timestamps: true, // Automatically adds `createdAt` and `updatedAt` fields
});

const GuideVideo = model('GuideVideo', guideVideoSchema);

export default GuideVideo;
