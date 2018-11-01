const express 			= require('express');
const router 			= express.Router();

const UserController 	= require('../controllers/user.controller');
const PostsController 	= require('../controllers/posts.controller');
const TagsController 	= require('../controllers/tags.controller');

const CompanyController = require('../controllers/company.controller');
const HomeController 	= require('../controllers/home.controller');

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
router.get(     '/users',           passport.authenticate('jwt', {session:false}), UserController.get);        // R
router.put(     '/users',           passport.authenticate('jwt', {session:false}), UserController.update);     // U
router.delete(  '/users',           passport.authenticate('jwt', {session:false}), UserController.remove);     // D
router.post(    '/users/login',     UserController.login);

/** Posts routes **/
router.post('/posts',           passport.authenticate('jwt', {session:false}), PostsController.create);        // C
router.get('/posts/:tag',           passport.authenticate('jwt', {session:false}), PostsController.get);        	   // R
router.put('/posts',           passport.authenticate('jwt', {session:false}), PostsController.update);         // U
router.delete('/posts',           passport.authenticate('jwt', {session:false}), PostsController.remove);        // D

/** Tags routes**/
router.get('/tags',           passport.authenticate('jwt', {session:false}), TagsController.get);        // R
router.get('/tags/user',           passport.authenticate('jwt', {session:false}), TagsController.getUserTags);        // R


router.post(    '/companies',             passport.authenticate('jwt', {session:false}), CompanyController.create);                  // C
router.get(     '/companies',             passport.authenticate('jwt', {session:false}), CompanyController.getAll);                  // R

router.get(     '/companies/:company_id', passport.authenticate('jwt', {session:false}), custom.company, CompanyController.get);     // R
router.put(     '/companies/:company_id', passport.authenticate('jwt', {session:false}), custom.company, CompanyController.update);  // U
router.delete(  '/companies/:company_id', passport.authenticate('jwt', {session:false}), custom.company, CompanyController.remove);  // D

router.get('/dash', passport.authenticate('jwt', {session:false}),HomeController.Dashboard)


//********* API DOCUMENTATION **********
router.use('/docs/api.json',            express.static(path.join(__dirname, '/../public/v1/documentation/api.json')));
router.use('/docs',                     express.static(path.join(__dirname, '/../public/v1/documentation/dist')));
module.exports = router;
