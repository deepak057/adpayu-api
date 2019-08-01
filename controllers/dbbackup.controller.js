const CONFIG  = require('../config/config');
const S3Controller   = require('./s3.controller');
const moment = require("moment");
const childProcess = require('child_process');
const appRoot = require('app-root-path');

const backupDb = async function() {
	 try {
	 	 //let dumpCommand = 'mysqldump -u' + CONFIG.db_user + ' -p' + CONFIG.db_password + ' ' + CONFIG.db_name;
	     let fileName = CONFIG.db_name + '-' + moment().format('YYYY-MM-DD-HH-mm-ss') + '.sql';
	     let backupfFileFolder = function () {
	     	let backupFolder = 'backup/db/';
	     	let today = new Date();
	    	return backupFolder + today.getFullYear() + "/" + (today.getMonth()+1) + "/"
	     }
	     let localFilePath = appRoot + '/uploads/' + fileName;
	     let dumpCommand = 'mysqldump -u ' + CONFIG.db_user +' -p'+ CONFIG.db_password +' ' + CONFIG.db_name + ' > ' + localFilePath;
	     
	     childProcess.exec(dumpCommand, (error, stdout, stderr)=> {
	        console.log('Uploading the DB backup');
	        S3Controller.uploadToS3(localFilePath, backupfFileFolder())
	          .then((data) => {
	          	console.log("DB Backup uploaded")
	          })
	     });
	 } catch (e) {
	 	console.log("Something went wrong while backing up the DB");
	 	console.log(e)
	 }
	 
}

module.exports.backupDb = backupDb;