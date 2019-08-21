const { Comments, User, Likes, Posts, Videos, Questions, Forex, ConsumedAds } = require('../models');
const { to, ReE, ReS, getMySQLDateTime, removeBlankParagraphs, getDomainURL, ucFirst, roundTwoDecimalPlaces } = require('../services/util.service');
const NotificationsController   = require('./notifications.controller');
const MailsController   = require('./mails.controller');
const { NOTIFICATIONS } = require('../config/app-constants');
const { getCommentIncludes, getSingleComment, canUpdatePost, formatComments } = require('../services/app.service');
const Sequelize = require('sequelize');
const { VIDEO_PAYMENT_CONFIG } = require('../config/app-constants');
require('dotenv').config();

function getNotification(commentId, postId, type= 'text') {
  return {
    type: NOTIFICATIONS.types.COMMENT_ON_POST,
    meta: JSON.stringify({
      commentId: parseInt(commentId),
      postId: parseInt(postId),
      postType: type
    })
  }
}

function getCommentCriteriaObject (user, where = false) {
  let r_ = {
    include: getCommentIncludes(),
    attributes: {
      include: [
        [Sequelize.literal('(SELECT COUNT(*) FROM Likes WHERE Likes.CommentId = Comments.id)'), 'CommentsLikesCount'],
        [Sequelize.literal('(SELECT COUNT(*) FROM Likes WHERE Likes.CommentId = Comments.id AND Likes.UserId = '+ user.id +')'), 'HasLiked']
      ]
    },
  }
  if (where) {
    r_.where =  where
  }
  return r_;
}

function getCommentURL (comment) {
  return process.env.FRONT_END_SITE_URL_BASE + '/c/' + comment.id;
}

const get =  function(req, res){
  try {
    let postId = req.params.postId || false, user = req.user;
    if (postId) {
      Comments.findAll(getCommentCriteriaObject (user, {PostId: postId}))
        .then((comments) => {
          if (comments) {
            comments = formatComments(comments, user)
          } else {
            comments = []
          }
          return ReS(res, {comments: comments});
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

     Posts.findOne({where: {id: postId}})
      .then((post) => {
         
        Comments.create(filterComment(req.body))
          .then((comment) => {
             comment.setPost(post);
             comment.setUser(user);
             post.addComments(comment);
             user.addComments(comment);

             // send notification
             if (req.user.id !== post.UserId) {
               NotificationsController.create(getNotification(comment.id, post.id, post.type), req.user.id, post.UserId)
               
              /* Update updatedAt timestamp on this post, 
              * if it needs to be updated
              */
               if (canUpdatePost(post, comment)) {
                 Posts.update({updatedAt: getMySQLDateTime()}, {where: {id: post.id}})
               }
               
               /* commenting below code as it didn't work for some reason*/
               /*post.updatedAt = getMySQLDateTime();
               post.save() */

             }

             comment = comment.toWeb();
             comment.Likes = [];

             //add User model
             comment.User = req.user;

             //send mail to Admin about the video 
             sendVideoReviewMailToAdmin(comment);

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

const remove = async function(req, res){
    try {
      let comment, err, post, commentId = parseInt(req.params.commentId), user = req.user;

      [err, comment] = await to(Comments.findOne({where: {id: commentId, UserId: user.id}}));
      if(err) return ReE(res, 'error occured trying to delete the comment');
      
      [err, post] = await to(Posts.findOne({where: {id: comment.PostId}}));
      if(err) return ReE(res, 'error occured trying to delete the comment');
      
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
      return ReE(res, 'error occured trying to delete the comment', 204);
    }

}
module.exports.remove = remove;

const getComment = async function(req, res){
  try {
    let commentId = req.params.commentId, comment, err, post;
    
     [err, comment] = await to(Comments.find(getCommentCriteriaObject(req.user, {id: commentId})));
     if(err) {
        console.log(err)
        throw new Error('error occured trying to get the comment')
     }
      
      [err, post] = await to(Posts.find({where: {id: comment.PostId}, include: [{model: Questions},{model: Videos}]}));
      if(err) {
        console.log(err)
        throw new Error('error occured trying to get the post')
       }

      return ReS(res, {comment: getSingleComment(comment, req.user), post: post}, 200);      

  } catch (e) {
    console.log(e)
    return ReE(res, {success: false, message: 'Somehting went wrong while getting the comment.'});

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
      getVideoPayment: function (forex) {
        return {
          videoPaymentUSD: roundTwoDecimalPlaces(VIDEO_PAYMENT_CONFIG.perVideoPriceINR/forex),
          videoPaymentINR: VIDEO_PAYMENT_CONFIG.perVideoPriceINR
        }
      },
      addMoneyToUserAccount: function (comment, amount) {
        return new Promise(function(resolve, reject) {
          try {
            ConsumedAds.find({
              where: {
                UserId: comment.User.id,
                CommentId: comment.id
              }
            })
              .then((consumedAd) => {
                if (!consumedAd) {
                  ConsumedAds.create({
                    action: 'videoComment',
                    amountUSD: amount,
                    UserId: comment.User.id,
                    CommentId: comment.id
                  })
                    .then((consumedAd) => {
                      resolve(consumedAd)
                    })
                  
                } else {
                  resolve(consumedAd)
                }
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

      if (action === 'approve') {
        Forex.getUSD2INR()
          .then((forex) => {
              let videoPayment = paymentObj.getVideoPayment(forex);
              paymentObj.addMoneyToUserAccount(comment, videoPayment.videoPaymentUSD)
                .then((record) => {
                  sendNotification(comment, action, record, videoPayment);
                  contentBody += '$' + videoPayment.videoPaymentUSD + ' (' + videoPayment.videoPaymentINR + ' INR) have been added to your ' + process.env.SITE_NAME + ' account.';
                  MailsController.sendMail(contentHead + contentBody + contentFooter, sub, comment.User.email, false);
                })
          })
      } else {
        sendNotification(comment, action);
        contentBody += 'The video could be ' + actionText() + ' due to any of following reasons- \n\n1. The video answer does not answer the question. \n2. The video answer belongs to some other question.\n3. The video answer is too long or too short. Ideally, it should be 10-15 seconds long, as long as it is able to makes sense. \n4. The video answer is not unique and has either been uploaded already or was found on some other website/app.\n5. Video comment/answer is inappropriate and contains objectionable content.\n\nSorry, you will not get paid for this video. But do not loose heart, try to fix the issue and then re-upload the video :) \n\nYour video might be deleted in some time or has already been deleted. Or it will not be deleted at all, in which case, you can delete it yourself if you would like.';
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
    return ReE(res, {message: 'Somehting went wrong.'});
  }
}

module.exports.reviewVideoComment = reviewVideoComment;