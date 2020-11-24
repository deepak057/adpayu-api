const { Tags, User } = require('../models');
const { to, ReE, ReS, isEmptyObject, getLimitOffset } = require('../services/util.service');
const { tagsToWeb} = require('../services/app.service');
const { TAGS } = require('../config/app-constants');

const Sequelize = require('sequelize');

const Op = Sequelize.Op;

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

const searchTags = function(req, res, sort = false, exclidedIds = []) {
  let limitNOffset = getLimitOffset((req.body.page || req.query.page), 16);
  let criteria = {
    limit: limitNOffset.limit,
    order: sort !== 'RO' ? [['createdAt', (sort || 'ASC')]] : [[Sequelize.fn('RAND')]],
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
  }

  criteria.where = {}

  if (sort !== 'RO') {
    criteria.offset = limitNOffset.offset
  } else {
    criteria.where.id =  {
      [Op.notIn]: exclidedIds
    }
  }

  /*
  *  add search by name condition if k (keyword parameter is supplied)
  */
  if(req.body.k) {
    criteria.where.name = {
      [Op.like]: '%'+ req.body.k + '%'
    }
  }

  Tags.findAll(criteria)
    .then((tags)=>{
      return ReS(res, {tags: tagsToWeb(tags)});
    })
    .catch((error) => {
      return ReE(res, error);
    })
}

const browseTags = function(req, res){
  searchTags(req, res)
}

module.exports.browseTagsWithSort = function(req, res, sort, exclidedIds = false){
  searchTags(req, res, sort, exclidedIds)
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

const createDefaultTag = function(){

  let tagName = TAGS.defaultTag.name;

  try{

    Tags.find({where: {name: tagName}})
    .then ((tag) => {
      if (!tag) {
        Tags.create({name: tagName})
          .then((tag) => {
            console.log('Default tag ' + tagName + ' created')
          })
      }
    })
  } catch (e) {
    console.log(e)
    console.log('Something went wrong while trying to create the default tag')
  }  
}

module.exports.createDefaultTag = createDefaultTag;

const associateWithDefaultTag = function(user){
  let tagName = TAGS.defaultTag.name;

  try {
    Tags.find({where: {name: tagName}})
      .then ((tag) => {
        tag.addUsers(user)
      })
  } catch (e) {
    console.log(e)
    console.log('Something went wrong while associating the user with default tag.')
  }
}

module.exports.associateWithDefaultTag = associateWithDefaultTag;
