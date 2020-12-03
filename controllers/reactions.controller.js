const { Comments, Reactions, User, DummyReactions} = require('../models');
const { to, ReE, ReS, getLimitOffset} = require('../services/util.service');
const { NOTIFICATIONS } = require('../config/app-constants');
const Sequelize = require('sequelize');
const op = Sequelize.Op;

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
        offset: limitNOffset.offset,
        order: [['updatedAt', 'DESC']]
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


const create = function (req, res) {
  try {
    let commentId = req.params.commentId,
    reaction = req.body.reaction || false
    if (commentId && reaction) {
      Reactions.create({
        text: reaction,
        CommentId: commentId,
        UserId: req.user.id
      })
        .then((r) => {
          Reactions.find({
            where: {
              id: r.id
            },
            include: [{
              model: User.scope('public')
            }
            ]
          })
            .then((r1) => {
              return ReS(res, {reaction: r1});
            })
          
        })
    } else {
      return ReE(res, {error: 'Missing parameters'}, 404);
    }
  } catch (e) {
    console.log(e)
    return ReE(res, {error: 'Something went wrong'}, 500);
  }
}

module.exports.create = create;

const remove = function (req, res) {
  try {
    let reactionId = req.params.reactionId || false,
    user = req.user;

    if (reactionId) {
      Reactions.destroy({
        where: {
          id: reactionId,
          UserId: user.id
        }
      })
        .then((d) => {
          return ReS(res, {message: ' Reaction Deleted'})
        })
        .catch((err) => {
          console.log(e)
          return ReE(res, {error: 'Something went wrong'}, 500);
        })
    } else {
      return ReE(res, {error: 'Missing parameters'}, 404);
    }
  } catch (e) {
    console.log(e)
    return ReE(res, {error: 'Something went wrong'}, 500);
  }
}

module.exports.remove = remove;

const addDummyReaction = function (req, res) {
  try {
    if (req.user.isAdmin) {
      let text = req.body.text ? req.body.text.trim() : false
      if (text) {
        DummyReactions.create({
          text: text,
          UserId: req.user.id
        })
          .then((d) => {
            return ReS(res, {message: 'Reaction added: '+text})
          })
          .catch((err) => {
            console.log(e)
            return ReE(res, {error: 'Something went wrong'}, 500);
          })
      } else {
        return ReE(res, 'Missing parameters', 500);
      }
    } else {
      return ReE(res, {message:'Unathorized user'}, 401);
    }
  } catch (e) {
    console.log(e)
    return ReE(res, {error: 'Something went wrong'}, 500);
  }
}

module.exports.addDummyReaction = addDummyReaction;

const addFakeReactions = function (req, res) {
  try {
    if (req.user.isAdmin) {
      let commentId = req.params.commentId,
      n = parseInt(req.query.n),
      type = req.query.type || 'reactions';

      let getData = (reactions, users) => {
        let arr_ = []
        for (let i in reactions) {
          if (type === 'reactions') {
            arr_.push({
              text: reactions[i].text,
              CommentId: commentId,
              UserId: users[i].id
            })  
          } else {
            arr_.push({
              comment: reactions[i].text,
              PostId: commentId,
              UserId: users[i].id,
              disableOnMainFeed: false
            })
          }
        }
        return arr_
      }

      if (commentId, n) {
        DummyReactions.findAll({
          order: Sequelize.literal('rand()'), 
          limit: n
        })
          .then((reactions) => {
            User.scope('public').findAll({
              where: {systemCreatedUser: true}, 
              order: Sequelize.literal('rand()'), 
              limit: n
            })
              .then((users) => {
                let model = type === 'reactions' ? Reactions : Comments
                model.bulkCreate(getData(reactions, users))
                  .then((d) => {
                    return ReS(res, {message: type + ' added successfully'})
                  })
              })
          })
          .catch((rEE) => {
            console.log(rEE)
            return ReE(res, 'Something went wrong', 500);
          })
      } else {
        return ReE(res, 'Missing parameters', 500);
      }
    } else {
      return ReE(res, {message:'Unathorized user'}, 401);
    }
  } catch (e) {
    console.log(e)
    return ReE(res, {error: 'Something went wrong'}, 500);
  }
  
}

module.exports.addFakeReactions = addFakeReactions;