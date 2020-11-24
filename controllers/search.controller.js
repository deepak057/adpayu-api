const { Posts, User, Videos, Questions } = require('../models');
const { to, ReE, ReS, isEmptyObject, getLimitOffset, getIdsArray } = require('../services/util.service');
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
        let uncommented = req ? (req.body.uncommented ? req.body.uncommented === 'true' : false) : false;
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

      let keyword = req.body.k;

      /** get array of ids of results
      ** that have already been sent to client side
      */
      let getExcludedIds = function () {
        let ids = []
        if (req.body.lRIds) {
          return req.body.lRIds
        }
        return ids
      }

      /*
      * get the type of sorting
      */
      let sort = function () {
        if (req.body.sort) {
          if (req.body.sort === 'NF') {
            return 'DESC'
          } else if (req.body.sort === 'LF') {
            return 'ASC'
          } else {
            return req.body.sort
          }
        } else {
          return 'ASC'
        }
      }

      let err, friends;

      let page = req.body.page || 1;

      let limitNOffset = getLimitOffset(page);

      let sortType = sort()

      if (searchType === 'users') {
        // get current user's friends
        // or the users where friendship request
        // is pending
        [err, friends] = await to(User.getFriends(req.user.id, false))
        if(err) {
          return ReE(res, err, 422);
        }
        // don't include Excluded Id in search query in case of random search
        let idCondArr = sortType === 'RO' ? getUIDs(friends, req.user).concat(getExcludedIds()) : getUIDs(friends, req.user)

        let criteria = {
          limit: limitNOffset.limit,
          order: sortType === 'RO' ? [[Sequelize.fn('RAND')]] : [['createdAt', sortType]],
          where: {
            id: { [Op.notIn]: idCondArr},
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
        }

        if (sortType !== 'RO') {
          criteria.offset = limitNOffset.offset
        }

        User.scope('public', 'visible').findAll(criteria)
          .then ((users) => {
            return ReS(res, {users: users});
          })
          .catch ((err) => {
            return ReE(res, err, 422);
          })
      } else if (searchType === 'tags') {
        const TagsController   = require('./tags.controller');
        TagsController.browseTagsWithSort(req, res, sortType, getExcludedIds())
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

       let criteria = {};
       criteria.include = [
        {
          model: Videos
        },
        {
          model: Questions
        }
       ]
      /*
      * A hack to use Limit and Offset as we are querying through other tables
      * in which case, limit and offset parameters cause mySQL errors
      */
       //criteria.order = Sequelize.literal((req.user.recentActivitiesEnabled ? 'updatedAt' : 'createdAt') + ' ' +sort + ' LIMIT '+ limitNOffset.offset + ','+limitNOffset.limit);
      criteria.order = Sequelize.literal((sortType === 'RO' ? 'RAND()' : ('updatedAt ' + sortType )) + ' LIMIT ' + (sortType !== 'RO' ? limitNOffset.offset + ',' : '') + limitNOffset.limit);
      
      let andCond = {
        AdOptionId: {[Op.eq]: null}
      }

      if (sortType === 'RO') {
        andCond.id = {
          [Op.notIn]: getExcludedIds()
        }
      }

      criteria.where = {      
            [Op.and]: [
              andCond,
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
            /*
            ** get the ids of posts and simply only fetch
            * those posts by IDs as the above query was 
            * taking way too long in case of Random order search
            * on the server, probably because of too many joins in
            * the query. So in the above query, we are running the 
            * queries with minimal number of required joins and then
            * running a new query with all the joins, but only for the
            * posts which were obtained from the above query
            */
            if (posts && posts.length) {
              let criteriaWithChildModels = getPostCriteriaObject(req.user);
              criteriaWithChildModels.where= {
                id: getIdsArray(posts) 
              }
              if (sortType !== 'RO') {
                criteriaWithChildModels.order = [['updatedAt', sortType]]
              }
              Posts.findAll(criteriaWithChildModels)
                .then((newPosts) => {
                  return ReS(res, {posts: toWeb(newPosts, req.user)});    
                })
            } else {
              return ReS(res, {posts: toWeb(posts, req.user)});  
            }
          })
          .catch((err) => {
            console.log(err)
            return ReE(res, {'error': err}, 422);
          })
      }
    
}

module.exports.get = get;
