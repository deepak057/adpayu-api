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

function getParameters (buffer = false, file = false) {
    //configuring parameters
	let r_ = {
	  Bucket: process.env.AWS_S3_BUCKET_NAME,
	  Body : fs.createReadStream(filePath),
	  Key : folder + path.basename(filePath)
	}
}

function upload (params, filePath = false, deleteFile = true) {
	return new Promise(function(resolve, reject) {
		try {

			var s3 = new AWS.S3();

			s3.upload(params, function (err, data) {
		  		//handle error
			  if (err) {
			    console.log("Error", err);
			    reject(err)
			  }

			  //success
			  if (data) {
			  	if(filePath && deleteFile) {
			  		fs.unlink(filePath, function() {
			  			console.log('Uploaded to S3, Original file deleted.')
			  		});	
			  	}
			    console.log("Uploaded in:", data.Location);
			    resolve(data);
			  }

			});

		} catch (e) {
			reject(e)
		}
		
	});
	
}

const uploadBufferToS3 = function (buffer, fileName, folder = 'public/') {
	//configuring parameters
	let params = {
	  Bucket: process.env.AWS_S3_BUCKET_NAME,
	  Body : buffer,
	  Key : folder + fileName
	};

	return upload(params, false);
}

module.exports.uploadBufferToS3 = uploadBufferToS3;

const uploadToS3 = function (filePath, folder = 'public/', deleteFile = true) {
	
	//configuring parameters
	let params = {
	  Bucket: process.env.AWS_S3_BUCKET_NAME,
	  Body : fs.createReadStream(filePath),
	  Key : folder + path.basename(filePath)
	};

	return upload(params, filePath, deleteFile);
}

module.exports.uploadToS3 = uploadToS3;

const copyS3Object = function (copySource, copyDestination) {
	return new Promise(function(resolve, reject) {
		try {

			var s3 = new AWS.S3();

			//configuring parameters
			var params = {
			  Bucket: process.env.AWS_S3_BUCKET_NAME,
			  CopySource: process.env.AWS_S3_BUCKET_NAME + '/' + copySource,
			  Key : copyDestination
			};

			s3.copyObject(params, function (err, data) {
		  	  //handle error
			  if (err) {
			    console.log("Error", err);
			    reject(err)
			  }

			  //success
			  else {
			    console.log("S3 object (" + copySource + ") copied to " + copyDestination);
			    resolve(data);
			  }

			});

		} catch (e) {
			reject(e)
		}
		
	});
}

const deleteS3Object = function (fileName, folder = '') {
	
	return new Promise(function(resolve, reject) {
		try {

			var s3 = new AWS.S3();

			//configuring parameters
			var params = {
			  Bucket: process.env.AWS_S3_BUCKET_NAME,
			  Key : folder + fileName
			};

			// copy the object to Trash folder before deleting
			copyS3Object(folder + fileName, 'trash/' + fileName)
			  .then ((data) => {

			  	s3.deleteObject(params, function (err, data) {
			  	  //handle error
				  if (err) {
				    console.log("Error", err);
				    reject(err)
				  }

				  //success
				  else {
				    console.log("S3 object (" + fileName + ") deleted");
				    resolve(data);
				  }

				});

			  })

		} catch (e) {
			reject(e)
		}
		
	});
	
}

module.exports.deleteS3Object = deleteS3Object;

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