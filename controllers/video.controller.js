const { Videos, Comments} = require('../models');
const { to, ReE, ReS } = require('../services/util.service');
const Sequelize = require('sequelize');
const op = Sequelize.Op;
const S3Controller   = require('./s3.controller');
const appRoot = require('app-root-path');
const path = require('path');
const fs = require('fs');


//configuring the AWS environment
/*AWS.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY,
	secretAccessKey: process.env.AWS_SECRET
});

/*
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
		PipelineId: process.env.AWS_EMT_PIPELINE_ID,
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
*/


function getVideoMeta (localFilePath) {
  return new Promise (function(resolve, reject) {
    const ffmpeg = require('fluent-ffmpeg');
    //ffmpeg.setFfprobePath(localFilePath);
    ffmpeg.ffprobe(localFilePath, function(err, metadata) {
        if (err) {
            reject(err);
        } else {
            let meta = metadata.streams[0]
            resolve({
              height: meta.coded_height,
              width: meta.coded_width,
              allMeta: meta
            })
        }
    });
  })
}


function getFFMPEGCommand (input, output, resolution = false, overlayIcon = true) {
  let cmd  = 'ffmpeg -i ' + input + " -y";
  if (overlayIcon) {
    cmd += ' -i ' + appRoot + '/public/assets/overlay_icon.png';
  }
  if (resolution || overlayIcon) {
    cmd += ' -filter_complex "';

    if(resolution) {
      cmd += '[0:v]scale=-2:' + resolution + '[scaled];[scaled][1:v]'
    }
    if (overlayIcon) {
      cmd += 'overlay=x=(main_w-(overlay_w) - 10):y=(main_h-(overlay_h + 10))'
    }

    cmd += '"'
  }

  return  cmd + ' -vcodec libx264 -vprofile high -preset veryslow -crf 30 -threads 0 -c:a aac -b:a 64k -movflags +faststart -map_metadata 0 -b:v 400k -maxrate 500k -bufsize 1000k ' + output
}

function getFilesAndCommands (localFilePath) {
  return new Promise (function (resolve, reject) {
    let getOutputFilePath = function (inputFilePath, resolution) {
      let fileName = path.basename(inputFilePath)
      let dir = inputFilePath.replace(fileName, '');
      let subDir = dir + resolution + '/';
      if (!fs.existsSync(subDir)){
        fs.mkdirSync(subDir);
      }
      return subDir + fileName;
    }
    getVideoMeta(localFilePath)
      .then((meta) => {
        let desiredResolutions = [360, 480];
        let commands = [];
        let outputFilesPath = [];
        let scalingNeeded = 0;
        for (let i in desiredResolutions) {
          let outputFilePath = getOutputFilePath(localFilePath, desiredResolutions[i]);
          outputFilesPath.push(outputFilePath);
          if(meta.height > desiredResolutions[i]) {  
            commands.push(getFFMPEGCommand(localFilePath, outputFilePath, desiredResolutions[i]));
            scalingNeeded ++
          } else {
            commands.push(getFFMPEGCommand(localFilePath, outputFilePath))
          }
        }
        resolve ({
          outputFiles: outputFilesPath,
          commands: commands,
          scalingNeeded: scalingNeeded
        })
      })
      .catch((e) => {
        reject(e)
      })
  })
}

function getCommandArgsArry (command) {
  return command.replace("ffmpeg " , "").split(" ")
}

function executeCommand (command) {
  return new Promise (function(resolve, reject) {
    const exec = require('child_process').exec;
    console.log("Executing FFMPEG command- " + command);
    let ffmpeg = exec(command, function(err, stdout, stderr) {
    });

    ffmpeg.on('exit', function (code) {
      if (code === 0) {
        console.log("Command execution successfull.")
        resolve (command)
      } else {
        reject (code)
      }
    });

   /*
   const spawn = require('child_process').spawn;
   let ffmpeg = spawn('ffmpeg', getCommandArgsArry(command))
    ffmpeg.on('close', (statusCode) => {
      if (statusCode === 0) {
         console.log('FFMPEG transcoding successfull');
         resolve (command)
      } else {
        reject(statusCode)
      }
    })
    ffmpeg.stdout.on('data', function(data) {
      console.log(data);
    })
    ffmpeg.stderr
      .on('data', (err) => {
        //console.log(getCommandArgsArry(command))
        //console.log(new String(err))
        reject(err)
      })*/

  })
}

function transcodeVideo (localFilePath) {
  return new Promise(function(resolve, reject){
    try {
      getFilesAndCommands(localFilePath)
      .then((data) => {
        let commandsExecuted = 0;
        let execute = function () {
          executeCommand(data.commands[commandsExecuted])
            .then((c) => {
              commandsExecuted ++;
              if (commandsExecuted === data.commands.length) {
                resolve (data)
              } else {
                execute()
              }
            })
        }
        execute ()
      });  
  
    } catch (e) {
      reject(e)
    }
    
  })
  
}

function getParentDirName (filePath) {
 return  path.dirname(filePath).split(path.sep).pop()
}

function manageTranscodedFiles (files) {
  return new Promise (function(resolve, reject) {
    let filesUploaded = 0;
    let uploadToS3 = function () {
      S3Controller.uploadToS3(files[filesUploaded], 'public/'+ getParentDirName(files[filesUploaded]) + '/')
        .then((d) => {
          filesUploaded ++;
          if (filesUploaded === files.length) {
            resolve(files)
          } else {
            uploadToS3()
          }
        })
    }
    if (files.length) {
      uploadToS3()
    } else {
      reject(new Error("No Files"))
    }
  })
}

function alreadyInProgress () {
  return new Promise (function(resolve, reject) {
    const find = require('find-process');
    find('name', 'ffmpeg', true)
      .then(function (list) {
        resolve(list.length)
      });  
  }) 
}

function optimizeVideoFile (dbObj, type = 'video') {
  let fileName = type === 'video' ? dbObj.path : dbObj.videoPath; 
  let sourceKey = 'public/' + fileName;
  let localFilePath = appRoot + '/uploads/temp/' + fileName;
  let markVideoAsOptimised = function () {
    return new Promise (function(resolve, reject) {
      if (type === 'video') {
        dbObj.optimized = true;
      } else {
        dbObj.videoOptimized = true;
      }
      dbObj.save()
        .then((video) => {
          console.log("Optimization completed for Video (" + fileName + ")");
          resolve(video)
        })
        .catch((e) => {
          reject(e)
        })
      })
  }
  let updateFailedAttempt = function () {
    dbObj.failedProcessingAttempts += 1;
    dbObj.save()
      .then ((obj) => {
        console.log("Failed attempt at video optimisation recorded in database.")
      })
  }
 
  try {
    S3Controller.downloadS3Object(sourceKey, localFilePath)
      .then((data) => {
        transcodeVideo(localFilePath)
          .then((data1) => {
            manageTranscodedFiles(data1.outputFiles)
              .then((data2) => {
                markVideoAsOptimised()
                fs.unlink(localFilePath);
              })
          })
      })
  } catch (e) {
    console.log(e);
    updateFailedAttempt()
  }
}


/*
* This video optimisation function does the following-
* 1. It first copies the original S3 video file to Original/ folder
* 2. If the size of the video to be optimised is greater than 6 MB, then proceed. Else jump directly to #5
* 3. Transcodes and optimises the original video using AWS Elastic Transcoder 
* 4. Copies the transcoded video to the orignal video and then delets the copied video
* 5. Updates the database to flag the given video Optimised



function optimizeVideoFile (dbObj, type = 'video') {
  let fileName = type === 'video' ? dbObj.path : dbObj.videoPath; 
  let source = 'public/' + fileName;
  let copy = 'original/' + fileName;
  let outputFileName = "copy_" + fileName;
  let minFileSizeForTranscodingInMb = 6;
  let updateFailedAttempt = function (obj) {
    obj.failedProcessingAttempts += 1;
    obj.save()
      .then ((obj) => {
        console.log("Failed attempt at video optimisation recorded in database.")
      })
  }
  let markVideoAsOptimised = function () {
    return new Promise (function(resolve, reject) {
      if (type === 'video') {
        dbObj.optimized = true;
      } else {
        dbObj.videoOptimized = true;
      }
      dbObj.save()
        .then((video) => {
          console.log("Optimization completed for Video (" + fileName + ")");
          resolve(video)
        })
        .catch((e) => {
          reject(e)
        })
      })
  }
  try {
  	S3Controller.copyS3Object(source, copy)
  	  .then((data) => {
        S3Controller.getObjectSize(source)
          .then((size) => {
            if((size / (1000**2)) > minFileSizeForTranscodingInMb) {
              transcodeVideo(fileName, outputFileName)
                .then((data1) => {
                  S3Controller.copyS3Object('public/'+ outputFileName, source)
                    .then((data2) => {
                      S3Controller.deleteS3Object(outputFileName)
                        .then((data3) => {
                          markVideoAsOptimised()
                        })
                      });   
                })
            } else {
              markVideoAsOptimised()
            }
          })
  	  })
  } catch (e) {
      updateFailedAttempt (dbObj);
      console.log("Error occured during video processing" + e);
  }  
}
*/

module.exports.optimizeVideoFile = optimizeVideoFile;


/*
* this method recursivly picks up un-optimized Video files
* for optimizing them and when no un-optimized Video files 
* are found it starts to recursivly optimize Video Comment files
*/
const optimizeVideos =  async function(){

  alreadyInProgress()
    .then((d) => {
      if (!d) {
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
      } else {
        console.log('Previous transcoding process is still in progress..')
      }
    })
}
module.exports.optimizeVideos = optimizeVideos;
