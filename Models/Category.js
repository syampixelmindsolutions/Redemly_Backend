import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  categoryName: {
    type: String,
    unique: true,
    trim: true,
  }
}, { timestamps: true });

const Category = mongoose.model('Category', categorySchema);

export default Category;
