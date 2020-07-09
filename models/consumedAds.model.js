'use strict';
const bcrypt            = require('bcrypt');
const bcrypt_p          = require('bcrypt-promise');
const jwt               = require('jsonwebtoken');
const {TE, to}          = require('../services/util.service');
const CONFIG            = require('../config/config');
const {roundTwoDecimalPlaces } = require('../services/util.service');

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('ConsumedAds', {
        action: {
            type:   DataTypes.ENUM,
            values: ['impression', 'click', 'view', 'videoComment'],
            defaultValue: 'impression'
        },
        amountUSD: DataTypes.FLOAT,
        settled: {
            type: DataTypes.BOOLEAN,
            defaultValue: 0
        }
    });

    Model.getUserTotal = function (uid) {
        return this.find({
            attributes: [[sequelize.fn('sum', sequelize.col('amountUSD')), 'total']],
            where: {
                UserId: uid,
                settled: 0
            },
            raw: true

        })
          .then ((data) => {
            return new Promise((resolve) => { 
                //fixing the total to 4 decimal places
                resolve(data.total? data.total.toFixed(4) : 0) 
            })
          })
          .catch((error) => {
            return new Promise((resolve, reject) => { reject(error) })
          })
    }

    Model.associate = function(models){
        this.User = this.belongsTo(models.User, {onDelete: 'CASCADE'});
        this.Post = this.belongsTo(models.Posts, {onDelete: 'CASCADE'});
        this.Comment = this.belongsTo(models.Comments, {onDelete: 'CASCADE'});
    };

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
