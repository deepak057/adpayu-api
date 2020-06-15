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
const AdsController = require('../controllers/ads.controller');
const WithdrawController = require('../controllers/withdraw.controller');
const MailsController = require('../controllers/mails.controller');
const GeneralController = require('../controllers/general.controller');
const VideoController = require('../controllers/video.controller');
const AudioController = require('../controllers/audio.controller');
const SocialSharingController = require('../controllers/socialSharing.controller');
const ReferralController = require('../controllers/ref.controller');
const ReactionsController = require('../controllers/reactions.controller');


const custom 	        = require('./../middleware/custom');

const passport      	= require('passport');
const path              = require('path');


require('./../middleware/passport')(passport)
/* GET home page. */
router.get('/', function(req, res, next) {
  res.json({status:"success", message:"Parcel Pending API", data:{"version_number":"v1.0.0"}})
});

/** users routes **/
router.post(    '/users',           UserController.create);   
router.post(    '/users/sendPasswordResetLink',           UserController.sendPasswordResetLink);                                                    // C
router.get(    '/users/getUserBySecretKey',           UserController.getUserBySecretKey);                                                    // R
router.put(    '/users/updateAccountPassword',           UserController.updateAccountPassword);                                                    // U
router.get(     '/users/:uid',           passport.authenticate('jwt', {session:false}), UserController.get);        // R
router.put(     '/users',           passport.authenticate('jwt', {session:false}), UserController.update);     // U
router.delete(  '/users',           passport.authenticate('jwt', {session:false}), UserController.remove);     // D
router.post(    '/users/login',     UserController.login);
router.get(    '/users/updateAccountStatus/:userId',     UserController.updateAccountStatus); 
router.post(     '/users/getUserRevenue',           passport.authenticate('jwt', {session:false}), UserController.getUserRevenue);        // R
router.put('/users/markAsViewed/', passport.authenticate('jwt', {session:false}), UserController.markAsViewed);        //U
router.put('/users/public/markAsViewed/', UserController.markAsViewed);        //U
router.post('/users/getUserDetails/:userId', passport.authenticate('jwt', {session:false}), UserController.getUserDetails);        //R

/** Posts routes **/
router.post('/posts',           passport.authenticate('jwt', {session:false}), PostsController.create);        // C
router.get('/posts/:tag',           passport.authenticate('jwt', {session:false}), PostsController.get);        	   // R
router.get('/post/:postId',  passport.authenticate('jwt', {session:false}), PostsController.getPostById);        	   // R
router.get('/post/public/:postId',  PostsController.getPostById);        	   // R
router.get('/posts/timelineFeed/:userId',           passport.authenticate('jwt', {session:false}), PostsController.getTimelineFeed);        	   // R
router.put('/posts',           passport.authenticate('jwt', {session:false}), PostsController.update);         // U
router.get('/getPublicPosts', PostsController.getPublicPosts);        	   // R
router.delete('/posts/:postId',           passport.authenticate('jwt', {session:false}), PostsController.remove);        // D

/** Tags routes**/
router.get('/tags',           passport.authenticate('jwt', {session:false}), TagsController.get);        // R
router.get('/tags/user',           passport.authenticate('jwt', {session:false}), TagsController.getUserTags);        // R
router.get('/tags/browse',           passport.authenticate('jwt', {session:false}), TagsController.browseTags);        // R
router.put('/tags/follow/:tagId',           passport.authenticate('jwt', {session:false}), TagsController.follow);        // R
router.delete('/tags/unfollow/:tagId',           passport.authenticate('jwt', {session:false}), TagsController.unfollow);        // R

/** Comments routes**/
router.get('/comments/:postId', passport.authenticate('jwt', {session:false}), CommentsController.get);        // R
router.post('/comments/:postId',           passport.authenticate('jwt', {session:false}), CommentsController.create);        // C
router.put('/comments/edit/:commentId',           passport.authenticate('jwt', {session:false}), CommentsController.edit);        // U
router.delete('/comments/:commentId',           passport.authenticate('jwt', {session:false}), CommentsController.remove);        // D
router.get('/comments/getComment/:commentId', passport.authenticate('jwt', {session:false}), CommentsController.getComment);        // R
router.get('/comments/public/getComment/:commentId', CommentsController.getComment);        // R
router.get('/reviewVideoComment/:commentId', CommentsController.reviewVideoComment);        //U

/** Likes routes**/
router.post('/like/post/:postId',           passport.authenticate('jwt', {session:false}), LikesController.createPostLike);        // C
router.delete('/like/post/:postId',           passport.authenticate('jwt', {session:false}), LikesController.removePostLike);        // C
router.post('/like/comment/:commentId',           passport.authenticate('jwt', {session:false}), LikesController.createCommentLike);        // C
router.delete('/like/comment/:commentId',           passport.authenticate('jwt', {session:false}), LikesController.removeCommentLike);        // C

/** Image Upload routes**/
router.post('/upload/image/',   passport.authenticate('jwt', {session:false}),  UploadController.uploadImage);        // C
router.post('/upload/video/',   passport.authenticate('jwt', {session:false}),  UploadController.uploadVideo);      // C
router.post('/upload/profilePicture/',   passport.authenticate('jwt', {session:false}),  UploadController.uploadUserProfilePic);        // C
router.post('/upload/accountIdentityDocs/',   passport.authenticate('jwt', {session:false}),  UploadController.accountIdentityDocs);        // C
router.delete('/upload/removeFiles/',   passport.authenticate('jwt', {session:false}),  UploadController.removeFiles);        // D

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

/** Ads routes**/
router.get('/ad/defaultOptions',  AdsController.defaultOptions);        // R
router.post('/ad/adConsumed/:action/:postId',   passport.authenticate('jwt', {session:false}),  AdsController.adConsumed);        // C

/** Withdraw routes **/
router.get('/withdraw/overview',   passport.authenticate('jwt', {session:false}),  WithdrawController.withdrawOverview);        // R
router.post('/withdraw',   passport.authenticate('jwt', {session:false}),  WithdrawController.withdraw);        // C

/** Video routes **/
router.put('/video/edit',   passport.authenticate('jwt', {session:false}),  VideoController.edit);        // U

/** Audio routes **/
router.get('/audio/get',   passport.authenticate('jwt', {session:false}),  AudioController.get);        // R
router.get('/audio/getCategories',   passport.authenticate('jwt', {session:false}),  AudioController.getCategories);        // R
router.post('/audio/upload',   passport.authenticate('jwt', {session:false}),  AudioController.upload);        // C
router.delete('/audio/deleteFile/:filePath',   passport.authenticate('jwt', {session:false}),  AudioController.deleteFile);        // D
router.delete('/audio/delete/:trackId',   passport.authenticate('jwt', {session:false}),  AudioController.delete);        // D
router.post('/audio/save',   passport.authenticate('jwt', {session:false}),  AudioController.save);        // C

/** Mails routes **/
router.post('/mails/sendContactMail',  MailsController.sendContactMail);        // P

/** General routes **/
router.post('/general/fakeCommentsLike/:commentId', passport.authenticate('jwt', {session:false}), GeneralController.fakeCommentsLike);        // C
router.post('/general/fakePostLike/:postId', passport.authenticate('jwt', {session:false}), GeneralController.fakePostLike);        // C
router.post('/general/captureScreenshots', passport.authenticate('jwt', {session:false}), GeneralController.captureScreenshots);        // C
router.post('/general/putDefaultTagInAllPosts', passport.authenticate('jwt', {session:false}), GeneralController.putDefaultTagInAllPosts);        // C
router.post('/general/importNames', passport.authenticate('jwt', {session:false}), GeneralController.importNames);        // C
router.post('/general/putRandomProfilePics', passport.authenticate('jwt', {session:false}), GeneralController.putRandomProfilePics);        // C
router.post('/general/moveContentToS3', passport.authenticate('jwt', {session:false}), GeneralController.moveContentToS3);        // C
router.post('/general/fixCommentAssociation', passport.authenticate('jwt', {session:false}), GeneralController.fixCommentAssociation);        // U
router.post('/general/changeCommentAssociation/:commentId', passport.authenticate('jwt', {session:false}), GeneralController.changeCommentAssociation);        // U
router.post('/general/optimizeImages/', passport.authenticate('jwt', {session:false}), GeneralController.optimizeImages);        // U
router.post('/general/updateVideoThumb/:videoType/:id', passport.authenticate('jwt', {session:false}), GeneralController.updateVideoThumb);        // U

//router.get('/general/fakeIpRequests/', GeneralController.fakeIpRequests);        // R

/** Social Sharing routes **/
router.post('/socialSharing/track/', passport.authenticate('jwt', {session:false}), SocialSharingController.trackSharing);        // U

/** Referral routes **/
router.get('/referral/getRefCode', passport.authenticate('jwt', {session:false}), ReferralController.getRefCode);        // R
router.get('/referral/getUserReferralDetails', passport.authenticate('jwt', {session:false}), ReferralController.getUserReferralDetails);        // R

/** Reactions routes **/
router.get('/reactions/:commentId', passport.authenticate('jwt', {session:false}), ReactionsController.get);        // R
router.post('/reactions/:commentId', passport.authenticate('jwt', {session:false}), ReactionsController.create);        // P
router.delete('/reactions/:reactionId', passport.authenticate('jwt', {session:false}), ReactionsController.remove);        // D

//********* API DOCUMENTATION **********
router.use('/docs/api.json',            express.static(path.join(__dirname, '/../public/v1/documentation/api.json')));
router.use('/docs',                     express.static(path.join(__dirname, '/../public/v1/documentation/dist')));
module.exports = router;
