import mongoose from 'mongoose';

// Check if the model is already registered
const NewsArticle = mongoose.models.NewsArticle || mongoose.model('NewsArticle', new mongoose.Schema({
  title: { type: String },
  description: { type: String },
  pubDate: { type: Date },
  source: { type: String },
  link: { type: String },
  image: { type: String },
  category: { type: String }, // Store the category
}, { timestamps: true }));

export default NewsArticle;
