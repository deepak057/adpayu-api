'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('Orders', {
        status: { type: DataTypes.STRING, defaultValue: 'PENDING'},
        amount: DataTypes.FLOAT,
        currency: {type: DataTypes.STRING, defaultValue: 'INR'},
        response: DataTypes.TEXT,
        message: DataTypes.STRING,
        INRPerUSDRate: DataTypes.FLOAT,
        processingFeePercentage: DataTypes.FLOAT
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
