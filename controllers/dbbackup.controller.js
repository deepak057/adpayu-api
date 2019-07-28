const { to, ReE, ReS, uniqeFileName } = require('../services/util.service');
const appRoot = require('app-root-path');
const CONFIG  = require('../config/config');
const S3Controller   = require('./s3.controller');
const fs = require('fs');
const childProcess = require('child_process');
require('dotenv').config();

const backupDb = async function() {
	 var dumpCommand = 'mysqldump -u' + CONFIG.db_user + ' -p' + CONFIG.db_password + ' ' + CONFIG.db_name;
     childProcess.exec(dumpCommand, (error, stdout, stderr)=> {
        var bufferData = Buffer.from(stdout, 'utf8');
        S3Controller.uploadBufferToS3(bufferData, 'backup.sql', 'backup/db/')
          console.log("Backup uploaded")
     });
}

module.exports.backupDb = backupDb;