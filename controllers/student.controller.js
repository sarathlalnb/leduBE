const Class = require("../models/classModel");
const Request = require("../models/requestModel");
const Test = require("../models/testModel");
const StudentProfile = require("../models/studentProfileModel");


exports.getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user._id;

    const now = new Date();

    // Upcoming classes (next 5)
    const upcomingClasses = await Class.find({
      student: studentId,
      date: { $gte: now },
      status: "scheduled",
    }).sort({ date: 1 }).limit(5);

    // Recent completed classes (last 5)
    const recentClasses = await Class.find({
      student: studentId,
      status: "done",
    }).sort({ date: -1 }).limit(5);

    // Recent tests (last 5)
    const recentTests = await Test.find({
      student: studentId,
    }).sort({ testDate: -1 }).limit(5);

    // Pending requests
    const pendingRequests = await Request.find({
      student: studentId,
      status: "pending",
    }).populate("classId").sort({ createdAt: -1 });

    // Student profile summary
    const studentProfile = await StudentProfile.findOne({
      student: studentId,
    }).select("school standard subjects totalHours totalFees");

    // Upcoming tests (next 3)
    const upcomingTests = await Test.find({
      student: studentId,
      testDate: { $gte: now },
    }).sort({ testDate: 1 }).limit(3);

    // Statistics
    const totalClasses = await Class.countDocuments({ student: studentId });
    const completedClasses = await Class.countDocuments({ 
      student: studentId, 
      status: "done" 
    });
    const totalTests = await Test.countDocuments({ student: studentId });

    res.status(200).json({
      success: true,
      data: {
        upcomingClasses,
        recentClasses,
        recentTests,
        upcomingTests,
        pendingRequests,
        studentProfile,
        statistics: {
          totalClasses,
          completedClasses,
          totalTests,
          pendingRequestsCount: pendingRequests.length,
        },
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

    const { classId, type, reason, postponedDate } = req.body;

    if (!classId || !type) {
      throw new Error("classId and type are required");
    }

    if (type === "postpone" && !postponedDate) {
      throw new Error("postponedDate is required for postpone requests");
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
      postponedDate: type === "postpone" ? new Date(postponedDate) : undefined,
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
