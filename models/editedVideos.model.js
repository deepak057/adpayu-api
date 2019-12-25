'use strict';

module.exports = (sequelize, DataTypes) => {
    var Model = sequelize.define('EditedVideos', {
        trim: {type: DataTypes.TEXT, allowNull: true, defaultValue: ''}
    })

    Model.associate = function(models){
        this.User = this.belongsTo(models.User, {onDelete: 'CASCADE'})
        this.Comment = this.belongsTo(models.Comments, {onDelete: 'CASCADE'})
        this.AudioTrack = this.belongsTo(models.AudioTracks, {onDelete: 'CASCADE'})
        this.Video = this.belongsTo(models.Videos, {onDelete: 'CASCADE'})
    };

    Model.prototype.toWeb = function (pw) {
        let json = this.toJSON();
        return json;
    };

    return Model;
};
