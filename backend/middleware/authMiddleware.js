
const jwt = require("jsonwebtoken");

// Verify that the request contains a valid JWT
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  // Expected format: Authorization: Bearer <token>
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "error",
      message: "Access denied. Authentication token required.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach authenticated user's details to the request
    req.user = {
      id: decoded.sub,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired token",
    });
  }
}

// Allow only specified roles to access a route
function allowRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden. You do not have permission to access this resource.",
      });
    }

    next();
  };
}

module.exports = { verifyToken, allowRoles };
