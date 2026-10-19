import mongoose from 'mongoose';

const surveySchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
    },
    questions: [
      {
        questionText: {
          type: String,
        },
        options: {
          type: [String],
          validate: {
            validator: function (arr) {
              return arr.length === 4;
            },
            message: 'Each question must have exactly 4 options.',
          },
        },
        correctOptionIndex: {
          type: Number,
          min: 0,
          max: 3,
        },
      },
    ],
    // 🆕 Responses will be stored here
    responses: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
      },
        answers: [
          {
            questionIndex: {
              type: Number,
            },
            selectedOptionIndex: {
              type: Number,
            },
          },
        ],
        submittedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

const Survey = mongoose.model('Survey', surveySchema);
export default Survey;
