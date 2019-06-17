const { Images} = require('../models');
const { to, ReE, ReS, uniqeFileName } = require('../services/util.service');
const { captureVideoPoster } = require('../services/app.service');
const appRoot = require('app-root-path');


const uploadImage = async function(req, res){

   if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
   }

// The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  let sampleFile = req.files.image;
    
  let name = uniqeFileName(sampleFile.name);
    
      // Use the mv() method to place the file somewhere on your server
    sampleFile.mv(appRoot+'/uploads/'+ name, function(err){
      if (err) {
        return res.status(500).send(err);
      } else {
          Images.create({path: name})
          .then((image) => {
            image.setUser(req.user);
            return ReS(res, image);
          })
          .catch((err) => {
            console.log(err);
            return ReE(res, {error: 'Something went wrong while trying to upload the image.'});
          }) 
      }
    });

}

module.exports.uploadImage = uploadImage;

const uploadVideo = async function(req, res){
  if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
   }

// The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  let sampleFile = req.files.video;
    
  let name = uniqeFileName(sampleFile.name);
    
      // Use the mv() method to place the file somewhere on your server
    sampleFile.mv(appRoot+'/uploads/'+ name, function(err) {
      if (err) {
        return ReE(res, err);
      }

      else {
        captureVideoPoster (name);
        return ReS(res, {path: name});
      }

    });

}

module.exports.uploadVideo = uploadVideo;

const uploadUserProfilePic = async function(req, res){
  if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
   }

  let sampleFile = req.files.image;
    
  let name = uniqeFileName(sampleFile.name);
    
    sampleFile.mv(appRoot+'/uploads/'+ name, function(err) {
      if (err) {
        return ReE(res, err);
      } else {
        req.user.pic = name
        req.user.save()
          .then(function () {
            return ReS(res, {user: req.user}, 201);
          })
      }
    });

}

module.exports.uploadUserProfilePic = uploadUserProfilePic;