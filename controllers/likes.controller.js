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

    if(like)  return ReS(res, {message:'Post already Liked', like: like}, 204);

    else{
      Likes.create()
        .then((like) => {

         like.setUser(req.user);
         like.setPost(post);
         user.addLikes(like);
         post.addLikes(like);
         return ReS(res, {message:'Post Liked', like: like}, 204);

        })
    
    }

   
  }

}
module.exports.createPostLike = createPostLike;

const removePostLike = async function(req, res){
    let like, err;
    let user = req.user;

    [err, like] = await to(Likes.destroy({where: {UserId: user.id, PostId: req.params.postId}}));

    if(err)  return ReE(res, {message:'Failed unlike'});

    else  return ReS(res, {message:'Post unliked'}, 204);

}
module.exports.removePostLike = removePostLike;

const createCommentLike = async function(req, res){
    
}
module.exports.createCommentLike = createCommentLike;

const removeCommentLike = async function(req, res){
    
}
module.exports.removeCommentLike = removeCommentLike;