'use strict';
const bcrypt 			= require('bcrypt');
const bcrypt_p 			= require('bcrypt-promise');
const jwt           	= require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');
const Sequelize = require('sequelize');
const op = Sequelize.Op;

function defaultScope () {
    return {
      where: {
        visible: {
            [op.eq]: true
        },
        deleted: {
            [op.eq]: false
        }
      }
    }    
}

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('Posts', {
        type     : DataTypes.STRING,
        content  : DataTypes.TEXT,
        public: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        visible: {type: DataTypes.BOOLEAN, defaultValue: true},
        deleted: {type: DataTypes.BOOLEAN, defaultValue: false},
    }, {

        defaultScope: defaultScope(),
        scopes: {

            /* This scope will ommit the posts on which all the 
            *  answers or comments have been viewed by the given user
            */
            ExcludedViewedPosts: function (uid, showUnAnswerdQuestions = false) {
                return {
                    where: {
                        'abc': Sequelize.literal(" (case when (Posts.type = 'question') then (" + (showUnAnswerdQuestions ? "((select count(*) from Comments where Comments.PostId = Posts.id AND Comments.deleted = 0 AND Comments.disableOnMainFeed = 0) = 0) OR " : "") + "(select count(*) from ViewedEntities where ViewedEntities.CommentId In (select id from Comments where Comments.PostId = Posts.id AND Comments.deleted = 0 AND Comments.disableOnMainFeed = 0) AND ViewedEntities.UserId = " + uid + ") != (select count(*) from Comments where Comments.PostId = Posts.id AND Comments.deleted = 0 AND Comments.disableOnMainFeed = 0)) else 1 end) AND (case when (Posts.type != 'question' AND Posts.AdOptionId IS NULL) then ( (select count(*) from ViewedEntities where ViewedEntities.PostId = Posts.id && ViewedEntities.UserId=" + uid + ") = 0) else 1 end)")
                    }
                }
            },
            
            /*
            * This scope excludes the Posts that have been marked
            * as seen i.e. posts that are sent into user's feed but 
            * they might or might not have be viewed yet
            */
            ExcludSeenPosts: function (uid) {
                return {
                    where: {
                        'xyz': Sequelize.literal("(Posts.id NOT IN (select PostId from SeenPosts where UserId = " + uid + "))")
                    }
                }
            },
            defaultScopeCopy : function () {
                return defaultScope()
            }
        }
    });

    Model.associate = function(models){
        this.User = this.belongsTo(models.User, {onDelete: 'CASCADE'});
        this.Comments = this.belongsToMany(models.Comments, {through: 'PostComments', onDelete: 'CASCADE'});
        this.Question = this.belongsTo(models.Questions, {onDelete: 'CASCADE'});
        this.AdOption = this.belongsTo(models.AdOptions, {onDelete: 'CASCADE'});
        this.Imgs= this.belongsToMany(models.Imgs, {through: 'PostImgs', onDelete: 'CASCADE'});
        this.Tages = this.belongsToMany(models.Tags, {through: 'PostsTags', onDelete: 'CASCADE'})
        this.Likes = this.belongsToMany(models.Likes, {through: 'PostLikes', onDelete: 'CASCADE'});
        this.Images = this.belongsToMany(models.Images, {through: 'PostImages', onDelete: 'CASCADE'});
        this.Video = this.belongsTo(models.Videos, {onDelete: 'CASCADE'});
        this.Comments = this.belongsToMany(models.Comments, {through: 'PostComments', onDelete: 'CASCADE'});
        this.ConsumedAds = this.hasMany(models.ConsumedAds, { onDelete: 'CASCADE'});
        this.PushedAds = this.hasMany(models.PushedAds, { onDelete: 'CASCADE'});
        this.ViewedEntities = this.hasMany(models.ViewedEntities, {onDelete: 'CASCADE'});
    };
   

    Model.prototype.toWeb = function (user) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
