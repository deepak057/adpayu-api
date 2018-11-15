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
         
        Comments.create(req.body)
          .then((comment) => {
             comment.setPost(post);
             comment.setUser(user);
             post.addComments(comment);
             user.addComments(comment);

             comment = comment.toWeb();
             comment.Likes = [];

             //add User model
             comment.User = req.user;

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

const remove = async function(req, res){
    let comment, err;

    [err, comment] = await to(Comments.destroy({where: {id: req.query.commentId}}));
    if(err) return ReE(res, 'error occured trying to delete the comment');

    return ReS(res, {message:'Comment deleted'}, 204);
}
module.exports.remove = remove;