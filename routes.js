const express = require("express");
const {
  registerStudent,
  assignTutor,
  scheduleClass,
  updateClassStatus,
  getAllStudents,
  getSingleStudent,
  updateStudent,
  deleteStudent,
  getAdminDashboard,
  handleRequest,
  getAllRequests,
  createTest,
  updateTestMarks,
} = require("./controllers/admin.controller");
const {
  getStudentDashboard,
  getStudentClasses,
  createRequest,
  getMyRequests,
  getStudentTests,
} = require("./controllers/student.controller");
const { protect, isAdmin } = require("./middlewares/authMiddleware");
const { login } = require("./controllers/auth.controller");
const router = express.Router();


router.post("/login", login);
router.post("/register-student", protect, isAdmin, registerStudent);
// -
router.post("/students/:studentId/assign-tutor", protect, isAdmin, assignTutor);
router.post(
  "/students/:studentId/schedule-class",
  protect,
  isAdmin,
  scheduleClass,
);
router.post("/students/:studentId/tests", protect, isAdmin, createTest);
router.patch("/tests/:testId/marks", protect, isAdmin, updateTestMarks);
router.patch("/classes/:classId/status", protect, isAdmin, updateClassStatus);
// -
router.get("/students", protect, isAdmin, getAllStudents);
router.get("/students/:studentId", protect, isAdmin, getSingleStudent);
router.put("/students/:studentId", protect, isAdmin, updateStudent);
router.delete("/students/:studentId", protect, isAdmin, deleteStudent);
// -
router.get("/dashboard", protect, isAdmin, getAdminDashboard);

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
