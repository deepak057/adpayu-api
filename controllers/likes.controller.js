const { Likes, Posts, User, Comments } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');
const Sequelize = require('sequelize');

const Op = Sequelize.Op;

const createPostLike = async function(req, res){
  let like, err, post;

  [err, post] = await to(Posts.findOne({where: {id: req.params.postId}}));
  if(err) return ReE(res, 'Post not found');


  else {
    let user = req.user;

    [err, like] = await to(Likes.findOne({where: {UserId: user.id, PostId: post.id}}));

    if(like)  return ReS(res, {message:'Post already Liked', like: like}, 200);

    else{
      Likes.create()
        .then((like) => {

         like.setUser(req.user);
         like.setPost(post);
         user.addLikes(like);
         post.addLikes(like);
         return ReS(res, {message:'Post Liked', like: like}, 200);

        })
    
    }

   
  }

}
module.exports.createPostLike = createPostLike;

const removePostLike = async function(req, res){
    let like, err;
    let user = req.user;

    [err, like] = await to(Likes.destroy({where: {UserId: user.id, PostId: req.params.postId}}));

    if(err)  return ReE(res, {message:'Failed to unlike'});

    else  return ReS(res, {message:'Post unliked'}, 200);

}
module.exports.removePostLike = removePostLike;

const createCommentLike = async function(req, res){
    let like, err, comment;

  [err, comment] = await to(Comments.findOne({where: {id: req.params.commentId}}));
  if(err) return ReE(res, 'Comment not found');


  else {
    let user = req.user;

    [err, like] = await to(Likes.findOne({where: {UserId: user.id, CommentId: comment.id}}));

    if(like)  return ReS(res, {message:'Comment already Liked', like: like}, 200);

    else{
      Likes.create()
        .then((like) => {

         like.setUser(user);
         like.setComment(comment);
         user.addLikes(like);
         comment.addLikes(like);
         return ReS(res, {message:'Comment Liked', like: like}, 200);

        })
    
    }

   
  }


}
module.exports.createCommentLike = createCommentLike;

const removeCommentLike = async function(req, res){
    let like, err;
    
    let user = req.user;

    [err, like] = await to(Likes.destroy({where: {UserId: user.id, CommentId: req.params.commentId}}));

    if(err)  return ReE(res, {message:'Failed to unlike'});

    else  return ReS(res, {message:'Comment unliked'}, 200);

}
module.exports.removeCommentLike = removeCommentLike;