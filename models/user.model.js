'use strict';
const bcrypt 			= require('bcrypt');
const bcrypt_p 			= require('bcrypt-promise');
const jwt           	= require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');
const Sequelize = require('sequelize');
const op = Sequelize.Op;

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('User', {
        first     : DataTypes.STRING,
        last      : DataTypes.STRING,
        email     : {type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: {msg: "Email is invalid."} }},
        phone     : {type: DataTypes.STRING, defaultValue: ''}, /*{type: DataTypes.STRING, allowNull: true, unique: true, validate: { len: {args: [7, 20], msg: "Phone number invalid, too short."}, isNumeric: { msg: "not a valid phone number."} }},*/
        password  : DataTypes.STRING,
        pic       : {type: DataTypes.STRING, defaultValue: ''},
        gender    : {type: DataTypes.STRING, defaultValue: ''},
        location  : {type: DataTypes.STRING, defaultValue: ''},
        about     : {type: DataTypes.TEXT, defaultValue: ''},
        tagline   : {type: DataTypes.STRING, defaultValue: ''},
        feedEnabled: {type: DataTypes.BOOLEAN, defaultValue: true},
        adsEnabled: {type: DataTypes.BOOLEAN, defaultValue: true},
        recentActivitiesEnabled: {type: DataTypes.BOOLEAN, defaultValue: true},
        bankDetails: DataTypes.TEXT,
        passwordResetKey: DataTypes.TEXT,
        locationCords: {type: DataTypes.STRING, defaultValue: ''},
        visible: {type: DataTypes.BOOLEAN, defaultValue: true}
    },{
        defaultScope: {
          attributes: { exclude: [] },
        },
        scopes: {
          public: {
           attributes: { exclude: ['passwordResetKey', 'password', 'feedEnabled', 'adsEnabled', 'recentActivitiesEnabled','gender', 'email', 'createdAt', 'updatedAt', 'phone', 'location', 'bankDetails', 'locationCords'] },
          },
          visible: {
            where: {
              visible: {
                [op.eq]: true
              }
            }
          }
        },
    });

    Model.associate = function(models){
        this.myFriends = this.belongsToMany(models.User, {as: 'myFriends', foreignKey: 'UserId', through: models.Friendship});
        this.othersFriend = this.belongsToMany(models.User, {as: 'othersFriend', foreignKey: 'FriendId', through: models.Friendship});
        this.Posts = this.belongsToMany(models.Posts, {through: 'UserPosts', onDelete: 'CASCADE'});
        this.Comments = this.belongsToMany(models.Comments, {through: 'UserComments', onDelete: 'CASCADE'});
        this.Questions = this.belongsToMany(models.Questions, {through: 'UserQuestions', onDelete: 'CASCADE'});
        this.AdOptions = this.belongsToMany(models.AdOptions, {through: 'UserAdOptions', onDelete: 'CASCADE'});
        this.Tags = this.belongsToMany(models.Tags, {through: 'UserTags', onDelete: 'CASCADE'});
        this.Likes = this.belongsToMany(models.Likes, {through: 'UserLikes', onDelete: 'CASCADE'});
        this.Images = this.belongsToMany(models.Images, {through: 'UserImages', onDelete: 'CASCADE'});
        this.Videos = this.belongsToMany(models.Videos, {through: 'UserVideos', onDelete: 'CASCADE'});
        this.Notifications = this.hasMany(models.Notifications, {as: 'sender', foreignKey: 'fromId', onDelete: 'CASCADE'});
        this.Notifications = this.hasMany(models.Notifications, {as: 'receiver', foreignKey: 'toId', onDelete: 'CASCADE'});
        this.ConsumedAds = this.hasMany(models.ConsumedAds, {onDelete: 'CASCADE'});
    };

    Model.getFriends = function (uid, acceptedOnly= true) {

        let common_ = {}

        /*
        * return only those records where
        * friend request has actually been 
        * accepted
        */
        if(acceptedOnly) {
            common_.where = {
                accepted: true
            }
        }

        return this.scope('public').find({
            where: {id: uid},
            include: [
                {
                    model: this.scope('public'),
                    as: 'othersFriend',
                    through: common_
                },
                {
                    model: this.scope('public'),
                    as: 'myFriends',
                    through: common_
                }
            ]
        })
          .then ((user) => {
            return new Promise((resolve) => { resolve(user.othersFriend.concat(user.myFriends)) })
          })
          .catch((error) => {
            return new Promise((resolve, reject) => { reject(error) })
          })
    }

    Model.beforeSave(async (user, options) => {
        let err;
        if (user.changed('password')){
            let salt, hash
            [err, salt] = await to(bcrypt.genSalt(10));
            if(err) TE(err.message, true);

            [err, hash] = await to(bcrypt.hash(user.password, salt));
            if(err) TE(err.message, true);

            user.password = hash;
        }
    });

    Model.prototype.comparePassword = async function (pw) {
        let err, pass
        if(!this.password) TE('password not set');

        [err, pass] = await to(bcrypt_p.compare(pw, this.password));
        if(err) TE(err);

        if(!pass) TE('invalid password');

        return this;
    }

    Model.prototype.getJWT = function () {
        let expiration_time = parseInt(CONFIG.jwt_expiration);
        return "Bearer "+jwt.sign({user_id:this.id}, CONFIG.jwt_encryption, {

        //omitting this value so the Token remains valid indefinetly
        /*expiresIn: expiration_time*/

        });
    };

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
