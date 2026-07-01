const mongoose = require("mongoose");

const studentProfileSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one profile per student
    },

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
      enum: ["online", "offline","hybrid"],
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
        tutorHourlyRate: {
          type: Number,
          default: 0,
        },
        studentHourlyRate: {
          type: Number,
          default: 0,
        },
        hourlyRate: Number, // legacy field for older records
      },
    ],

    totalHours: {
      type: Number,
      default: 0,
    },

    totalTutorFees: {
      type: Number,
      default: 0,
    },

    totalStudentFees: {
      type: Number,
      default: 0,
    },

    totalFees: {
      type: Number,
      default: 0,
    },

    // 📦 Package Details
    packageHours: {
      type: Number,
      default: 0, // total contracted hours e.g. 40
    },

    hoursPerDay: {
      type: Number,
      default: 1, // hours per class session e.g. 1.5
    },

    packageStartDate: {
      type: Date,
    },

    packageEndDate: {
      type: Date,
    },

    packagePattern: {
      type: String, // e.g. "all-saturdays", "weekdays", "all-days"
      trim: true,
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