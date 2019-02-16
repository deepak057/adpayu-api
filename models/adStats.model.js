'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('AdStats', {
        cpcTotal     : DataTypes.FLOAT,
        cpvTotal     : DataTypes. FLOAT,
        cpiTotal		: DataTypes.FLOAT,
        impressions: DataTypes.INTEGER,
        clicks: DataTypes.INTEGER,
        views: DataTypes.INTEGER,
    });

    Model.associate = function(models){
    };
   

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
