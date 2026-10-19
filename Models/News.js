// Models/News.js

import mongoose from "mongoose";

const newsSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: [
      'Immigration',
      'Stocks & Finance',
      'AI & Tech',
      'India',
      'Cricket',
      'Geopolitics',
      'Austin Local'
    ],
    index: true
  },
  category_emoji: {
    type: String,
    default: function() {
      const emojiMap = {
        'Immigration': '🛂',
        'Stocks & Finance': '📈',
        'AI & Tech': '🤖',
        'India': '🇮🇳',
        'Cricket': '🏏',
        'Geopolitics': '🌍',
        'Austin Local': '🏙️'
      };
      return emojiMap[this.category] || '📰';
    }
  },
  catchy_headline: {
    type: String,
    required: true,
    trim: true
  },
  tldr: {
    type: String,
    required: true,
    trim: true
  },
  summary: {
    type: String,
    required: true
  },
  what_it_means_for_you: {
    type: String,
    required: true
  },
  disclaimer: {
    type: String,
    default: "This news is for informational purposes only. Please verify with official sources."
  },
  source_name: {
    type: String,
    required: true
  },
  source_url: {
    type: String,
    required: true
  },
  url_large: {
    type: String, // Main large image URL from Cloudinary
    required: true
  },
  url: {
    type: String, // Flip/secondary image URL from Cloudinary
    required: true
  },
  published_at: {
    type: Date,
    required: true,
    index: true
  },
  cloudinary_ids: {
    url_large: String, // Cloudinary public ID for large image
    url: String        // Cloudinary public ID for flip image
  },
  isActive: {
    type: Boolean,
    default: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
newsSchema.index({ category: 1, published_at: -1 });
newsSchema.index({ catchy_headline: 'text', tldr: 'text', summary: 'text' });
newsSchema.index({ published_at: -1 }); // For sorting by date

const News = mongoose.model("News", newsSchema);
export default News;