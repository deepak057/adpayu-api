const { ConsumedAds, Posts, AdOptions, AdArchives, Orders, AdStats } = require('../models');
const { to, ReE, ReS } = require('../services/util.service');
const { ADS } = require('../config/app-constants');
const Sequelize = require('sequelize');
const op = Sequelize.Op;
const NotificationsController   = require('./notifications.controller');
const { NOTIFICATIONS } = require('../config/app-constants');

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

	  let postId = req.params.postId, action = req.params.action || 'impression' , post, err, user = req.user, adConsumed;

	  // make sure a valid PostId is sent by the client
	  // and that the ad post is not created by the current user
	  [err, post] = await to(Posts.find(getPostDBCriteria(postId, user)));
      if(err) {
      	console.log(err)
      	throw new Error('Post/ad not found');
      }

      if (canProceed(post, action)) {

	  	[err, adConsumed] = await to(ConsumedAds.find({where: { PostId: postId, UserId: user.id, action: action}}));
      	if(err) {
      	  console.log(err)
      	  throw new Error('Something went wrong');
        } else {
        	if (!adConsumed) {
        		ConsumedAds.create({
        			action: action,
        			amountUSD: getAdAmount(post, action)
        		})
        		  .then ((adConsumedObj) => {
        		  	adConsumedObj.setPost(post);
        		  	adConsumedObj.setUser(user);

        		  	//update the Ad Stats and send response to client
        		  	updateAdStats (post, action)
        		  	  .then ((adStat) => {
        		  	  	
        		  	  	//get the ad consumption 
        		  	  	// records and send them to client
        		  	  	ConsumedAds.findAll({where: {
        		  	  		PostId: post.id,
        		  	  		UserId: user.id
        		  	  	}})
        		  	  	  .then ((consumedAdsObjs) => {

        		  	  	  	//finally, run the post ad asumption checks
        		  	  	  	postAdConsumptionChecks(postId, user);

        		  	  	  	return ReS(res, {
		                      success: true,
		                      message: action + ' successfull',
		                      ConsumedAds: consumedAdsObjs,
		                      alreadyConsumed: false
		    	            }, 200);
        		  	  	  })
        		  	  	  .catch ((err) => {
        		  	        console.log(err)
      	  			        throw new Error('Something went wrong while getting the Ad consumption records');
        		          })
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
	             message: action + ' has been done already',
	             alreadyConsumed: true
	    	   }, 200);
        	}
        }

      } else {
      	throw new Error('Can not proceed to crediting amount as ad might have acheived its targets');
      }

	} catch (err) {
		console.log(err)
		return ReE(res, {success: false, error: 'Something went wrong while attempting to complete the action'}, 422);
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

	// check the stats only if adstats exist
	// else return true becuase AdStats will
	// be null only if this ad is being seen
	// for the very first time
	if (adStats) {
		switch (action) {
			case 'impression':
			  return Number(adconfig.impressionTarget) ? Number(adStats.impressions) < Number(adconfig.impressionTarget): false
			case 'click':
			  return Number(adconfig.clickTarget) ? Number(adStats.clicks) < Number(adconfig.clickTarget): false
			case 'view':
			  return Number(adconfig.viewTarget) ? Number(adStats.views) < Number(adconfig.viewTarget): false
			default:
			  throw new Error ('Not a valid ad action provided while checking the ad targets')
			  return false
		}
	} else {
		return true;
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
		  	return new Promise((resolve) => { 
		  		// associate the AdOption with this 
		  		// new AdStat record
		  		post.AdOption.setAdStat(AdStat)
		  		resolve(AdStat) 
		  	})
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
			  break;
			case 'click':
			  if (adconfig.clickTarget) {
			  	save.clicks = incrementStatValue(adStats? adStats.clicks: false)
			  	save.cpcTotal = incrementStatValue(adStats? adStats.cpcTotal: false, adconfig.cpc)
			  }
			  break;
			case 'view':
			   if (adconfig.viewTarget) {
			   	 save.views = incrementStatValue(adStats? adStats.views: false)
			     save.cpvTotal = incrementStatValue(adStats? adStats.cpvTotal: false, adconfig.cpv)
			   }
			   break;
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
* function to return the database
* criteria for fidning Post Object in
*/

function getPostDBCriteria (postId, user) {
  return {
	where: {
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
  }
}


/*
* function to check ad targets 
* after the ad consumption 
*/

async function postAdConsumptionChecks (postId, user) {
  
  try {
  	let post, err;
	  [err, post] = await to(Posts.find(getPostDBCriteria(postId, user)));
	  if(err) {
	  	console.log(err)
	  	throw new Error('Post/ad not found');
	  } else {
	  	if (!canProceed(post, 'impression') && canProceed(post, 'click')){
		} else if (!canProceed(post, 'impression') && canProceed(post, 'view')) {
		} else if (!canProceed(post, 'impression') && !canProceed(post, 'click') && !canProceed(post, 'view')){
			archiveAdConfiguration (post, user);
		}
	  }
  } catch (err) {
	console.log(err)
	return ReE(res, {success: false, error: 'Something went wrong while doing the post ad asumption checks'}, 422);
  }
}

/*
* function to check if all the ad targets are acheived
* then simply remove the AdConfiguration from the post
* and turn this ad post into a normal post
*/

function archiveAdConfiguration (post, user) {
	let adConfig = post.AdOption
	AdArchives.create({AdOptionId: adConfig.id, PostId: post.id})
	  .then((archive) => {
	  	//remove the Post configuration and make the post public
	  	Posts.update({AdOptionId: null, public: true}, {where: { id: post.id}})
	  	  .then ((postObj) => {
	  	  	//send Notification to the user about ad completion
	  	  	NotificationsController.create(getNotification(post.id, adConfig.id), false, post.UserId)
	  	  })
	  	  .catch ((pErr) => {
	  	  	console.log(pErr)
	  	  	throw new Error ('Something went wrong while removing the ad configuration')
	  	  })
	  })
	  .catch((err)=> {
	  	console.log(err)
	  	throw new Error ('Something went wrong while archiving the ad config')
	  })
}

function getNotification(postId, adOptionId) {
  return {
    type: NOTIFICATIONS.types.AD_TARGET_COMPLETED,
    meta: JSON.stringify({
      postId: parseInt(postId),
      adOptionId: parseInt(adOptionId),
      postType: 'ad'
    })
  }
}