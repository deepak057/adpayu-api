const { Posts, Comments, User, Questions, AdOptions, Images, Imgs, Tags, Likes, Videos, Friendship, Orders, PushedAds, ConsumedAds } = require('../models');
const { to, ReE, ReS, isEmptyObject, sleep, getLimitOffset, removeBlankParagraphs, videoToPNG, cloneOject } = require('../services/util.service');
const { getUIDs, getDBInclude, toWeb, getPostCriteriaObject } = require('../services/app.service');
const Sequelize = require('sequelize');
const op = Sequelize.Op;
const { ADS } = require('../config/app-constants');
const CommentsController   = require('./comments.controller');


const create = async function(req, res){
      
    try {
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

      // filter the Post text
      if (post_info.content) {
        post_info.content = removeBlankParagraphs(post_info.content.trim())
      }

      // create the post
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
          console.log(err)
          return ReE(res, err, 422);
        })

    } catch (e){
      console.log(e)
      return ReE(res, err, 422);
    }

    
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

    let limitNOffset = getLimitOffset(page, 25);

    // get current user's friends
    [err, friends] = await to(User.getFriends(user.id))
     if(err) {
       return ReE(res, err, 422);
     }

     let UIDCondition = getUIDs(friends, req.user);

     /* Condition for shwoing posts 
     ** from friends and self
     */
     let friendsPostsCondition =  {
            UserId: UIDCondition
     };

     // Array that will contain all the conditions
     let condition = []

    //ad location wise ad filtering search criteria
    condition.push(getAdLocationSearchCriteria(user))

    let criteria = getPostCriteriaObject(user);
      
    criteria.order = Sequelize.literal(getOrderByCondition(user) + ' LIMIT '+ limitNOffset.offset + ',' + limitNOffset.limit);  

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



          // push friends conditions i.e. get posts that are from friends or self
          condition.push(friendsPostsCondition);

          // push public Posts condition. i.e. get public posts in the tags that 
          // current user follows
          condition.push({AdOptionId: {[op.eq]: null}, public: { [op.eq]: true},'$Tags.id$': tagsId});

          // club all the conditions
          criteria.where = getWhereCondition (user, condition)

          Posts.scope(getPostScopes(user)).findAll(criteria)
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
            
            /* Friends posts condition i.e. get those posts 
            * that are from friends or self and belong to 
            * given tag
            */
            friendsPostsCondition =  {
                UserId: UIDCondition,
                '$Tags.id$': [Dbtag.id]
            };

            condition.push(friendsPostsCondition);
            // update the db include array by passing it TagIds of the tag that
            // has been requested
            //criteria.include = getDBInclude(user, [Dbtag.id]);

            //condition.push({public: { [op.eq]: true}});
            
            // get only those posts that are public and belong to current/given tag
            condition.push({AdOptionId: {[op.eq]: null}, public: { [op.eq]: true},'$Tags.id$': [Dbtag.id]});

            criteria.where = getWhereCondition(user, condition)

            Posts.scope(getPostScopes(user)).findAll(criteria)
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


function getPostScopes (user) {
  return scopes = [
      { 
        /* Use ExcludedViewedPosts and pass it user object
        * this scope will ommit the posts on which all the 
        * answers or comments have been viewed by current user
        */
        method: ['ExcludedViewedPosts', user]
      },

      /*
      * using scope array seems to ignore the default Posts scope
      * so use the copy of default scope as well to keep the 
      * default scope applied
      */
      {
        method: ['defaultScopeCopy']
      }
    ]

}

/*
* This function is used to implement Ad Restriction policy
* If policy is enabled, this function will implement the rules
* as per the policy and will restrict the ads that get sent to the 
* user feed
*/

function putAdRestrictions (posts, user) {
  return new Promise(function (resolve, reject) {
    let getPosts = ()=> {
      return toWeb(posts)
    }
    // function to return array of Ads in given posts
    let getAdPosts = (postsJson) => {
      let ads = []
      if (postsJson.length ) {
        for (let i in postsJson) {
          if (postsJson[i].AdOption) {
            ads.push(postsJson[i])
          }
        }
      }
      return ads
    }
    let getUnseenAds = (postsJson) => {
      let unseenAds = [];
      for (let i in postsJson) {
        if (postsJson[i].UserId !== user.id) {
          if (postsJson[i].ConsumedAds && postsJson[i].ConsumedAds.length) {
          } else {
            unseenAds.push(postsJson[i])
          }  
        } 
      }
      return unseenAds
    }
    let deleteUnseenAds = (postsJson, adsToDeleteCount, unseenAds) => {      
      let deletedAds = 0;
      for (let i = (postsJson.length -1); i >= 0; i-- ) {        
        for (let j = (unseenAds.length - 1); j >= 0; j--) {
          if (postsJson[i].id === unseenAds[j].id) {
            posts.splice(i, 1)
            deletedAds++
            if (deletedAds === adsToDeleteCount) {
              return posts
            }
          }
        }
      }
    }
    let keepTheAdsUsersCanSee = (postsJson, newAdsUserCanSee, unseenAds) => {
      if (!unseenAds.length || unseenAds.length <= newAdsUserCanSee) {
        return posts
      } else {
        return deleteUnseenAds(postsJson, (unseenAds.length - newAdsUserCanSee), unseenAds)
      }
    }
    let main = ()=> {
      let postsJson = getPosts()
      let ads = getUnseenAds(postsJson)
      //proceed only if ad restriction policy is on and there are ads in the given set of posts
      if (process.env.AD_RESTRICTION === 'true' && ads.length) {
        let policy = ADS.adsRestrictionPolicy
        ConsumedAds.count({
          where: {
            UserId: user.id,
            action: ADS.actions.impression
          }
        })
          .then((seenAdsCount) => {
            if (seenAdsCount && seenAdsCount >= policy.maxAdsToShowOnRegistration) {
              let moment = require('moment')
              ConsumedAds.count({
                where: {
                  UserId: user.id,
                  action: ADS.actions.impression,
                  updatedAt: {
                    [op.gte]: moment().subtract(policy.daysInterval, 'days').toDate()
                    // [op.gte]: Sequelize.literal('NOW() - INTERVAL "' + policy.daysInterval + 'd"')
                  }
                }
              })
                .then((seenAdsCountInDaysInterval) => {
                  if (seenAdsCountInDaysInterval < policy.maxAdsToShowOnInterval) {
                    let newAdsUserCanSee = policy.maxAdsToShowOnInterval - seenAdsCountInDaysInterval
                    resolve(keepTheAdsUsersCanSee(postsJson, newAdsUserCanSee, ads))  
                  } else {
                    resolve(keepTheAdsUsersCanSee(postsJson, 0, ads))
                  }
                  
                })
              
            } else {
              let newAdsUserCanSee = policy.maxAdsToShowOnRegistration - seenAdsCount
              resolve(keepTheAdsUsersCanSee(postsJson, newAdsUserCanSee, ads))
            }
          })
      } else {
        resolve(posts)
      }
    }
    main()
  })
}


/*
** This method is another layer in feed interpretation and 
** manipulation. Since the default SQL retreival has issues, this method 
** is needed to do following-
**   1) Fixes the Adstats object in posts so that it doesn't have incorrect stats values
**   2) Adds lastComment field in posts
**   3) Removes duplicate posts from the given set of posts
** 
*/

async function FixPosts (posts, user) {
  return new Promise(function(resolve, reject) {
    let postsArr = [], postObjs;   
    
    /*
    * function to set default comment in the given post
    * the client side app, generates the Post Description
    * based on the default comment/answer on a post
    */ 

    let getDefaultComment = function (post) {
      if (post.Comments.length) {
        let comments = post.Comments.reverse();
        comments = CommentsController.setDefaultComment(comments)
        for (let i =0; i < comments.length; i ++) {
          if (comments[i].setDefault) {
            return comments[i]
          }
        }
      }
      return false;
    }

    /*
    * function to remove duplicate posts 
    */
    function removeDuplicatePosts (posts) {
      let postJson = toWeb(posts)
      let postIds = []
      for (let i in postJson) {
        if (postIds.indexOf(postJson[i].id) === -1) {
          postIds.push(postJson[i].id)
        } else {
          posts.splice(i, 1)
        }
      }
      return posts
    }
    if (!posts.length) {
      resolve(posts)
    }
    for (let i in posts) {
      postsArr.push(posts[i].id)
    }
    Posts.findAll({
      where: { 
        id: postsArr
      },
      include: getDBInclude(user)
    })
     .then((postObjs) => {
        //only replace the properties that have incorrect values in Original SQL retrieve
        // at the time, replace the original Comments and ConsumedAds
        for (let i in posts) {
          for (let j in postObjs) {
            if (posts[i].id === postObjs[j].id) {
              // don't send all the comments in post, 
              // as front-end app only needs to have 
              // the last comment, so only send the 
              // last comment, if post has comments
              //posts[i].setDataValue('defaultComment', postObjs[j].Comments && postObjs[j].Comments.length ? postObjs[j].Comments[postObjs[j].Comments.length-1] : false);
              posts[i].setDataValue('defaultComment', getDefaultComment(postObjs[j]));
              posts[i].setDataValue('ConsumedAds', postObjs[j].ConsumedAds)
            }
          }
        }
        putAdRestrictions(removeDuplicatePosts(posts), user)
          .then((postsUpdated) => {
            resolve(postsUpdated)
          })
     })
     .catch ((err) => {
        reject(err)
     })
  
  })

}


/*
** this method adds Top Posts or Ads to the top
* of the feed of given user
*/

async function sendFeed (user, posts, res, page =1 ) {
  try {
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
        FixPosts(posts, user)
          .then((posts) => {
            return ReS(res, {posts: toWeb(posts, user)});
          })
        
      })
    } else {
      FixPosts(posts, user)
        .then((posts) => {
          return ReS(res, {posts: toWeb(posts, user)});
        })
          
    }
  } catch (e) {
    console.log(e)
    return ReE(res, {message: 'Something went wrong.'});
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

  /*
  * function to set default comment property in a post
  * as the comment that was posted by the profile 
  * user
  */

  let setDefaultComment = function (posts) {
    for (let i in posts) {
      posts[i].setDataValue('defaultComment', false)
      if (posts[i].Comments.length) {
        for(let j in posts[i].Comments) {
          if (posts[i].Comments[j].UserId === profileUserId) {
            posts[i].setDataValue('defaultComment', posts[i].Comments[j])
          }
        }
      }
    }
    return posts
  }

  let getWhereCondition = function () {
    
    return new Promise(function(resolve, reject) {
      /* 
      * condition for including the posts
      * that user has left any answer on
      */
      let answerdPostsCond = Sequelize.literal("id IN (select Comments.PostId from Comments where UserId = " + profileUserId + " AND videoPath !='' AND deleted = 0 )") 

      /*
      * Or condtion to give the posts
      * that are either created by the 
      * profile user or the posts where
      * this user left any answer on
      */
      let orCondition = {
        [op.or]: [
            {
              UserId: profileUserId
            },
            {
              abc: answerdPostsCond
            }
         ]
      }

      if (profileUserId === req.user.id) {
         resolve(orCondition)

      } else {
        let isFriend = false, andCondition = []

        // get profile user's friends
        User.getFriends(profileUserId)
          .then((friends) => {

            // check if current user is friends with Profile user
            if(friends && friends.length) {
               isFriend = getUIDs(friends).indexOf(req.user.id) !== -1
             }

             /*
             * if current user is not friend with profile user
             * show them only public posts from profile user
             */
            if (!isFriend) {
              andCondition.push({public: { 
                 [op.eq]: true
               }})
            }

            /*
           * for other user's profile, don't
           * show the ad posts
           */
           andCondition.push({
              AdOptionId: { [op.eq]: null},
            })

           andCondition.push(orCondition);

           resolve({
            [op.and]: andCondition
           })

          })         
      }
    })
    
  }

  criteria.order = [[req.user.recentActivitiesEnabled ? 'updatedAt' : 'createdAt', 'DESC']];
  criteria.limit = limitNOffset.limit;
  criteria.offset = limitNOffset.offset;
  getWhereCondition()
    .then((condition) => {
      criteria.where = condition;
      Posts.findAll(criteria)
       .then(posts => {
          return ReS(res, {posts: toWeb(setDefaultComment(posts), req.user)});
       })
       .catch ((error) => {
         return ReS(res, error);
       })
    })
}

module.exports.getTimelineFeed = getTimelineFeed;


const getPostById = function(req, res){
    let postId = req.params.postId || false
    let checkOwner = req.query.checkOwner || false
    let user = req.user || false

    if(postId) {
      let criteria = getPostCriteriaObject(user);
      criteria.where = {id: postId};

      /*
      ** In case of post editin, return data
      ** only if current post was created
      ** by current user
      */
      if (checkOwner === 'true') {
        criteria.where.UserId = user.id;
      }
      
      Posts.findOne(criteria)
      .then((post) => {
            return ReS(res, toWeb(post, user), 200);
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
      const S3Controller   = require('./s3.controller');
      let postId = req.params.postId;
      let deletePostMedia = function (post) {
        if(post.Video) {
          S3Controller.deleteVideo(post.Video.path);
        } 
        if (post.Images) {
          for (let i in post.Images) {
            S3Controller.deleteS3Object(post.Images[i].path)
          }
        }
      };
      let criteria = {
        where: {
          id: postId, UserId: req.user.id
        },
        include: [
          {
            model: Videos
          },
          {
            model: Images
          }
        ]
      }
      Posts.find(criteria)
        .then((post) => {
          // soft delete the post by just updating Deleted flag
          post.deleted = true;
          post.save()
            .then(() => {
              const MailsController   = require('./mails.controller');
              //notify site admin about the deletion of this post
              MailsController.sendMail("Post id: " + post.id + "\nPost: " + JSON.stringify(post), "Post (id: " + post.id + ") deleted by " + req.user.first + ' ' + req.user.last, false, false);

              deletePostMedia(post)
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