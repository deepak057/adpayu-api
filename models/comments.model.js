'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');
const Sequelize = require('sequelize');
const op = Sequelize.Op;

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('Comments', {
        type     : DataTypes.STRING,
        comment: DataTypes.TEXT,
        videoPath: {type: DataTypes.STRING, defaultValue: ''},
        videoOptimized: {type: DataTypes.BOOLEAN, defaultValue: false},
        failedProcessingAttempts: {type: DataTypes.INTEGER, defaultValue: 0},
        deleted: {type: DataTypes.BOOLEAN, defaultValue: false},
    }, {
         defaultScope: {
            where: {
              deleted: {
                [op.eq]: false
              }
            }
         } 
       });

    Model.associate = function(models){
        this.Post = this.belongsTo(models.Posts, {onDelete: 'CASCADE'});
        this.User = this.belongsTo(models.User, {onDelete: 'CASCADE'});
        this.Likes = this.belongsToMany(models.Likes, {through: 'CommentLikes', onDelete: 'CASCADE'});
    };
   

     Model.prototype.toWeb = function (user) {
        let json = this.toJSON();

        return json;
    };
    
    return Model;
};
