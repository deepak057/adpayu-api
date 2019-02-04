'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('Orders', {
        status: { type: DataTypes.ENUM('pending', 'success', 'failed'), defaultValue: 'pending'},
        amount: DataTypes.FLOAT,
        currency: {type: DataTypes.STRING, defaultValue: 'INR'},
        message: DataTypes.STRING,
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
