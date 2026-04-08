const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
    },

    type: {
      type: String,
      enum: ["postpone", "cancel"],
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