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
      enum: ["scheduled", "done", "postponed", "cancelled"],
      default: "scheduled",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Class", classSchema);