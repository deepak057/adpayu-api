const { Posts, Comments, User, Questions, AdOptions, AdStats, ConsumedAds, Images, Imgs, Tags, Likes, Videos, Friendship } = require('../models');
const { isEmptyObject } = require('./util.service');
const Sequelize = require('sequelize');
const op = Sequelize.Op;

/*
* Function to get the array of only UIDs
* extracted from the given array of User
* objects
*/


module.exports.getUIDs = function(users, currentUser = false) {
  let uids= []
  if(users.length) {
    users.forEach(function(user){
      uids.push(user.id)
    })
  }
  // also push the id of current user so that
  // it alwasy shows posts created by self
  if (currentUser) {
    uids.push(currentUser.id)
  }

  return uids
}


/*
* function to get the comment
* model and dependencies
*/

function getCommentIncludes () {
return [
  {
    model: User.scope('public')
  },
  {
    model: Likes,
    //including an a fake condition
    // to prevent selecting all the 
    // associated Records to save 
    where: {
      id: 'dummy'
    },
    required: false
  }
]
}

module.exports.getCommentIncludes = function () {
  return getCommentIncludes()
}

/*
** Get default DB Include models
*/

function getDBInclude(user, tagIds = [], pushModel = {}) {
  let tags = {
    model: Tags,
  }
  
  let adOption = {
      model: AdOptions,
      /* where: {
        adCountries: 
      }*/
      include: [
        {
          model: AdStats
        }
      ]
  }

  /*if (user.location) {
   adOption.where = Sequelize.literal(' FIND_IN_SET("'+user.location+'",adCountries)')
  }
  */

  if (tagIds.length) {
    tags.where = {
      id: tagIds
    }
  }

  let return_ = [

          {
            model: User.scope('public')
          },
          
          {
            model: Images,
          },
          {
            model: Questions,
          },
          {
            model: Likes,
            //including an a fake condition
            // to prevent selecting all the 
            // associated Records to save 
            where: {
              id: 'dummy'
            },
            required: false
          },
          {
            model: Videos,
          },
          {
            model: ConsumedAds,
            where: {
              UserId: user.id
            },
            required: false,
          }
          
        ];

    return_.push(tags)
    return_.push(adOption)
    /*return_.push({model: Comments})*/

    if(!isEmptyObject(pushModel)) {
      return_.push(pushModel)
    }

    return return_;
}
module.exports.getDBInclude = getDBInclude;


function getPostCriteriaObject (user, tagIds = []) {
  return {
      include: getDBInclude(user, tagIds) ,
      
      /*
      Include comments count 
      */
      attributes: {
        include: [
          [Sequelize.literal('(SELECT COUNT(*) FROM Comments WHERE Comments.PostId = Posts.id)'), 'CommentsCount'],
          [Sequelize.literal('(SELECT COUNT(*) FROM Likes WHERE Likes.PostId = Posts.id)'), 'LikesCount'],
          [Sequelize.literal('(SELECT COUNT(*) FROM Likes WHERE Likes.PostId = Posts.id AND Likes.UserId = '+ user.id +')'), 'HasLiked']
        ]
      },
        
    }
}

module.exports.getPostCriteriaObject = getPostCriteriaObject;

/**
** Convert the posts and include Likes
**/
module.exports.toWeb = function(posts, user) {
    
  if(posts.constructor !== Array) {
    return getWebPost(posts, user)
  }

  else {
    let posts_web = [];

    for (let i in posts){

        posts_web.push(getWebPost(posts[i], user))

    }

    return posts_web;
  }
 
}

function getWebPost (post, user) {
  let post_web = setDefaultLike (post, user);
  post_web.Comments = getPostComments(post, user);

  //add some custom properties 
  post_web.show = true
  post_web.showComments = false
  
  return post_web;
}


function getPostComments (post, user) {
  let comments_web = [];

    for (let i in post.Comments){
      comments_web.push(getSingleComment(post.Comments[i], user))
    }

    return comments_web;

}

module.exports.formatComments = function (comments, user) {
  let comments_web = [];

    for (let i in comments){
      comments_web.push(getSingleComment(comments[i], user))
    }

    return comments_web;
}

function getSingleComment (commentObj, user) {
  return setDefaultLike(commentObj, user)
}

module.exports.getSingleComment = function (commentObj, user) {
  return getSingleComment(commentObj, user)
}

function setDefaultLike (model, user) {
  let json = model.toJSON();

        for(let i in json['Likes']) {
            json['Likes'][i].liked = false;
            if(json['Likes'][i].UserId == user.id) {
                json['Likes'][i].liked = true;
            }
        }

  return json;
}

/*
** function to add "following" boolean to indicate wehter 
** current user follow a given tag or not
*/
module.exports.tagsToWeb = function (tags) {
  let tagsWeb = []
  if(tags.length) {
    for (let i in tags) {
      let t = tags[i].toWeb()
      if(t.Users.length) {
        t.following = true
      } else {
        t.following = false
      }
      delete t.Users
      tagsWeb.push(t)
    }
  }
  return tagsWeb
}

/*
* function to decide wether a given post's updatedAt timestamp needs to be updated
*/
module.exports.canUpdatePost = function (post, comment) {
  /*
  * updatedAt timestamp can be updated if given comment is an Answer or if 
  * it's a video comment
  */
  return post.type === 'question' || comment.videoPath
}


function captureVideoPoster (videoFileName) {
  const appRoot = require('app-root-path');
  let ffmpeg = require('fluent-ffmpeg');
  let videoPath = appRoot+'/uploads/'+ videoFileName
  // replace the extension of given video file with ".png"
  let posterImageName = videoFileName.substr(0, videoFileName.lastIndexOf(".")) + ".png";
  ffmpeg(videoPath)
    .on('end', function() {
      console.log('Screenshot taken');
    })
    .on('error', function(err) {
      console.error(err);
    })
    .screenshots({
      timestamps: [.5],
      folder: appRoot+'/uploads/thumbs',
      filename: posterImageName
    });

}

module.exports.captureVideoPoster = captureVideoPoster;