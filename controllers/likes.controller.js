const { Likes, Posts, User, Comments } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');
const Sequelize = require('sequelize');

const Op = Sequelize.Op;

const createPostLike =  function(req, res){
  let like, err, post;

  [err, post] = await to(Posts.fndOne({where: {id: req.params.postId}}));
  if(err) return ReE(res, 'Post not found');


  else {

    [err, like] = await to(Likes.create());
    if(err) return ReE(res, 'error occured');

    else{
      like.setUser(req.user);
      like.setPost(post);
      user.addLikes(like);
      post.addLikes(like);
      return ReS(res, {message:'Post Liked', like: like}, 204);

    }

   
  }

}
module.exports.createPostLike = createPostLike;

const removePostLike = async function(req, res){
    
}
module.exports.removePostLike = removePostLike;

const createCommentLike = async function(req, res){
    
}
module.exports.createCommentLike = createCommentLike;

const removeCommentLike = async function(req, res){
    
}
module.exports.removeCommentLike = removeCommentLike;