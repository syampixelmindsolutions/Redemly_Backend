import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: { type: String },
  image: { type: String, default: null },  // Store the image URL (optional)
  read: { type: Boolean, default: false },
  coins: { type: Number, default: 0 },  // Add this field to store the coins sent
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);
