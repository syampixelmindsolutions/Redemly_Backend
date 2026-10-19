import mongoose from 'mongoose';

const quizSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
      validate: {
        validator: (val) => val.length === 4,
        message: 'Options must have exactly 4 items',
      },
    },
    answer: {
      type: String,
      required: true,
    },
    explanation: {
      type: String,
    },
  },
  { timestamps: true }
);

const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;
