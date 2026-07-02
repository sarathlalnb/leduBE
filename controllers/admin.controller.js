const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/userModel");
const StudentProfile = require("../models/studentProfileModel");
const Class = require("../models/classModel");
const Test = require("../models/testModel");
const Request = require("../models/requestModel");

const getTutorRate = (tutor, rateKey) => {
  const value = tutor?.[rateKey];
  if (value === undefined || value === null || value === "") {
    return 0;
  }
  return Number(value);
};

const applyBillingToProfile = async (profile, classData, delta) => {
  if (!profile) return;

  const tutor = profile.tutors.find(
    (t) => t.name === classData.tutor.name && t.subject === classData.tutor.subject
  );

  if (!tutor) return;

  const duration = Number(classData.duration) || 0;
  const tutorRate = Number(classData.tutorRate ?? (getTutorRate(tutor, "tutorHourlyRate") || getTutorRate(tutor, "hourlyRate")));
  const studentRate = Number(classData.studentRate ?? getTutorRate(tutor, "studentHourlyRate"));

  profile.totalHours = Math.max(0, Number(profile.totalHours || 0) + delta * duration);
  profile.totalTutorFees = Math.max(0, Number(profile.totalTutorFees || 0) + delta * duration * tutorRate);
  profile.totalStudentFees = Math.max(0, Number(profile.totalStudentFees || 0) + delta * duration * studentRate);
  profile.totalFees = profile.totalStudentFees;

  await profile.save();
};

exports.registerTutor = async (req, res) => {
  try {
    const { name, email, password, hourlyRate = 0, subjects = [] } = req.body;

    if (!name || !email || !password) {
      throw new Error("Name, email, and password are required");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error("User already exists with this email");
    }

    const normalizedSubjects = Array.isArray(subjects)
      ? subjects.map((subject) => subject.trim()).filter(Boolean)
      : [];

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "tutor",
      hourlyRate: Number(hourlyRate) || 0,
      subjects: normalizedSubjects,
    });

    res.status(201).json({
      success: true,
      message: "Tutor registered successfully",
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllTutors = async (req, res) => {
  try {
    const tutors = await User.find({ role: "tutor" })
      .select("name email hourlyRate subjects createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();
    const reqYear = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();
    const reqMonth = req.query.month ? parseInt(req.query.month, 10) : now.getMonth() + 1;
    const startOfMonth = new Date(reqYear, reqMonth - 1, 1);
    const endOfMonth = new Date(reqYear, reqMonth, 1);

    const tutorNames = tutors.map(t => t.name);
    const classes = await Class.find({
      "tutor.name": { $in: tutorNames },
      status: "done"
    }).lean();

    const statsMap = {};
    tutorNames.forEach(name => {
      statsMap[name] = { totalClasses: 0, classesThisMonth: 0, hoursThisMonth: 0, totalHours: 0 };
    });

    classes.forEach(c => {
      const tName = c.tutor?.name;
      if (tName && statsMap[tName]) {
        statsMap[tName].totalClasses += 1;
        statsMap[tName].totalHours += Number(c.duration || 0);

        const d = new Date(c.date);
        if (d.getFullYear() === reqYear && d.getMonth() === reqMonth - 1) {
          statsMap[tName].classesThisMonth += 1;
          statsMap[tName].hoursThisMonth += Number(c.duration || 0);
        }
      }
    });

    const enrichedTutors = tutors.map(t => ({
      ...t,
      stats: statsMap[t.name] || { totalClasses: 0, classesThisMonth: 0, hoursThisMonth: 0, totalHours: 0 }
    }));

    res.status(200).json({
      success: true,
      count: enrichedTutors.length,
      data: enrichedTutors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateTutor = async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { name, email, subjects } = req.body;

    if (!tutorId) {
      throw new Error("Tutor id is required");
    }

    const tutor = await User.findById(tutorId);
    if (!tutor || tutor.role !== "tutor") {
      throw new Error("Tutor not found");
    }

    if (email && email !== tutor.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error("Email already in use");
      }
    }

    const normalizedSubjects = Array.isArray(subjects)
      ? subjects.map((subject) => subject.trim()).filter(Boolean)
      : [];

    tutor.name = name || tutor.name;
    tutor.email = email || tutor.email;
    tutor.subjects = normalizedSubjects;

    await tutor.save();

    res.status(200).json({
      success: true,
      message: "Tutor updated successfully",
      data: tutor,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteTutor = async (req, res) => {
  try {
    const { tutorId } = req.params;

    if (!tutorId) {
      throw new Error("Tutor id is required");
    }

    const tutor = await User.findById(tutorId);
    if (!tutor || tutor.role !== "tutor") {
      throw new Error("Tutor not found");
    }

    await User.findByIdAndDelete(tutorId);

    res.status(200).json({
      success: true,
      message: "Tutor deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateAssignedTutor = async (req, res) => {
  try {
    const { studentId, tutorId } = req.params;
    const { name, subject, tutorHourlyRate, studentHourlyRate, hourlyRate } = req.body;

    if (!studentId) {
      throw new Error("Student id is required");
    }

    if (!tutorId) {
      throw new Error("Assigned tutor id is required");
    }

    if (!name || !subject) {
      throw new Error("Tutor name and subject are required");
    }

    const profile = await StudentProfile.findOne({ student: studentId });

    if (!profile) {
      throw new Error("Student profile not found");
    }

    const tutorEntry = profile.tutors.id(tutorId);

    if (!tutorEntry) {
      throw new Error("Assigned tutor not found");
    }

    const duplicateTutorSubject = profile.tutors.some(
      (t) =>
        String(t._id) !== tutorId &&
        t.name.toLowerCase() === name.toLowerCase() &&
        t.subject.toLowerCase() === subject.toLowerCase()
    );

    if (duplicateTutorSubject) {
      throw new Error("Tutor already assigned for this subject");
    }

    const duplicateSubject = profile.tutors.some(
      (t) => String(t._id) !== tutorId && t.subject.toLowerCase() === subject.toLowerCase()
    );

    if (duplicateSubject) {
      throw new Error("Subject is already assigned to another tutor for this student");
    }

    const resolvedTutorRate = tutorHourlyRate ?? hourlyRate ?? 0;
    const resolvedStudentRate = studentHourlyRate ?? 0;

    tutorEntry.name = name;
    tutorEntry.subject = subject;
    tutorEntry.tutorHourlyRate = Number(resolvedTutorRate) || 0;
    tutorEntry.studentHourlyRate = Number(resolvedStudentRate) || 0;
    tutorEntry.hourlyRate = Number(resolvedTutorRate) || 0;

    profile.subjects = Array.from(
      new Set(profile.tutors.map((t) => t.subject).filter(Boolean))
    );

    await profile.save();

    res.status(200).json({
      success: true,
      message: "Assigned tutor updated successfully",
      data: profile,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.registerStudent = async (req, res) => {
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
        totalHours = 0,
        packageHours = 0,
        hoursPerDay = 1,
        packageStartDate,
        packageEndDate,
        packagePattern,
      } = req.body;

      if (!name || !email || !password) {
        throw new Error("Name, email, and password are required");
      }

      if (!parentName || !parentPhone || !school || !standard || !mode) {
        throw new Error("Missing required student profile fields");
      }

      // Check for duplicate subjects
      if (subjects && subjects.length !== new Set(subjects).size) {
        throw new Error("Duplicate subjects are not allowed for a student");
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error("User already exists with this email");
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: "student",
      });

      const profile = await StudentProfile.create({
        student: user._id,
        parentName,
        parentPhone,
        school,
        syllabus,
        standard,
        mode,
        remarks,
        subjects,
        tutors: [],
        totalHours: Number(totalHours) || 0,
        packageHours: Number(packageHours) || 0,
        hoursPerDay: Number(hoursPerDay) || 1,
        packageStartDate: packageStartDate ? new Date(packageStartDate) : undefined,
        packageEndDate: packageEndDate ? new Date(packageEndDate) : undefined,
        packagePattern: packagePattern || undefined,
      });

      res.status(201).json({
        success: true,
        data: {
          user,
          profile,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };


    exports.assignTutor = async (req, res) => {
      try {
        const { studentId } = req.params;

        const { name, subject, tutorHourlyRate, studentHourlyRate, hourlyRate } = req.body;

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

        // Check if the same tutor-subject combination already exists
        const isAlreadyAssigned = profile.tutors.some(
          (t) =>
            t.name.toLowerCase() === name.toLowerCase() &&
            t.subject.toLowerCase() === subject.toLowerCase()
        );

        if (isAlreadyAssigned) {
          throw new Error("Tutor already assigned for this subject");
        }

        // Check if the subject is already assigned to any tutor (prevent duplicate subjects)
        const isDuplicateSubject = profile.tutors.some(
          (t) => t.subject.toLowerCase() === subject.toLowerCase()
        );

        if (isDuplicateSubject) {
          throw new Error("Subject is already assigned to another tutor for this student");
        }

        const resolvedTutorRate = tutorHourlyRate ?? hourlyRate ?? 0;
        const resolvedStudentRate = studentHourlyRate ?? 0;

        profile.tutors.push({
          name,
          subject,
          tutorHourlyRate: Number(resolvedTutorRate) || 0,
          studentHourlyRate: Number(resolvedStudentRate) || 0,
          hourlyRate: Number(resolvedTutorRate) || 0,
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

    const { 
      tutorName, 
      subject, 
      date, 
      duration = 1,
      packageHours,
      packagePattern,
      packageStartDate,
      packageEndDate
    } = req.body;

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

    // Try exact match (name + subject, case-insensitive, trimmed)
    const tutorNameNorm = tutorName.trim().toLowerCase();
    const subjectNorm = subject.trim().toLowerCase();

    let tutor = profile.tutors.find(
      (t) =>
        t.name.trim().toLowerCase() === tutorNameNorm &&
        t.subject.trim().toLowerCase() === subjectNorm
    );

    // Fallback: match by name only (handles manual subject input or slight case/subject differences)
    if (!tutor) {
      tutor = profile.tutors.find(
        (t) => t.name.trim().toLowerCase() === tutorNameNorm
      );
    }

    if (!tutor) {
      throw new Error("Tutor not assigned to this student");
    }

    // Handle both single date and array of dates
    const dates = Array.isArray(date) ? date : [date];

    const newClasses = await Class.create(
      dates.map((d) => ({
        student: studentId,
        tutor: {
          name: tutor.name,
          subject: tutor.subject,
        },
        date: new Date(d),
        duration,
        tutorRate: Number(tutor.tutorHourlyRate ?? tutor.hourlyRate ?? 0) || 0,
        studentRate: Number(tutor.studentHourlyRate ?? 0) || 0,
        status: "scheduled",
      }))
    );

    // Update package info in profile if provided
    if (packageHours || packagePattern || packageStartDate) {
      if (packageHours !== undefined) profile.packageHours = Number(packageHours);
      if (duration !== undefined) profile.hoursPerDay = Number(duration);
      if (packagePattern !== undefined) profile.packagePattern = packagePattern;
      if (packageStartDate !== undefined) profile.packageStartDate = packageStartDate ? new Date(packageStartDate) : null;
      if (packageEndDate !== undefined) profile.packageEndDate = packageEndDate ? new Date(packageEndDate) : null;
      await profile.save();
    }

    res.status(201).json({
      success: true,
      message: `Class${dates.length > 1 ? "es" : ""} scheduled successfully`,
      data: Array.isArray(date) ? newClasses : newClasses[0],
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

    const isTutorRequest = req.user?.role === "tutor";
    if (isTutorRequest) {
      const tutorName = classData.tutor?.name?.toLowerCase();
      const currentTutorName = req.user?.name?.toLowerCase();
      if (!tutorName || tutorName !== currentTutorName) {
        throw new Error("You can only update your own classes");
      }
    }

    if (classData.status === "done" && status === "done") {
      throw new Error("Class already marked as done");
    }

    if (status === "postponed") {
      if (!newDate) {
        throw new Error("New date is required for postponing");
      }

      classData.date = new Date(newDate);
    }

    const previousStatus = classData.status;
    classData.status = status;

    const profile = await StudentProfile.findOne({ student: classData.student });
    if (previousStatus === "done" && status !== "done") {
      await applyBillingToProfile(profile, classData, -1);
    } else if (status === "done" && previousStatus !== "done") {
      await applyBillingToProfile(profile, classData, 1);
    }

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

exports.editClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date, duration, tutorName, subject } = req.body;

    if (!classId) {
      throw new Error("Class id is required");
    }

    const classData = await Class.findById(classId);

    if (!classData) {
      throw new Error("Class not found");
    }

    if (classData.status === "cancelled") {
      throw new Error("Cannot edit a cancelled class");
    }

    if (classData.status === "done") {
      throw new Error("Cannot edit a completed class");
    }

    // Update date if provided
    if (date) {
      classData.date = new Date(date);
    }

    // Update duration if provided
    if (duration) {
      classData.duration = duration;
    }

    // Update tutor information if provided
    if (tutorName || subject) {
      const profile = await StudentProfile.findOne({ student: classData.student });

      if (!profile) {
        throw new Error("Student profile not found");
      }

      // Find tutor with provided name and subject
      const tutor = profile.tutors.find(
        (t) =>
          (tutorName ? t.name.toLowerCase() === tutorName.toLowerCase() : t.name === classData.tutor.name) &&
          (subject ? t.subject.toLowerCase() === subject.toLowerCase() : t.subject === classData.tutor.subject)
      );

      if (!tutor) {
        throw new Error("Tutor not assigned to this student for the specified subject");
      }

      classData.tutor = {
        name: tutor.name,
        subject: tutor.subject,
      };
    }

    await classData.save();

    res.status(200).json({
      success: true,
      message: "Class updated successfully",
      data: classData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.bulkEditClasses = async (req, res) => {
  try {
    const { classIds, updateData } = req.body;

    if (!classIds || !Array.isArray(classIds) || classIds.length === 0) {
      throw new Error("classIds array is required and must not be empty");
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new Error("At least one field to update is required");
    }

    const { date, duration, tutorName, subject } = updateData;

    // Find all classes to validate them
    const classesData = await Class.find({ _id: { $in: classIds } });

    if (classesData.length === 0) {
      throw new Error("No classes found with the provided IDs");
    }

    // If tutorName/subject provided, validate for each class's student
    if (tutorName && subject) {
      const studentIds = [...new Set(classesData.map((c) => c.student.toString()))];
      for (const studentId of studentIds) {
        const profile = await StudentProfile.findOne({ student: studentId });
        if (!profile) throw new Error(`Student profile not found for student ${studentId}`);
        const tutor = profile.tutors.find(
          (t) =>
            t.name.toLowerCase() === tutorName.toLowerCase() &&
            t.subject.toLowerCase() === subject.toLowerCase()
        );
        if (!tutor) {
          throw new Error(`Tutor "${tutorName}" with subject "${subject}" is not assigned to student ${studentId}`);
        }
      }
    } else if (tutorName || subject) {
      throw new Error("Both tutorName and subject must be provided together");
    }

    // Build mongo update object
    const mongoUpdate = {};
    if (date) mongoUpdate.date = new Date(date);
    if (duration) mongoUpdate.duration = Number(duration);
    if (tutorName && subject) {
      mongoUpdate["tutor.name"] = tutorName;
      mongoUpdate["tutor.subject"] = subject;
    }

    await Class.updateMany({ _id: { $in: classIds } }, { $set: mongoUpdate });

    const finalClasses = await Class.find({ _id: { $in: classIds } });

    res.status(200).json({
      success: true,
      message: `${finalClasses.length} class(es) updated successfully`,
      count: finalClasses.length,
      data: finalClasses,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const { classId } = req.params;

    if (!classId) {
      throw new Error("Class id is required");
    }

    const classData = await Class.findById(classId);

    if (!classData) {
      throw new Error("Class not found");
    }

    if (classData.status === "done") {
      const profile = await StudentProfile.findOne({ student: classData.student });
      await applyBillingToProfile(profile, classData, -1);
    }

    await Class.findByIdAndDelete(classId);

    res.status(200).json({
      success: true,
      message: "Class deleted successfully",
      data: classData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


exports.deleteAllClasses = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      throw new Error("Student id is required");
    }

    const classesToDelete = await Class.find({ student: studentId });

    if (classesToDelete.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No classes found to delete",
        deletedCount: 0,
      });
    }

    // Reverse totalHours and totalFees for any "done" classes
    const profile = await StudentProfile.findOne({ student: studentId });
    if (profile) {
      for (const classData of classesToDelete) {
        if (classData.status === "done") {
          await applyBillingToProfile(profile, classData, -1);
        }
      }
    }

    await Class.deleteMany({ student: studentId });

    res.status(200).json({
      success: true,
      message: "All classes deleted successfully",
      deletedCount: classesToDelete.length,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!userId) {
      throw new Error("User id is required");
    }
    
    if (!newPassword) {
      throw new Error("New password is required");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const user = await User.findByIdAndUpdate(userId, { password: hashedPassword });
    if (!user) {
      throw new Error("User not found");
    }

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
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
      .sort({ createdAt: -1 })
      .lean();

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

    const now = new Date();
    const reqYear = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();
    const reqMonth = req.query.month ? parseInt(req.query.month, 10) : now.getMonth() + 1;

    const studentIds = result.map(p => p.student?._id).filter(Boolean);
    const classes = await Class.find({
      student: { $in: studentIds },
      status: "done"
    }).lean();

    const statsMap = {};
    studentIds.forEach(id => {
      statsMap[id.toString()] = { totalClasses: 0, classesThisMonth: 0, hoursThisMonth: 0, totalHours: 0 };
    });

    classes.forEach(c => {
      const sId = c.student?.toString();
      if (sId && statsMap[sId]) {
        statsMap[sId].totalClasses += 1;
        statsMap[sId].totalHours += Number(c.duration || 0);

        const d = new Date(c.date);
        if (d.getFullYear() === reqYear && d.getMonth() === reqMonth - 1) {
          statsMap[sId].classesThisMonth += 1;
          statsMap[sId].hoursThisMonth += Number(c.duration || 0);
        }
      }
    });

    const enrichedResult = result.map(p => ({
      ...p,
      stats: p.student?._id ? (statsMap[p.student._id.toString()] || { totalClasses: 0, classesThisMonth: 0, hoursThisMonth: 0, totalHours: 0 }) : { totalClasses: 0, classesThisMonth: 0, hoursThisMonth: 0, totalHours: 0 }
    }));

    res.status(200).json({
      success: true,
      count: enrichedResult.length,
      data: enrichedResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.getTutorDashboard = async (req, res) => {
  try {
    const tutorName = req.user?.name;
    if (!tutorName) {
      throw new Error("Tutor profile not found");
    }

    const now = new Date();
    const upcomingClasses = await Class.find({
      "tutor.name": tutorName,
      date: { $gte: now },
      status: { $in: ["scheduled", "postponed"] },
    }).sort({ date: 1 }).limit(10);

    const recentClasses = await Class.find({
      "tutor.name": tutorName,
      status: "done",
    }).sort({ date: -1 }).limit(10);

    const allClasses = await Class.find({ "tutor.name": tutorName });
    const completedClasses = allClasses.filter((item) => item.status === "done");
    const totalHours = completedClasses.reduce((sum, item) => sum + Number(item.duration || 0), 0);
    const totalRevenue = completedClasses.reduce((sum, item) => sum + Number(item.tutorRate || 0) * Number(item.duration || 0), 0);

    const monthlySummary = completedClasses.reduce((acc, item) => {
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = acc[monthKey] || { month: monthKey, classes: 0, hours: 0, revenue: 0 };
      existing.classes += 1;
      existing.hours += Number(item.duration || 0);
      existing.revenue += Number(item.tutorRate || 0) * Number(item.duration || 0);
      acc[monthKey] = existing;
      return acc;
    }, {});

    // Current month stats
    const currentNow = new Date();
    const currentMonthKey = `${currentNow.getFullYear()}-${String(currentNow.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthData = monthlySummary[currentMonthKey] || { classes: 0, hours: 0, revenue: 0 };
    const currentMonthStats = {
      totalClasses: currentMonthData.classes,
      totalHours: currentMonthData.hours,
      totalSalary: currentMonthData.revenue,
    };

    const studentProfiles = await StudentProfile.find({ "tutors.name": tutorName })
      .populate("student", "name email")
      .sort({ createdAt: -1 });

    const assignedStudents = [];

    for (const profile of studentProfiles) {
      if (!profile.student) continue;

      const matchingTutor = (profile.tutors || []).find(
        (tutor) => tutor?.name?.toLowerCase() === tutorName.toLowerCase()
      );

      const studentClasses = await Class.find({
        student: profile.student._id,
        "tutor.name": tutorName,
      }).sort({ date: 1 });

      assignedStudents.push({
        id: profile.student._id,
        name: profile.student.name,
        email: profile.student.email,
        school: profile.school,
        standard: profile.standard,
        subjects: profile.subjects || [],
        tutorSubject: matchingTutor?.subject || "",
        assignedClasses: studentClasses,
        upcomingClasses: studentClasses.filter(
          (item) => new Date(item.date) >= now && ["scheduled", "postponed"].includes(item.status)
        ),
        packageHours: profile.packageHours || 0,
        hoursPerDay: profile.hoursPerDay || 1,
        totalHours: profile.totalHours || 0,
        packageStartDate: profile.packageStartDate,
        packageEndDate: profile.packageEndDate,
        packagePattern: profile.packagePattern,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        upcomingClasses,
        recentClasses,
        assignedStudents,
        stats: {
          totalClasses: allClasses.length,
          completedClasses: completedClasses.length,
          totalHours,
          totalRevenue,
        },
        monthlySummary: Object.values(monthlySummary).sort((a, b) => a.month.localeCompare(b.month)),
        currentMonthStats,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getTutorSalaryReport = async (req, res) => {
  try {
    const { tutorName } = req.params;
    if (!tutorName) {
      throw new Error("Tutor name is required");
    }

    const now = new Date();
    // Parse year and month safely
    const reqYear = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();
    const reqMonth = req.query.month ? parseInt(req.query.month, 10) : now.getMonth() + 1; // 1-12

    const monthStart = new Date(reqYear, reqMonth - 1, 1);
    const monthEnd = new Date(reqYear, reqMonth, 1); // exclusive

    // All-time completed classes for this tutor
    const allDoneClasses = await Class.find({
      "tutor.name": { $regex: new RegExp(`^${tutorName}$`, "i") },
      status: "done",
    });

    // Completed classes for the selected month
    const monthDoneClasses = allDoneClasses.filter((cls) => {
      const d = new Date(cls.date);
      return d.getFullYear() === reqYear && d.getMonth() === reqMonth - 1;
    });

    // Build daily breakdown
    const daysInMonth = new Date(reqYear, reqMonth, 0).getDate();
    const dailyBreakdown = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayClasses = monthDoneClasses.filter((cls) => {
        const d = new Date(cls.date);
        return d.getDate() === day;
      });
      const hours = dayClasses.reduce((s, c) => s + Number(c.duration || 0), 0);
      const amount = dayClasses.reduce(
        (s, c) => s + Number(c.tutorRate || 0) * Number(c.duration || 0),
        0
      );
      dailyBreakdown.push({
        day,
        classCount: dayClasses.length,
        hours,
        amount,
      });
    }

    // Monthly totals
    const monthlyTotals = {
      totalClasses: monthDoneClasses.length,
      totalHours: monthDoneClasses.reduce((s, c) => s + Number(c.duration || 0), 0),
      totalAmount: monthDoneClasses.reduce(
        (s, c) => s + Number(c.tutorRate || 0) * Number(c.duration || 0),
        0
      ),
    };

    // All-time totals
    const allTimeTotals = {
      totalClasses: allDoneClasses.length,
      totalHours: allDoneClasses.reduce((s, c) => s + Number(c.duration || 0), 0),
      totalAmount: allDoneClasses.reduce(
        (s, c) => s + Number(c.tutorRate || 0) * Number(c.duration || 0),
        0
      ),
    };

    // Tutor user info
    const tutorUser = await User.findOne({
      name: { $regex: new RegExp(`^${tutorName}$`, "i") },
      role: "tutor",
    }).select("name email subjects");

    res.status(200).json({
      success: true,
      data: {
        tutorInfo: tutorUser || { name: tutorName },
        month: reqMonth,
        year: reqYear,
        daysInMonth,
        dailyBreakdown,
        monthlyTotals,
        allTimeTotals,
      },
    });
  } catch (error) {
    res.status(400).json({
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
      

    const tests = await Test.find({ student: studentId })
      .sort({ testDate: -1 })
    

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


exports.createTest = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { subject, testDate, totalMarks, marks = 0, remarks } = req.body;

    if (!studentId) {
      throw new Error("Student id is required");
    }

    if (!subject || !testDate || totalMarks === undefined) {
      throw new Error("Subject, testDate, and totalMarks are required");
    }

    const student = await User.findById(studentId);
    if (!student) {
      throw new Error("Student not found");
    }

    const newTest = await Test.create({
      student: studentId,
      subject,
      testDate: new Date(testDate),
      marks,
      totalMarks,
      remarks,
    });

    res.status(201).json({
      success: true,
      message: "Test created successfully",
      data: newTest,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


exports.updateTestMarks = async (req, res) => {
  try {
    const { testId } = req.params;
    const { marks, totalMarks, remarks } = req.body;

    if (!testId) {
      throw new Error("Test id is required");
    }

    if (marks === undefined && totalMarks === undefined && remarks === undefined) {
      throw new Error("At least one of marks, totalMarks, or remarks is required");
    }

    const test = await Test.findById(testId);
    if (!test) {
      throw new Error("Test not found");
    }

    if (marks !== undefined) test.marks = marks;
    if (totalMarks !== undefined) test.totalMarks = totalMarks;
    if (remarks !== undefined) test.remarks = remarks;

    await test.save();

    res.status(200).json({
      success: true,
      message: "Test updated successfully",
      data: test,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


exports.updateStudent = async (req, res) => {
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
      packageHours,
      hoursPerDay,
      packageStartDate,
      packageEndDate,
      packagePattern,
    } = req.body;

    if (!studentId) {
      throw new Error("Student id is required");
    }

    const user = await User.findById(studentId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check for duplicate subjects
    if (subjects && subjects.length !== new Set(subjects).size) {
      throw new Error("Duplicate subjects are not allowed for a student");
    }

    if (email && email !== user.email) {
      const exists = await User.findOne({ email });
      if (exists) {
        throw new Error("Email already in use");
      }
      user.email = email;
    }

    if (name) user.name = name;

    await user.save();

    const profile = await StudentProfile.findOne({ student: studentId });

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
    if (packageHours !== undefined) profile.packageHours = Number(packageHours) || 0;
    if (hoursPerDay !== undefined) profile.hoursPerDay = Number(hoursPerDay) || 1;
    if (packageStartDate !== undefined) profile.packageStartDate = packageStartDate ? new Date(packageStartDate) : null;
    if (packageEndDate !== undefined) profile.packageEndDate = packageEndDate ? new Date(packageEndDate) : null;
    if (packagePattern !== undefined) profile.packagePattern = packagePattern || null;

    await profile.save();

    res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: { user, profile },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};



exports.deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      throw new Error("Student id is required");
    }

    const user = await User.findById(studentId);
    if (!user) {
      throw new Error("User not found");
    }

    await StudentProfile.deleteOne({ student: studentId });

    await Class.deleteMany({ student: studentId });

    await Test.deleteMany({ student: studentId });

    await User.deleteOne({ _id: studentId });

    res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
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
      .populate("student", "name email")
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
        const postponeDate = newDate || request.postponedDate;
        if (!postponeDate) {
          throw new Error("Postpone date is required");
        }

        classData.status = "postponed";
        classData.date = new Date(postponeDate);
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


exports.createTutorRequest = async (req, res) => {
  try {
    const tutorUser = req.user;

    const { classId, type, reason, postponedDate } = req.body;

    if (!classId || !type) {
      throw new Error("classId and type are required");
    }

    if (!["postpone", "cancel"].includes(type)) {
      throw new Error("type must be 'postpone' or 'cancel'");
    }

    if (type === "postpone" && !postponedDate) {
      throw new Error("postponedDate is required for postpone requests");
    }

    const classData = await Class.findById(classId);

    if (!classData) {
      throw new Error("Class not found");
    }

    // Verify this class belongs to this tutor (by name match stored in class doc)
    if (classData.tutor?.name !== tutorUser.name) {
      throw new Error("Unauthorized: this class does not belong to you");
    }

    // Prevent duplicate pending requests
    const existing = await Request.findOne({
      classId,
      tutor: tutorUser._id,
      status: "pending",
    });
    if (existing) {
      throw new Error("A pending request already exists for this class");
    }

    const request = await Request.create({
      classId,
      student: classData.student,
      tutor: tutorUser._id,
      requestedBy: "tutor",
      type,
      reason,
      postponedDate: type === "postpone" ? new Date(postponedDate) : undefined,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Postpone request submitted successfully",
      data: request,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};