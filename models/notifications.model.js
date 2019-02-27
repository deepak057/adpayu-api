'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('Notifications', {
        seen: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        type: DataTypes.STRING,
        meta: DataTypes.TEXT,
        fromId: DataTypes.INTEGER,
        toId: DataTypes.INTEGER,
        postId: DataTypes.BIGINT
    });

    Model.associate = function(models){
        this.User = this.belongsTo(models.User, {as: 'receiver', foreignKey: 'toId', onDelete: 'CASCADE'});
        this.User = this.belongsTo(models.User, {as: 'sender', foreignKey: 'fromId', onDelete: 'CASCADE'});

    };
   

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
