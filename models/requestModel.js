const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    tutor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    requestedBy: {
      type: String,
      enum: ["student", "tutor"],
      default: "student",
    },

    type: {
      type: String,
      enum: ["postpone", "cancel"],
    },

    postponedDate: {
      type: Date,
    },

    reason: String,

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Request", requestSchema);