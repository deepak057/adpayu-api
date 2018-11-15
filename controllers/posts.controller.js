const { Posts, Comments, User, Questions, AdOptions, Imgs, Tags, Likes } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');


/**
** Convert the posts and include Likes
**/
function toWeb(posts, user) {
    
  if(posts.constructor !== Array) {
    return posts.toWeb(user);
  }

  else {
    let posts_web = [];

    for (let i in posts){
      posts_web.push(posts[i].toWeb(user))
    }

    return posts_web;
  }
 
}

const create = async function(req, res){
    let err, post, comments, question, adOptions, imgs, tags;
    let user = req.user;

    let post_info = req.body;

    /*
    Temporary workarounds
    */
    post_info.likes = '';

    /***
    Workarounds end
    **/


    [err, post] = await to(Posts.create(post_info));
    if(err) return ReE(res, err, 422);

    // Saving relations
    user.addPosts(post);
    post.setUser(user);

   /* if(!isEmptyObject(post_info.comments)){
        [err, comments] = await to(Comments.create(post_info.comments));
        if(err) return ReE(res, err, 422);

        post.addComments(comments);
        comments.setPost(post);
        user.addComments(comments);
        comments.setUser(user);

    }*/


     if(!isEmptyObject(post_info.question)){

        [err, question] = await to(Questions.create(post_info.question));
         if(err) return ReE(res, err, 422);

         post.setQuestion(question);
         user.addQuestions(question);
         question.setUser(user);

    }

    if(post_info.adOptions.postIsAd) {
        [err, adOptions] = await to(AdOptions.create(post_info.adOptions));
         if(err) return ReE(res, err, 422);

        post.setAdOption(adOptions);
        adOptions.setUser(user);
        user.addAdOptions(adOptions);
    }

    if(post_info.imgs.length > 0) {


        [err, imgs] = await to(Imgs.bulkCreate(post_info.imgs));
         if(err) return ReE(res, err, 422);

        for(var i in imgs){
            imgs[i].setPost(post);
            imgs[i].setUser(user);
            post.addImgs(imgs[i]);
        }
    }

    /*
    ** Loop through given Tags and cretae new tags if they don't already exist in database
    ** also associate tags with current post 
    */

    if(post_info.tags.length > 0) {

      for(var i in post_info.tags){
        
        Tags.findOrCreate(
        {
          where: {name: post_info.tags[i].text},
          defaults: {
            name: post_info.tags[i].text,
            UserId: user.id
          }
        },
        ). spread ((tag, created) => {
          post.addTags(tag)
        })

      }

    }


    [err, post] = await to(post.save());
    if(err) return ReE(res, err, 422);

    let post_json = post.toWeb();
    post_json.user = [{user:user}];

    Posts.findOne({include: [
          {
            model: Comments,
          },
          {
            model: User
          },
          {
            model: AdOptions,
          },
          {
            model: Imgs,
          },
          {
            model: Questions,
          },
          {
            model: Tags
          },
          {
            model: Likes,
          }


        ], where: {id: post.id}})
      .then((post) => {
            return ReS(res, toWeb(post, user), 201);

      })

}
module.exports.create = create;

const get = function(req, res){
    let user = req.user;

    let tag = req.params.tag || 'all';

    let dbIncludes = [

          {
            model: Comments,
            include: [{model: User}]
          },
          {
            model: User,
            where: {id: 1}
          },
          {
            model: AdOptions,
          },
          {
            model: Imgs,
          },
          {
            model: Questions,
          },
          {
            model: Likes,
          }
        ];

    let criteria = {
      include: dbIncludes ,
      order: [['updatedAt', 'DESC']], limit: 10,
    };

    if(tag === 'all')  {

      criteria.include.push({
          model: Tags,
        })

      Posts.findAll(criteria)
         .then(posts => {

            return ReS(res, {posts: toWeb(posts, user)});

      })

    }  

    else {

      Tags.findOne({where: {name: tag}})
      .then ((Dbtag) => {

       criteria.include.push({
          model: Tags,
          where: {id: Dbtag.id}
        })

        Posts.findAll(criteria)
         .then(posts => {

            return ReS(res, {posts: toWeb(posts, user)});

      })

      }).catch ((error) => {
        return ReS(res, error);

      })

    }

    

    

}
module.exports.get = get;

const update = async function(req, res){
    let err, company, data;
    company = req.company;
    data = req.body;
    company.set(data);

    [err, company] = await to(company.save());
    if(err){
        return ReE(res, err);
    }
    return ReS(res, {company:company.toWeb()});
}
module.exports.update = update;

const remove = async function(req, res){
    let company, err;
    company = req.company;

    [err, company] = await to(company.destroy());
    if(err) return ReE(res, 'error occured trying to delete the company');

    return ReS(res, {message:'Deleted Company'}, 204);
}
module.exports.remove = remove;