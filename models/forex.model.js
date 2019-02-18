'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('Forex', {
        USD: {type: DataTypes.FLOAT, defaultValue: 1},
        INR: DataTypes.FLOAT
    }, {

        //prevent Sequelize from adding "s" to the table name
        freezeTableName: true
    });

    Model.associate = function(models){
    };

    Model.getUSD2INR = function () {
        return this.find({where: {USD: 1}})
          .then ((forex) => {
            return new Promise((resolve) => { resolve(forex.INR) })
          })
          .catch((error) => {
            return new Promise((resolve, reject) => { reject(error) })
          })
    }

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
