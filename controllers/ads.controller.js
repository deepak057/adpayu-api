const { SeenAds, Posts, AdOptions, Orders, AdStats } = require('../models');
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
	  	include: [
		  	{
		  		model: Orders
		  	},
		  	{
		  		model: AdStats
		  	}
	  	]
	  }]
	  }));
      if(err) {
      	console.log(err)
      	throw new Error('Post/ad not found');
      }

      if (canProceed(post, action)) {

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

        		  	//update the Ad Stats and send response to client
        		  	updateAdStats (post, action)
        		  	  .then ((adStat) => {
        		  	  	return ReS(res, {
		                  success: true,
		                  message: action + ' successfull'
		    	        }, 200);
        		  	  })
        		  	  .catch ((err) => {
        		  	    console.log(err)
      	  			    throw new Error('Something went wrong');
        		      })
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
      	throw new Error('Can not proceed to crediting amount as ad might have acheived its targets');
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

function canProceed (post, action) {
	//check if associated Order was successfull and check if Ad has not already exhausted its budget
	return post && post.AdOption.Order && post.AdOption.Order.status === 'SUCCESS' && checkAdTarget (post, action)
}

/*
* function to check if an ad's targtes and budget
* have already been acheived
*/

function checkAdTarget (post, action, updatedAdStats = false) {
	let adconfig = post.AdOption;

	let adStats = updatedAdStats || post.AdOption.AdStat

	switch (action) {
		case 'impression':
		  return Number(adStats.impressions) < Number(adconfig.impressionTarget)
		case 'click':
		  return Number(adStats.clicks) < Number(adconfig.clickTarget)
		case 'views':
		  return Number(adStats.views) < Number(adconfig.viewTarget)
		default:
		  throw new Error ('Not a valid ad action provided while checking the ad targets')
		  return false
	}
}


/*
* function to update the ad stats after
* ad is successfully consumed by an user
*/

async function updateAdStats (post, action) {
	let adconfig = post.AdOption;
	
	let statsData = post.AdOption.AdStat;

	if (statsData) {
		return AdStats.update(getAdStatsValues (adconfig, action, statsData), {where: {id: statsData.id}})
		  .then ((AdStat) => {
		  	return new Promise((resolve) => { resolve(AdStat) })
		  })
		  .catch ((err) => {
		  	console.log(err);
		  	return new Promise((resolve, reject) => { reject(err) })
		  })
	} else {
		return AdStats.create(getAdStatsValues (adconfig, action))
		  .then ((AdStat) => {
		  	return new Promise((resolve) => { resolve(AdStat) })
		  })
		  .catch ((err) => {
		  	console.log(err);
		  	return new Promise((resolve, reject) => { reject(err) })
		  })
	}
}

/*
* function to return an object containig values
* to be save in Ad Stats table
*/
function getAdStatsValues (adconfig, action, adStats = false) {
	let save = {}

	if(adconfig) {
		switch (action) {
			case 'impression':
			  save.impressions = incrementStatValue(adStats? adStats.impressions: false)
			  save.cpiTotal = incrementStatValue(adStats? adStats.cpiTotal: false, adconfig.cpi)
			case 'click':
			  if (adconfig.clickTarget) {
			  	save.clicks = incrementStatValue(adStats? adStats.clicks: false)
			  	save.cpcTotal = incrementStatValue(adStats? adStats.cpcTotal: false, adconfig.cpc)
			  }
			case 'view':
			   if (adconfig.viewTarget) {
			   	 save.views = incrementStatValue(adStats? adStats.views: false)
			     save.cpvTotal = incrementStatValue(adStats? adStats.cpvTotal: false, adconfig.cpv)
			   }
		}
	}

  return save;
}

function incrementStatValue (val, defaultVal = 1) {
	if (val) {
		val = Number(val) + defaultVal
	} else {
		val = defaultVal
	}
	return val
}

/*
* function to get the Ad Stats
* database object if it doesn't exist
* already
*/

async function getAdStats (post, action) {
	let adStats = post.AdOption.AdStat, adStatsNew;
	if (!adStats) {
		let err;
		[err, adStatsNew] = await to(AdStats.create())
	  	if(err) {
	  	  console.log(err)
	  	  throw new Error('Something went wrong while trying to create Ad Stats');
	    } else {
	    	post.AdOption.setAdStat(adStatsNew);
	    	return adStatsNew
	    }
	} else {
		return adStats;
	}
	
}