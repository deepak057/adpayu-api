const { to, ReE, ReS } = require('../services/util.service');
require('dotenv').config();//instatiate environment variables

const nodemailer = require('nodemailer');

const sendMail = async function (content, subject, to) {
  return new Promise(function(resolve, reject) {
    var transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    var mailOptions = {
      to: to || process.env.ADMIN_MAIL,
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

const sendContactMail = async function(req, res){
  try {

    let email = req.body.email, message = req.body.message

    if (email && message) {
      sendMail ('Email: ' + email+'\n\nMessage: '+ message, 'Contact Mail from AdpayU')
        .then ((m) => {
          return ReS(res, {
            success: true,
            message: 'Message sent successfully. We will be in touch with you shortly.'
          }, 200);
        }).
        catch ((error) => {
          return showMailErrorMessage(res)
        })
    } else {
      return showMailErrorMessage(res)
    }

  } catch (e) {
      console.log(e)
      return showMailErrorMessage (res)
  }
}
module.exports.sendContactMail = sendContactMail;

function showMailErrorMessage (res) {
  return ReE(res, {
    success: false,
    message: 'Something went wrong while sending the message.'
  }, 422);
}