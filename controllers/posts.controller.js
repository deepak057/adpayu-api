const { Posts, Comments, User, Questions, AdOptions, Images, Imgs, Tags, Likes, Videos, Friendship } = require('../models');
const { to, ReE, ReS, isEmptyObject, sleep, getLimitOffset } = require('../services/util.service');
const { getUIDs, getDBInclude, toWeb } = require('../services/app.service');
const Sequelize = require('sequelize');
const op = Sequelize.Op;


const create = async function(req, res){
    let err, post, comments, question, adOptions, images, tags, video;
    let user = req.user;

    let post_info = req.body;

    /*
    * delete the ID parameter just in case 
    * it was sent by the client
    */
    if('id' in post_info) {
      delete post_info.id
    }

    [err, post] = await to(Posts.create(post_info));
    if(err) return ReE(res, err, 422);

    // Saving relations
    user.addPosts(post);
    post.setUser(user);


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
        
      [err, adOptions] = await to(AdOptions.create(getAdOptions(post_info.adOptions)));
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
          tag.addUsers(user)
          user.addTags(tag)
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

    Posts.findOne({include: getDBInclude(), where: {id: post.id}})
      .then((post) => {
            return ReS(res, toWeb(post, user), 201);

      })
      .catch((err) => {
        return ReE(res, err, 422);
      })

}

/*
* function to return the AdOptions object
* to be save in the database
*/

function getAdOptions (adOptions) {
  let countries = [];
  if (adOptions.adCountries.length) {
    for(let i in adOptions.adCountries) {
      countries.push(adOptions.adCountries[i].code)
    }
  }
  adOptions.adCountries = countries.toString();
  return adOptions;
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

     let condition = [
          {
            UserId: getUIDs(friends, req.user)
          },
          {
            AdOptionId: { [op.ne]: null}
          },
      ]

    let criteria = {
      include: dbIncludes ,
      //attributes: [[Sequelize.literal('DISTINCT'), '']],
      distinct: true,
      //attributes: [[Sequelize.literal('DISTINCT'), 'key'], 'value'],
      order: Sequelize.literal('updatedAt DESC LIMIT '+ limitNOffset.offset + ',' + limitNOffset.limit), 
      
      /*
      * Get only those posts which are from user's friends, public, selft created or ads
      */
        
    };

    if(tag === 'all')  {

      // get the tags of current user and create an array containing Tag Ids
      req.user.getTags()
        .then ((userTags) => {
          let tagsId = [];
          if(userTags) {
            for(let i in userTags) {
              tagsId.push(userTags[i].id)
            }
          }

          condition.push({public: { [op.eq]: true},'$Tags.id$': tagsId});

          criteria.where = {[op.or]: condition}

          Posts.findAll(criteria)
           .then((posts) => {
              return ReS(res, {posts: toWeb(posts, user)});
            })
           .catch ((error) => {
             return ReS(res, error);
            })

        })
        .catch ((error) => {
          return ReS(res, error);
        })

          // update the db include array by passing it TagIds of the tags that
          // current user follows
          // criteria.include = getDBInclude(tagsId)

    }  else {

        Tags.findOne({where: {name: tag}})
          .then ((Dbtag) => {
            
            // update the db include array by passing it TagIds of the tag that
            // has been requested
            criteria.include = getDBInclude([Dbtag.id]);

            condition.push({public: { [op.eq]: true}});

            criteria.where = {[op.or]: condition}

            Posts.findAll(criteria)
             .then(posts => {
                return ReS(res, {posts: toWeb(posts, user)});
             })
             .catch ((error) => {
               return ReS(res, error);
              })

          })
          .catch ((error) => {
            return ReS(res, error);
          })
  }
}
module.exports.get = get;

const getTimelineFeed = async function(req, res){
  let profileUserId = parseInt(req.params.userId) || req.user.id

  let page = req.query.page || 1;

  let limitNOffset = getLimitOffset(page);

  let criteria = {
      include: getDBInclude() ,
      order: [['updatedAt', 'DESC']], 
      limit: limitNOffset.limit,
      offset: limitNOffset.offset,
      where: {}
  }    

  if (profileUserId === req.user.id) {
     criteria.where = {
        UserId: req.user.id
     }
  } else {
    let err, friends, isFriend = false;

    // get profile user's friends
    [err, friends] = await to(User.getFriends(profileUserId))
     if(err) {
       return ReE(res, err, 422);
     }

     // check if current user is friends with Profile user
     if(friends.length) {
       isFriend = getUIDs(friends).indexOf(req.user.id) !== -1
     }
     
     if (isFriend) {
       criteria.where = {
         UserId: profileUserId,
       }
     } else {
        criteria.where = {
          UserId: profileUserId,
          [op.or]: [
            {
              AdOptionId: { [op.ne]: null}
            },
            {
              public: { [op.eq]: true}
            }
          ]
        }
     }
  }
  
  Posts.findAll(criteria)
   .then(posts => {
      return ReS(res, {posts: toWeb(posts, req.user)});
   })
   .catch ((error) => {
     return ReS(res, error);
   })

}

module.exports.getTimelineFeed = getTimelineFeed;


const getPostById = function(req, res){
    let postId = req.params.postId || false

    if(postId) {
      Posts.findOne({include: getDBInclude(), where: {id: postId}})
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