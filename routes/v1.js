const express 			= require('express');
const router 			= express.Router();

const UserController 	= require('../controllers/user.controller');
const PostsController 	= require('../controllers/posts.controller');
const TagsController 	= require('../controllers/tags.controller');
const CommentsController 	= require('../controllers/comments.controller');
const LikesController 	= require('../controllers/likes.controller');
const UploadController 	= require('../controllers/upload.controller');
const FriendsController 	= require('../controllers/friends.controller');
const NotificationsController   = require('../controllers/notifications.controller');
const SearchController   = require('../controllers/search.controller');
const PaymentController   = require('../controllers/payment.controller');

const custom 	        = require('./../middleware/custom');

const passport      	= require('passport');
const path              = require('path');


require('./../middleware/passport')(passport)
/* GET home page. */
router.get('/', function(req, res, next) {
  res.json({status:"success", message:"Parcel Pending API", data:{"version_number":"v1.0.0"}})
});

/** users routes **/
router.post(    '/users',           UserController.create);                                                    // C
router.get(     '/users/:uid',           passport.authenticate('jwt', {session:false}), UserController.get);        // R
router.put(     '/users',           passport.authenticate('jwt', {session:false}), UserController.update);     // U
router.delete(  '/users',           passport.authenticate('jwt', {session:false}), UserController.remove);     // D
router.post(    '/users/login',     UserController.login);

/** Posts routes **/
router.post('/posts',           passport.authenticate('jwt', {session:false}), PostsController.create);        // C
router.get('/posts/:tag',           passport.authenticate('jwt', {session:false}), PostsController.get);        	   // R
router.get('/post/:postId',           passport.authenticate('jwt', {session:false}), PostsController.getPostById);        	   // R
router.get('/posts/timelineFeed/:userId',           passport.authenticate('jwt', {session:false}), PostsController.getTimelineFeed);        	   // R
router.put('/posts',           passport.authenticate('jwt', {session:false}), PostsController.update);         // U
router.delete('/posts',           passport.authenticate('jwt', {session:false}), PostsController.remove);        // D

/** Tags routes**/
router.get('/tags',           passport.authenticate('jwt', {session:false}), TagsController.get);        // R
router.get('/tags/user',           passport.authenticate('jwt', {session:false}), TagsController.getUserTags);        // R
router.get('/tags/browse',           passport.authenticate('jwt', {session:false}), TagsController.browseTags);        // R
router.put('/tags/follow/:tagId',           passport.authenticate('jwt', {session:false}), TagsController.follow);        // R
router.delete('/tags/unfollow/:tagId',           passport.authenticate('jwt', {session:false}), TagsController.unfollow);        // R

/** Comments routes**/
router.post('/comments/:postId',           passport.authenticate('jwt', {session:false}), CommentsController.create);        // C
router.delete('/comments/:postId',           passport.authenticate('jwt', {session:false}), CommentsController.remove);        // C

/** Likes routes**/
router.post('/like/post/:postId',           passport.authenticate('jwt', {session:false}), LikesController.createPostLike);        // C
router.delete('/like/post/:postId',           passport.authenticate('jwt', {session:false}), LikesController.removePostLike);        // C
router.post('/like/comment/:commentId',           passport.authenticate('jwt', {session:false}), LikesController.createCommentLike);        // C
router.delete('/like/comment/:commentId',           passport.authenticate('jwt', {session:false}), LikesController.removeCommentLike);        // C

/** Image Upload routes**/
router.post('/upload/image/',   passport.authenticate('jwt', {session:false}),  UploadController.uploadImage);        // C
router.post('/upload/video/',   passport.authenticate('jwt', {session:false}),  UploadController.uploadVideo);      // C
router.post('/upload/profilePicture/',   passport.authenticate('jwt', {session:false}),  UploadController.uploadUserProfilePic);        // C

/** Freinds routes**/
router.get('/friends/',   passport.authenticate('jwt', {session:false}),  FriendsController.get);        // G
router.post('/friends/request/:friendId',   passport.authenticate('jwt', {session:false}),  FriendsController.create);        // C
router.put('/friends/add/:friendId',   passport.authenticate('jwt', {session:false}),  FriendsController.add);        // U
router.delete('/friends/remove/:friendId',   passport.authenticate('jwt', {session:false}),  FriendsController.remove);        // D


/** Notifications routes**/
router.get('/notifications',   passport.authenticate('jwt', {session:false}),  NotificationsController.get);        // C
router.put('/notifications/markSeen',   passport.authenticate('jwt', {session:false}),  NotificationsController.markSeen);        // U

/** Search routes**/
router.get('/search/:type',   passport.authenticate('jwt', {session:false}),  SearchController.get);        // R

/** Payment routes**/
router.get('/payment/getToken',   passport.authenticate('jwt', {session:false}),  PaymentController.getToken);        // R
router.post('/payment/processResponse',  PaymentController.processResponse);        // P
router.get('/payment/checkOrderStatus/:orderId',   passport.authenticate('jwt', {session:false}),  PaymentController.checkOrderStatus);        // R

//********* API DOCUMENTATION **********
router.use('/docs/api.json',            express.static(path.join(__dirname, '/../public/v1/documentation/api.json')));
router.use('/docs',                     express.static(path.join(__dirname, '/../public/v1/documentation/dist')));
module.exports = router;
