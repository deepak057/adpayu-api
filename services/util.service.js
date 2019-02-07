const {to} = require('await-to-js');
const pe = require('parse-error');
const uniqid = require('uniqid');
const path = require('path');

module.exports.to = async (promise) => {
    let err, res;
    [err, res] = await to(promise);
    if(err) return [pe(err)];

    return [null, res];
};

module.exports.ReE = function(res, err, code){ // Error Web Response
    if(typeof err == 'object' && typeof err.message != 'undefined'){
        err = err.message;
    }

    if(typeof code !== 'undefined') res.statusCode = code;

    return res.json({success:false, error: err});
};

module.exports.ReS = function(res, data, code){ // Success Web Response
    let send_data = {success:true};

    if(typeof data == 'object'){
        send_data = Object.assign(data, send_data);//merge the objects
    }

    if(typeof code !== 'undefined') res.statusCode = code;

    return res.json(send_data)
};

module.exports.TE = TE = function(err_message, log){ // TE stands for Throw Error
    if(log === true){
        console.error(err_message);
    }

    throw new Error(err_message);
};

module.exports.isEmptyObject  = function (obj) { //check if an object is empty, returns true if object is empty

    return Object.keys(obj).length === 0 && obj.constructor === Object
}

module.exports.sleep  = function (ms) { 

   return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}

module.exports.uniqeFileName = function (fileName) {
      return fileName? uniqid() + path.extname(fileName) : ''
}

/*
* function to get limit and offset depending 
* upon the given page number
*/
module.exports.getLimitOffset = function (page, resultsPerPage = 10) {
    let limit = resultsPerPage;
    let offset = page == 1? 0: (page -1 ) * limit
    return {
    limit: limit,
    offset: offset
    }
}

module.exports.cloneOject = function (obj) {
    return JSON.parse(JSON.stringify(obj));
}

module.exports.roundTwoDecimalPlaces = function (number) {
    return Math.round(number * 100) / 100
}