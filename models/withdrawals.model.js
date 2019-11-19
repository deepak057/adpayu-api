'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('Withdrawals', {
        status: { type: DataTypes.STRING, defaultValue: 'PENDING'},
        totalAmount: DataTypes.FLOAT,
        payableAmount: DataTypes.FLOAT,
        currency: {type: DataTypes.STRING, defaultValue: 'INR'},
        response: DataTypes.TEXT,
        transferId: DataTypes.STRING,
        transferMode: DataTypes.STRING,
        INRPerUSDRate: DataTypes.FLOAT,
        paymentGatewayCharges: DataTypes.FLOAT,
        siteFee: DataTypes.FLOAT,
        phone: {
            type: DataTypes.STRING,
            allowNull: true
        }
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
