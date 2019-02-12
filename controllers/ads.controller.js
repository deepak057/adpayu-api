const { to, ReE, ReS } = require('../services/util.service');
const ADS = require('../config/app-constants');

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

