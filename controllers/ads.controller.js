const { SeenAds, Posts, AdOptions, Orders } = require('../models');
const { to, ReE, ReS } = require('../services/util.service');
const ADS = require('../config/app-constants');
const Sequelize = require('sequelize');
const op = Sequelize.Op;

const defaultOptions = async function(req, res){
	try {
		return ReS(res, {
	             options: ADS.defaultPricing
	    	   }, 200);

	} catch (err) {
		console.log(err)
		return ReE(res, {success: false, error: 'Something went wrong while getting the ad pricing options'}, 422);
	}
}

module.exports.defaultOptions = defaultOptions;

const adConsumed = async function(req, res){
	try {

	  let postId = req.params.postId, action = req.params.action || 'impression' , post, err, user = req.user, seenAd;

	  // make sure a valid PostId is sent by the client
	  // and that the ad post is not created by the current user
	  [err, post] = await to(Posts.find({where: {
	  	id: postId,
	  	UserId: {
	  		[op.ne]: user.id
	  	},
	  	adOptionId: {
	  		[op.ne]: null
	  	}
	  },
	  include: [{
	  	model: AdOptions,
	  	include: [{
	  		model: Orders
	  	}]
	  }]
	  }));
      if(err) {
      	console.log(err)
      	throw new Error('Post/ad not found');
      }

      if (canProceed(post)) {

	  	[err, seenAd] = await to(SeenAds.find({where: { PostId: postId, UserId: user.id, action: action}}));
      	if(err) {
      	  console.log(err)
      	  throw new Error('Something went wrong');
        } else {
        	if (!seenAd) {
        		SeenAds.create({
        			action: action,
        			amountUSD: getAdAmount(post, action)
        		})
        		  .then ((seenAdNew) => {
        		  	seenAdNew.setPost(post);
        		  	seenAdNew.setUser(user);
        		  	return ReS(res, {
		              success: true,
		              message: action + ' successfull'
		    	    }, 200);
        		  })
        		  .catch ((err) => {
        		  	console.log(err)
      	  			throw new Error('Something went wrong');
        		  })
        	} else {
	    		return ReS(res, {
	             success: true,
	             message: action + ' has been done already'
	    	   }, 200);
        	}
        }

      } else {
      	throw new Error('Can not proceed to crediting amount');
      }

	} catch (err) {
		console.log(err)
		return ReE(res, {success: false, error: 'Something went wrong trying to mark this ad as seen'}, 422);
	}
}

module.exports.adConsumed = adConsumed;


/*
* function to calculate the amount in USD
* that will be credited to the user's
* account after they consume the ad
* as per the ad Action
*/

function getAdAmount (post, action) {
	let config = post.AdOption;

	switch (action) {
		case 'impression':
		  return config.cpi
		case 'click':
		  return config.cpc
		 default:
		   return config.cpv
	}
}

/*
* function to perform all the checks
* before starting the process of 
* crediting the amount to user
*/

function canProceed (post) {
	//check if associated Order was successfull
	let order = post && post.AdOption.Order && post.AdOption.Order.status === 'SUCCESS'
	//check if Ad has already exhausted its budget
	return order
}