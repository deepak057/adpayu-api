const { Images, Posts, User } = require('../models');
const { to, ReE, ReS, isEmptyObject, uniqeFileName } = require('../services/util.service');
const Sequelize = require('sequelize');

const Op = Sequelize.Op;


const getToken = async function(req, res){

    let data = req.query;
    
          return ReS(res, {message:'Success'}, 200);

   /* var cryp = crypto.createHash('sha512');
    var text = data.key+'|'+data.txnid+'|'+data.amount+'|'+data.pinfo+'|'+data.fname+'|'+data.email+'|||||'+data.udf5+'||||||'+data.salt;
    cryp.update(text);
    var hash = cryp.digest('hex'); 
    */ 

}

module.exports.getToken = getToken;