const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/userModel");
const StudentProfile = require("../models/studentProfileModel");
const Class = require("../models/classModel");
const Test = require("../models/testModel");
const Request = require("../models/requestModel");


exports.registerStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      name,
      email,
      password,
      parentName,
      parentPhone,
      school,
      syllabus,
      standard,
      mode,
      remarks,
      subjects = [],
    } = req.body;

    if (!name || !email || !password) {
      throw new Error("Name, email, and password are required");
    }

    if (!parentName || !parentPhone || !school || !standard || !mode) {
      throw new Error("Missing required student profile fields");
    }

    const existingUser = await User.findOne({ email }).session(session);
    if (existingUser) {
      throw new Error("User already exists with this email");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create(
      [
        {
          name,
          email,
          password: hashedPassword,
          role: "student",
        },
      ],
      { session }
    );

    const profile = await StudentProfile.create(
      [
        {
          student: user[0]._id,
          parentName,
          parentPhone,
          school,
          syllabus,
          standard,
          mode,
          remarks,
          subjects,
          tutors: [],
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: {
        user: user[0],
        profile: profile[0],
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


exports.assignTutor = async (req, res) => {
  try {
    const { studentId } = req.params;

    const { name, subject, hourlyRate } = req.body;

    if (!studentId) {
      throw new Error("Student id is required");
    }

    if (!name || !subject) {
      throw new Error("Tutor name and subject are required");
    }

    const profile = await StudentProfile.findOne({ student: studentId });

    if (!profile) {
      throw new Error("Student profile not found");
    }

    const isAlreadyAssigned = profile.tutors.some(
      (t) =>
        t.name.toLowerCase() === name.toLowerCase() &&
        t.subject.toLowerCase() === subject.toLowerCase()
    );

    if (isAlreadyAssigned) {
      throw new Error("Tutor already assigned for this subject");
    }

    profile.tutors.push({
      name,
      subject,
      hourlyRate: hourlyRate || 0,
    });

    if (!profile.subjects.includes(subject)) {
      profile.subjects.push(subject);
    }

    await profile.save();

    res.status(200).json({
      success: true,
      message: "Tutor assigned successfully",
      data: profile,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


exports.scheduleClass = async (req, res) => {
  try {
    const { studentId } = req.params;

    const { tutorName, subject, date, duration = 1 } = req.body;

    if (!studentId) {
      throw new Error("Student id is required");
    }

    if (!tutorName || !subject || !date) {
      throw new Error("Tutor, subject and date are required");
    }

    const profile = await StudentProfile.findOne({ student: studentId });

    if (!profile) {
      throw new Error("Student profile not found");
    }

    const tutor = profile.tutors.find(
      (t) =>
        t.name.toLowerCase() === tutorName.toLowerCase() &&
        t.subject.toLowerCase() === subject.toLowerCase()
    );

    if (!tutor) {
      throw new Error("Tutor not assigned to this student");
    }

    const newClass = await Class.create({
      student: studentId,
      tutor: {
        name: tutor.name,
        subject: tutor.subject,
      },
      date: new Date(date),
      duration,
      status: "scheduled",
    });

    res.status(201).json({
      success: true,
      message: "Class scheduled successfully",
      data: newClass,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}; 

exports.updateClassStatus = async (req, res) => {
  try {
    const { classId } = req.params;
    const { status, newDate } = req.body;

    if (!classId) {
      throw new Error("Class id is required");
    }

    if (!status) {
      throw new Error("Status is required");
    }

    const allowedStatuses = ["done", "postponed", "cancelled"];

    if (!allowedStatuses.includes(status)) {
      throw new Error("Invalid status");
    }

    const classData = await Class.findById(classId);

    if (!classData) {
      throw new Error("Class not found");
    }

    if (classData.status === "cancelled") {
      throw new Error("Cannot update a cancelled class");
    }

    if (classData.status === "done") {
      throw new Error("Class already marked as done");
    }

    if (status === "postponed") {
      if (!newDate) {
        throw new Error("New date is required for postponing");
      }

      classData.date = new Date(newDate);
    }

    classData.status = status;

    await classData.save();

    res.status(200).json({
      success: true,
      message: "Class status updated successfully",
      data: classData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllStudents = async (req, res) => {
  try {
    const { search, mode, standard } = req.query;

    const filter = {};

    if (mode) {
      filter.mode = mode;
    }

    if (standard) {
      filter.standard = standard;
    }

    let query = StudentProfile.find(filter)
      .populate("student", "name email")
      .sort({ createdAt: -1 });

    const profiles = await query;

    let result = profiles;

    if (search) {
      const keyword = search.toLowerCase();

      result = profiles.filter(
        (p) =>
          p.student?.name.toLowerCase().includes(keyword) ||
          p.student?.email.toLowerCase().includes(keyword) ||
          p.parentName.toLowerCase().includes(keyword) ||
          p.school.toLowerCase().includes(keyword)
      );
    }

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.getSingleStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      throw new Error("Student id is required");
    }

    const profile = await StudentProfile.findOne({ student: studentId })
      .populate("student", "name email");

    if (!profile) {
      throw new Error("Student not found");
    }

    const classes = await Class.find({ student: studentId })
      .sort({ date: -1 })
      .limit(10);

    const tests = await Test.find({ student: studentId })
      .sort({ testDate: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        profile,
        classes,
        tests,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


exports.updateStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { studentId } = req.params;

    const {
      name,
      email,
      parentName,
      parentPhone,
      school,
      syllabus,
      standard,
      mode,
      remarks,
      subjects,
    } = req.body;

    if (!studentId) {
      throw new Error("Student id is required");
    }

    const user = await User.findById(studentId).session(session);
    if (!user) {
      throw new Error("User not found");
    }

    if (email && email !== user.email) {
      const exists = await User.findOne({ email }).session(session);
      if (exists) {
        throw new Error("Email already in use");
      }
      user.email = email;
    }

    if (name) user.name = name;

    await user.save({ session });

    const profile = await StudentProfile.findOne({ student: studentId }).session(session);

    if (!profile) {
      throw new Error("Student profile not found");
    }

    if (parentName) profile.parentName = parentName;
    if (parentPhone) profile.parentPhone = parentPhone;
    if (school) profile.school = school;
    if (syllabus) profile.syllabus = syllabus;
    if (standard) profile.standard = standard;
    if (mode) profile.mode = mode;
    if (remarks !== undefined) profile.remarks = remarks;
    if (subjects) profile.subjects = subjects;

    await profile.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: { user, profile },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


exports.deleteStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { studentId } = req.params;

    if (!studentId) {
      throw new Error("Student id is required");
    }

    const user = await User.findById(studentId).session(session);
    if (!user) {
      throw new Error("User not found");
    }

    await StudentProfile.deleteOne({ student: studentId }).session(session);

    await Class.deleteMany({ student: studentId }).session(session);

    await Test.deleteMany({ student: studentId }).session(session);

    await User.deleteOne({ _id: studentId }).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};



exports.getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();

    const totalStudentsPromise = User.countDocuments({ role: "student" });

    const totalClassesPromise = Class.countDocuments();

    const classStatsPromise = Class.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const upcomingClassesPromise = Class.find({
      date: { $gte: now },
      status: "scheduled",
    })
      .sort({ date: 1 })
      .limit(5);

    const recentStudentsPromise = StudentProfile.find()
      .populate("student", "name email")
      .sort({ createdAt: -1 })
      .limit(5);

    const [
      totalStudents,
      totalClasses,
      classStats,
      upcomingClasses,
      recentStudents,
    ] = await Promise.all([
      totalStudentsPromise,
      totalClassesPromise,
      classStatsPromise,
      upcomingClassesPromise,
      recentStudentsPromise,
    ]);

    const formattedStats = {
      scheduled: 0,
      done: 0,
      postponed: 0,
      cancelled: 0,
    };

    classStats.forEach((item) => {
      formattedStats[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        totalClasses,
        classStats: formattedStats,
        upcomingClasses,
        recentStudents,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.handleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, newDate } = req.body;

    if (!requestId) {
      throw new Error("Request id is required");
    }

    if (!["approved", "rejected"].includes(status)) {
      throw new Error("Invalid status");
    }

    const request = await Request.findById(requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status !== "pending") {
      throw new Error("Request already processed");
    }

    const classData = await Class.findById(request.classId);

    if (!classData) {
      throw new Error("Class not found");
    }

    if (status === "approved") {
      if (request.type === "cancel") {
        classData.status = "cancelled";
      }

      if (request.type === "postpone") {
        if (!newDate) {
          throw new Error("New date required for postponing");
        }

        classData.status = "postponed";
        classData.date = new Date(newDate);
      }
    }

    request.status = status;

    await classData.save();
    await request.save();

    res.status(200).json({
      success: true,
      message: `Request ${status} successfully`,
      data: {
        request,
        class: classData,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


exports.getAllRequests = async (req, res) => {
  try {
    const { status, type } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (type) {
      filter.type = type;
    }

    const requests = await Request.find(filter)
      .populate({
        path: "classId",
        select: "date status tutor",
      })
      .populate({
        path: "student",
        select: "name email",
      })
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