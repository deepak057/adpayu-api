require('dotenv').config();//instatiate environment variables
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
//const { GlacierClient } = require('@aws-sdk/client-glacier-node/GlacierClient');
//const { UploadArchiveCommand } = require('@aws-sdk/client-glacier-node/UploadArchiveCommand');


//configuring the AWS environment
AWS.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY,
	secretAccessKey: process.env.AWS_SECRET
});


const uploadToS3 = function (filePath, folder = '') {
	
	return new Promise(function(resolve, reject) {
		var s3 = new AWS.S3();

		//configuring parameters
		var params = {
		  Bucket: process.env.AWS_S3_BUCKET_NAME,
		  Body : fs.createReadStream(filePath),
		  Key : folder + path.basename(filePath)
		};

		s3.upload(params, function (err, data) {
	  		//handle error
		  if (err) {
		    console.log("Error", err);
		    reject(err)
		  }

		  //success
		  if (data) {
		    console.log("Uploaded in:", data.Location);
		    resolve(data);
		  }

		});
	});
	
}

module.exports.uploadToS3 = uploadToS3;

const uploadToS3Glacier = function (filePath, folder = '') {
	
	return new Promise(function(resolve, reject) {
		
		AWS.config.update({region: 'ap-south-1'});

		let glacier = new AWS.Glacier();

		let params = {vaultName: 'svanq', body: /*fs.createReadStream(filePath)*/Buffer.from(filePath, 'base64')};

		glacier.uploadArchive(params, function(err, data) {
		  if (err) {
		    console.log("Error uploading archive!", err);
		    reject(err)
		  } else {
		    console.log("Archive ID", data.archiveId);
		    resolve(data);
		  }
		});

		/*
		const glacier = new GlacierClient({region: 'ap-south-1'});

		const params = {
		    vaultName: 'svanq',
		    accountId: '698885112665',
		    body: fs.createReadStream(filePath)
		};

		const uploadArchiveCommand = new UploadArchiveCommand(params);
		
		glacier.send(uploadArchiveCommand).then(data => {
		    console.log('Uploaded to S3 glacier.')
		    resolve(data)
		}).catch(error => {
		    reject(error)
		})
		*/
	});
	
}

module.exports.uploadToS3Glacier = uploadToS3Glacier;