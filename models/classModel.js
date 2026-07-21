const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    tutor: {
      name: String,
      subject: String,
    },

    date: {
      type: Date,
      required: true,
    },

    duration: {
      type: Number,     
      default: 1,
    },

    tutorRate: {
      type: Number,
      default: 0,
    },

    studentRate: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["scheduled", "in_progress", "done", "postponed", "cancelled"],
      default: "scheduled",
    },

    // Time tracking fields
    classStartTime: {
      type: Date,
      default: null,
    },

    classEndTime: {
      type: Date,
      default: null,
    },

    // Actual minutes taken (from login/logout or admin manual input)
    // When set, salary and hours calculations use this instead of 'duration'
    actualMinutes: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Class", classSchema);