const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new Error("Not authorized, no token");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      throw new Error("User not found");
    }

    req.user = user;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};

exports.isAdmin = (req, res, next) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      throw new Error("Access denied. Admins only.");
    }

    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      message: error.message,
    });
  }
};