const { User, Friendship } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');
const Sequelize = require('sequelize');

const Op = Sequelize.Op;

const create =  async function(req, res){
    let friendId, friend, err;
    friendId = req.params.friendId;
    if(friendId) {
      [err, friend] = await to(User.findOne({where: { id: friendId}}));
      if(err) {
        return ReE(res, err, 422);
      } else {
        req.user.addFriend(friend);
        return ReS(res, {message:'Success'}, 200);
      }
    } else {
      return ReE(res, 'No friend Id provided', 422);
    }
}
module.exports.create = create;

const remove = async function(req, res){
    let friendId, friend, err;
    friendId = req.params.friendId;
    if(friendId) {
      [err, friend] = await to(Friendship.cancelFriendship(req.user.id, friendId));
      if(err) return ReE(res, err, 422);
      return ReS(res, {message:'Success'}, 200);
    } else {
      return ReE(res, 'No friend Id provided', 422);
    }
}
module.exports.remove = remove;