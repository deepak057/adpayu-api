const { to, ReE, ReS } = require('../services/util.service');
require('dotenv').config();//instatiate environment variables

const nodemailer = require('nodemailer');

const sendMail = async function (content, subject, to = "deakmisra@gmail.com") {
  return new Promise(function(resolve, reject) {
    var transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    var mailOptions = {
      to: to,
      subject: subject,
      text: content
    };

    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        reject(error);
      } else {
        console.log('Email sent: ' + info.response);
        resolve(info)
      }
    });
  });  
}

module.exports.sendMail = sendMail;
