'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('Comments', {
        type     : DataTypes.STRING,
        comment: DataTypes.TEXT,

    });

    Model.associate = function(models){
        this.Post = this.belongsTo(models.Posts, {onDelete: 'CASCADE'});
        this.User = this.belongsTo(models.User, {onDelete: 'CASCADE'});
        this.Likes = this.belongsToMany(models.Likes, {through: 'CommentLikes', onDelete: 'CASCADE'});
    };
   

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
