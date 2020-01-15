const { SocialShares } = require('../models');
const { to, ReE, ReS } = require('../services/util.service');
const Sequelize = require('sequelize');
const op = Sequelize.Op;

const trackSharing = async function (req, res) {
  try {
    let data = req.body
    let queryInsert = {
      UserId: req.user.id,
      network: data.network,
      shareObject: JSON.stringify(data.shareObj)
    } 
    if (data.commentId) {
      queryInsert.CommentId = data.commentId
    }
    if (data.postId) {
      queryInsert.PostId = data.postId
    }
    SocialShares.create(queryInsert)
      .then((d) => {
        return ReS(res, {message: 'Page available for sharing now'}, 200);
      })
  } catch (e) {
    console.log(e)
    return ReE(res, {success: false, error: 'Something went wrong while sharing.'}, 501)

  }
}

module.exports.trackSharing = trackSharing;


module.exports.hasContentBeenShared = function (contentId) {

  return new Promise(function (resolve, reject) {

    SocialShares.count({
      where: {
        [op.or]: [
          {
            CommentId: contentId
          },{
            PostId: contentId
          }
        ]
      }
    })
      .then((d) => {
        resolve(d)
      })
      .catch ((e) => {
        reject(e)
      })

  })

}