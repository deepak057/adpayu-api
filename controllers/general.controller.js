const { Likes, User, Comments, Posts } = require('../models');
const { to, ReE, ReS } = require('../services/util.service');


const fakeCommentsLike =  async function(req, res){
    let commentId = req.params.commentId, err, user = req.user, comment, n = req.query.n || 100, likes = [];
  	if (user.id === 1) {
  	  [err, comment] = await to(Comments.findOne({where: {id: commentId}}));	
  	
  	  for (let i = 0; i < n; i++) {
  		likes.push({
  			UserId: user.id,
  			CommentId: comment.id
  		})
  	  }

  	  Likes.bulkCreate(likes)
        .then((likes) => {
        	for(let i in likes) {
                user.addLikes(likes[i]);
                comment.addLikes(likes[i]);
        	}
            return ReS(res, {message:'Likes made successfully'}, 200);
        })
	
  	} else {
  		return ReE(res, {message:'Unathorized user'}, 401);
  	}
  	
}

module.exports.fakeCommentsLike = fakeCommentsLike;

const fakePostLike =  async function(req, res){
    let postId = req.params.postId, err, user = req.user, post, n = req.query.n || 100, likes = [];
  	if (user.id === 1) {
  	  [err, post] = await to(Posts.findOne({where: {id: postId}}));	
  	
  	  for (let i = 0; i < n; i++) {
  		likes.push({
  			UserId: user.id,
  			PostId: post.id
  		})
  	  }

  	  Likes.bulkCreate(likes)
        .then((likes) => {
        	for(let i in likes) { 
             user.addLikes(likes[i]);
             post.addLikes(likes[i]);
        	}
            return ReS(res, {message:'Likes made successfully'}, 200);
        })
	
  	} else {
  		return ReE(res, {message:'Unathorized user'}, 401);
  	}
  	
}

module.exports.fakePostLike = fakePostLike;
