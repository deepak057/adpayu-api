const { Tags, User } = require('../models');
const { to, ReE, ReS, isEmptyObject, getLimitOffset } = require('../services/util.service');
const Sequelize = require('sequelize');

const Op = Sequelize.Op;

/*
** function to add "following" boolean to indicate wehter 
** current user follow a given tag or not
*/
function toWeb (tags) {
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

const get = function(req, res){

    Tags.findAll({limit:7, where: {name: {[Op.like] :  '%' +req.query.tag+'%'}}})
      .then((tags)=>{
        return ReS(res, {tags: tags});
      })
      .catch((error) => {
        return ReE(res, error);
      })


}
module.exports.get = get;

const getUserTags = function(req, res){

	let user = req.user;

  User.scope('public').find({
    where: {id: user.id},
    include: [
      {
        model: Tags
      }
    ]
  })
    .then((user)=>{
        return ReS(res, {tags: user.Tags});
      })
      .catch((error) => {
        return ReE(res, error);
      })
}
module.exports.getUserTags = getUserTags;

const browseTags = function(req, res){
    
    let limitNOffset = getLimitOffset((req.query.page || 1), 16);

    Tags.findAll({
      limit: limitNOffset.limit,
      offset: limitNOffset.offset,
      include: [
        {
          model: User.scope('public'),
          through: {
            where: [
              {
                UserId: req.user.id
              }
            ]
          }
        }
      ]
    })
      .then((tags)=>{
        return ReS(res, {tags: toWeb(tags)});
      })
      .catch((error) => {
        return ReE(res, error);
      })

}
module.exports.browseTags = browseTags;

const follow = function(req, res){
    
    let tagId = req.params.tagId || false;

    if (tagId) {
      Tags.find({
        where: {
          id: tagId
        }
      })
        .then((tag) => {
          if (tag) {
            tag.addUsers(req.user)
            return ReS(res, {success: true, message: 'followed the tag successfully'});
          } else {
            return ReE(res, {'error': 'Tag not found'}, 404);
          }
        })
    } else {
      return ReE(res, {'error': 'Tag Id not supplied'}, 404);
    }

}
module.exports.follow = follow;

const unfollow = function(req, res){
    
    let tagId = req.params.tagId || false;

    if (tagId) {
      Tags.find({
        where: {
          id: tagId
        }
      })
        .then((tag) => {
          if (tag) {
            tag.removeUsers(req.user)
            return ReS(res, {success: true, message: 'unfollowed the tag successfully'});
          } else {
            return ReE(res, {'error': 'Tag not found'}, 404);
          }
        })
    } else {
      return ReE(res, {'error': 'Tag Id not supplied'}, 404);
    }

}
module.exports.unfollow = unfollow;