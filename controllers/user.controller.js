const { User, Friendship, ConsumedAds }          = require('../models');
const authService       = require('../services/auth.service');
const { to, ReE, ReS, uniqeFileName, roundTwoDecimalPlaces}  = require('../services/util.service');
const TagsController   = require('./tags.controller');
const crypto = require('crypto');
require('dotenv').config();//instatiate environment variables
const MailsController   = require('./mails.controller');

const create = async function(req, res){
    const body = req.body;

    if(!body.unique_key && !body.email && !body.phone){
        return ReE(res, 'Please enter an email or phone number to register.');
    } else if(!body.first || !body.last){
      return ReE(res, 'Please enter your full name to register.');
    } else if (!body.location) {
      return ReE(res, 'Please choose your country to register.');
    } else if(!body.password){
        return ReE(res, 'Please enter a password to register.');
    }else{
        let err, user;

        [err, user] = await to(authService.createUser(body));

        //associate this user with default tag
        TagsController.associateWithDefaultTag(user);

        if(err) return ReE(res, err, 422);
        return ReS(res, {message:'Successfully created new user.', user:user.toWeb(), token:user.getJWT()}, 201);
    }
}
module.exports.create = create;

const updateAccountPassword = async function(req, res) {
    try {
        let key = req.body.key || false, password = req.body.password || false

        if (key && password) {
            User.find({
                where: {
                    passwordResetKey: key
                }
            })
              .then((user) => {
                if (user) {
                    user.password = password;
                    user.passwordResetKey = '';
                    user.save()
                      .then ((user) => {
                        return ReS(res, {message: 'Account password changed successfully'});
                      })
                } else {
                    throw new Error ('Something went wrong while trying to reset your password.')
                }
              })
              .catch ((err) => {
                 console.log(err)
                 return ReE(res, { message: 'Something went wrong while changing the account password.'}, 422);
              })
        } else {
            throw new Error('Secret key or password not provided.')
        }

    } catch (e) {
        console.log(e)
        return ReE(res, { message: 'Something went wrong while changing the account password.'}, 422);
    }
}
module.exports.updateAccountPassword = updateAccountPassword;

const get = async function(req, res){
    let user, err, friendship;
    if(req.params.uid) {
      [err, user] = await to (User.scope('public').findOne({ where: {id: req.params.uid}}))
      if(err) return ReE(res, err, 422);
      [err, friendship] = await to (Friendship.getFriendship(req.user.id, req.params.uid))
      if(err) return ReE(res, err, 422);

    } else {
      user = req.user
    }

    return ReS(res, {user:user, friendship: friendship});
}
module.exports.get = get;

const getUserBySecretKey = async function(req, res){
    try {
        let key = req.query.key || false;
        User.scope('public').findOne({where: {
            passwordResetKey: key
        }})
          .then ((user) => {
            if (user) {
                return ReS(res, {user:user});
            } else {
                return ReE(res, {message: 'Invalid or expired link'});
            }
          })
          .catch ((err) => {
            throw err
          })

    } catch (e) {
        console.log(e);
        return ReE(res, {message: 'Something went wrong while verifying the key.'}, 422);

    }

}

module.exports.getUserBySecretKey = getUserBySecretKey;

const update = async function(req, res){
    let err, user, data
    user = req.user;
    data = req.body;

    // delete properties that are 
    // not supposed to be updated
    delete data.email;
    
    // change the password if
    // newPassword property is not empty
    if(req.body.newPassword) {
        data.password = req.body.newPassword
    } else {
        delete data.password;
    }
    
    user.set(data);

    [err, user] = await to(user.save());
    if(err){
        if(err.message=='Validation error') err = 'The email address is already in use';
        return ReE(res, err);
    }
    return ReS(res, {user: user});
}
module.exports.update = update;

const remove = async function(req, res){
    let user, err;
    user = req.user;

    [err, user] = await to(user.destroy());
    if(err) return ReE(res, 'error occured trying to delete user');

    return ReS(res, {message:'Deleted User'}, 204);
}
module.exports.remove = remove;


const login = async function(req, res){
    const body = req.body;
    let err, user, amount;

    [err, user] = await to(authService.authUser(req.body));
    if(err) return ReE(res, err, 422);

    //get total amount of money that user has accumlated
    [err, amount] = await to(ConsumedAds.getUserTotal(user.id));
    if(err) return ReE(res, err, 422);

    return ReS(res, {
        token:user.getJWT(), 
        user:user.toWeb(),
        totalRevenue: amount

    });
}
module.exports.login = login;

const sendPasswordResetLink = async function (req, res) {
    try {
        let email = req.body.email, url= (req.body.url || false), err;
        User.findOne({where: {
            email: email
        }})
          .then((user) => {
            if (user) {
                updateUserPasswordResetSecretHash(user)
                  .then ((user) => {
                     MailsController.sendMail(getPasswordResetMailBody(user, url), process.env.SITE_NAME+ '- Reset your account password', email)
                      .then((m) => {
                        return ReS(res, {
                          message: 'Password Reset link has been sent to your email address. Please follow that link.'
                        });
                      })
                      .catch ((err) => {
                        console.log(err)
                        throw err
                      })
                  })
                  .catch((err) => {
                    console.log(err)
                    return ReE(res, {success: false, message: 'Soemthing went wrong while trying to save secret key.'}, 422);
                  })   
            } else {
                return ReE(res, {
                    message: 'This email is not registered with us.'
                });
            }
          })
          .catch((err) => {
            console.log(err)
            return ReE(res, {success: false, message: 'Soemthing went wrong while trying to check your email.'}, 422);
          })

    } catch (e) {
        console.log(e)
        return ReE(res, {success: false, message: 'Soemthing went wrong while trying to send Password Reset mail.'}, 422);
    }
}
module.exports.sendPasswordResetLink = sendPasswordResetLink;

function updateUserPasswordResetSecretHash (user) {
  return new Promise(function(resolve, reject) {

      let current_date = (new Date()).valueOf().toString();
      let random = Math.random().toString() + user.password;
      let k = crypto.createHash('sha1').update(current_date + random).digest('hex');
      user.passwordResetKey = k;
      user.save()
        .then((user) => {
            resolve(user)
        })
        .catch ((err) => {
            reject(err)
        })
  });
}
function getPasswordResetLink (user, url) {
  if (!url) {
    url = process.env.FRONT_END_SITE_URL_BASE + '/' + process.env.FRONT_END_SITE_URL_CHANGE_PASSWORD
  }
  return url + '?k='+ user.passwordResetKey
}
function getPasswordResetMailBody (user, url) {
    return 'Hello ' + user.first.charAt(0).toUpperCase() +', \n\nSomeone has requested to reset your ' + process.env.SITE_NAME +' accout password. If it was you, please click the link below to continue.\n\n'+ getPasswordResetLink(user, url) + '\n\nHowever, if you did not request it, please just ignore this mail. Your account is safe and sound. \n\n\n\n Thank you! \n\n\n\n\n '+ process.env.SITE_NAME + ' Team'
}