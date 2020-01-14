const { Posts, User } = require('../models');
const { to, ReE, ReS, isEmptyObject, getLimitOffset } = require('../services/util.service');
const { getUIDs, getDBInclude, toWeb, getPostCriteriaObject} = require('../services/app.service');
const Sequelize = require('sequelize');

const Op = Sequelize.Op;

/*
** function to return OR condition
* array depending upon the search filter
*/
function getContentCondition (searchType, keyword, req = false) {
      let contentCondition = [];
      let onlyQuestions = { '$Question.question$': {[Op.like] :  '%' +keyword+'%'}};
      let onlyVideos = { '$Video.title$': {[Op.like] :  '%' +keyword+'%'}}
      if (searchType === 'video') {
        contentCondition.push(onlyVideos)
      } else if (searchType === 'questions') {
        let uncommented = req ? (req.query.uncommented ? req.query.uncommented === 'true' : false) : false;
        if (uncommented) {
          // if this parameter is true, retreive only those questions that don't have any answers
          onlyQuestions.abc = Sequelize.literal('((select count(*) from Comments where Comments.PostId = Posts.id AND deleted = 0) = 0)')
        }
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
        // get current user's friends
        // or the users where friendship request
        // is pending
        [err, friends] = await to(User.getFriends(req.user.id, false))
        if(err) {
          return ReE(res, err, 422);
        }

        User.scope('public', 'visible').findAll({
          limit: limitNOffset.limit,
          offset: limitNOffset.offset,
          order: [['createdAt', 'DESC']],
          where: {
            id: { [Op.notIn]: getUIDs(friends, req.user)},

            [Op.or]: [
              {
                first: {[Op.like]: '%' +keyword+'%'}
              },
              {
                last: {[Op.like]: '%' +keyword+'%'}
              },
              Sequelize.where(Sequelize.fn("concat", Sequelize.col("first"), ' ', Sequelize.col("last")), {
                  [Op.like]:  '%' + keyword + '%'
              })
            ]
          }
        })
          .then ((users) => {
            return ReS(res, {users: users});
          })
          .catch ((err) => {
            return ReE(res, err, 422);
          })
      } else if (searchType === 'tags') {
        const TagsController   = require('./tags.controller');
        TagsController.browseTags(req, res)
      } else {
        
        // get current user's friends
        // or the users where friendship request
        // is accepted
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

       let criteria = getPostCriteriaObject(req.user);

      /*
      * A hack to use Limit and Offset as we are querying through other tables
      * in which case, limit and offset parameters cause mySQL errors
      */
       criteria.order = Sequelize.literal((req.user.recentActivitiesEnabled ? 'updatedAt' : 'createdAt') + ' DESC LIMIT '+ limitNOffset.offset + ','+limitNOffset.limit);

       criteria.where = {      
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
                [Op.or]: getContentCondition (searchType, keyword, req)
              }
            ]
          };

        Posts.findAll(criteria)
          .then((posts) => {
            return ReS(res, {posts: toWeb(posts, req.user)});
          })
          .catch((err) => {
            return ReE(res, {'error': err}, 422);
          })
      }
    
}

module.exports.get = get;
