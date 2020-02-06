const {to} = require('await-to-js');
const pe = require('parse-error');
const uniqid = require('uniqid');
const path = require('path');
const mmm = require('mmmagic');
const fs = require('fs');
   
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

module.exports.uniqeFileName = function (fileName, user = false) {
      return fileName? (uniqid() + ( user ? user.id: '' ) + path.extname(fileName)).replace(' ', '_') : ''
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

module.exports.getMySQLDateTime = function () {
    return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

module.exports.removeBlankParagraphs = function (str) {
  return str.replace(new RegExp('<p><br></p>', 'g'), '')  
}

module.exports.videoToPNG = function (videoFileName) {
    return videoFileName.split('.').slice(0, -1).join('.')+ ".png"
}

module.exports.getDomainURL = function (req, apiURL = false) {
    return req.protocol + '://' + req.headers.host + (apiURL ? '/v1' : '')
}

module.exports.ucFirst = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports.getFileMime = function (filePath) {
   return new Promise(function (resolve, reject) {
      let Magic = mmm.Magic
      let magic = new Magic(mmm.MAGIC_MIME_TYPE);
      magic.detectFile(filePath, function(err, result) {
          if (err) reject(err)
          resolve(result)
      });
   })
    
}

module.exports.getDirectory = function (dir) {
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }
  return dir
}

module.exports.getFileNameWithExtension = function(filename, ext = "mp3") {
  return filename.indexOf("." + ext) !== -1 ? filename : filename + "." + ext
}

module.exports.removeLastOccuranceOf = function (str, char) {
  let n = str.lastIndexOf(char)
  return str.slice(0, n) + str.slice(n).replace(char, '')
}
module.exports.getIdsArray = function(arr) {
  let ids = []
  if (arr && arr.length) {
    for (let i in arr) {
      ids.push(arr[i].id)
    }  
  }
  return ids
}