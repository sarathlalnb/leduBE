const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "student", "tutor"],
      default: "student",
    },

    hourlyRate: {
      type: Number,
      default: 0,
    },

    subjects: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);