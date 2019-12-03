'use strict';

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('EditedVideos', {
    });

    Model.associate = function(models){
        this.User = this.belongsTo(models.User, {onDelete: 'CASCADE'});
        this.Comment = this.belongsTo(models.Comments, {onDelete: 'CASCADE'});
        this.Post = this.belongsTo(models.Posts, {onDelete: 'CASCADE'});
        this.AudioTrack = this.belongsTo(models.AudioTracks, {onDelete: 'CASCADE'});
    };

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
