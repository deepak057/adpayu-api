const { Images} = require('../models');
const { to, ReE, ReS, uniqeFileName, videoToPNG, getDomainURL } = require('../services/util.service');
const { captureVideoPoster, optimizeImage } = require('../services/app.service');
const appRoot = require('app-root-path');
const S3Controller   = require('./s3.controller');
const fs = require('fs');
require('dotenv').config();
const AWS = require('aws-sdk');

//configuring the AWS environment
AWS.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY,
	secretAccessKey: process.env.AWS_SECRET
});

const transcodeVideo =  function function_name(fileName) {
	return new Promise(function (resolve, reject) {
		try {
		  let elastictranscoder = new AWS.ElasticTranscoder();
		  elastictranscoder.createJob(getTranscodingParameteres(fileName), function(err, data) {
			  if (err) {
			  	throw err
			  } 
			  else {
			  	console.log(data)
			  	resolve(data); 
			  }
		  });
		} catch (e) {
			console.log(e)
			reject(e)
		}
	})
}

function getTranscodingParameteres (fileName) {
	return {
		PipelineId: '1567496975573-0lfuuw',
		OutputKeyPrefix: 'docs/',
		Input: {
			Key: 'public/' + fileName
		},
		Output: {
			Key: fileName,
			PresetId: '1351620000001-100070',
			Watermarks: [
				{
					PresetWatermarkId: 'BottomRight',
					InputKey: 'public/logo-light-icon.png'
				}
			]

		}
		
	}
}

module.exports.transcodeVideo = transcodeVideo;