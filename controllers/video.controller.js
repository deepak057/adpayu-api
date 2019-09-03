const { Videos, Comments} = require('../models');
const { to, ReE, ReS } = require('../services/util.service');
const S3Controller   = require('./s3.controller');
require('dotenv').config();
const AWS = require('aws-sdk');
const Sequelize = require('sequelize');
const op = Sequelize.Op;


//configuring the AWS environment
AWS.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY,
	secretAccessKey: process.env.AWS_SECRET
});

const transcodeVideo =  function (inputFileName, outputFileName) {
	return new Promise(function (resolve, reject) {
		try {
		  let elastictranscoder = new AWS.ElasticTranscoder();
		  elastictranscoder.createJob(getTranscodingParameteres(inputFileName, outputFileName), function(err, data) {
			  if (err) {
			  	throw err
			  } 
			  else {
			  	if(data.Job.Id) {
			  		elastictranscoder.waitFor('jobComplete', {Id: data.Job.Id }, function(err, data) {
					  if (!err && data) {
					  	console.log('Video transcoded for Job Id-' + data.Job.Id);
					  	resolve(data);
					  }
					});
			  	}
			  	 
			  }
		  });
		} catch (e) {
			console.log(e)
			reject(e)
		}
	})
}

function getTranscodingParameteres (inputFileName, outputFileName) {
	return {
		PipelineId: '1567496975573-0lfuuw',
		OutputKeyPrefix: 'public/',
		Input: {
			Key: 'public/' + inputFileName
		},
		Output: {
			Key: outputFileName,
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

/*
* This video optimisation function does the following-
* 1. It first copies the original S3 video file to Original/ folder
* 2. Transcodes and optimises the original video using AWS Elastic Transcoder 
* 3. Copies the transcoded video to the orignal video and then delets the copied video
* 4. Updates the database to flag the given video Optimised
*/


function optimizeVideoFile (dbObj, type = 'video') {
  let fileName = type === 'video' ? dbObj.path : dbObj.videoPath; 
  let source = 'public/' + fileName;
  let copy = 'original/' + fileName;
  let outputFileName = "copy_" + fileName;
  let updateFailedAttempt = function (obj) {
    obj.failedProcessingAttempts += 1;
    obj.save()
      .then ((obj) => {
        console.log("Failed attempt at video optimisation recorded in database.")
      })
  }
  try {
  	S3Controller.copyS3Object(source, copy)
  	  .then((data) => {
  	  	transcodeVideo(fileName, outputFileName)
  	  	  .then((data1) => {
  	  	  	S3Controller.copyS3Object('public/'+ outputFileName, source)
  	  	  	  .then((data2) => {
  	  	  	  	S3Controller.deleteS3Object(outputFileName)
  	  	  	      .then((data3) => {
                    if (type === 'video') {
                      dbObj.optimized = true;
                    } else {
                      dbObj.videoOptimized = true;
                    }
                    dbObj.save()
                      .then((video) => {
                        console.log("Optimization completed for Video (" + fileName + ")");
                      })	
  	  	  	  		})
  	  	  	    });	  
  	  	  })
  	  })
  } catch (e) {
      updateFailedAttempt (dbObj);
      console.log("Error occured during video processing" + e);
  }  
}

module.exports.optimizeVideoFile = optimizeVideoFile;


/*
* this method recursivly picks up un-optimized Video files
* for optimizing them and when no un-optimized Video files 
* are found it starts to recursivly optimize Video Comment files
*/
const optimizeVideos =  async function(){

  let maxFailedAttempts = 3;

  Videos.find({
    where: {
      optimized: false,
      failedProcessingAttempts: {
        [op.lte]: maxFailedAttempts
      }
    },
    limit: 1
  })
    .then ((video) => {
      if (video) {
        optimizeVideoFile (video)
      } else {
        Comments.find({
          where: {
            videoPath: {
              [op.ne]: ''
            },
            videoOptimized: false,
            failedProcessingAttempts: {
              [op.lte]: maxFailedAttempts
            }
          },
          limit: 1
        })
          .then((videoComment) => {
            if (videoComment) {
              optimizeVideoFile(videoComment, 'videoComment');
            } else {
              console.log("No videos to optimize.")
            }
          })
      }
    })
}
module.exports.optimizeVideos = optimizeVideos;
