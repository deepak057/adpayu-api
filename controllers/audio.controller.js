const { Images} = require('../models');
const { to, ReE, ReS, uniqeFileName, getDirectory} = require('../services/util.service');
const appRoot = require('app-root-path');
const S3Controller   = require('./s3.controller');
const fs = require('fs');
require('dotenv').config();

function musicGeneres () {
  return [
    {
      label: 'All',
      id: 0
    },
    {
      label: 'Hip Hop',
      id: 1
    },
    {
      label: 'Dance',
      id: 2
    },
    {
      label: 'Rock',
      id: 3
    },
    {
      label: 'Horror',
      id: 4
    }
  ]
}

const getCategories = async function(req, res){
  ReS(res, musicGeneres(), 200)
}

module.exports.getCategories = getCategories;

function optimizeAudio (filePath) {
  return new Promise (function(resolve, reject) {
    console.log('Optimizing uploaded audio file...')
    const spawn = require('child_process').spawn;
     let ffmpeg = spawn(command, [], { shell: true, stdio: 'inherit' });

     //let ffmpeg = spawn('ffmpeg', getCommandArgsArry(command))
      ffmpeg.on('close', (statusCode) => {
        if (statusCode === 0) {
           console.log('FFMPEG command execution successfull.');
           resolve (command)
        } else {
          reject(statusCode)
        }
      })
  })
  
}

const upload = async function(req, res){

   if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
   }

// The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  let sampleFile = req.files.audio;
    
  let name = uniqeFileName(sampleFile.name, req.user);

  let fileDir = getDirectory(appRoot+'/uploads/audio/');

  let filePath = fileDir + name;
    
      // Use the mv() method to place the file somewhere on your server
    sampleFile.mv(filePath, function(err){
      if (err) {
        return res.status(500).send(err);
      } else {
        S3Controller.uploadToS3(filePath, 'public/audio/')
          .then((data) => {
              ReS(res,{path: name}, 200)
          }) 
      }
    });

}


module.exports.upload = upload;