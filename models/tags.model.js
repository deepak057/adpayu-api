'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('Tags', {
        name     : DataTypes.STRING,
        icon     : {type: DataTypes.STRING, defaultValue: 'mdi mdi-tag'},
        UserId: { type: DataTypes.INTEGER}
    });

    Model.associate = function(models){
        this.Users = this.belongsToMany(models.User, {onDelete: 'CASCADE', through: 'UserTags'});
    };
   

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
