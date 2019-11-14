'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('AudioTracks', {
        title     : DataTypes.STRING,
        description: DataTypes.TEXT,
        genre: DataTypes.INTEGER,
        path: DataTypes.STRING
    });

    Model.associate = function(models){
        this.User = this.belongsTo(models.User, {onDelete: 'CASCADE'});
    };
   
    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
