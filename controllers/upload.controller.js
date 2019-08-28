const { Images} = require('../models');
const { to, ReE, ReS, uniqeFileName, videoToPNG, getDomainURL } = require('../services/util.service');
const { captureVideoPoster, optimizeImage } = require('../services/app.service');
const appRoot = require('app-root-path');
const S3Controller   = require('./s3.controller');
const fs = require('fs');
require('dotenv').config();

const uploadImage = async function(req, res){

   if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
   }

// The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  let sampleFile = req.files.image;
    
  let name = uniqeFileName(sampleFile.name, req.user);

  let filePath = appRoot+'/uploads/'+ name;
    
      // Use the mv() method to place the file somewhere on your server
    sampleFile.mv(filePath, function(err){
      if (err) {
        return res.status(500).send(err);
      } else {
          optimizeImage(filePath)
            .then(() => {
            	S3Controller.uploadToS3(filePath)
		            .then((data) => {
		              Images.create({path: name})
		                .then((image) => {
		                  image.setUser(req.user);
		                  return ReS(res, image);
		                })
		                .catch((err) => {
		                  console.log(err);
		                  return ReE(res, {error: 'Something went wrong while trying to upload the image.'});
		                })
		            }) 
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
    
  let name = uniqeFileName(sampleFile.name, req.user);
  
  let filePath = appRoot+'/uploads/'+ name;

      // Use the mv() method to place the file somewhere on your server
    sampleFile.mv(filePath, function(err) {
      if (err) {
        console.log(err);
        return ReE(res, {'message': 'Something went wrong.'});
      }
      else {
        S3Controller.uploadToS3(filePath, '', false)
          .then((data) => {
            captureVideoPoster (name)
              .then((data) => {
                return ReS(res, {path: name});
              })
          })
          .catch((err) => {
            console.log(err);
            return ReE(res, {'message': 'Something went wrong.'});
          })
      }
    });
}

module.exports.uploadVideo = uploadVideo;

const uploadUserProfilePic = async function(req, res){
  if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
   }

  let sampleFile = req.files.image;
    
  let name = uniqeFileName(sampleFile.name, req.user);
   
  let filePath = appRoot+'/uploads/'+ name;

    sampleFile.mv(filePath, function(err) {
      if (err) {
        return ReE(res, err);
      } else {
        S3Controller.uploadToS3(filePath)
          .then((data) => {
            let user = req.user;
            // delete old profile pic
            if (user.pic) {
              S3Controller.deleteS3Object(user.pic)
            }
            user.pic = name
            user.save()
              .then(function () {
                return ReS(res, {user: user}, 200);
              })
          })
      }
    });
}

module.exports.uploadUserProfilePic = uploadUserProfilePic;

const accountIdentityDocs = async function(req, res){
  if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
   }

  const MailsController   = require('./mails.controller');

  let totalFiles = req.body.files_length;

  let filesNames = [];

  let user = req.user;

  let attachments = []

  let attachmentsString = ''

  let basePath = appRoot+'/uploads/docs/';

  let hostUrl = getDomainURL(req, true);

  let accountStatusUpdateLink = function (action = 'verified') {
    return hostUrl + "/users/updateAccountStatus/" + user.id + "?action=" + action + "&key=" + process.env.SITE_ADMIN_KEY 
  }

  let sendMailToUser = function () {
    let subject = process.env.SITE_NAME + "- We received your identity verification documents ";

    let content = "Dear " + user.first + ", \n\nWe have received your documents for the verification of your identity for your " + process.env.SITE_NAME + " account.\n\nWe are reviewing the documents. You will get an email from us regarding the status of your verification as soon as we have completed the review process. \n\nThank you.\n\n\n\nSincerely,\n\nTeam "+ process.env.SITE_NAME;

    MailsController.sendMail(content, subject, user.email, false)
      .then((info) => {
        console.log("Acknowledgement mail sent to the user who uploaded the identity verification documents.")
      })
  }

  let sendMailToAdmin = function () {
    return new Promise(function(resolve, reject) { 

      for (let i in filesNames) {
        attachments.push({
          path: basePath + filesNames[i]
        })
        attachmentsString += process.env.S3_BUCKET_URL + "/docs/" + filesNames[i] + "\n"
      }

      let subject = process.env.SITE_NAME + "- " + user.first + " " + user.last + " uploaded identity verification documents";

      let content = "Dear Admin, \n\nPlease find below the details: \n\nName: " + user.first + " " + user.last+ "\nUser Id: " + user.id + "\nEmail: "+ user.email + "\nUploaded Document(s): \n" + attachmentsString + "\n\nPlease click the link below to confirm verification: \n"+  accountStatusUpdateLink() +" \n\nOr\n\nClick the link below to disapprove the verification: \n" + accountStatusUpdateLink('unverified');

      MailsController.sendMail(content, subject, false, true, attachments)
        .then((info) => {
          console.log("Identity verification mails with documents sent to admin- " + info)
          for(let i in filesNames) {
            fs.unlink(basePath + filesNames[i])
          }
          resolve(info)
        })
        .catch((e) => {
          reject(e)
        })
    });

  }

  for (let i = 0; i < totalFiles; i++) {

    let sampleFile = req.files['files_'+i];
    
    let name = uniqeFileName(sampleFile.name, user);
     
    filesNames.push(name);

    let filePath = basePath + name;

    sampleFile.mv(filePath, function(err) {
      if (err) {
        return ReE(res, err);
      } else {
          S3Controller.uploadToS3(filePath, 'docs/', false)
          if (i == (totalFiles - 1)) {
            user.accountStatus = 'pending';
            user.identityDocs = JSON.stringify(filesNames);
            user.save()
              .then ((user) => {
                sendMailToAdmin()
                sendMailToUser ();
                return ReS(res, {message: 'Success', user: user}, 200);
              })
          }
      }
    });
  }
}

module.exports.accountIdentityDocs = accountIdentityDocs;

const removeFiles = async function (req, res) {
  try {
    let files = req.body.files;
    let fileType = req.body.type || 'image';
    let deleteS3Files = function (folder = '') {
      for (let i in files) {
        let fileName = folder === 'public/thumbs/' ? videoToPNG(files[i]) : files[i]
        let localFile = appRoot + '/uploads/' + folder + fileName;
        // remove local video file
        if (fs.existsSync(localFile)) {
          fs.unlink(localFile)
        }
        S3Controller.deleteS3Object(fileName, folder);  
      }
    }
    if (files) {
      deleteS3Files()
      if (fileType === 'image') {
        Images.destroy({where: {
          path: files,
          UserId: req.user.id
        }})
      } else if (fileType === 'video') {
        deleteS3Files('public/thumbs/')
      }  
      return ReS(res, {message: 'Files being deleted'}, 200);
    }
  } catch (e) {
    console.log(e);
    return ReE(res, {message: 'Something went wrong'});
  }
}

module.exports.removeFiles = removeFiles;