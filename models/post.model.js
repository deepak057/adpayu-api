'use strict';
const bcrypt 			= require('bcrypt');
const bcrypt_p 			= require('bcrypt-promise');
const jwt           	= require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('Posts', {
        type     : DataTypes.STRING,
        content  : DataTypes.STRING,
        tags     : {type: DataTypes.TEXT, allowNull: true},
        imgs     : {type: DataTypes.TEXT, allowNull: true},
        adOptions  : DataTypes.STRING,
        question  : DataTypes.STRING,
        video  : DataTypes.STRING,
        show  : DataTypes.STRING,
        likes  : DataTypes.STRING,
        showComments  : DataTypes.STRING,
        uid: DataTypes.BIGINT,

    });

    Model.associate = function(models){
        this.User = this.belongsTo(models.User, {through: 'UserPosts', as: 'user'});
    };
   

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
