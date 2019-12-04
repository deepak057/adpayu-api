'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');
const Sequelize = require('sequelize');
const op = Sequelize.Op;

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('AudioTracks', {
        name     : DataTypes.STRING,
        description: DataTypes.TEXT,
        genere: DataTypes.INTEGER,
        path: DataTypes.STRING,
        deleted: {type: DataTypes.BOOLEAN, defaultValue: false}
    }, {
        defaultScope:  {
          where: {
            deleted: {
                [op.eq]: false
            }
          }
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
