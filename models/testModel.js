const mongoose = require("mongoose");

const testSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    subject: String,

    testDate: Date,

    marks: Number,

    totalMarks: Number,

    remarks: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Test", testSchema);