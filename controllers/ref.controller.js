const { User }          = require('../models');
const { to, ReE, ReS}  = require('../services/util.service');
require('dotenv').config();//instatiate environment variables
const Hashids = require('hashids/cjs');

const getRefCode = async function(req, res){
  try {
    let user = req.user;
    let code;
    let createCode = () => {
      /* let mykey = crypto.createCipher('aes-128-cbc', 'SvaBQUSerREFcOdE&@');
      var mystr = mykey.update(user.id + ',' + user.email, 'utf8', 'hex')
      mystr += mykey.final('hex');
      return mystr
      */
      let hashids = new Hashids('SvaBQUSerREFcOdE&@', 8);
      return hashids.encode(user.id);

    }
    if (user.refCode) {
      code = user.refCode
    } else {
      code = createCode()
      user.refCode = code
      user.save()
    }
    return ReS(res, {code: code}, 200)
  } catch (e) {
    console.log(e)
    return Ree(res, {error: 'Something went wrong'}, 500)
  }
  
}

module.exports.getRefCode = getRefCode;