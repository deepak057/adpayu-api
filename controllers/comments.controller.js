const { Comments, Users, Likes, Posts, Videos, Questions } = require('../models');
const { to, ReE, ReS, getMySQLDateTime, removeBlankParagraphs } = require('../services/util.service');
const NotificationsController   = require('./notifications.controller');
const { NOTIFICATIONS } = require('../config/app-constants');
const { getCommentIncludes, getSingleComment, canUpdatePost, formatComments } = require('../services/app.service');
const Sequelize = require('sequelize');

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
      return ReE(res, {error: 'Something went wrong while trying to load comments/answers for given post.'}, 422);
  }
}

module.exports.get = get;

const create =  function(req, res){

    let postId = req.params.postId;

    let user = req.user;

    let comment;

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
      
      comment.destroy();

      NotificationsController.remove(getNotification(commentId, post.id, post.type), user.id)

      return ReS(res, {message:'Comment deleted'}, 200);
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
