const { Comments, Posts } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');
const NotificationsController   = require('./notifications.controller');
const NOTIFICATIONS = require('../config/app-constants');

function getNotification(commentId, postId) {
  return {
    type: NOTIFICATIONS.types.COMMENT_ON_POST,
    meta: JSON.stringify({
      commentId: commentId,
      postId: postId
    })
  }
}

const create =  function(req, res){

    let postId = req.params.postId;

    let user = req.user;

    let comment;

     Posts.findOne({where: {id: postId}})
      .then((post) => {
         
        Comments.create(req.body)
          .then((comment) => {
             comment.setPost(post);
             comment.setUser(user);
             post.addComments(comment);
             user.addComments(comment);

             // send notification
             if (req.user.id !== post.UserId) {
               NotificationsController.create(getNotification(comment.id, post.id), req.user.id, post.UserId)
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
    let comment, err, postId;

    [err, comment] = await to(Comments.findOne({where: {id: req.query.commentId}}));
    if(err) return ReE(res, 'error occured trying to delete the comment');
      
    postId = comment.PostId;

    comment.destroy();

    NotificationsController.remove(getNotification(req.query.commentId, postId), req.user.id)

    return ReS(res, {message:'Comment deleted'}, 204);
}
module.exports.remove = remove;