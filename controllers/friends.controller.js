const { User, Friendship } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');
const NotificationsController   = require('./notifications.controller');
const NOTIFICATIONS = require('../config/app-constants');

const get =  async function(req, res){
    let err, friends, friendsWeb = [], friendship, temp;

    // get all the users
    // including current user's friends
    // or other users from whom curent
    // user has received a friend request 
    // or has sent a friend requests to
    
    [err, friends] = await to(User.getFriends(req.user.id, false))
     if(err) {
       return ReE(res, err, 422);
     }
    return ReS(res, {friends: friends}, 200);

}
module.exports.get = get;

const create =  async function(req, res){
    let friendId, friend, err;
    friendId = req.params.friendId;
    if(friendId) {
      [err, friend] = await to(User.findOne({where: { id: friendId}}));
      if(err) {
        return ReE(res, err, 422);
      } else {
        req.user.addMyFriends(friend, {as: 'myFriends'});
        NotificationsController.create({type: NOTIFICATIONS.types.SENT_FRIEND_REQUEST}, req.user.id, friend.id)
        return ReS(res, {message:'Success'}, 200);
      }
    } else {
      return ReE(res, { error: 'No friend Id provided' }, 422);
    }
}
module.exports.create = create;

const add =  async function(req, res){
    let friendId, friend, err;
    friendId = req.params.friendId;
    if(friendId) {
      [err, friend] = await to(Friendship.acceptFriendship(req.user.id, friendId));
      if(err) {
        return ReE(res, err, 422);
      } else {
        // send a notification to the user who sent the request
        NotificationsController.create({type: NOTIFICATIONS.types.FRIENDSHIP_ACCEPTED}, req.user.id, friendId)

        //remove the "freindship reqest" notification from current user'saccount
        NotificationsController.remove({type: NOTIFICATIONS.types.SENT_FRIEND_REQUEST}, friendId, req.user.id)

        return ReS(res, {message:'Success'}, 200);
      }
    } else {
      return ReE(res, { error: 'No friend Id provided' }, 422);
    }
}
module.exports.add = add;

const remove = async function(req, res){
    let friendId, friend, err, friendship;
    friendId = req.params.friendId;
    if(friendId) {

      [err, friendship] = await to(Friendship.getFriendship(req.user.id, friendId));
      if(err) return ReE(res, err, 422);

      else {
        [err, friend] = await to(Friendship.cancelFriendship(req.user.id, friendId));
        if(err) return ReE(res, err, 422);

        NotificationsController.remove({type: NOTIFICATIONS.types.SENT_FRIEND_REQUEST}, friendship.UserId, friendship.FriendId)
        NotificationsController.remove({type: NOTIFICATIONS.types.FRIENDSHIP_ACCEPTED}, friendship.FriendId, friendship.UserId)

        return ReS(res, {message:'Success'}, 200);
      }

    } else {
      return ReE(res, { error: 'No friend Id provided' }, 422);
    }
}
module.exports.remove = remove;