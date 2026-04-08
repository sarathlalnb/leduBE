const mongoose = require("mongoose");

const studentProfileSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one profile per student
    },

    // 👨‍👩‍👧 Parent Details
    parentName: {
      type: String,
      required: true,
      trim: true,
    },

    parentPhone: {
      type: String,
      required: true,
      match: [/^[0-9]{10}$/, "Invalid phone number"],
    },

    // 🏫 Academic Details
    school: {
      type: String,
      required: true,
      trim: true,
    },

    syllabus: {
      type: String, // CBSE / ICSE / State / etc
      required: true,
    },

    standard: {
      type: String, // "10", "12", "8th"
      required: true,
    },

    mode: {
      type: String,
      enum: ["online", "offline"],
      required: true,
    },

    // 📘 Learning Setup
    subjects: [String],

    tutors: [
      {
        name: {
          type: String,
          required: true,
        },
        subject: {
          type: String,
          required: true,
        },
        hourlyRate: Number,
      },
    ],

    totalHours: {
      type: Number,
      default: 0,
    },

    totalFees: {
      type: Number,
      default: 0,
    },

    // 📝 Extra Notes
    remarks: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentProfile", studentProfileSchema);