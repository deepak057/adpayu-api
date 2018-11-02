const { Comments, Posts } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');
const Sequelize = require('sequelize');

const Op = Sequelize.Op;

const create =  function(req, res){

    let postId = req.params.postId;

    let user = req.user;

    let comment;

     Posts.findOne({where: {id: postId}})
      .then((post) => {
        let comment = Comments.create
         
        Comments.create(req.body)
          .then((comment) => {
             comment.setPost(post);
             comment.setUser(user);
             post.addComments(comment);
             user.addComments(comment);
             return ReS(res, {comment: comment});
          })
          .catch((error) => {
            return ReE(res, error, 422);
          })
      })
      .catch((error) => {
        return ReE(res, error, 422);
      })

}
module.exports.create = create;