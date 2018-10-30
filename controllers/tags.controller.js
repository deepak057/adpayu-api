const { Tags } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');
const Sequelize = require('sequelize');

const Op = Sequelize.Op;

const get = function(req, res){

    Tags.findAll({where: {name: {[Op.like] :  '%' +req.query.tag+'%'}}})
      .then((tags)=>{
        return ReS(res, {tags: tags});
      })
      .catch((error) => {
        return ReE(res, error);
      })


}
module.exports.get = get;