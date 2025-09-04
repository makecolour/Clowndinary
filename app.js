require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var mysql = require('mysql2');
var expressLayouts = require('express-ejs-layouts');
var { initializeDatabase } = require('./config/database');
var { setUserLocals } = require('./middleware/auth');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var syncRouter = require('./routes/sync');

var app = express();

// Initialize database
initializeDatabase().catch(console.error);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Configure MySQL session store
var sessionStore = new MySQLStore({
  host: process.env.DB_HOST || 'localhost',
  port: 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'clowndinary',
  clearExpired: true,
  checkExpirationInterval: 900000, // 15 minutes
  expiration: 86400000, // 24 hours
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
});

app.use(session({
  key: 'clowndinary_session',
  secret: process.env.SESSION_SECRET || 'clowndinary-secret-key',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(setUserLocals);

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/sync', syncRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
