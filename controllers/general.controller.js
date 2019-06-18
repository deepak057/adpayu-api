const { Likes, User, Comments, Posts } = require('../models');
const { to, ReE, ReS } = require('../services/util.service');
const { captureVideoPoster } = require('../services/app.service');

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


const captureScreenshots =  async function(req, res){
    if (req.user.id === 1) {

      const appRoot = require('app-root-path');

      // List all files in a directory in Node.js recursively in a synchronous fashion
       var walkSync = function(dir, filelist) {
              var path = path || require('path');
              var fs = fs || require('fs'),
                  files = fs.readdirSync(dir);
              filelist = filelist || [];
              files.forEach(function(file) {
                  if (fs.statSync(path.join(dir, file)).isDirectory()) {
                      filelist = walkSync(path.join(dir, file), filelist);
                  }
                  else {
                      
                    if(file.split('.').pop() === 'mp4') {
                      captureVideoPoster(file)
                    }
                  }
              });
              return filelist;
          };

          walkSync(appRoot+'/uploads/');
          return ReS(res, {message:'Screenshots are being taken.'}, 200);
    } else {
      return ReE(res, {message:'Unathorized user'}, 401);
    }
}

module.exports.captureScreenshots = captureScreenshots;