'use strict';

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('SocialShares', {
        network     : DataTypes.STRING,
        shareObject: DataTypes.TEXT
    });

    Model.associate = function(models){
        this.User = this.belongsTo(models.User, {onDelete: 'CASCADE'});
        this.Comment = this.belongsTo(models.Comments, {onDelete: 'CASCADE'});
        this.Post = this.belongsTo(models.Posts, {onDelete: 'CASCADE'});
    };

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
