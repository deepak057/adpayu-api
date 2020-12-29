const { Comments, User, Likes, Posts, Videos, Questions, Forex, ConsumedAds } = require('../models');
const { to, ReE, ReS, getMySQLDateTime, removeBlankParagraphs, getDomainURL, ucFirst, roundTwoDecimalPlaces, cloneOject } = require('../services/util.service');
const NotificationsController   = require('./notifications.controller');
const MailsController   = require('./mails.controller');
const { NOTIFICATIONS } = require('../config/app-constants');
const { getCommentCriteriaObject, getSingleComment, canUpdatePost, formatComments } = require('../services/app.service');
const Sequelize = require('sequelize');
const { VIDEO_PAYMENT_CONFIG } = require('../config/app-constants');
require('dotenv').config();

function getNotification(commentId, postId, type= 'text') {
  return NotificationsController.getNotificationData(NOTIFICATIONS.types.COMMENT_ON_POST, commentId, postId, type)
}

module.exports.getNotification = getNotification;

function getCommentURL (comment) {
  return process.env.FRONT_END_SITE_URL_BASE + '/c/' + comment.id;
}

const get = function(req, res){
  try {
    let postId = req.params.postId || false, user = req.user, userFeed = req.query.userFeed && req.query.userFeed === 'true';
    if (postId) {
      let model = userFeed ? Comments.scope(['ExcludedCommentsOnMainFeed','defaultScopeCopy']) : Comments
      model.findAll(getCommentCriteriaObject (user, {PostId: postId}))
        .then((comments) => {
          if (comments) {
            comments = formatComments(comments, user)
          } else {
            comments = []
          }
          return ReS(res, {comments: setDefaultComment(comments)});
        })
    } else {
      throw new Error('PostId is not provided')
    }
  } catch (e) {
      console.log(e)
      return ReE(res, {error: 'Something went wrong while trying to load comments/answers for given post.'});
  }
}

module.exports.get = get;

const create =  function(req, res){

    let postId = req.params.postId;

    let user = req.user;

    let comment;

    /*
    ** function send mail to the admin about this video comment
    ** so that admin can review it and take appropriate
    ** action about the video
    */
    let sendVideoReviewMailToAdmin = function (comment) {
      let sub = 'New Video Comment (' + comment.id + ') posted by ' + user.first + ' ' + user.last + ' (' + user.id + ')';
      let userProfile = process.env.FRONT_END_SITE_URL_BASE + '/profile/' + user.id;
      let getActionURL = function (action) {
        return getDomainURL(req, true) + '/reviewVideoComment/' + comment.id + '?key=' + process.env.SITE_ADMIN_KEY + '&action=' + action;
      }
      let content = 'Video URL: ' + getCommentURL(comment) + '\nUser Profile: ' + userProfile + ' \n\nClick here to approve it-\n' + getActionURL('approve') + '\n\nClick here to reject it-\n' + getActionURL('reject');
      MailsController.sendMail(content, sub);
    }

    let filterComment = function (commentObj) {
      // remove blank paragraphs 
      commentObj.comment = removeBlankParagraphs(commentObj.comment.trim());
      return commentObj
    }

    let canSendForAdminReview = function (comment) {
      return comment.videoPath && process.env.ENABLE_VIDEO_REVIEW === 'true' && !user.byPassVideoReview
    }

     Posts.findOne({where: {id: postId}})
      .then((post) => {
        
        /*
        * if it's a normal text comment
        * enable it on main feed by default
        */
        if (!req.body.videoPath) {
          req.body.disableOnMainFeed = 0
        }

        Comments.create(filterComment(req.body))
          .then((comment) => {
             comment.setPost(post);
             comment.setUser(user);
             post.addComments(comment);
             user.addComments(comment);

             /* Update updatedAt timestamp on this post, 
             * if it needs to be updated
             */
               if (canUpdatePost(post, comment)) {
                 Posts.update({updatedAt: getMySQLDateTime()}, {where: {id: post.id}})
               }

             // send notification
             if (req.user.id !== post.UserId) {
               NotificationsController.create(getNotification(comment.id, post.id, post.type), req.user.id, post.UserId)
               
               /* commenting below code as it didn't work for some reason*/
               /*post.updatedAt = getMySQLDateTime();
               post.save() */

             }

             comment = comment.toWeb();
             comment.Likes = [];

             //add User model
             comment.User = req.user;

             /*
             ** Send mail to Admin about Video review
             **  
             */
             if (canSendForAdminReview(comment)) {
              sendVideoReviewMailToAdmin(comment); 
             }
             
             return ReS(res, {comment: comment});
          })
          .catch((error) => {
            return ReE(res, error, 422);
          })
      })
      .catch((error) => {
        return ReE(res, error, 422);
      })

}
module.exports.create = create;

module.exports.edit = async function (req, res) {
  let showError = (msg = false) => {
    return ReE(res, {error: msg || 'An error occured while saving the comment/details'}, 500)
  }
  try {
    let commentId = req.params.commentId || false, user = req.user, comment = req.body.comment || ''
    if (!commentId) {
      showError('No comment Id provided')
    } else {
      let condition = {
        id: commentId
      }
      if (!user.isAdmin) {
        condition.UserId = user.id
      }
      Comments.update({
        comment: removeBlankParagraphs(comment.trim())
      },{
        where: condition
      })
        .then((comntObj) => {
          if (comntObj) {
            return ReS(res, {message: 'Comment/details saved successfully'}, 200);
          } else {
            showError()
          }
        })
    }
  } catch (e) {
    console.log(e)
    showError()
  }
}

const remove = async function(req, res){
    try {
      let comment, err, post, commentId = parseInt(req.params.commentId), 
      user = req.user, 
      consumedAd = false,
      whereCond = {
        id: commentId
      };
      if (!user.isAdmin) {
        whereCond.UserId = user.id
      }

      [err, comment] = await to(Comments.findOne({where: whereCond}))
      if(err) return ReE(res, 'error occured trying to delete the comment');
      
      [err, post] = await to(Posts.findOne({where: {id: comment.PostId}}));
      if(err) return ReE(res, 'error occured trying to delete the comment');
      
      /*
      * if it's a video comment and is approved for payment
      * then this comment can not be deleted
      */
      if (comment.videoPath) {
        [err, consumedAd] = await to(ConsumedAds.findOne({where: {CommentId: commentId}}));
        if(err || consumedAd) {
          return ReE(res, 'Sorry, you can not delete this video response as it has been approved for payment.')
        }  
      }
      
      comment.deleted = true;
      comment.save()
        .then((comment) => {
          if(comment.videoPath) {
            const S3Controller   = require('./s3.controller');
            S3Controller.deleteVideo(comment.videoPath);
            //notify site admin about the deletion of this video comment
            MailsController.sendMail("Comment id: " + comment.id + "\nComment:" + JSON.stringify(comment), "Video comment (id: " + comment.id + ") deleted by " + user.first + ' ' + user.last, false, false);
          }
          NotificationsController.remove(getNotification(commentId, post.id, post.type), user.id)
          return ReS(res, {message:'Comment deleted'}, 200);
        })
      
    } catch (e) {
      console.log(e);
      return ReE(res, 'error occured trying to delete the comment');
    }

}
module.exports.remove = remove;

/*
* this function set a comment ad 'default'
* in the given array of comments
* Default comment/answer is what shows up under a question
* by default in User Feed
* The basic algorithm for determinign the default answer is-
* 1. Sort the comments from lowest to highest likes count
* 2. The "unviewed" comment with highest likes count is set as default comment
* 3. If all the comments are "viewed" then simply set the comment with highest likes count as default
*/

function setDefaultComment (comments) {
    if (comments.length && comments.length > 1) {

      let addDefaultCommentProperty = function (comments) {
        for (let i in comments) {
          comments[i].setDefault = false;
        } 
        return comments;
      }

      let getIndexInOriginalArrayByCommentId = function (commentId) {
        for (let i in comments) {
          if (comments[i].id === commentId) {
            return parseInt(i)
          }
        }
      }

      comments = addDefaultCommentProperty(comments)
      let sortedArr = cloneOject(comments)
      let unviewedFound = false
      sortedArr.sort((a, b) => {
        return a.CommentsLikesCount - b.CommentsLikesCount
      })

      for (let i = (sortedArr.length - 1); i >= 0; i--) {
        if (!sortedArr[i].HasViewed) {
          comments[getIndexInOriginalArrayByCommentId(sortedArr[i].id)].setDefault = true;
          unviewedFound = true
          break
        } 
      }
      if (!unviewedFound) {
        comments[getIndexInOriginalArrayByCommentId(sortedArr[(sortedArr.length - 1)].id)].setDefault = true;
      }
    } else if (comments.length === 1){
      comments[0].setDefault = true;
    }
    return comments
}

module.exports.setDefaultComment = setDefaultComment;

const getComment = async function(req, res){
 let showError = (message) => {
      return ReE(res, {success: false, message: message || 'Somehting went wrong.'}, 500);
  }
 try {
    let commentId = req.params.commentId, comment, err, post, user = req.user || false;

    let main = async () => {
      [err, comment] = await to(Comments.find(getCommentCriteriaObject(user, {id: commentId})));
       if(err) {
          console.log(err)
          throw new Error('error occured trying to get the comment')
       }
        
        [err, post] = await to(Posts.find({where: {id: comment.PostId}, include: [{model: Questions},{model: Videos}]}));
        if(err) {
          console.log(err)
          throw new Error('error occured trying to get the post')
         }

        return ReS(res, {comment: getSingleComment(comment, user), post: post}, 200);
    }

    /*
    * if user is not logged in, the page is most likely being
    * requested from public pages, in which case, make sure
    * the content was really shared 
    */
    if (!user) {
      const SocialSharingController   = require('./socialSharing.controller');
      SocialSharingController.hasContentBeenShared(commentId)
      .then((d) => {
        if (!d) {
          showError('This response/comment is not shared yet')
        } else {
          main()
        }
      })
    } else {
      main()
    }
  } catch (e) {
    console.log(e)
    showError()
  }
      
}
module.exports.getComment = getComment;

const reviewVideoComment = async function (req, res) {
  try {
    let commentId = req.params.commentId;
    let keyAuthentication = req.query.key && req.query.key === process.env.SITE_ADMIN_KEY;
    let action = req.query.action || false;
    let err, comment;
    let actionText = function () {
      return action === 'approve' ? 'approved' : action + 'ed';
    }
    let sendNotification = function (comment, action, adConsumed = false, videoPayment = false) {
      let meta = {
        commentId: comment.id,
        postId: comment.PostId,
      }
      if (action === 'approve') {
        meta.adConsumedId = adConsumed.id;
        meta.amountUSD = videoPayment.videoPaymentUSD;
        meta.amountINR = videoPayment.videoPaymentINR;
      }
      NotificationsController.create({
        type: action === 'approve' ? NOTIFICATIONS.types.VIDEO_COMMENT_ACCEPTED : NOTIFICATIONS.types.VIDEO_COMMENT_REJECTED,
        meta: JSON.stringify(meta),
      }, comment.User.id, comment.User.id)
    };

    let paymentObj = {
      getVideoPayment: function (forex, user) {
        let INRPrice = user.perVideoPriceINR  || VIDEO_PAYMENT_CONFIG.perVideoPriceINR
        return {
          videoPaymentUSD: roundTwoDecimalPlaces(INRPrice/forex),
          videoPaymentINR: INRPrice
        }
      },
      addMoneyToUserAccount: function (comment, amount) {
        return new Promise(function(resolve, reject) {
          try {
            ConsumedAds.findOrCreate({
              where: {
                UserId: comment.User.id,
                CommentId: comment.id,
                action: 'videoComment'
              },
              defaults: {
                action: 'videoComment',
                amountUSD: amount,
                UserId: comment.User.id,
                CommentId: comment.id
              }
            })
              .spread((consumedAd, created) => {
                resolve(consumedAd)
              })  
          } catch (e) {
            reject(e)
          }
        })
      }
    }
    /*
    * function to send mail to user, letting them know about the status of the 
    ** video review process by the admin
    */
    let proceed = function (comment) {
      let sub = process.env.SITE_NAME + '- ' + (action === 'approve' ? 'Congratulations, ' : 'Sorry, ') +  'your Video Comment (' + comment.id + ') is ' + actionText();
      let contentHead = 'Hi ' + ucFirst(comment.User.first) + ',\n\nYour video comment (' + getCommentURL(comment) + ') has been reviewed and been ' + actionText() + '.';
      let contentFooter = '\n\nWe will be very happy to help you if you have any questions or queries, please feel free to contact us.\n\nThank you.\n\n\n\nSincerely,\n\nTeam '+ process.env.SITE_NAME;
      let contentBody = '\n\n';
      
      //enable the approved comment on the Main feed
      let EnableCommentOnMainFeed = () => {
        comment.disableOnMainFeed = false
        comment.save()
      }
      if (action === 'approve') {
        EnableCommentOnMainFeed()
        Forex.getUSD2INR()
          .then((forex) => {
              let videoPayment = paymentObj.getVideoPayment(forex, comment.User);
              paymentObj.addMoneyToUserAccount(comment, videoPayment.videoPaymentUSD)
                .then((record) => {
                  sendNotification(comment, action, record, videoPayment);
                  contentBody += '$' + videoPayment.videoPaymentUSD + ' (' + videoPayment.videoPaymentINR + ' INR) have been added to your ' + process.env.SITE_NAME + ' account.';
                  MailsController.sendMail(contentHead + contentBody + contentFooter, sub, comment.User.email, false);
                })
          })
      } else {
        sendNotification(comment, action);
        contentBody += 'The video could be ' + actionText() + ' due to any of following reasons- \n\n1. The video answer does not answer the question. \n2. The video answer belongs to some other question.\n3. The video answer is too long or too short. Ideally, it should be 10-15 seconds long, as long as it is able to makes sense. \n4. The video answer is not unique and has either been uploaded already or was found on some other website/app.\n5. Video comment/answer is inappropriate and contains objectionable content.\n\nSorry, you will not get paid for this video. But do not loose heart, try to fix the issue and then re-upload the video :)\n\nFollow these guidelines for making better video answers and to avoid rejection in future-\n' + process.env.FRONT_END_SITE_URL_BASE + '/pages/video-answer-guidelines' + ' \n\nYour video might be deleted in some time or has already been deleted. Or it will not be deleted at all, in which case, you can delete it yourself if you would like.';
        MailsController.sendMail(contentHead + contentBody + contentFooter, sub, comment.User.email, false);
      }
    };

    if (!keyAuthentication || !action) {
      throw new Error ('Invalid or no key found in Review Video Comment URL OR no action specified.')
    } else {
      [err, comment] = await to (Comments.find({
        where: {
          id: commentId
        },
        include: [
          {
            model: User
          }
        ]
      }));
      if (!err) {
        proceed(comment);
        return ReS(res, {message: 'Comment successfully ' + actionText()}, 200);
      } else {
        throw err
      }
    }
  } catch (e) {
    console.log(e);
    return ReE(res, {message: 'Somehting went wrong'});
  }
}

module.exports.reviewVideoComment = reviewVideoComment;

const commentOnMainFeed = async function (req, res) {
  try {
    if (req.user.isAdmin) {
      let commentId = req.params.commentId,
      action = req.query.action && req.query.action === 'disable' ? true : false;
      Comments.update({
        disableOnMainFeed: action
      }, {
        where: {
          id: commentId
        }
      })
        .then((d) => {
          if (d) {
            return ReS(res, {message: 'Comment successfully ' + (action ? 'disabled': 'enabled') + ' on main feed'})
          }
        })
        .catch((e) => {
          console.log(e)
          return ReE(res, {message: 'Somehting went wrong'}, 500);
        })
    } else {
      return ReE(res, {message: 'Anauthorized User'}, 403);   
    }
  } catch (e) {
    console.log(e)
    return ReE(res, {message: 'Somehting went wrong'}, 500);
  }
}

module.exports.commentOnMainFeed = commentOnMainFeed;