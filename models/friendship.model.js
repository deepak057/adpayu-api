'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');
const Sequelize = require('sequelize');
const op = Sequelize.Op;

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('Friendship', {
        accepted: { 
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        }}, {
                scopes: {
                    friends: {
                        where: {accepted: true}
                    }
                }
        });

    /*Model.associate = function(models){
        this.Users = this.belongsToMany(models.User, {onDelete: 'CASCADE', through: 'Friendship'});
    };*/

    function getCommonFriendCondition (userId, FriendId) {
        let ORCondition = [
            {
                userId: userId,
                FriendId: FriendId
            },
            {
                userId: FriendId,
                FriendId: userId
            },
        ]

        return {where: { [op.or]: ORCondition }}
    }

    Model.getFriendship = function (userId, FriendId) {
        return this.findOne(getCommonFriendCondition(userId, FriendId))
    }

    Model.cancelFriendship = function (userId, FriendId) {
         return this.destroy(getCommonFriendCondition(userId, FriendId))
    }

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
