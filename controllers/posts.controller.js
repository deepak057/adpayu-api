const { Posts, Comments, User, Questions, AdOptions, Images, Imgs, Tags, Likes, Videos, Friendship, Orders, PushedAds, ConsumedAds, SeenPosts, ViewedEntities } = require('../models');
const { to, ReE, ReS, isEmptyObject, sleep, getLimitOffset, removeBlankParagraphs, videoToPNG, cloneOject, getIdsArray } = require('../services/util.service');
const { getUIDs, getDBInclude, toWeb, getPostCriteriaObject } = require('../services/app.service');
const Sequelize = require('sequelize');
const op = Sequelize.Op;
const { ADS } = require('../config/app-constants');
const CommentsController   = require('./comments.controller');
const JUMP_TO_NEXT_PAGE = "jumpToNextPage"
const moment = require('moment')

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


      //update the post
      [err, post] = await to(post.save());
      if(err) return ReE(res, err, 422);

      /** save Tags
      ** Loop through given Tags and cretae new tags if they don't already exist in database
      ** also associate tags with current post 
      */
      addTagsOnPost(post_info.tags, post, user)

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
* function to loop through given set of Tags and 
* cretae new tags if they don't already exist in 
* database, also associate tags with current post
* though it doesn't have any Promise returned so can't
* track the status of when all the given tags
* are added. And it's not needed at the moment whatsoever
*/

function addTagsOnPost (tags, post, user) {
  if (tags.length > 0) {
      for(var i in tags){
        Tags.findOrCreate(
        {
          where: {name: tags[i].text},
          defaults: {
            name: tags[i].text,
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
  getUserFeed(req, res)
}

function getTag (req) {
  return req.params.tag || 'all'
}

async function getUserFeed (req, res, nextPage = false) {
  let friends;

  let user = req.user;

  let tag = getTag(req)

  let page = nextPage || (req.query.page || 1);

  let dbIncludes = getDBInclude(user)

  let limitNOffset = getLimitOffset(page, 25);

  // get current user's friends
  [err, friends] = await to(User.getFriends(user.id))
   if(err) {
     return ReE(res, err, 500);
   }

   let getMainFeedPosts = () => {
     return new Promise(function(resolve, reject) {
        let UIDCondition = getUIDs(friends, user);

       /* Condition for showing posts 
       ** from friends and self
       */
       let friendsPostsCondition =  {
              UserId: UIDCondition
       };

       // Array that will contain all the conditions
       let condition = []

      //ad location wise ad filtering search criteria
      condition.push(getAdLocationSearchCriteria(user))

      let criteria = getPostCriteriaObject(user, [], true);
        
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
                resolve(posts)
              })
             .catch ((error) => {
               reject(error)
              })

          })
          .catch ((error) => {
            reject(error)
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
               .then((posts) => {
                  resolve(posts)
               })
               .catch ((error) => {
                 reject(error)
                })

            })
            .catch ((error) => {
              reject(error)
            })
      }
     })
   }
    /*
    * this function adds additional Posts such as Content Video or
    * some random posts in original set of Posts
    */

    function smartFeed (posts) {
      return new Promise(function (resolve, reject) {
        let getContentVideo = () => {
          for (let i in posts) {
            if (posts[i].type === 'video' && !posts[i].AdOptionId && posts[i].UserId !== user.id) {
              return false
            }
          }
          return true
        }
        let getPostsIds = (postsArr = false) => {
          return getIdsArray((postsArr ? posts.concat(postsArr) : posts))
        }
        let getPostsIdNotInCondition = (postsToExclude = false) => {
          return {
              [op.notIn]: getPostsIds(postsToExclude)
          }
        }
        let getPostCriteria = () => {
          let criteria = {}
          criteria.where = {
            AdOptionId: {
              [op.eq]: null
            },
            UserId: {
              [op.ne]: user.id
            },
            public: {
              [op.eq]: true
            },
            id: getPostsIdNotInCondition()
          }        
          if (tag !== 'all') {
            criteria.include = [ 
              {
                model: Tags,
                where: {
                  name: tag
                }
              }
            ]
          }
          return criteria
        }
        let getRandomPosts = (criteria, postsToExclude = false) => {
          criteria.where.id = getPostsIdNotInCondition(postsToExclude)
          criteria.order = [
            [Sequelize.literal('RAND()')]
          ]
          criteria.where.type = {
            [op.ne]: 'video'
          }
          criteria.limit = 4
          return Posts.scope(getPostScopes(user)).findAll(criteria)
        }
        let getVideos = (criteria) => {
          criteria.where.type = {
            [op.eq]: 'video'
          }
          criteria.order = [
            ['updatedAt', 'DESC']
          ]
          criteria.limit = 1
          return Posts.scope(getPostScopes(user)).findAll(criteria)
        }
        let mergeAndFetchPosts = (newPosts) => {
          if (!newPosts || !newPosts.length) {
            resolve(newPosts)
            return
          }
          let criteria = getPostCriteriaObject(user, [], true)
          criteria.where = {
            id: getIdsArray(newPosts)
          }
          Posts.findAll(criteria)
            .then((updatedPosts) => {
              if (updatedPosts && updatedPosts.length) {
                resolve(updatedPosts)
              } else {
                resolve(posts)
              }
            })
            .catch((pErr) => {
              reject(pErr)
            })
        }
        let main = () => {
          if (!posts || !posts.length || !user.feedEnabled) {
            resolve(posts)
            return 
          }
          let postsToAdd = []
          let criteria = getPostCriteria()
          if (getContentVideo()) {
            getVideos(criteria)
              .then((videoPosts) => {
                if (videoPosts) {
                  postsToAdd = postsToAdd.concat(videoPosts)
                }
                getRandomPosts(criteria, (postsToAdd.length ? postsToAdd : false))
                  .then((randomPosts) => {
                    if (randomPosts) {
                      postsToAdd = postsToAdd.concat(randomPosts)
                    }
                    mergeAndFetchPosts(postsToAdd)
                  })
              })
              .catch ((e) => {
                reject(e)
              })
          } else {
            getRandomPosts(criteria)
              .then((randomPosts) => {
                if (randomPosts) {
                  postsToAdd = postsToAdd.concat(randomPosts)
                }
                mergeAndFetchPosts(postsToAdd)
              })
              .catch ((e) => {
                reject(e)
              })
          }
        }
        main()
      })
    }


   getMainFeedPosts()
     .then((posts) => {
        smartFeed(posts)
          .then((smartFeedPosts) => {
            if (smartFeedPosts) {
              posts = posts.concat(smartFeedPosts)
            }
            return sendFeed(req, res, posts, page)
          })
     })
     .catch((pErr) => {
        console.log(pErr)
        return ReE(res, {message: 'Something went wrong.'}, 500);
     })
   
}

function getPostScopes (user) {
  return scopes = [
      { 
        /* Use ExcludedViewedPosts and pass it user object
        * this scope will ommit the posts on which all the 
        * answers or comments have been viewed by current user
        */
        method: ['ExcludedViewedPosts', user.id, user.unCommentedEnabled]
      },

      {
        /*
        * This scope excludes the Posts that have been marked
        * as seen for current user i.e. posts that are sent into 
        * user's feed but they might or might not have be viewed yet
        */
            
        method: ['ExcludSeenPosts', user.id]
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

function putAdRestrictions (posts, req, res, page) {
  return new Promise(function (resolve, reject) {
    let user = req.user
    let policy = ADS.adsRestrictionPolicy
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
        if (postsJson[i].UserId !== user.id && postsJson[i].AdOptionId) {
          if (postsJson[i].ConsumedAds && postsJson[i].ConsumedAds.length) {
          } else {
            unseenAds.push(postsJson[i])
          }  
        } 
      }
      return unseenAds
    }
    let deleteUnseenAds = (postsJson, adsToDeleteCount, unseenAds) => {      
      let deletedAds = 0      
      if (postsJson.length === adsToDeleteCount) {
        /*
        * if all the posts are to be deleted in 
        * given set of posts, return a string value
        * instead of Array/Object that will indicate
        * to recursively jump to next feed page instead of returning
        * empty array to client side
        */
        return JUMP_TO_NEXT_PAGE
      } else {
        for (let i = (postsJson.length -1); i >= 0; i-- ) {        
          for (let j = (unseenAds.length - 1); j >= 0; j--) {
            if (postsJson[i].id === unseenAds[j].id) {
              posts = removeObject(posts, unseenAds[j].id)
              deletedAds++
              if (deletedAds === adsToDeleteCount) {
                return posts
              }
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
      //proceed only if ad restriction policy is on
      if (process.env.AD_RESTRICTION === 'true') {
        let resolution = (adsToShow, addAd = false) => {
          if (adsToShow) {
            if (ads.length) {
              resolve(keepTheAdsUsersCanSee(postsJson, adsToShow, ads))
            } else if (!ads.length && addAd && user.adsEnabled) {
              // get the new unseen ad
              adsToBePushedToTheTop(user, adsToShow, true)
                .then((newAdsToShow) => {
                  if (newAdsToShow) {
                    newAdsToShow = newAdsToShow.concat(posts)
                    resolve(newAdsToShow)
                  } else {
                    resolve(posts)
                  }
                })
            } else {
              resolve(keepTheAdsUsersCanSee(postsJson, 0, ads))  
            }
          } else {
            resolve(keepTheAdsUsersCanSee(postsJson, 0, ads))
          }
        }
        let execute = (max = false, addAd = false) => {
          getUserAdStats(user, max)
            .then((newAdsUserCanSee) => {
              resolution(newAdsUserCanSee, addAd)
            })
        }
        if (policy.watchedVideosCountToShowAds) {
          getAdsSeenToday(user)
            .then((d) => {
              if (d.firstAdSeen) {
                if (d.videosWatchedToday >= policy.watchedVideosCountToShowAds && d.videosWatchedSinceLastAd >= policy.watchedVideosCountToShowAds) {
                  // unlock only one ad and pull new ad if there is no ad in 
                  // the given set of ads
                  execute(1, true)
                } else {
                  // don't unlock new ads
                  resolve(keepTheAdsUsersCanSee(postsJson, 0, ads))
                }  
              } else {
                execute(1, true)
              }
            })
        } else {
          execute()
        }
      } else {
        resolve(posts)
      }
    }
    main()
  })
}


/*
* function to remove the elements from given array of objects
* based on the id value of objects
*/
function removeObject (arrObj, id) {
  if (arrObj.length) {
    for (let i in arrObj) {
      if (arrObj[i].id === id) {
        arrObj.splice(i, 1)
        return arrObj
      }
    }  
  }
  return arrObj
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

async function FixPosts (posts, req, res, page) {
  return new Promise(function(resolve, reject) {
    let postsArr = [], postObjs, user = req.user;   
    
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
        //console.log('Post Id:' + posts[i].id + ', JOSN id: '+ postJson[i].id + '\n\n')
        if (postIds.indexOf(postJson[i].id) === -1) {
          postIds.push(postJson[i].id)
        } else {
          posts = removeObject(posts, postJson[i].id)
        }
      }
      return posts
      /*
      let postIds = []
      for (let i in posts) {
        if (postIds.indexOf(posts[i].id) === -1) {
          postIds.push(posts[i].id)
        } else {
          posts.splice(i,1)
        }
      }
      return posts*/
    }
    if (!posts || !posts.length) {
      resolve(posts)
      return
    }
    for (let i in posts) {
      postsArr.push(posts[i].id)
    }
    Posts.findAll({
      where: { 
        id: postsArr
      },
      include: getDBInclude(user, [], {}, true)
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
        putAdRestrictions(removeDuplicatePosts(posts), req, res, page)
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
* This method helps implement the Dynamic Feed
* It records the Seen Posts by given user so those
* posts don't show up in feed for a given period 
* of time
*/
function markSeenPosts (posts, user) {
  try {
    let getPostIdsToSave = () => {
      let seenPosts = []
      if (posts.length) {
        for (let i in posts) {
          if (posts[i].type !== 'text' && posts[i].UserId !== user.id && !posts[i].AdOptionId && (posts[i].type === 'question' && user.unCommentedEnabled ? posts[i].Comments.length : true)) {
            seenPosts.push({
              PostId: posts[i].id,
              UserId: user.id
            })
          }
        }
      }
      return seenPosts
    }
    let main = () => {
      let seenPosts = getPostIdsToSave()
      if (seenPosts && seenPosts.length) {
        SeenPosts.bulkCreate(seenPosts, {
          updateOnDuplicate: ['updatedAt']
        })
      }
    }
    main()
  } catch (e) {
    return posts
  }
  
  return posts
}

module.exports.cleanSeenPosts = function () {
  // records older than below specified number of minutes will be deleted
  let minutesToDeleteSeenPosts = 360
  console.log("Deleting seen posts that are older than " + minutesToDeleteSeenPosts + ' minutes..')
  SeenPosts.destroy({
    where: {
      updatedAt: {
        [op.lte]: moment().subtract(minutesToDeleteSeenPosts, 'minutes').toDate()            
      }
    }
  })
    .then((d) => {
      if (d) {
        console.log("Deleted " + d + ' seen posts..')
      }
    })
    .catch((e) => {
      console.log(e)
    })
  
}


/*
** this function adds Top Posts or Ads to the top
* of the feed of given user
*/

async function sendFeed (req, res, posts, page =1 ) {
  try {
    let user = req.user
    
    page = parseInt(page)
    
    let sendResponse = (posts) => { 
      ++page
      if (typeof posts === 'string' && posts === JUMP_TO_NEXT_PAGE) {
        console.log('Jumping to next page ' + page + ' for getting more feed')
        getUserFeed(req, res, page)
      } else {
        return ReS(res, {posts: toWeb(markSeenPosts(posts, user), user), nextPage: page})  
      }
    }

    let sortByDate = (posts) => {
      return posts
      if (user.recentActivitiesEnabled) {
        posts.sort(function (a, b) {
          return new Date(b.updatedAt) - new Date(a.updatedAt)
        })
      }
      return posts
    }
    FixPosts(posts, req, res, page)
      .then((posts) => {
        sendResponse(posts)
      })
    /*if (page === 1 && user.adsEnabled) {
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
        FixPosts(posts, req, res, page)
          .then((posts) => {
            sendResponse(posts)
          })
      })
    } else { 
      FixPosts(posts, req, res, page)
        .then((posts) => {
          sendResponse(posts)
        })
    }*/
  } catch (e) {
    console.log(e)
    return ReE(res, {message: 'Something went wrong.'});
  }
  
}


/*
* fuction to return unseen ad posts
* for the given user which will be
*/
function adsToBePushedToTheTop(user, limit = false, onlySeenAds = false, adType = false) {
    return new Promise(function(resolve, reject) { 
        try {
          let criteria = getPostCriteriaObject (user, [], true);
          let andCond = [
            {
              'id': Sequelize.literal(' Posts.id NOT IN (select PostId from PushedAds where UserId = '+ user.id+')')
            }
          ]
          if (onlySeenAds) {
            // condition to pull only "unseen" ads which are not yet seen by the given user
            andCond.push({
              'xyz': Sequelize.literal(' Posts.id NOT IN (select PostId from ConsumedAds where UserId = ' + user.id + ' AND (action = "' + ADS.actions.impression + '" OR action = "' + ADS.actions.click + '" OR action = "' + ADS.actions.view + '"))')
            })
          }
          criteria.where = {
            [op.and]: andCond.concat([getAdLocationSearchCriteria (user)]),
          }
          if (adType) {
            criteria.where.type = adType
          }
          criteria.order = Sequelize.literal('Posts.createdAt DESC limit ' + (limit || ADS.maxAdsToBePushedToTop));
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
  try {
    let postId = req.params.postId || false
    let checkOwner = req.query.checkOwner || false
    let user = req.user || false
    
    let main = () => {
      let criteria = getPostCriteriaObject(user);
      criteria.where = {id: postId};

      /*
      ** In case of post editing, return data
      ** only if current post was created
      ** by current user
      */
      if (checkOwner === 'true' && !user.isAdmin) {
        criteria.where.UserId = user.id;
      }
      
      Posts.findOne(criteria)
      .then((post) => {
            return ReS(res, toWeb(post, user), 200);
      })
    }

    if(postId) {
      /*
      * if user is not logged in, the page is most likely being
      * requested from public pages, in which case, make sure
      * the content was really shared 
      */
      if (!user) {
        const SocialSharingController   = require('./socialSharing.controller');
        SocialSharingController.hasContentBeenShared(postId)
        .then((d) => {
          if (!d) {
            return ReE(res, {error: 'This page/post is not shared yet'}, 401)
          } else {
            main()
          }
        })
      } else {
        main()
      }     
    } else {
      return ReE(res, {'error': 'No Post Id provided'}, 422);
    }
  } catch(e) {
    return ReE(res, {error: 'Something went wrong'}, 500)
  } 
}

module.exports.getPostById = getPostById;

const update = async function(req, res){
    try {
      let post = req.body;
      let criteria = {
        where: {
          id: post.id
        }
      }
      if (!req.user.isAdmin) {
        criteria.where.UserId = req.user.id
      }
      Posts.find(criteria)
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
                  //UserId: req.user.id
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
                  //UserId: req.user.id
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
          id: postId
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
      
      if (!req.user.isAdmin) {
        criteria.where.UserId = req.user.id
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
              return ReS(res, {success: true, message: 'Post successfully deleted'}, 200);
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

const getPublicPosts =  function(req, res) {
  let page = req.query.page || 1

  let limitNOffset = getLimitOffset(page)

  let criteria = {}

  // criteria.order = Sequelize.literal(' updatedAt DESC LIMIT '+ limitNOffset.offset + ',' + limitNOffset.limit);

  criteria.order = [
    ['updatedAt', 'DESC'],
  ]

  criteria.limit = limitNOffset.limit

  criteria.offset = limitNOffset.offset

  criteria.where = {
    type: {
      [op.eq]: 'question'
    },
    public: {
      [op.eq]: true
    },
    AdOptionId: {
      [op.eq]: null
    }
  }

  Posts.scope('PostsWithVideoComments', 'defaultScopeCopy').findAll(criteria)
    .then((d) => {
      
      let newCriteria = {
        include: getDBInclude(),
        where: {
          id: getIdsArray(d)
        },
        order: [
            ['updatedAt', 'DESC'],
        ],
      }

      Posts.findAll(newCriteria)
        .then((d1) => {
          return ReS(res, {posts: d1}, 200);
        })
          
    })
}

module.exports.getPublicPosts = getPublicPosts;


module.exports.getAds = async (req, res) => {
  let user = req.user
  adsToBePushedToTheTop(user, 1, false, 'video')
    .then((ads) => {
      return ReS(res, {ads: ads}, 200);
    })
    .catch((aErr) => {
      return ReE(res, {'error': 'Something went wrong'}, 500);
    })
}

function getUserAdStats (user, max = false) {
  return new Promise (function(resolve, reject) {
    let policy = ADS.adsRestrictionPolicy

    // check how many ads this user has seen so far
    ConsumedAds.count({
      where: {
        UserId: user.id,
        action: ADS.actions.impression
      }
    })
      .then((seenAdsCount) => {
        if (seenAdsCount && seenAdsCount >= policy.maxAdsToShowOnRegistration) {
          let getDateRange = () => {
            if (policy.daysInterval === 1) {
              // get date range between current day's begginning to its end
              return [
                moment.utc().startOf('day').toDate(),
                moment.utc().endOf('day').toDate()
              ]
            } else {
              //get date range between n days in past from the current day and to the end of the current 
              // date
              return [
                moment.utc().subtract((policy.daysInterval -1), 'days').startOf('day').toDate(),
                moment.utc().endOf('day').toDate()
              ]
            }
          }

          ConsumedAds.count({
            where: {
              UserId: user.id,
              action: ADS.actions.impression,
              updatedAt: {
                [op.between]: getDateRange()
                // [op.gte]: Sequelize.literal('NOW() - INTERVAL "' + policy.daysInterval + 'd"')
              }
            }
          })
            .then((seenAdsCountInDaysInterval) => {
              if (seenAdsCountInDaysInterval < policy.maxAdsToShowOnInterval) {
                let newAdsUserCanSee = !max ? (policy.maxAdsToShowOnInterval - seenAdsCountInDaysInterval) : max
                resolve(newAdsUserCanSee)  
              } else {
                resolve(0)
              }
            })
          
        } else {
          let newAdsUserCanSee = policy.maxAdsToShowOnRegistration - seenAdsCount
          newAdsUserCanSee = max? (max > newAdsUserCanSee ? newAdsUserCanSee: max) : newAdsUserCanSee
          resolve(newAdsUserCanSee)
        }
      })
      .catch((aErr) => {
        reject(aErr)
      })
  })
}

function getAdsSeenToday (user) {
  return new Promise(function(resolve, reject) {
    let stats = {
      videosWatchedToday: 0,
      videosWatchedSinceLastAd: 0,
      firstAdSeen: false
    }

    /*
    * first get the last seen ad by the current user
    */
    ConsumedAds.find({
      where: {
        UserId: user.id,
        action: ADS.actions.impression
      },
      order: [['createdAt', 'DESC']],
      limit: 1
    })
      .then((cA) => {
        if (cA) {
          const db  = require('../models/index')

          stats.firstAdSeen = true

          /*
          * convert the Sequzlie date back to Mysql DateTime Format and in UTC
          */
          let lastSeenAdDateUTC = moment.utc(cA.createdAt).format("YYYY-MM-DD HH:mm:ss");
          /*
          * Get the start of current day
          */
          let dayStartDate = moment.utc().startOf('day').format("YYYY-MM-DD HH:mm:ss");
          /*
          * Now get the total watched videos that have been watched since when the last ad was seen
          * Also total number of videos watched in the current day, it is to make sure that user doesn't
          * see the ads before watching n videos every day
          * using a hacky way to write raw query
          */
          db.sequelize.query("SELECT ((select COUNT(DISTINCT CommentId) FROM ViewedEntities WHERE UserId=" + user.id + " AND createdAt > '"+ lastSeenAdDateUTC +"') + (select COUNT(DISTINCT PostId) FROM ViewedEntities WHERE UserId=" + user.id + " AND createdAt > '" + lastSeenAdDateUTC + "')  ) as total, ((select COUNT(DISTINCT CommentId) FROM ViewedEntities WHERE UserId=" + user.id + " AND createdAt > '"+ dayStartDate +"') + (select COUNT(DISTINCT PostId) FROM ViewedEntities WHERE UserId=" + user.id + " AND createdAt > '" + dayStartDate + "')  ) as totalSinceDayStart")
            .then((r) => {
              if (r.length) {
                stats.videosWatchedToday = parseInt(r[0][0].totalSinceDayStart)
                stats.videosWatchedSinceLastAd = parseInt(r[0][0].total)
              }
              resolve(stats)
            })
        } else {
          resolve(stats)
        }
      })
      .catch((aErr) => {
        reject(aErr)
      })
  })
}

module.exports.getAdStats = (req, res) => {
    try {
      let policy = ADS.adsRestrictionPolicy
      let user = req.user
      if (user.adsEnabled && process.env.AD_RESTRICTION === 'true') {
        let stats = {
          newAdsRemaining: 0,
          videosToWatch: 0,
          clearInterval: false
        }
        getUserAdStats(user)
          .then((newAdsToShow) => {
            if (newAdsToShow) {
              stats.newAdsRemaining = newAdsToShow
              if (policy.watchedVideosCountToShowAds) {
                getAdsSeenToday(user)
                  .then((seenVideosCount) => {
                    if (seenVideosCount.videosWatchedToday >= policy.watchedVideosCountToShowAds) {
                      if (seenVideosCount.videosWatchedSinceLastAd >= policy.watchedVideosCountToShowAds) {
                        stats.videosToWatch = 0
                      } else {
                        stats.videosToWatch = policy.watchedVideosCountToShowAds - seenVideosCount.videosWatchedSinceLastAd
                      }
                    } else {
                      stats.videosToWatch = policy.watchedVideosCountToShowAds - seenVideosCount.videosWatchedToday
                    }
                    return ReS(res, {stats: stats}, 200);
                  })
              } else {
                return ReS(res, {stats: stats}, 200);  
              }
            } else {
              stats.clearInterval = true
              return ReS(res, {stats: stats}, 200);
            }
          })
      } else {
        stats.clearInterval = true
        return ReS(res, {stats: stats}, 200);  
      }
    } catch (e) {
      console.log(e)
      return ReE(res, {'error': 'Something went wrong'}, 500)
    }
}


module.exports.addTags = async function (req, res) {
  try {
    let user = req.user
    if (user.isAdmin) {
      let postId = req.params.postId
      let tags = req.query.tags
      if (postId && tags) {
        let formatTheTags = () => {
          let arrRtr = []
          let tagsArr = tags.split(',')
          if (tagsArr) {
            for (let i in tagsArr) {
              arrRtr.push({
                text: tagsArr[i]
              })
            }
          }
          return arrRtr
        }
        Posts.find({
          where: {
            id: postId
          }
        })
          .then((post) => {
            if (post) {
              addTagsOnPost(formatTheTags(), post, user)
              return ReS(res, {message: 'Tags added'}, 200)  
            } else {
              return ReE(res, {message: 'Post not found'}, 404);
            }
          })
      } else {
        return ReE(res, {message: 'Missing parameters'}, 404);  
      }
    } else {
      return ReE(res, {message: 'You are not authorized'}, 401); 
    }
  } catch (e) {
      console.log(e)
      return ReE(res, {message: 'Something went wrong'}, 500); 
  }
}