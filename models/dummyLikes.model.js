'use strict';

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('DummyLikes', {
        likesCount: {
            type: DataTypes.INTEGER, 
        }
    });

    Model.associate = function(models){
        this.Comment = this.belongsTo(models.Comments, {onDelete: 'CASCADE'});
        this.Post = this.belongsTo(models.Posts, {onDelete: 'CASCADE'});
        this.User = this.belongsTo(models.User, {onDelete: 'CASCADE'});
    };

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
