const { Posts, User, Friendship } = require('../models');
const { to, ReE, ReS, isEmptyObject, getLimitOffset } = require('../services/util.service');
const { getUIDs, getDBInclude, toWeb} = require('../services/app.service');
const Sequelize = require('sequelize');

const Op = Sequelize.Op;

/*
** function to return OR condition
* array depending upon the search filter
*/
function getContentCondition (searchType, keyword) {
      let contentCondition = [];
      let onlyQuestions = { '$Question.question$': {[Op.like] :  '%' +keyword+'%'}};
      let onlyVideos = { '$Video.title$': {[Op.like] :  '%' +keyword+'%'}}
      if (searchType === 'video') {
        contentCondition.push(onlyVideos)
      } else if (searchType === 'questions') {
        contentCondition.push(onlyQuestions)
      } else {
        contentCondition.push(onlyVideos);
        contentCondition.push(onlyQuestions)
      }

      return contentCondition;
}

const get = async function(req, res){
    
      let searchType = req.params.type || 'content';

      let keyword = req.query.k;

      let err, friends;

      let page = req.query.page || 1;

      let limitNOffset = getLimitOffset(page);

      if (searchType === 'users') {
        User.scope('public').findAll({
          where: {
            [Op.or]: [
              {
                first: {[Op.like]: '%' +keyword+'%'}
              },
              {
                last: {[Op.like]: '%' +keyword+'%'}
              }
            ]
          }
        })
          .then ((users) => {
            return ReS(res, {users: users});
          })
          .catch ((err) => {
            return ReE(res, err, 422);
          })
      } else {
        
        // get current user's friends
    [err, friends] = await to(User.getFriends(req.user.id))
     if(err) {
       return ReE(res, err, 422);
     }


     /*
     * Find all the public video and questions 
     * posts which are not ads and match the 
     * given keyword and are either created by 
     * friends or self
     */

      Posts.findAll({

        /*
        * A hack to use Limit and Offset as we are querying through other tables
        * in which case, limit and offset parameters cause mySQL errors
        */
        order: Sequelize.literal('updatedAt DESC LIMIT '+ limitNOffset.offset + ','+limitNOffset.limit), 
        /*limit: limitNOffset.limit,
        offset: limitNOffset.offset,*/
        where: {      
          [Op.and]: [
            {
              AdOptionId: {[Op.eq]: null},
            },
            {
              [Op.or]: [
                { 
                  public: {[Op.eq]: true},
                },
                {
                  UserId: getUIDs(friends, req.user)
                }
              ],
            },
            {
              [Op.or]: getContentCondition (searchType, keyword)
            }
          ]
        },
        include: getDBInclude()
      })
        .then((posts) => {
          return ReS(res, {posts: toWeb(posts, req.user)});
        })
        .catch((err) => {
          return ReE(res, {'error': err}, 422);
        })
      }
  

    
}

module.exports.get = get;
