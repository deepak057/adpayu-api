const { Images, Posts, User } = require('../models');
const { to, ReE, ReS, isEmptyObject, uniqeFileName } = require('../services/util.service');
const Sequelize = require('sequelize');
var crypto = require('crypto');

const Op = Sequelize.Op;


const getToken = async function(req, res){

    var i = req.url.indexOf('?');
    var query = req.url.substr(i+1);

    var hash = crypto.createHmac('sha256', '27a853b42e9b20e1992d8d2d2bf433c9ec89bfb5').update(query).digest('base64')

    var params = req.query;
    params.paymentToken = hash;

    return ReS(res, {

      params: params

    }, 200);


}

module.exports.getToken = getToken;