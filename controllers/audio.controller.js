const { AudioTracks} = require('../models');
const { to, ReE, ReS, uniqeFileName, getDirectory, getLimitOffset, getFileNameWithExtension} = require('../services/util.service');
const appRoot = require('app-root-path');
const S3Controller   = require('./s3.controller');
const fs = require('fs');
require('dotenv').config();
const S3AudioFolder = 'public/audio/';
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

/*
* Id of My Tracks music category
*/
let myTracksCategoryId = 12;

function musicGeneres () {
  return [
    {
      label: 'All',
      id: 0
    },
    {
      label: 'Angry',
      id: 1
    },
    {
      label: 'Bright',
      id: 2
    },
    {
      label: 'Calm',
      id: 3
    },
    {
      label: 'Dark',
      id: 4
    },
    {
      label: 'Dramatic',
      id: 5
    },
    {
      label: 'Funky',
      id: 6
    },
    {
      label: 'Happy',
      id: 7
    },
    {
      label: 'Inspirational',
      id: 8
    },
    {
      label: 'Naugthy',
      id: 9
    },
    {
      label: 'Romantic',
      id: 10
    },
    {
      label: 'Sad',
      id: 11
    },
    {
      label: 'My Tracks',
      id: 12
    }
  ]
}

const getCategories = async function(req, res){
  ReS(res, {categories: musicGeneres(), myTracksCategoryId: myTracksCategoryId}, 200)
}

module.exports.getCategories = getCategories;

const get = async function (req, res) {
  try {

    let page = req.query.page || 1;

    let searchKeyword = req.query.search;

    let genere = parseInt(req.query.genere) || false;

    let limitNOffset = getLimitOffset(page, 12);

    let whereCondition = {}

    if (genere) {
      if (genere === myTracksCategoryId) {
        whereCondition.UserId = req.user.id
      } else {
        whereCondition.genere = genere  
      }
      
    }
    if (searchKeyword) {
      whereCondition.name = {
        [Op.like] :  '%' + searchKeyword + '%'
      }
    }

    AudioTracks.findAll({
      limit: limitNOffset.limit,
      offset: limitNOffset.offset,
      order: [['updatedAt', 'DESC']],
      where: whereCondition
    })
      .then ((tracks) => {
        ReS(res, {tracks: tracks, myTracksCategoryId: myTracksCategoryId}, 200)
      })
  } catch (e) {
    console.log(e)
    throwErr(res)
  }
}

module.exports.get = get;


const remove = async function (req, res) {
  try {
    let trackId = req.params.trackId
    let user = req.user

    AudioTracks.find({
      where: {
        id: trackId,
        UserId: user.id
      }
    })
      .then((track) => {
          S3Controller.deleteS3Object(track.path, S3AudioFolder)
            .then((d1) => {
              track.deleted = true
              track.save()
                .then((updatedTrack) => {
                  ReS(res, {message: 'Track deleted successfully'}, 200)
                })
            })
      })
  } catch (e) {
    console.log(e)
    throwErr(res)
  }
}

module.exports.delete = remove;

function optimizeAudio (input, output) {
  return new Promise (function(resolve, reject) {
    console.log('Optimizing uploaded audio file...')
    const spawn = require('child_process').spawn;
    let command = "ffmpeg -i " + input + " -vn -b:a 64k " + output;
    let ffmpeg = spawn(command, [], { shell: true, stdio: 'inherit' });
    console.log("Executing: " + command)
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
    
  let inputFilename = uniqeFileName(sampleFile.name, req.user);

  let fileDir = getDirectory(appRoot+'/uploads/audio/');

  let srcFile = fileDir + 'copy_'+ inputFilename;

  let outputFileName = getFileNameWithExtension(inputFilename)

  let outputFilePath = fileDir + outputFileName;
  
  sampleFile.mv(srcFile, function(err){
    if (err) {
      return res.status(500).send(err);
    } else {
      optimizeAudio(srcFile, outputFilePath)
        .then((d) => {
          fs.unlink(srcFile)
          S3Controller.uploadToS3(outputFilePath, S3AudioFolder)
            .then((data) => {
                ReS(res,{path: outputFileName}, 200)
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