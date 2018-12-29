const { Tags } = require('../models');
const { to, ReE, ReS, isEmptyObject, getLimitOffset } = require('../services/util.service');
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

    Tags.findAll({where: {UserId: user.id }})
      .then((tags)=>{
        return ReS(res, {tags: tags});
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
      offset: limitNOffset.offset
    })
      .then((tags)=>{
        return ReS(res, {tags: tags});
      })
      .catch((error) => {
        return ReE(res, error);
      })

}
module.exports.browseTags = browseTags;