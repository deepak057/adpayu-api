const { Images} = require('../models');
const { to, ReE, ReS, uniqeFileName} = require('../services/util.service');
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