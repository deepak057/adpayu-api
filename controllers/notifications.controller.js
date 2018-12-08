const { User, Notifications } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');

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

const remove = async function(notification, fromId, toId){
  Notifications.destroy({
    where: {fromId: fromId, type: notification.type, toId: toId},
  })
}
module.exports.remove = remove;