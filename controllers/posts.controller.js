const { Posts, Comments, User, Questions, AdOptions } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');

const create = async function(req, res){
    let err, post, comments, question, adOptions;
    let user = req.user;

    let post_info = req.body;

    /*
    Temporary workarounds
    */
    post_info.imgs = '';
    post_info.comments = {'comment': 'd'};
    post_info.likes = '';
    post_info.tags = '';

    /***
    Workarounds end
    **/

    
    [err, comments] = await to(Comments.create(post_info.comments));
    if(err) return ReE(res, err, 422);

    [err, post] = await to(Posts.create(post_info));
    if(err) return ReE(res, err, 422);

    // Saving relations
    user.addPosts(post);
    post.setUser(user);
    post.addComments(comments);
    comments.setPost(post);
    user.addComments(comments);
    comments.setUser(user);

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


    [err, post] = await to(post.save());
    if(err) return ReE(res, err, 422);

    let post_json = post.toWeb();
    post_json.user = [{user:user}];

    return ReS(res, {post:post_json}, 201);
}
module.exports.create = create;

const getAll = async function(req, res){
    let user = req.user;
    let err, companies;

    [err, companies] = await to(user.getCompanies({include: [ {association: Company.Users} ] }));

    let companies_json =[]
    for( let i in companies){
        let company = companies[i];
        let users =  company.Users;
        let company_info = company.toWeb();
        let users_info = [];
        for (let i in users){
            let user = users[i];
            // let user_info = user.toJSON();
            users_info.push({user:user.id});
        }
        company_info.users = users_info;
        companies_json.push(company_info);
    }

    console.log('c t', companies_json);
    return ReS(res, {companies:companies_json});
}
module.exports.getAll = getAll;

const get = function(req, res){
    let company = req.company;

    return ReS(res, {company:company.toWeb()});
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