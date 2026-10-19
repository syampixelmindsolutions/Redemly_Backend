import mongoose from 'mongoose';

// Define the schema for the contact model
const contactSchema = new mongoose.Schema(
  {
    mobile: { type: String, },
    email: { type: String, },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

// Create and export the Contact model
const Contact = mongoose.model('Contact', contactSchema);
export default Contact;
