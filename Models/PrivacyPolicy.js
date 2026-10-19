// models/PrivacyPolicy.js
import mongoose from "mongoose";

const privacyPolicySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  date: {
    type: String, // format: dd-mm-yyyy
    required: true,
  },
}, { timestamps: true });

const PrivacyPolicy = mongoose.model("PrivacyPolicy", privacyPolicySchema);

export default PrivacyPolicy;
