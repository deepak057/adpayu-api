const { AudioTracks} = require('../models');
const { to, ReE, ReS, uniqeFileName, getDirectory, getLimitOffset} = require('../services/util.service');
const appRoot = require('app-root-path');
const S3Controller   = require('./s3.controller');
const fs = require('fs');
require('dotenv').config();
const S3AudioFolder = 'public/audio/';

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

const get = async function (req, res) {
  try {

    let page = req.query.page || 1;

    let searchKeyword = req.query.search;

    let genere = parseInt(req.query.genere) || false;

    let limitNOffset = getLimitOffset(page, 4);

    let whereCondition = {}

    if (genere) {
      whereCondition.genere = genere
    }

    AudioTracks.findAll({
      limit: limitNOffset.limit,
      offset: limitNOffset.offset,
      order: [['updatedAt', 'DESC']],
      where: whereCondition
    })
      .then ((tracks) => {
        ReS(res, {tracks: tracks}, 200)
      })
  } catch (e) {
    console.log(e)
    throwErr(res)
  }
}

module.exports.get = get;

function optimizeAudio (input, output) {
  return new Promise (function(resolve, reject) {
    console.log('Optimizing uploaded audio file...')
    const spawn = require('child_process').spawn;
    let command = "ffmpeg -i " + input + " -vn -b:a 64k " + output;
    let ffmpeg = spawn(command, [], { shell: true, stdio: 'inherit' });
    ffmpeg.on('close', (statusCode) => {
      if (statusCode === 0) {
         console.log('FFMPEG command execution for audio optimisation is successfull.');
         resolve (output)
      } else {
        reject(statusCode)
      }
    })
  })
  
}

function throwErr (res) {
  return ReE(res, {message: 'Sorry, something went wrong'}, 500)
}

const upload = async function(req, res){

   if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
   }

// The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  let sampleFile = req.files.audio;
    
  let name = uniqeFileName(sampleFile.name, req.user);

  let fileDir = getDirectory(appRoot+'/uploads/audio/');

  let srcFile = fileDir + 'copy_'+name;

  let filePath = fileDir + name;
  
  sampleFile.mv(srcFile, function(err){
    if (err) {
      return res.status(500).send(err);
    } else {
      optimizeAudio(srcFile, filePath)
        .then((d) => {
          fs.unlink(srcFile)
          S3Controller.uploadToS3(filePath, S3AudioFolder)
            .then((data) => {
                ReS(res,{path: name}, 200)
            })
        })
        .catch((e) => {
          throwErr(res)
        })
    }
  });

}

module.exports.upload = upload;

const deleteFile = async function (req, res) {
  try {
    let filePath = req.params.filePath;
    /*
    * make sure the file being deleted
    * has not been used in existing tracks
    */
    AudioTracks.find({
      where: {
        path: filePath
      }
    })
      .then((track) => {
        if (!track) {
          S3Controller.deleteS3Object(filePath, S3AudioFolder)
            .then((d) => {
              ReS(res, {message: 'File deleted successfully'}, 200)
            })
        }
      })
  } catch (e) {
    throwErr (res)
  }
}

module.exports.deleteFile = deleteFile;

const save = async function (req, res) {
  try {
    let data = req.body;
    data.UserId = req.user.id;
    AudioTracks.create(data)
      .then((track) => {
        ReS(res, {
          message: 'Track added successfully',
          track: track
        }, 200)
      })
      .catch ((e) => {
        throwErr (res)
      })
  } catch (e) {
    throwErr (res)
  }
}

module.exports.save = save;