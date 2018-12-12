const { Comments, Posts } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');
const NotificationsController   = require('./notifications.controller');
const NOTIFICATIONS = require('../config/app-constants');

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
               NotificationsController.create(getNotification(comment.id, post.id, post.type), req.user.id, post.UserId)
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
    let comment, err, post;

    [err, comment] = await to(Comments.findOne({where: {id: req.query.commentId}}));
    if(err) return ReE(res, 'error occured trying to delete the comment');
      
    [err, post] = await to(Posts.findOne({where: {id: comment.PostId}}));
    if(err) return ReE(res, 'error occured trying to delete the comment');
      
    comment.destroy();

    NotificationsController.remove(getNotification(req.query.commentId, post.id, post.type), req.user.id)

    return ReS(res, {message:'Comment deleted'}, 204);
}
module.exports.remove = remove;