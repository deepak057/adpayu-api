const { Tags, User, Posts, Questions, Videos } = require('../models');
const { to, ReE, ReS, isEmptyObject, getLimitOffset } = require('../services/util.service');
const Sequelize = require('sequelize');

const Op = Sequelize.Op;

const get = function(req, res){
    
      let searchType = req.params.type | 'content';

      let keyword = req.query.k;

      Posts.findAll({
        where: {
          public: true
        },
        include: [
          {
            model: Questions,
            where: {
              question: {[Op.like] :  '%' +keyword+'%'}
            }
          },
          {
            model: Videos,
            where: {
              title: {[Op.like] :  '%' +keyword+'%'}
            }
          }
        ]
      })
        .then((posts) => {
          return ReS(res, {posts: posts});
        })
        .catch((err) => {
          return ReE(res, {'error': err}, 404);
        })
}

module.exports.get = get;
