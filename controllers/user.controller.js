const { User, Friendship, ConsumedAds, ViewedEntities, Reactions, SocialShares, Forex}          = require('../models');
const authService       = require('../services/auth.service');
const { to, ReE, ReS, uniqeFileName, roundTwoDecimalPlaces, getWebView, cloneOject}  = require('../services/util.service');
const TagsController   = require('./tags.controller');
const crypto = require('crypto');
require('dotenv').config();//instatiate environment variables
const MailsController   = require('./mails.controller');
const Sequelize = require('sequelize');
const op = Sequelize.Op;

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
        let err, user, refCode = false;

        if (body.refCode) {
          refCode = body.refCode
          delete body.refCode
        }

        [err, user] = await to(authService.createUser(body));

        //associate this user with default tag
        TagsController.associateWithDefaultTag(user);

        // if there is any referral code, associate that user with this one
        if (refCode) {
          User.find({
            where: {
              refCode: refCode
            }
          })
            .then((u) => {
              if (u) {
                u.setReferredBy(user)
              }
            })
        }

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
    try{
      let user, err, friendship, forex;
      if(req.params.uid && parseInt(req.params.uid) !== req.user.id) {
        [err, user] = await to (User.scope('public').findOne({ where: {id: req.params.uid}}))
        if(err) return ReE(res, err, 500);
        [err, friendship] = await to (Friendship.getFriendship(req.user.id, req.params.uid))
        if(err) return ReE(res, err, 500);

      } else {
        /*
        * if current user requests their own info
        * then it is assumed, that request will be 
        * invoked when that user signs on to the platform
        * and in which case, pass all their data and 
        * send other info such as Forex rate etc 
        * needed on client side to show Revenue in local
        * currency, and update local data for the logged in user
        */
        [err, forex] = await to(Forex.getUSD2INR());
        if(err) return ReE(res, err, 500);

        user = req.user
        
      }
      
      return ReS(res, {user:user, friendship: friendship, forex: forex}); 
    } catch (e) {
      console.log(e);
      return ReE(res, {message: 'Something went wrong'}, 500);
    }

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

    /*
    * remove the actual profile picture file 
    * if user deletes their profile pics 
    */
    if (user.pic && !data.pic) {
      const S3Controller   = require('./s3.controller')
      S3Controller.deleteS3Object(user.pic)
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
                     MailsController.sendMail(getPasswordResetMailBody(user, url), process.env.SITE_NAME+ '- Reset your account password', email, false)
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

const updateAccountStatus = async function (req, res) {
  if (req.query.key && req.query.key === process.env.SITE_ADMIN_KEY && req.query.action && ['verified', 'unverified', 'pending'].includes(req.query.action)) {
    let userId = req.params.userId;
    let action = req.query.action;
    const NotificationsController   = require('./notifications.controller');
    const { NOTIFICATIONS } = require('../config/app-constants');

    let sendMailToUser = function (user) {
      let subject = process.env.SITE_NAME + "- ";
      let content = 'Dear ' + user.first + ",\n\n";
      let notiType = false;
      if (action === 'verified') {
          subject += 'Congratulations, your identity is verified'
          content += 'Your account is successfully verified. \n\nWe are glad to inform you that you can now withdraw money from your ' + process.env.SITE_NAME + ' account.\n\nPlease feel free to contact us if you have any questions or still face any difficulties withdrawing money. \n\nP.S. Make sure to refresh the site or re-open the mobile app if you are still not able to withdraw the money.';
          notiType = NOTIFICATIONS.types.IDENTITY_DOCS_APPROVED;
      } else if (action === 'unverified') {
        subject += 'Account not verified';
        content += 'We reviewd your documents but unfortuantly, we are not able to verify your indentity.\n\nIt could be due to any of following reasons- \n\n1. The name on your document and the name on your ' + process.env.SITE_NAME + ' account do not match.\n2. The document is invalid or ambiguous.\n3. The same document has already been uploaded by someone else.\n\n\nPlease take the appropriate actions to fix the issue and then re-upload the documents on ' + process.env.SITE_NAME + ' for review.\n\nWe will be very happy to help you if you have any questions or queries, please feel free to contact us.';
        notiType = NOTIFICATIONS.types.IDENTITY_DOCS_REJECTED;
      }

      /*
      * send an onsite notification to the user
      * about the status of their account verification
      */
      if (notiType) {
        NotificationsController.create({
          type: notiType
        }, user.id, user.id)
      }
      if (action !== 'pending') {
        content += '\n\n\n\nSincerely,\n\nTeam '+ process.env.SITE_NAME;
        MailsController.sendMail(content, subject, user.email, false)  
      }
    };

    User.find({where: {
      id: parseInt(userId)
    }})
      .then((user) => {
        user.accountStatus = action;
        user.save()
          .then((user) => {
            sendMailToUser(user);
            return ReS(res, {
              message: 'Success',
              'Account Status': user.accountStatus
            }, 200);
          })
      })
      .catch((err) => {
        return ReE(res, {message: 'Something went wrong.'}, 404);
      })
  } else {
    return ReE(res, {message: 'You are not authorized or bad link followed.'}, 401);
  }
}

module.exports.updateAccountStatus = updateAccountStatus;

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
    return 'Hello ' + user.first.charAt(0).toUpperCase()+ user.first.slice(1) +', \n\nSomeone has requested to reset your ' + process.env.SITE_NAME +' account password. If it was you, please click the link below to continue.\n\n'+ getPasswordResetLink(user, url) + '\n\nHowever, if you did not request it, please just ignore this mail. Your account is safe and sound. \n\n\n\n Thank you! \n\n\n\n\n '+ process.env.SITE_NAME + ' Team'
}

const getUserRevenue = async function(req, res) {
    let showErr = () => {
      return ReE(res, {error: 'Something went wrong'}, 500);
    }
    try {
      let err, user = req.user, amount, guestUserId = req.body.guestUserId || false, lastLoginFrom = getWebView(req);

      //get total amount of money that user has accumlated
      [err, amount] = await to(ConsumedAds.getUserTotal(user.id));
      if(err) {
        showErr()
      }

      /*
      * Save GuestUserId for the current user
      */

      if (guestUserId && req.user.guestUserId !== String(guestUserId)) {
        req.user.guestUserId = guestUserId
      }

      /*
      * Spdate current user's Current Device info
      */
      if (lastLoginFrom) {
        req.user.lastLoginFrom = lastLoginFrom  
      }
      
      req.user.save()

      return ReS(res, {
          totalRevenue: amount
      });

    } catch (e) {
      showErr()
    }
    
}

module.exports.getUserRevenue = getUserRevenue;

const markAsViewed = function (req, res) {
  try {
    let user = req.user || false;
    let id = req.body.id;
    let type = req.body.entityType;
    let guestUserId = req.body.guestUserId || false;
    let data = {
    }
    if (user) {
      data.UserId = user.id
    }
    if (guestUserId) {
      data.guestUserId = String(guestUserId)
    }
    if (type === 'post') {
      data.PostId = id;
    } else {
      data.CommentId = id
    }
    ViewedEntities.findOrCreate({
      where: data,
      defaults : data
    })
      .spread((record, created) => {
        return ReS(res, {message: type + ' marked as viewed successfully'}, 200);
      })

  } catch (e) {
    console.log(e);
    return ReE(res, {message: 'Somehting went wrong'}, 500);
  }
}

module.exports.markAsViewed = markAsViewed;

/*
const getUserDetails = async function (req, res) {
  try {
    let user = req.user || false;
    if (user.isAdmin) {
      let userId = req.params.userId;
      User.find({
        where: {
          id: userId
        }
      })
        .then((u) => {
          if (u) {
            User.find({
              where: {
                guestUserId: u.guestUserId,
                id: {
                  [op.ne]: u.id
                }
              }
            })
              .then((u1) => {
                let unique = false
                if (!u1) {
                  unique = true
                }
                ViewedEntities.count({
                  where: {
                    CommentId: {
                      [op.ne]: null
                    },
                    UserId: u.id
                  }
                })
                  .then((c) => {
                    Reactions.count({
                      where: {
                        UserId: u.id
                      }
                    })
                      .then((rC) => {
                        return ReS(res, {
                          name: u.first + ' ' + u.last,
                          id: u.id,
                          Unique: unique ? 'Yes': 'No',
                          'Watched Video Answer': c,
                          'Reactions': rC,
                          Platform: u.lastLoginFrom
                        }, 200); 
        
                      })
                    
                  })
                
              })
          } else {
            return ReE(res, {message: 'User not found'}, 404);
          }
        }) 
    } else {
      return ReE(res, {message: 'You are not authorised'}, 403);
    }
    
  } catch (e) {
    console.log(e);
    return ReE(res, {message: 'Somehting went wrong'}, 500);
  }
}
*/
const getUserDetails = async function (req, res) {
  try {
    let user = req.user || false;
    if (user.isAdmin) {
      let userId = req.params.userId;
      let includes = 
      User.find({
        attributes: { 
          include: [
            [Sequelize.literal('(SELECT COUNT(*) FROM Reactions WHERE Reactions.UserId = ' + userId + ' AND deleted = 0)'), 'ReactionsCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM SocialShares WHERE SocialShares.UserId = ' + userId + ')'), 'SocialSharesCount'],
            [Sequelize.literal('(SELECT COUNT(*) FROM ViewedEntities WHERE ViewedEntities.UserId = ' + userId + ' AND CommentId IS NOT NULL)'), 'ViewedEntitiesCount']
          ]
        },
        where: {
          id: userId
        }
      })
        .then((u) => {
          if (u) {
            User.find({
              where: {
                guestUserId: u.guestUserId,
                id: {
                  [op.ne]: u.id
                }
              }
            })
              .then((u1) => {
                let unique = false
                if (!u1) {
                  unique = true
                }

                /*
                * for some reasons, the Attributes property are
                * not being accessible through this User Object
                * so using a Hack way to convert this Sequelize object
                * to a plain object to access those attribute properties
                */
                u = cloneOject(u)
                
                return ReS(res, {
                  name: u.first + ' ' + u.last,
                  id: u.id,
                  Unique: unique ? 'Yes': 'No',
                  'Watched Video Answer': u.ViewedEntitiesCount,
                  'Reactions': u.ReactionsCount,
                  'Social Shares': u.SocialSharesCount,
                  Platform: u.lastLoginFrom
                }, 200); 
                
                })
          } else {
            return ReE(res, {message: 'User not found'}, 404);
          }
        }) 
    } else {
      return ReE(res, {message: 'You are not authorised'}, 403);
    }
    
  } catch (e) {
    console.log(e);
    return ReE(res, {message: 'Somehting went wrong'}, 500);
  }
}

module.exports.getUserDetails = getUserDetails;