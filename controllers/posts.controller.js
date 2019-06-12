const { Posts, Comments, User, Questions, AdOptions, Images, Imgs, Tags, Likes, Videos, Friendship, Orders, PushedAds } = require('../models');
const { to, ReE, ReS, isEmptyObject, sleep, getLimitOffset } = require('../services/util.service');
const { getUIDs, getDBInclude, toWeb, getPostCriteriaObject } = require('../services/app.service');
const Sequelize = require('sequelize');
const op = Sequelize.Op;
const { ADS } = require('../config/app-constants');


const create = async function(req, res){
    let err, post, comments, question, adOptions, images, tags, video, order;
    let user = req.user;

    let post_info = req.body;

    /*
    * delete the ID parameter just in case 
    * it was sent from the client side
    */
    if('id' in post_info) {
      delete post_info.id
    }

    [err, post] = await to(Posts.create(post_info));
    if(err) return ReE(res, err, 422);

    // Saving user and post relations
    user.addPosts(post);
    post.setUser(user);


    //save the question
     if(!isEmptyObject(post_info.question)){

      [err, question] = await to(Questions.create(post_info.question));
       if(err) return ReE(res, err, 422);

       post.setQuestion(question);
       user.addQuestions(question);
       question.setUser(user);

    }

    //save the video 
    if(!isEmptyObject(post_info.video)){

      [err, video] = await to(Videos.create(post_info.video));
       if(err) return ReE(res, err, 422);

       post.setVideo(video);
       user.addVideos(video);
       video.setUser(user)
    }

    //save the ad configuration
    if(post_info.adOptions.postIsAd) {
      
      [err, adOptions] = await to(AdOptions.create(getAdOptions(post_info.adOptions)));
      if(err) return ReE(res, err, 422);

      if ('orderId' in post_info && post_info.orderId.length) {
        //make sure the order was created by the current user
        [err, order] = await to(Orders.find({where: {id: post_info.orderId, UserId: user.id}}));
        if(err) return ReE(res, {success: false, error: 'Order not found'}, 422);
        //associate the order with the AdOptions
        adOptions.setOrder(order);
      }

      post.setAdOption(adOptions);
      adOptions.setUser(user);
      user.addAdOptions(adOptions);
    }

    //save images
    if(post_info.images.length > 0) {

      for(let j in post_info.images) {
          [err, image] = await to(Images.find({where: { id: post_info.images[j].id}}));
          if(image) {
            post.addImages(image)
            image.setPost(post)
          }
        }
    }

    //save Tags

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

    //update the post
    [err, post] = await to(post.save());
    if(err) return ReE(res, err, 422);

    /*
    ** Delay code execution by 100 miliseconds so that some database queries can finish executing
    ** And we get the most updated Post object to be sent to the front end
    */
    await sleep(100);

    Posts.findOne({include: getDBInclude(user), where: {id: post.id}})
      .then((post) => {
            return ReS(res, toWeb(post, user), 201);

      })
      .catch((err) => {
        return ReE(res, err, 422);
      })

}

/*
* function to save ad confuiguration in the database
*/

async function saveAdOptions (req, postObject) {
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

/*
** Method to get the posts for the UserFeed
*/

const get = async function(req, res){
    let friends;

    let user = req.user;

    let tag = req.params.tag || 'all';

    let page = req.query.page || 1;

    let dbIncludes = getDBInclude(user)

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
      ]

    //ad location wise ad filtering search criteria
    condition.push(getAdLocationSearchCriteria(user))

    let criteria = getPostCriteriaObject(user);
      
    criteria.order = Sequelize.literal(getOrderByCondition(user) + ' LIMIT '+ limitNOffset.offset + ',' + limitNOffset.limit);
      
      /*
      * Get only those posts which are from user's friends, public, selft created or ads
      */
        

    if(tag === 'all')  {

      // get the tags of current user and create an array containing Tag Ids
      user.getTags()
        .then ((userTags) => {
          let tagsId = [];
          if(userTags) {
            for(let i in userTags) {
              tagsId.push(userTags[i].id)
            }
          }

          condition.push({public: { [op.eq]: true},'$Tags.id$': tagsId});

          criteria.where = getWhereCondition (user, condition)

          Posts.findAll(criteria)
           .then((posts) => {
              return sendFeed(user, posts, res, page)
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
            //criteria.include = getDBInclude(user, [Dbtag.id]);

            //condition.push({public: { [op.eq]: true}});
            condition.push({public: { [op.eq]: true},'$Tags.id$': [Dbtag.id]});

            criteria.where = getWhereCondition (user, condition)

            Posts.findAll(criteria)
             .then(posts => {
                return sendFeed(user, posts, res, page)
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

/*
** this method adds Top Posts or Ads to the top
* of the feed of given user
*/

function sendFeed (user, posts, res, page =1 ) {
  if (page == 1 && user.adsEnabled) {
    adsToBePushedToTheTop(user)
      .then((adPosts) => {
        if (adPosts) {
          for (let i in adPosts) {
            // add a custom value to the each results object
            // which will indicate that these posts
            // need to be pushed to the top in user's feed
            // on the client side
            adPosts[i].setDataValue('PushToTop', true)
            
            //push the posts to the top of the feed
            posts.unshift(adPosts[i])
          }
        }
        return ReS(res, {posts: toWeb(posts, user)});
      })
  } else {
    return ReS(res, {posts: toWeb(posts, user)});
  }
}


/*
* fuction to return unseen ad posts
* for the given user which will be
* pushed to the top of the feed
*/
function adsToBePushedToTheTop(user) {
  
    return new Promise(function(resolve, reject) { 

        try {
          let criteria = getPostCriteriaObject (user);
          criteria.where = {
            [op.and]: [
              {
                'id': Sequelize.literal(' Posts.id NOT IN (select PostId from PushedAds where UserId = '+ user.id+')')
              },
              getAdLocationSearchCriteria (user)
            ]
          }
          criteria.order = Sequelize.literal('Posts.createdAt DESC limit ' + ADS.maxAdsToBePushedToTop);
          Posts.findAll(criteria)
            .then((posts) => {
              if (posts) {
                updatePushedAds(posts, user)
                resolve (posts)
              } else {
                resolve(false)
              }
            })
        } catch (e) {
          console.log(e)
          reject(e)
        }

    });
  
}

/*
* function to updated PushedAds model
*/

function updatePushedAds (posts, user) {
  let data = []
  for (let i in posts) {
    data.push({
      PostId: posts[i].id,
      UserId: user.id
    })
  PushedAds.bulkCreate(data)
    .then((pushedAds) => {
    })  
  }
}


function getOrderByCondition (user) {
  /*
  * Order by updatedAt if user has enabled RecentActivities filter
  * else order by createdAt timestamp
  */
  return (user.recentActivitiesEnabled ? 'Posts.updatedAt' : 'Posts.createdAt') + ' DESC'
}

/*
* function to prepare the final query 
* based on user's ad and feed preferences
*/
function getWhereCondition (user, condition) {
  let where;

  if (user.adsEnabled && user.feedEnabled) {
    where = {[op.or]: condition}
  } else {
      let adOptionIdCondition;

      if (!user.adsEnabled && user.feedEnabled) {
        adOptionIdCondition = {[op.eq]: null}
      }

      if (user.adsEnabled && !user.feedEnabled) {
        adOptionIdCondition = {[op.ne]: null}
      }
      if (!user.adsEnabled && !user.feedEnabled) {
        adOptionIdCondition = "somethingFake"
      }

      where = {

        [op.and]: [
          {
            AdOptionId: adOptionIdCondition
          },
          {
            [op.or]: condition
          }
        ]
      } 

  }

  
  return where;

}


/*
* function to return AdOption database search criteria
* to filter ads based on user's location
* User will always see global ads and location based
* ads if he has provided his country on Profile page
* 
*/

function getAdLocationSearchCriteria (user) {

  let AdOptionCondition, orCondition, userLocation;

      if(user.location) {
        orCondition = [
          {
            '$AdOption.adCountries$': Sequelize.literal(' FIND_IN_SET("'+user.location+'",AdOption.adCountries)')
          },
          {
            '$AdOption.adCountries$': { [op.eq]: ''},
            '$AdOption.adLat$': { [op.eq]: ''},
            '$AdOption.adLng$': { [op.eq]: ''},
            '$AdOption.adRadius$': { [op.eq]: ''}
          }
        ];

        /*
        * if user has specified their location cordinates (lat and lng)
        * then below SQL query uses Haversine formula for finding out
        * if given user's location lies in the Post Area Circle (if specified in post)
        */

        if (user.locationCords) {
          userLocation = JSON.parse(user.locationCords)
          orCondition.push({
            '$AdOption.adLat': Sequelize.literal('(AdOption.adCountries = "" AND AdOption.adLat IS NOT NULL AND AdOption.adLng IS NOT NULL AND AdOption.adRadius IS NOT NULL AND ( 6371000 * acos( cos( radians(AdOption.adLat) ) * cos( radians( ' + userLocation.lat + ' ) ) * cos( radians( ' + userLocation.lng + ' ) - radians(AdOption.adLng) ) + sin( radians(AdOption.adLat) ) * sin(radians(' + userLocation.lat + ')) ) ) <= AdOption.adRadius)')
          })
        }

        AdOptionCondition = {
          [op.and]: [

            {

              AdOptionId: { [op.ne]: null},
            },

            {
              [op.or]: orCondition
            }

          ]
          
        }
      } else {
        AdOptionCondition = {
          AdOptionId: { [op.ne]: null},
          '$AdOption.adCountries$': { [op.eq]: ''},
        }
      }

  return AdOptionCondition;
}

module.exports.get = get;

const getTimelineFeed = async function(req, res){
  let profileUserId = parseInt(req.params.userId) || req.user.id

  let page = req.query.page || 1;

  let limitNOffset = getLimitOffset(page);

  let criteria = getPostCriteriaObject(req.user);

  criteria.order = [['createdAt', 'DESC']];
  criteria.limit = limitNOffset.limit;
  criteria.offset = limitNOffset.offset;
  criteria.where = {};

  if (profileUserId === req.user.id) {
     criteria.where = {
        UserId: req.user.id
     }
  } else {
    let err, friends, isFriend = false;

    criteria.where = {
       UserId: profileUserId,
       AdOptionId: { [op.eq]: null}

    };

    // get profile user's friends
    [err, friends] = await to(User.getFriends(profileUserId))
     if(err) {
       return ReE(res, err, 422);
     }

     // check if current user is friends with Profile user
     if(friends.length) {
       isFriend = getUIDs(friends).indexOf(req.user.id) !== -1
     }
     
     if (!isFriend) {
       criteria.where.public = { [op.eq]: true}
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
    let checkOwner = req.query.checkOwner || false

    if(postId) {
      let criteria = getPostCriteriaObject(req.user);
      criteria.where = {id: postId};

      /*
      ** In case of post editin, return data
      ** only if current post was created
      ** by current user
      */
      if (checkOwner === 'true') {
        criteria.where.UserId = req.user.id;
      }
      
      Posts.findOne(criteria)
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
    try {
      let post = req.body;
      Posts.find({where: {
        id: post.id,
        UserId: req.user.id
      }})
        .then ((postRecord) => {
          if (post) {
            if (post.type === 'text'){
              postRecord.content = post.content;
              // maks sure post updated time
              // remains same so that this post
              // doesn't count in recent posts
              postRecord.updatedAt = post.updatedAt;
              postRecord.save()
                .then((updatedPostRecord) => {
                  return ReS(res, {message: 'Status updated successfully'});
                })
            } else if (post.type === 'question') {
              Questions.update({
                question: post.Question.question,
                description: post.Question.description
              }, {
                where: {
                  id: postRecord.QuestionId,
                  UserId: req.user.id
                }
              })
                .then((updatedPostRecord) => {
                  return ReS(res, {message: 'Question updated successfully'});
                })
            } else {
              Videos.update({
                title: post.Video.title,
                description: post.Video.description
              }, {
                where: {
                  id: postRecord.VideoId,
                  UserId: req.user.id
                }
              })
                .then((updatedPostRecord) => {
                  return ReS(res, {message: 'Video updated successfully'});
                })
            }

          } else {
            throw new Error ('Post not found')
          }
        })
    } catch (e) {
      console.log(e)
      return ReE(res, {'error': 'Something went wrong while trying to save this post'}, 422);
    }
}
module.exports.update = update;

const remove = async function(req, res){
    try {
      let postId = req.params.postId;
      Posts.find({where: {id: postId, UserId: req.user.id}})
        .then((post) => {
          post.destroy()
            .then(() => {
              const NotificationsController   = require('./notifications.controller');
              NotificationsController.removePostNotifications(postId); //remove all the notifications record associated with this post
              return ReS(res, {success: true, message: 'Post successfully deleted'}, 201);
            })
        })
        .catch((e) => {
          console.log(e)
          throw new Error('Post not found')
        })
    } catch (e) {
      console.log(e)
      return ReE(res, {'success': false, 'error': 'Something went wrong while trying to delete the post'}, 422);
    }
}
module.exports.remove = remove;