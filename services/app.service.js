const { Posts, Comments, User, Questions, AdOptions, Images, Imgs, Tags, Likes, Videos, Friendship } = require('../models');
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
** Get default DB Include models
*/

module.exports.getDBInclude = function(tagIds = []) {
  let tags = {
    model: Tags,
  }
  
  if (tagIds.length) {
    tags.where = {
      id: tagIds
    }
  }

  let return_ = [

          {
            model: Comments,
            include: [
              {
                model: User.scope('public')
              },
              {
                model: Likes
              }
            ]
          },
          {
            model: User.scope('public')
          },
          {
            model: AdOptions,
          },
          {
            model: Images,
          },
          {
            model: Questions,
          },
          {
            model: Likes,
          },
          {
            model: Videos,
          },
          
        ];

    return_.push(tags)

    return return_;
}


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
      comments_web.push(setDefaultLike(post.Comments[i], user))
    }

    return comments_web;

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
