const { Comments, Reactions, User} = require('../models');
const { to, ReE, ReS, getLimitOffset} = require('../services/util.service');

const get = function(req, res){
  try {  
    let commentId = req.params.commentId,
    limitNOffset = getLimitOffset((req.query.page || 1 ), 15);
    if (commentId) {
      Reactions.findAll({
        include: [
          {
            model: User.scope('public')
          }
        ],
        where: {
          CommentId: commentId
        },
        limit: limitNOffset.limit,
        offset: limitNOffset.offset
      })
        .then((reactions) => {
          return ReS(res, {reactions: reactions});
        })
        
    } else {
      return ReE(res, {error: 'Comment not found'}, 404);
    }
  } catch (e) {
      console.log(e)
      return ReE(res, {error: 'Something went wrong'}, 500);
  }
}

module.exports.get = get;
