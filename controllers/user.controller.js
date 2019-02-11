const { User, Friendship }          = require('../models');
const authService       = require('../services/auth.service');
const { to, ReE, ReS, uniqeFileName}  = require('../services/util.service');
const ADS = require('../config/app-constants');

const create = async function(req, res){
    const body = req.body;

    if(!body.unique_key && !body.email && !body.phone){
        return ReE(res, 'Please enter an email or phone number to register.');
    } else if(!body.password){
        return ReE(res, 'Please enter a password to register.');
    }else{
        let err, user;

        [err, user] = await to(authService.createUser(body));

        if(err) return ReE(res, err, 422);
        return ReS(res, {message:'Successfully created new user.', user:user.toWeb(), token:user.getJWT()}, 201);
    }
}
module.exports.create = create;

const uploadProfilePicture = async function(req, res) {

}
module.exports.uploadProfilePicture = uploadProfilePicture;

const get = async function(req, res){
    let user, err, friendship;
    if(req.params.uid) {
      [err, user] = await to (User.scope('public').findOne({ where: {id: req.params.uid}}))
      if(err) return ReE(res, err, 422);
      [err, friendship] = await to (Friendship.getFriendship(req.user.id, req.params.uid))
      if(err) return ReE(res, err, 422);

    } else {
      user = req.user
    }

    return ReS(res, {user:user, friendship: friendship});
}
module.exports.get = get;

const update = async function(req, res){
    let err, user, data
    user = req.user;
    data = req.body;

    // delete properties that are 
    // not supposed to be updated
    delete data.email;
    
    // change the password if
    // newPassword property is not empty
    if(req.body.newPassword) {
        data.password = req.body.newPassword
    } else {
        delete data.password;
    }
    
    user.set(data);

    [err, user] = await to(user.save());
    if(err){
        if(err.message=='Validation error') err = 'The email address or phone number is already in use';
        return ReE(res, err);
    }
    return ReS(res, {user: user});
}
module.exports.update = update;

const remove = async function(req, res){
    let user, err;
    user = req.user;

    [err, user] = await to(user.destroy());
    if(err) return ReE(res, 'error occured trying to delete user');

    return ReS(res, {message:'Deleted User'}, 204);
}
module.exports.remove = remove;


const login = async function(req, res){
    const body = req.body;
    let err, user;

    [err, user] = await to(authService.authUser(req.body));
    if(err) return ReE(res, err, 422);

    return ReS(res, {
        token:user.getJWT(), 
        user:user.toWeb(), 
        options: {
            // default ad pricing structure
            adDefaultPricing: ADS.defaultPricing
        }
    });
}
module.exports.login = login;

