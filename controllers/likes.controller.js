const { Likes, Posts, User, Comments } = require('../models');
const { to, ReE, ReS, isEmptyObject } = require('../services/util.service');
const Sequelize = require('sequelize');

const Op = Sequelize.Op;

const createPostLike =  function(req, res){

}
module.exports.createPostLike = createPostLike;

const removePostLike = async function(req, res){
    
}
module.exports.removePostLike = removePostLike;

const createCommentLike = async function(req, res){
    
}
module.exports.createCommentLike = createCommentLike;

const removeCommentLike = async function(req, res){
    
}
module.exports.removeCommentLike = removeCommentLike;