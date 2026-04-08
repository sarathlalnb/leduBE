const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/userModel");
const StudentProfile = require("../models/studentProfileModel");
const Class = require("../models/classModel");

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