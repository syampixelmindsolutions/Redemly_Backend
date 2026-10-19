import mongoose from "mongoose";

const quizSubmissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Quiz",
  },
  selectedOption: {
    type: String,
  },
  correctAnswer: {
    type: String,
  },
  score: {
    type: Number,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

const QuizSubmission = mongoose.model("QuizSubmission", quizSubmissionSchema);

export default QuizSubmission;
