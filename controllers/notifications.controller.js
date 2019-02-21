const { User, Notifications } = require('../models');
const { to, ReE, ReS, isEmptyObject, getLimitOffset, cloneOject } = require('../services/util.service');
const Sequelize = require('sequelize');

const Op = Sequelize.Op;

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

  let err, notificationRecord, data; 

  notification.fromId = fromId || toId;
  notification.toId = toId;

  Notifications.create(notification)
    .then((notificationRecord) => {
      return notificationRecord
    })
    .catch ((err) => {
      //return ReE(res, {error: 'Something went wrong while sending a notification to the user'}, 422);
      console.log(err)
      return false
    })

  return false
}

module.exports.create = create;

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
