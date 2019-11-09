const express 		= require('express');
const logger 	    = require('morgan');
const bodyParser 	= require('body-parser');
const passport      = require('passport');
const pe            = require('parse-error');
const cors          = require('cors');
const fileUpload = require('express-fileupload');
const path = require('path');
const cron = require("node-cron");
const compression = require('compression');

const v1    = require('./routes/v1');
const app   = express();

const CONFIG = require('./config/config');

app.use(logger('dev'));
app.use(bodyParser.json({limit: '5000mb', extended: true}));
app.use(bodyParser.urlencoded({limit: '5000mb', extended: true}));
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
}));
//app.use(express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
// app.use(cookieParser());
// app.use(express.static(path.join(__dirname, 'public')));

//Passport
app.use(passport.initialize());

/*
* function to uodate forex rates 
* in database
*/
function updateForexRates () {
  console.log("Fetching USD to INR forex rate");
  const ForexController   = require('./controllers/forex.controller');
  ForexController.fetchForexRates()
}

/*
* function for video optimzation
*/

function optimizeVideos () {
    const VideoController   = require('./controllers/video.controller');
    VideoController.optimizeVideos()
}

/*
* function to create default tag in database
*/

function createDefaultTag () {
  console.log("Creating default tag");
  const TagsController   = require('./controllers/tags.controller');
  TagsController.createDefaultTag()
}

/*
* function to take the mysql db backup and then send the backup 
* file to S3 bucket
* the function is called in by Cron job in regular intervals
*/

function dbBackup () {
  console.log("Taking Database backup");
  const dbbackupController   = require('./controllers/dbbackup.controller');
  dbbackupController.backupDb()
}


//Log Env
console.log("Environment:", CONFIG.app)
//DATABASE
const models = require("./models");
models.sequelize.authenticate().then(() => {
    console.log('Connected to SQL database:', CONFIG.db_name);
})
.catch(err => {
    console.error('Unable to connect to SQL database:',CONFIG.db_name, err);
});
if(CONFIG.app==='dev'){
    models.sequelize.sync()//creates table if they do not already exist
      .then ((data) => {

        //update the forex rates after
        // all the tables are created
        updateForexRates();

        //create the default tag if it doesn't already exist
        createDefaultTag()

      })
    // models.sequelize.sync({ force: true });//deletes all tables then recreates them useful for testing and development purposes
}
// CORS
app.use(cors({
  origin: CONFIG.CORS_WHITELIST
}));

// compress all responses
app.use(compression())

app.use('/v1', v1);

app.use('/', function(req, res){
	res.statusCode = 200;//send the appropriate status code
	res.json({status:"success", message:"Parcel Pending API", data:{}})
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
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

//This is here to handle all the uncaught promise rejections
process.on('unhandledRejection', error => {
    console.error('Uncaught Error', pe(error));
});


//cron job running once in 12 hours and stores 
// USD to INR forex rate in database    
cron.schedule("0 0 */12 * * *", function() {
  updateForexRates();
});

//cron job running once in 10 minutes for 
// optimizing the videos   
cron.schedule("0 */1 * * * *", function() {
  optimizeVideos();
});

/*
* disable auto-db backup script as we have used
* RDS for Database which automatically takes care
* of DB backup
*/
// cron job for taking database backup every hour
//"0 0 */1 * * *"
//cron.schedule("0 0 */1 * * *", function() {
  //dbBackup();
//});