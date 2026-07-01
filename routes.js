const express = require("express");
const {
  registerStudent,
  registerTutor,
  getAllTutors,
  updateTutor,
  deleteTutor,
  assignTutor,
  updateAssignedTutor,
  scheduleClass,
  updateClassStatus,
  editClass,
  bulkEditClasses,
  deleteClass,
  deleteAllClasses,
  getAllStudents,
  getSingleStudent,
  updateStudent,
  deleteStudent,
  getAdminDashboard,
  getTutorDashboard,
  getTutorSalaryReport,
  handleRequest,
  getAllRequests,
  createTest,
  updateTestMarks,
  createTutorRequest,
} = require("./controllers/admin.controller");
const {
  getStudentDashboard,
  getStudentClasses,
  createRequest,
  getMyRequests,
  getStudentTests,
} = require("./controllers/student.controller");
const { protect, isAdmin, isTutor } = require("./middlewares/authMiddleware");
const { login } = require("./controllers/auth.controller");
const router = express.Router();


router.post("/login", login);
router.post("/register-student", protect, isAdmin, registerStudent);
router.post("/register-tutor", protect, isAdmin, registerTutor);
router.get("/tutors", protect, isAdmin, getAllTutors);
router.put("/tutors/:tutorId", protect, isAdmin, updateTutor);
router.delete("/tutors/:tutorId", protect, isAdmin, deleteTutor);
router.get("/tutors/:tutorName/salary-report", protect, isAdmin, getTutorSalaryReport);
// -
router.post("/students/:studentId/assign-tutor", protect, isAdmin, assignTutor);
router.put("/students/:studentId/tutors/:tutorId", protect, isAdmin, updateAssignedTutor);
router.post(
  "/students/:studentId/schedule-class",
  protect,
  isAdmin,
  scheduleClass,
);
router.post("/students/:studentId/tests", protect, isAdmin, createTest);
router.patch("/tests/:testId/marks", protect, isAdmin, updateTestMarks);
router.patch("/classes/:classId/status", protect, updateClassStatus);
router.patch("/classes/bulk-edit", protect, isAdmin, bulkEditClasses);
router.patch("/classes/:classId", protect, isAdmin, editClass);
router.delete("/classes/:classId", protect, isAdmin, deleteClass);
// -
router.get("/students", protect, isAdmin, getAllStudents);
router.get("/students/:studentId", protect, isAdmin, getSingleStudent);
router.put("/students/:studentId", protect, isAdmin, updateStudent);
router.delete("/students/:studentId/classes", protect, isAdmin, deleteAllClasses);
router.delete("/students/:studentId", protect, isAdmin, deleteStudent);
// -
router.get("/dashboard", protect, isAdmin, getAdminDashboard);
router.get("/tutor-dashboard", protect, isTutor, getTutorDashboard);
router.post("/tutor-request", protect, isTutor, createTutorRequest);

// -
router.get("/requests", protect, isAdmin, getAllRequests);
router.patch("/requests/:requestId", protect, isAdmin, handleRequest);


// -st


router.get("/student-dashboard", protect, getStudentDashboard);

router.get("/student-classes", protect, getStudentClasses);

router.post("/student-request", protect, createRequest);

router.get("/student-requests", protect, getMyRequests);

router.get("/student-tests", protect, getStudentTests);


module.exports = router;
