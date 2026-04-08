const express = require("express");
const { registerStudent, assignTutor, scheduleClass, updateClassStatus } = require("./controllers/admin.controller");
const router = express.Router();


router.post("/register-student", registerStudent);
router.post("/students/:studentId/assign-tutor", assignTutor);
router.post("/students/:studentId/schedule-class", scheduleClass);
router.patch("/classes/:classId/status", updateClassStatus);

module.exports = router;