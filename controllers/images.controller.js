const { Images, Posts, User } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');
const Sequelize = require('sequelize');
const appRoot = require('app-root-path');
const uniqid = require('uniqid');
const path = require('path');

const Op = Sequelize.Op;


const create = async function(req, res){

   if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
  }

// The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  let sampleFile = req.files.file;
    
  let name = uniqid() + path.extname(sampleFile.name);
    
      // Use the mv() method to place the file somewhere on your server
    sampleFile.mv(appRoot+'/uploads/'+ name, function(err) {
      if (err) {
        return res.status(500).send(err);
      }

      else {

        Images.create({path: name})
          .then((image) => {
            image.setUser(req.user);
            return ReS(res, image, 201);
          })
          .catch((err) => {
            return ReE(res, err);
          })

      }

    });


}
module.exports.create = create;
