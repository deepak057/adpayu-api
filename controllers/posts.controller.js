const { Posts, Comments, User, Questions, AdOptions, Images, Imgs, Tags, Likes, Videos, Friendship } = require('../models');
const { to, ReE, ReS, isEmptyObject, sleep, getLimitOffset } = require('../services/util.service');
const Sequelize = require('sequelize');
const op = Sequelize.Op;

/*
* Function to get the array of only UIDs
*/

function getUIDs (users, currentUser) {
  let uids= []
  if(users.length) {
    users.forEach(function(user){
      uids.push(user.id)
    })
  }
  uids.push(currentUser.id)
  return uids
}


/*
** Get default DB Include models
*/

function getDBInclude (pushModel) {
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
            model: Videos
          }
        ];

    if(pushModel) {
      return_.push(pushModel)
    }

    return return_;
}


/**
** Convert the posts and include Likes
**/
function toWeb(posts, user) {
    
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

const create = async function(req, res){
    let err, post, comments, question, adOptions, images, tags, video;
    let user = req.user;

    let post_info = req.body;

    /*
    Temporary workarounds
    */
    post_info.likes = '';

    /***
    Workarounds end
    **/


    [err, post] = await to(Posts.create(post_info));
    if(err) return ReE(res, err, 422);

    // Saving relations
    user.addPosts(post);
    post.setUser(user);

   /* if(!isEmptyObject(post_info.comments)){
        [err, comments] = await to(Comments.create(post_info.comments));
        if(err) return ReE(res, err, 422);

        post.addComments(comments);
        comments.setPost(post);
        user.addComments(comments);
        comments.setUser(user);

    }*/


     if(!isEmptyObject(post_info.question)){

        [err, question] = await to(Questions.create(post_info.question));
         if(err) return ReE(res, err, 422);

         post.setQuestion(question);
         user.addQuestions(question);
         question.setUser(user);

    }

    if(!isEmptyObject(post_info.video)){

        [err, video] = await to(Videos.create(post_info.video));
         if(err) return ReE(res, err, 422);

         post.setVideo(video);
         user.addVideos(video);
         video.setUser(user)
    }

    if(post_info.adOptions.postIsAd) {
        [err, adOptions] = await to(AdOptions.create(post_info.adOptions));
         if(err) return ReE(res, err, 422);

        post.setAdOption(adOptions);
        adOptions.setUser(user);
        user.addAdOptions(adOptions);
    }

    if(post_info.images.length > 0) {

        for(let j in post_info.images) {
            [err, image] = await to(Images.find({where: { id: post_info.images[j].id}}));
            if(image) {
              post.addImages(image)
              image.setPost(post)
            }
          }
    }

    /*
    ** Loop through given Tags and cretae new tags if they don't already exist in database
    ** also associate tags with current post 
    */

    if(post_info.tags.length > 0) {

      for(var i in post_info.tags){
        
        Tags.findOrCreate(
        {
          where: {name: post_info.tags[i].text},
          defaults: {
            name: post_info.tags[i].text,
            UserId: user.id
          }
        },
        ). spread ((tag, created) => {
          post.addTags(tag)
        })

      }

    }


    [err, post] = await to(post.save());
    if(err) return ReE(res, err, 422);

    /*
    ** Delay code execution by 100 miliseconds so that some database queries can finish executing
    ** And we get the most updated Post object to be sent to the front end
    */
    await sleep(100);

    Posts.findOne({include: getDBInclude({model: Tags}), where: {id: post.id}})
      .then((post) => {
            return ReS(res, toWeb(post, user), 201);

      })
      .catch((err) => {
        return ReE(res, err, 422);
      })

}
module.exports.create = create;

const get = async function(req, res){
    let friends;

    let user = req.user;

    let tag = req.params.tag || 'all';

    let page = req.query.page || 1;

    let dbIncludes = getDBInclude()

    let limitNOffset = getLimitOffset(page);

    // get current user's friends
    [err, friends] = await to(User.getFriends(req.user.id))
     if(err) {
       return ReE(res, err, 422);
     }

    let criteria = {
      include: dbIncludes ,
      order: [['updatedAt', 'DESC']], 
      limit: limitNOffset.limit,
      offset: limitNOffset.offset,
      where: {[op.or]: [
          {
            UserId: getUIDs(friends, req.user)
          },
          {
            AdOptionId: { [op.ne]: null}
          },
          {
            public: { [op.eq]: true}
          }
        ]}
    };

    if(tag === 'all')  {

      criteria.include.push({
          model: Tags,
        })


      
      Posts.findAll(criteria)
         .then(posts => {

            return ReS(res, {posts: toWeb(posts, user)});

      })

    }  

    else {

      Tags.findOne({where: {name: tag}})
      .then ((Dbtag) => {

       criteria.include.push({
          model: Tags,
          where: {id: Dbtag.id}
        })

        Posts.findAll(criteria)
         .then(posts => {

            return ReS(res, {posts: toWeb(posts, user)});

      })

      }).catch ((error) => {
        return ReS(res, error);

      })

    }
}
module.exports.get = get;

const getPostById = function(req, res){
    let postId = req.params.postId || false

    if(postId) {
      Posts.findOne({include: getDBInclude({model: Tags}), where: {id: postId}})
      .then((post) => {
            return ReS(res, toWeb(post, req.user), 201);
      })
      .catch((err) => {
        return ReE(res, err, 422);
      })
    } else {
      return ReE(res, {'error': 'No Post Id provided'}, 422);
    }
}

module.exports.getPostById = getPostById;

const update = async function(req, res){
    let err, company, data;
    company = req.company;
    data = req.body;
    company.set(data);

    [err, company] = await to(company.save());
    if(err){
        return ReE(res, err);
    }
    return ReS(res, {company:company.toWeb()});
}
module.exports.update = update;

const remove = async function(req, res){
    let company, err;
    company = req.company;

    [err, company] = await to(company.destroy());
    if(err) return ReE(res, 'error occured trying to delete the company');

    return ReS(res, {message:'Deleted Company'}, 204);
}
module.exports.remove = remove;