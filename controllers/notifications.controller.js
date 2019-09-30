const { User, Notifications, Posts } = require('../models');
const { to, ReE, ReS, isEmptyObject, getLimitOffset, cloneOject } = require('../services/util.service');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

function getNotificationData(notiType, commentId, postId, type= 'text') {
  return {
    type: notiType,
    meta: JSON.stringify({
      commentId: parseInt(commentId),
      postId: parseInt(postId),
      postType: type
    })
  }
}

module.exports.getNotificationData = getNotificationData;

const get = async function (req, res) {

  let limitNOffset = getLimitOffset(req.query.page || 1);

  let autoMarkSeen = req.query.autoMarkSeen? req.query.autoMarkSeen === 'true': false;

  Notifications.findAll({

    where: {toId: req.user.id},
    order: [['updatedAt', 'DESC']], 
    limit: limitNOffset.limit,
    offset: limitNOffset.offset,
    include: [
      {
        model: User.scope('public'),
        as: 'sender'
      }
    ]

  })
    .then ((notifications) => {
      
      let notificationsTosend = cloneOject(notifications);

      if(autoMarkSeen && notifications.length) {
        notifications.forEach(function (notification) {
          if(!notification.seen) {
            notification.updateAttributes({ seen: true });
          }
        });
      }
      return ReS(res, {notifications: notificationsTosend}, 200);
    })
    .catch((err) => {
      return ReE(res, err, 422);
    })
}

module.exports.get = get;


const create = async function (notification, fromId, toId) {

  return new Promise(function(resolve, reject) {
    try {
      let err, notificationRecord, data, postId = getPostId(notification), postType = getMetaProperty(notification, 'postType'); 

      let createNoti = function (notification) {
        // create a notification only if doesn't already exist
        getNotification(notification)
          .then((noti) => {
            if (!noti) {
              Notifications.create(notification)
                .then((notificationRecord) => {
                  resolve(notificationRecord)
                })
            } else {
              resolve(noti)
            }
          })
      };

      notification.fromId = fromId || toId;
      notification.toId = toId;

      if(postId) {
        notification.postId = postId

        // if postId exists but not the post type
        // add the PostType in Notification meta info
        if(!postType) {
          Posts.find({
            where: {
              id: postId
            }
          })
            .then((post) => {
              notification.meta = JSON.parse(notification.meta);
              notification.meta.postType = post.type;
              notification.meta = JSON.stringify(notification.meta);
              createNoti(notification);
            })
        } else {
          createNoti(notification)
        }
      } else {
        createNoti(notification)
      }
    } catch (e) {
      reject(e)
    }
  });
}

module.exports.create = create;

function getNotification (notification) {
  return new Promise(function(resolve, reject) {
    let whereClause = {
      type: notification.type,
      meta: notification.meta,
      fromId: notification.fromId,
      toId: notification.toId
    }
    postId = getPostId(notification);
    
    if (postId) {
      whereClause.postId = postId
    }

    Notifications.find({
      where: whereClause
    })
      .then((noti) => {
        resolve(noti)
      })
      .catch ((e) => {
        reject (e)
      })  
  });
}


function getMetaProperty (notification, prop) {
  if ('meta' in notification){
    try {
      let meta = JSON.parse(notification.meta)
      if (meta && prop in meta) {
        return meta[prop]
      }
    } catch (e) {
      return false
    }
  }
  return false
}

/*
* method to get PostId from Notification object
*/
function getPostId (notification) {
  return getMetaProperty(notification, 'postId')
}

const remove = async function(notification, fromId = false, toId = false){
  let whereObj = {}
  whereObj.type = notification.type
  if('meta' in notification) {
    // using literal query to prevent sequalize from adding "slashes" in the Mysql query string
    // By default, Sequalize escapes the string which we don't want in the case of searching a JSON string
    whereObj.meta = Sequelize.literal("meta = '" +notification.meta + "'")
  }
  if(fromId){
    whereObj.fromId = fromId
  }
  if(toId){
    whereObj.toId = toId
  }
  Notifications.destroy({
    where: whereObj,
  })
}
module.exports.remove = remove;

const markSeen = async function(req, res){
  if (req.body.notiIds && req.body.notiIds.length) {
    Notifications.update({
      seen: true,
      },
      {
        where: {
         id: req.body.notiIds
        }
      })
      .then((notifications) => {
        return ReS(res, {notifications: notifications}, 200);
      })
      .catch((err) => {
        ReE(res, {error: 'Something went wrong while marking your notifications as seen'}, 422);
      })
  } else {
    ReE(res, {error: 'Notifications Ids not provided'}, 422);
  }
}

module.exports.markSeen = markSeen;


function removePostNotifications (postId) {
  return Notifications.destroy({where: {postId: postId}})
}

module.exports.removePostNotifications = removePostNotifications;