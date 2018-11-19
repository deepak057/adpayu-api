'use strict';
const bcrypt 			= require('bcrypt');
const bcrypt_p 			= require('bcrypt-promise');
const jwt           	= require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('User', {
        first     : DataTypes.STRING,
        last      : DataTypes.STRING,
        email     : {type: DataTypes.STRING, allowNull: true, unique: true, validate: { isEmail: {msg: "Phone number invalid."} }},
        phone     : {type: DataTypes.STRING, allowNull: true, unique: true, validate: { len: {args: [7, 20], msg: "Phone number invalid, too short."}, isNumeric: { msg: "not a valid phone number."} }},
        password  : DataTypes.STRING,
    });

    Model.associate = function(models){
        this.Posts = this.belongsToMany(models.Posts, {through: 'UserPosts', onDelete: 'CASCADE'});
        this.Comments = this.belongsToMany(models.Comments, {through: 'UserComments', onDelete: 'CASCADE'});
        this.Questions = this.belongsToMany(models.Questions, {through: 'UserQuestions', onDelete: 'CASCADE'});
        this.AdOptions = this.belongsToMany(models.AdOptions, {through: 'UserAdOptions', onDelete: 'CASCADE'});
        this.Tags = this.belongsToMany(models.Tags, {through: 'UserTags', onDelete: 'CASCADE'});
        this.Likes = this.belongsToMany(models.Likes, {through: 'UserLikes', onDelete: 'CASCADE'});
        this.Images = this.belongsToMany(models.Images, {through: 'UserImages', onDelete: 'CASCADE'});
    };

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
        return "Bearer "+jwt.sign({user_id:this.id}, CONFIG.jwt_encryption, {expiresIn: expiration_time});
    };

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
