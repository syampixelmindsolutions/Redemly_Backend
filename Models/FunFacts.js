import mongoose from 'mongoose';

// Define schema for Fun Fact
const funFactSchema = new mongoose.Schema({
  id: { type: Number, },
  fact: { type: String },
  description: { type: String },
  source: { type: String },
  link: { type: String },
  image: { type: String },
  pubDate: { type: Date }, // Make sure to store as a Date type
    category: { type: String }, // Add category field
}, { timestamps: true }); // Automatically add createdAt and updatedAt fields

// Create and export model for FunFact
const FunFact = mongoose.model('FunFact', funFactSchema);

export default FunFact;
