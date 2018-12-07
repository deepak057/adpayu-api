const { User, Notifications } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');

async function getUser (user) {
  if( typeof user === 'object' ) {
    return user
  } else {
    let err, userDb;
    [err, userDb] = await to(User.findOne({where: {id: user}}));
    return err? false: userDb
  }
}

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