const { Posts, Comments, User, Questions, AdOptions, AdStats, ConsumedAds, ViewedEntities, Images, Imgs, Tags, Likes, Videos, Friendship } = require('../models');
const { isEmptyObject } = require('./util.service');
const Sequelize = require('sequelize');
const op = Sequelize.Op;
const S3Controller   = require('../controllers/s3.controller');
const appRoot = require('app-root-path');
const fs = require('fs');
const path = require('path');
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

function getCommentIncludes (user = false) {
  let r = [
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
    },
  ]
  if (user) {
    r.push({
      model: ViewedEntities,
      where: {
        UserId: user.id
      },
      required: false
    })
  }
  return r;
}

module.exports.getCommentIncludes = getCommentIncludes;

function getCommentCriteriaObject (user = false, where = false) {
  let includes = [
    [Sequelize.literal('(SELECT COALESCE((select COUNT(*) FROM Likes WHERE Likes.CommentId = Comments.id), 0) + COALESCE((select DummyLikes.likesCount from DummyLikes where DummyLikes.CommentId = Comments.id order by DummyLikes.createdAt DESC limit 1), 0))'), 'CommentsLikesCount'],
    [Sequelize.literal('(SELECT COUNT(*) FROM Reactions WHERE Reactions.CommentId = Comments.id AND deleted = 0)'), 'ReactionsCount']
  ]
  if (user) {
    includes.push([Sequelize.literal('(SELECT COUNT(*) FROM Likes WHERE Likes.CommentId = Comments.id AND Likes.UserId = '+ user.id +')'), 'HasLiked'])
    includes.push([Sequelize.literal('(SELECT COUNT(*) FROM ViewedEntities WHERE ViewedEntities.CommentId = Comments.id AND ViewedEntities.UserId = '+ user.id +')'), 'HasViewed'])
  }
  let r_ = {
    include: getCommentIncludes(user),
    required: false,
    attributes: {
      include: includes
    },
  }
  if (where) {
    r_.where =  where
  }
  return r_;
}

module.exports.getCommentCriteriaObject = getCommentCriteriaObject;
/*
** Get default DB Include models
*/

function getDBInclude(user = false, tagIds = [], pushModel = {}, disableCommentsOnMainFeed = false) {
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

  let commentObj = getCommentCriteriaObject(user, false);
    
  commentObj.model = disableCommentsOnMainFeed ? Comments.scope(['ExcludedCommentsOnMainFeed','defaultScopeCopy']) : Comments;


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
          /*{
            model: Comments,
            include: [
              {
                model: User.scope('public')
              }, {
                model: ViewedEntities,
                where: {
                  UserId: user.id
                }
              }
            ],
            required: false
          }*/
          commentObj
          
        ];

    return_.push(tags)
    return_.push(adOption)
    /*return_.push({model: Comments})*/

    if(!isEmptyObject(pushModel)) {
      return_.push(pushModel)
    }

    if (user) {
      return_.push({
        model: ConsumedAds,
        where: {
          UserId: user.id,
        },
        required: false,
      })
    }

    return return_;
}
module.exports.getDBInclude = getDBInclude;


function getPostCriteriaObject (user = false, tagIds = [], disableCommentsOnMainFeed = false) {
  let includes = [
    [Sequelize.literal('(SELECT COUNT(*) FROM Comments WHERE Comments.PostId = Posts.id AND deleted = 0 ' + (disableCommentsOnMainFeed ? ' AND disableOnMainFeed = false ' : '') + ')'), 'CommentsCount'],
    [Sequelize.literal('(SELECT COALESCE((select COUNT(*) FROM Likes WHERE Likes.PostId = Posts.id), 0) + COALESCE((select DummyLikes.likesCount from DummyLikes where DummyLikes.PostId = Posts.id order by DummyLikes.createdAt DESC limit 1), 0))'), 'LikesCount']
  ]
  
  if (user) {
    includes.push([Sequelize.literal('(SELECT COUNT(*) FROM Likes WHERE Likes.PostId = Posts.id AND Likes.UserId = '+ user.id +')'), 'HasLiked'])
    includes.push([Sequelize.literal('(SELECT COUNT(*) FROM ViewedEntities WHERE ViewedEntities.PostId = Posts.id AND ViewedEntities.UserId = '+ user.id +')'), 'HasViewed'])
  }

  return {
      include: getDBInclude(user, tagIds, {}, disableCommentsOnMainFeed),
      
      /*
      Include comments count 
      */
      attributes: {
        include: includes
      },
        
    }
}

module.exports.getPostCriteriaObject = getPostCriteriaObject;

/**
** Convert the posts and include Likes
**/
module.exports.toWeb = function(posts, user) {
  if(posts && posts.constructor !== Array) {
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
  //post_web.Comments = getPostComments(post, user);

  //delete the Comments property as it is not needed by front-end
  delete post_web.Comments;

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

        /* for(let i in json['Likes']) {
            json['Likes'][i].liked = false;
            if(json['Likes'][i].UserId == user.id) {
                json['Likes'][i].liked = true;
            }
        } */

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



function captureVideoPoster (videoFileName, sec = 4) {
  return new Promise(function(resolve, reject) {
    try {
      let ffmpeg = require('fluent-ffmpeg');
      let videoPath = appRoot+'/uploads/'+ videoFileName;
      let screenshotFolder = appRoot+'/uploads/thumbs';
      // replace the extension of given video file with ".png"
      let posterImageName = videoFileName.substr(0, videoFileName.lastIndexOf(".")) + ".png";
      let posterPath = screenshotFolder + '/' + posterImageName;
      let screenshotSecond = sec;

      let main = (customSecond = false) => {
        // create the screenshot only if it doesn't already exist
        if (!fs.existsSync(posterPath)) {
          ffmpeg(videoPath)
          .on('end', function() {
            console.log('Screenshot taken');
            optimizeImage(posterPath)
              .then((stats) => {
                S3Controller.uploadToS3(posterPath, 'public/thumbs/')
                  .then((data) => {
                    resolve(data)
                  })
              })
          })
          .on('error', function(err) {
            console.error(err);
            reject(err)
          })
          .screenshots({
            timestamps: [(customSecond || screenshotSecond)],
            folder: screenshotFolder,
            filename: posterImageName
          });
        }
      }
      /*
      * probe the video file and depending upon it's length
      * calculate at what moment, the screenshot will be captured
      */
      ffmpeg.ffprobe(videoPath, function(err, metadata) {
        if (metadata) {
          if (metadata.format.duration >= screenshotSecond) {
            main()
          } else {
            main(Math.floor(metadata.format.duration))
          }
        } else {
          main()
        }
      })

    } catch (e) {
      reject(e)
    }
  });
}

/*
function captureVideoPoster (videoFileName) {
  return new Promise(function(resolve, reject) {
    try {
      let videoPath = appRoot+'/uploads/'+ videoFileName;
      let screenshotFolder = appRoot+'/uploads/thumbs';
      // replace the extension of given video file with ".png"
      let posterImageName = videoFileName.substr(0, videoFileName.lastIndexOf(".")) + ".png";
      let posterPath = screenshotFolder + '/' + posterImageName;

      const spawn = require('child_process').spawn;
      

      // create the screenshot only if it doesn't already exist
      if (!fs.existsSync(posterPath)) {
        //let ffmpeg = spawn('sh', ['-c', command], { stdio: 'inherit' });
        let ffmpeg = spawn('ffmpeg -ss 00:00:01 -i '  + videoPath + ' -vframes 1 -q:v 2 ' + posterPath , [], { shell: true, stdio: 'inherit' });

       //let ffmpeg = spawn('ffmpeg', getCommandArgsArry(command))
        ffmpeg.on('close', (statusCode) => {
          if (statusCode === 0) {
             console.log('Screenshot taken');
             optimizeImage(posterPath)
              .then((stats) => {
                S3Controller.uploadToS3(posterPath, 'public/thumbs/')
                  .then((data) => {
                    resolve(data)
                  })
              })
          } else {
            reject(statusCode)
          }
        })
      }
    } catch (e) {
      reject(e)
    }
  });
}
*/

module.exports.captureVideoPoster = captureVideoPoster;

/*
function optimizeVideoFile (dbObj, type = 'video') {
  const ffmpeg = require('fluent-ffmpeg');
  let fileName = type === 'video' ? dbObj.path : dbObj.videoPath; 
  let source = appRoot + '/uploads/' + fileName;
  let copy = appRoot + '/uploads/original/' + fileName;
  let updateFailedAttempt = function (obj) {
    obj.failedProcessingAttempts += 1;
    obj.save()
      .then ((obj) => {
        console.log("Failed attempt at video optimisation recorded in database.")
      })
  }

  try {

    fs.copyFile(source, copy, (err) => {
      if (err) {
        updateFailedAttempt(dbObj);
        //throw err;
      } else {
        ffmpeg(copy)
          .on('start', function(commandLine) {
              console.log('Spawned Ffmpeg with command: ' + commandLine);
          })
          .on('error', function(err, stdout, stderr) {
            console.log('Cannot process video: ' + err.message);
            updateFailedAttempt(dbObj);
            // throw err
          })
          .on('end', function() {
             S3Controller.uploadToS3(source)
               .then((data) => {
                  S3Controller.uploadToS3(copy, 'original/')
                    .then( (data2) => {

                        if (type === 'video') {
                          dbObj.optimized = true;
                        } else {
                          dbObj.videoOptimized = true;
                        }

                        dbObj.save()
                          .then((video) => {
                            console.log("Optimization completed for Video (" + fileName + ")");
                          })

                    })
                })
          })
          .save(source);
          console.log("Video (" + fileName + ") is being optimized....");
      }
    })

  } catch (e) {
      updateFailedAttempt (dbObj);
      console.log("Error occured during video processing" + e);
  }  
}


module.exports.optimizeVideoFile = optimizeVideoFile;
*/

function optimizeImage (imagePath) {
  return new Promise(function(resolve, reject) {
    try {
      const compress_images = require('compress-images');
      let copyPrefix = "copy_";
      let imageName = path.basename(imagePath);
      let directory = imagePath.replace(imageName, '');
      let copyFilePath = directory +  copyPrefix + imageName;

      fs.copyFile(imagePath, copyFilePath, (err) => {
        if (err) {
          throw err
        } else {

          fs.unlink(imagePath, function (err) {
            if (err) throw err
            else {
              compress_images(copyFilePath, imagePath, {compress_force: false, statistic: true, autoupdate: true}, false,
                                                  {jpg: {engine: 'mozjpeg', command: ['-quality', '60']}},
                                                  {png: {engine: 'webp', command: ['-q', '60']}},
                                                  {svg: {engine: 'svgo', command: '--multipass'}},
                                                  {gif: {engine: 'gifsicle', command: ['--colors', '64', '--use-col=web']}}, function(error, completed, statistic){
                  if (completed && !err) {
                    fs.unlink(copyFilePath);
                    fs.rename(statistic.path_out_new, imagePath, function(err) {
                      if (!err) {
                        console.log("Image " + imageName + ' optimized');
                        resolve(statistic);
                      } else {
                        throw err;
                      }
                    });
                  }
                  if (error) {
                    console.log(error)
                    throw new Error('Something went wrong.')
                  }   
              });
            }
          })  
        }
      });
    } catch (e) {
      reject(e)
    }
  });
}

module.exports.optimizeImage = optimizeImage;