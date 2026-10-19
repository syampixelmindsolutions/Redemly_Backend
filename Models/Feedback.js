import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const feedbackSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Link feedback to a user
  },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', },
  star: {
    type: Number,
    min: 1,
    max: 5, // Assuming 1 to 5 stars for rating
  },
  topic: {
    type: String,
  },
  tellUsAboutExperience: {
    type: String,
  },
}, {
  timestamps: true, // Add createdAt and updatedAt timestamps
});

const Feedback = model('Feedback', feedbackSchema);

export default Feedback;
