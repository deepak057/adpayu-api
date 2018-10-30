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
        video  : DataTypes.STRING,
        show  : DataTypes.STRING,
        likes  : DataTypes.STRING,
        showComments  : DataTypes.STRING,
        uid: DataTypes.BIGINT,

    });

    Model.associate = function(models){
        this.User = this.belongsTo(models.User, {onDelete: 'CASCADE'});
        this.Comments = this.belongsToMany(models.Comments, {through: 'PostComments', onDelete: 'CASCADE'});
        this.Question = this.belongsTo(models.Questions, {onDelete: 'CASCADE'});
        this.AdOption = this.belongsTo(models.AdOptions, {onDelete: 'CASCADE'});
        this.Imgs= this.belongsToMany(models.Imgs, {through: 'PostImgs', onDelete: 'CASCADE'});
        this.Tages = this.belongsToMany(models.Tags, {through: 'PostsTags', onDelete: 'CASCADE'})

    };
   

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
