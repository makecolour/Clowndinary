const CloudinaryConfig = require('../models/CloudinaryConfig');

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  if (req.session && req.session.cloudinaryConfig) {
    return next();
  } else {
    return res.redirect('/login');
  }
}

// Middleware to check if user is already authenticated
function redirectIfAuth(req, res, next) {
  if (req.session && req.session.cloudinaryConfig) {
    return res.redirect('/dashboard');
  } else {
    return next();
  }
}

// Middleware to make user data available in templates
function setUserLocals(req, res, next) {
  res.locals.user = req.session && req.session.cloudinaryConfig ? req.session.cloudinaryConfig : null;
  return next();
}

module.exports = {
  requireAuth,
  redirectIfAuth,
  setUserLocals
};
