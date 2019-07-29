const CONFIG  = require('../config/config');
const S3Controller   = require('./s3.controller');
const moment = require("moment");
const childProcess = require('child_process');

const backupDb = async function() {
	 try {
	 	let dumpCommand = 'mysqldump -u' + CONFIG.db_user + ' -p' + CONFIG.db_password + ' ' + CONFIG.db_name;
	     let backupFolder = 'backup/db/';
	     let backupfFileName = function () {
	     	let today = new Date();
	    	let year = today.getFullYear();
	    	let month = today.getMonth()+1;
	    	return year + "/" + month + "/" + CONFIG.db_name + '-' + moment().format('YYYY-MM-DD-HH-mm-ss') + '.sql';
	     }
	     childProcess.exec(dumpCommand, (error, stdout, stderr)=> {
	        S3Controller.uploadBufferToS3(Buffer.from(stdout, 'utf8'), backupfFileName(), backupFolder)
	          console.log("Backup uploaded")
	     });
	 } catch (e) {
	 	console.log("Something went wrong while backing up the DB");
	 	console.log(e)
	 }
	 
}

module.exports.backupDb = backupDb;