const Class = require("../models/classModel");
const Request = require("../models/requestModel");
const Test = require("../models/testModel");


exports.getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user._id;

    const now = new Date();

    const upcomingClasses = await Class.find({
      student: studentId,
      date: { $gte: now },
      status: "scheduled",
    }).sort({ date: 1 });

    res.status(200).json({
      success: true,
      data: {
        upcomingClasses,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



exports.getStudentClasses = async (req, res) => {
  try {
    const studentId = req.user._id;

    const classes = await Class.find({
      student: studentId,
    }).sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: classes.length,
      data: classes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.createRequest = async (req, res) => {
  try {
    const studentId = req.user._id;

    const { classId, type, reason } = req.body;

    if (!classId || !type) {
      throw new Error("classId and type are required");
    }

    const classData = await Class.findById(classId);

    if (!classData) {
      throw new Error("Class not found");
    }

    if (classData.student.toString() !== studentId.toString()) {
      throw new Error("Unauthorized");
    }

    const request = await Request.create({
      classId,
      student: studentId,
      type,
      reason,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Request submitted",
      data: request,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


exports.getMyRequests = async (req, res) => {
  try {
    const studentId = req.user._id;

    const requests = await Request.find({ student: studentId })
      .populate("classId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.getStudentTests = async (req, res) => {
  try {
    const studentId = req.user._id;

    const tests = await Test.find({ student: studentId })
      .sort({ testDate: -1 });

    res.status(200).json({
      success: true,
      count: tests.length,
      data: tests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
