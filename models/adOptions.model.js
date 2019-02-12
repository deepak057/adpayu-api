'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('AdOptions', {
        postIsAd: { type: DataTypes.BOOLEAN, defaultValue: true},
        cpc     : DataTypes.FLOAT,
        cpv     : DataTypes. FLOAT,
        cpi		: DataTypes.FLOAT,
        impressionTarget: DataTypes.INTEGER,
        clickTarget: DataTypes.INTEGER,
        viewTarget: DataTypes.INTEGER,
        adLink: DataTypes.STRING,
        adLinkLabel: DataTypes.STRING,
        adCountries: DataTypes.TEXT
    });

    Model.associate = function(models){
        this.User = this.belongsTo(models.User, {onDelete: 'CASCADE'});
        this.Order = this.belongsTo(models.Orders, {onDelete: 'CASCADE'});
    };
   

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
