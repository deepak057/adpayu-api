'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');
const Sequelize = require('sequelize');
const op = Sequelize.Op;

function defaultScope () {
  return {
    where: {
      deleted: {
        [op.eq]: false
      }
    }
 }
}

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('Comments', {
        type     : DataTypes.STRING,
        comment: DataTypes.TEXT,
        videoPath: {type: DataTypes.STRING, defaultValue: ''},
        videoOptimized: {type: DataTypes.BOOLEAN, defaultValue: false},
        failedProcessingAttempts: {type: DataTypes.INTEGER, defaultValue: 0},
        deleted: {type: DataTypes.BOOLEAN, defaultValue: false},
        disableOnMainFeed: {type: DataTypes.BOOLEAN, defaultValue: true}
        /*setDefault: {
          type: Sequelize.VIRTUAL,
          get () {
            return false
          }
        }*/
    }, {
         defaultScope: defaultScope(),
         scopes: {

            /* This scope will ommit the comments which are  
            *  not enabled on Main Feed
            */
            ExcludedCommentsOnMainFeed: function () {
                return {
                    where: {
                      disableOnMainFeed: {
                        [op.eq]: false
                      } 
                    }
                }
            },
            defaultScopeCopy: defaultScope()
          }  
        
       });

    Model.associate = function(models){
        this.Post = this.belongsTo(models.Posts, {onDelete: 'CASCADE'});
        this.User = this.belongsTo(models.User, {onDelete: 'CASCADE'});
        this.Likes = this.belongsToMany(models.Likes, {through: 'CommentLikes', onDelete: 'CASCADE'});
        this.ConsumedAds = this.hasMany(models.ConsumedAds, { onDelete: 'CASCADE'});
        this.ViewedEntities = this.hasMany(models.ViewedEntities, {onDelete: 'CASCADE'});
        this.Reactions = this.hasMany(models.Reactions, {onDelete: 'CASCADE'});
    };
   

     Model.prototype.toWeb = function (user) {
        let json = this.toJSON();

        return json;
    };
    
    return Model;
};
