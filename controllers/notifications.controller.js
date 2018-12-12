const { User, Notifications } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');
const Sequelize = require('sequelize');

const Op = Sequelize.Op;

const get = async function (req, res) {
  Notifications.findAll({

    where: {toId: req.user.id},
    order: [['updatedAt', 'DESC']], 
    limit: 10,
    include: [
      {
        model: User.scope('public'),
        as: 'sender'
      }
    ]

  })
    .then ((notifications) => {
      return ReS(res, {notifications: notifications}, 200);
    })
    .catch((err) => {
      return ReE(res, err, 422);
    })
}

module.exports.get = get;


const create = async function (notification, fromId, toId) {

  let err, notificationRecord, data; 

  notification.fromId = fromId;
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