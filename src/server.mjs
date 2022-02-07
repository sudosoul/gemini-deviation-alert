// Import dependencies 
import * as http from 'http';
import * as URL from 'url';
import * as ss from 'simple-statistics';              // https://github.com/simple-statistics/simple-statistics
import axios from 'axios';                            // https://github.com/axios/axios
import { CustomError } from './common/errors.js';
import { log } from './utils/logger.js';
import { isoTimestamp } from './utils/datetime.js';

// Set globals/constants/configs
const DEFAULT_SERVER_PORT = 7777
let { SERVER_PORT } = process.env
if (!SERVER_PORT) {
  log(`SERVER_PORT environment variable not set, defaulting to ${DEFAULT_SERVER_PORT}`, 'i');
  SERVER_PORT = DEFAULT_SERVER_PORT;
}
let validtradingPairs;

//** Entry point for all requests -- for simplicity, responds to any url route */ 
const requestListener = async (request, response) => {
  log(`${request.method}  ${request.url}`);

  let alertResponseBody, httpStatusCode;
  try {
    validateAlertRequest(request);
    alertResponseBody = await handleAlertRequest(request);
    httpStatusCode = 200;
  } catch(error) {
    log(`Could not handle request: ${error.message}`, 'e');
    httpStatusCode = error?.httpStatusCode ? error.httpStatusCode : 500
    alertResponseBody = {
      timestamp: isoTimestamp(),
      level: 'ERROR',
      data: {
        result: 'error',
        reason: error.reason ? error.reason : 'unknownErrorReason',
        message: error.message
      }
    };
  }

  // Send response
  response.writeHead(httpStatusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(alertResponseBody));
}

/**
 * 
 * @param {request} request - The request object from HTTP listener callback
 * @throws CustomError - If request is 400 invalid
 */
function validateAlertRequest(request) {
  const { method: requestMethod, url } = request;
  let { query: { deviation, tradingPairs } } = URL.parse(url, true);
  
  if (requestMethod !== 'GET') {
    throw new CustomError('Request method must be GET', { reason: 'invalidRequest', httpStatusCode: 400});
  // Check QS params set
  } else if (!tradingPairs || !deviation) {
    throw new CustomError(
      'Missing required query string params, see docs', 
      { reason: 'invalidRequest', httpStatusCode: 400}
    );
  // Is deviation a valid number?
  } else if (typeof Number.parseFloat(deviation) !== 'number' && deviation < 0) {
    throw new CustomError(
      `Value for deviation param must be a positive number, got ${deviation}`, 
      { reason: 'invalidRequest', httpStatusCode: 400}
    );
  // Validate the tradingPairs QS param
  } else {
    // Single string value provided, ensure valid
    if (!tradingPairs.includes(',')) {
      if (tradingPairs.toLowerCase() !== 'all' && (validtradingPairs.indexOf(tradingPairs) < 0)) {
        throw new CustomError(
          `Value for tradingPairs param must 'ALL' or a list of 1 or \
          more valid tradingPairs got ${tradingPairs}`, 
          { reason: 'invalidRequest', httpStatusCode: 400}
        );
      }
    // Comma separated list provided, make sure they are all valid, else fail. TODO, exclude invalid entries
    } else {
      tradingPairs = tradingPairs.split(','); // string -> array
      for (const tradingPair of tradingPairs) {
        if (validtradingPairs.indexOf(tradingPair) < 0) {
          throw new CustomError(`${tradingPair} is not a valid entry`, { reason: 'invalidRequest', httpStatusCode: 400});
        }
      }
    }
  }
}

/**
 * 
 * @param {request} request - The request object from HTTP listener callback
 * @returns [alertResponse] - Array containing each trading_price alert response obj.
 */
async function handleAlertRequest(request) {
  let { query: { deviation: deviationThreshold, tradingPairs } } = URL.parse(request.url, true);
  if (tradingPairs.includes(',')) {
    tradingPairs = tradingPairs.split(','); // string -> array
  } else if (tradingPairs.toLowerCase() === 'all') {
    tradingPairs = validtradingPairs;
  } else {
    tradingPairs = [tradingPairs];
  }
  
  const alertResponseBody = [];
  // Async get tradingPair data, interrupt on request finished
  return new Promise(async (resolve, reject) => {
    for (const [index, tradingPair] of tradingPairs.entries()) {
      // Sleep 1 second after every 10 requests to avoid rate limiting
      if ((index + 1) % 10 === 0) await new Promise(resolve => setTimeout(resolve, 1000));
      axios(`https://api.gemini.com/v2/ticker/${tradingPair}`) // HTTP GET
        .then(({data: tradingPairData}) => {
          const priceCalculations = doPriceCalculations(tradingPairData);
          alertResponseBody.push(
            buildAlertResponse(tradingPair, {...tradingPairData, ...priceCalculations}, deviationThreshold)
          );
        }).catch((error) => {
          // Handle non-200 responses
          // TODO would be retry 429, but it isn't an issue with 10rps
          if (error.response) {
            error = new CustomError(error.response.data.message, {reason: 'upstream'});
          }
          alertResponseBody.push(
            buildAlertResponse(tradingPair, error)
          );       
        })
        .finally(() => {
          if (alertResponseBody.length === tradingPairs.length) {

            return resolve(alertResponseBody);

          }
        });
    }
  });
}

/**
 * 
 * @param {GeminiTickerV2Response} tradingPairData - The response obj from Gemini v2 ticker endpoint
 * @returns {Object<Number>} - Object containing calculated 'mean', 'change', and 'priceDeviation' values
 * @throws CustomError - if there is an arithmetic error with simple-statistics library
 */
function doPriceCalculations(tradingPairData) {
  const { changes, close } = tradingPairData;
  changes.push(close); // insert close to end of changes list

  let standardDeviation, mean, priceDeviation, change;
  try {
    const prices = changes.map(Number); // cast each item to Number
    standardDeviation = ss.standardDeviation(prices);
    mean = ss.mean(prices);
    change = Math.abs(mean - prices[prices.length - 1]);  
    priceDeviation = Math.abs(ss.zScore(close, mean, standardDeviation));
    if (change === 0) priceDeviation = 0; // deviation evals to NaN when lastPrice == AVG
  } catch(error) {
    throw new CustomError(error.message, { reason: 'arithmeticError' });
  }

  return { mean, change, priceDeviation };
}

/**
 * 
 * @param {string} tradingPair - The trading pair to build a response for ('btcusd')
 * @param {mixed} tradingPairData - Mixed object of GeminiTickerV2Response & calculations, or CustomError
 * @param {Number} deviationThreshold - the deviation threshold specified by user
 * @returns 
 */
function buildAlertResponse(tradingPair, tradingPairData, deviationThreshold = null) {
  const alertResponse = {
    timestamp: isoTimestamp(),
    level: 'INFO',
    trading_pair: tradingPair
  };
 
  if (tradingPairData instanceof CustomError) {
    const error = tradingPairData;
    alertResponse.level = 'ERROR';
    alertResponse.data = {
      result: 'error',
      reason: error.reason,
      message: error.message
    };
  } else {
    const { priceDeviation, close, change, mean } = tradingPairData;

    alertResponse.deviation = (tradingPairData.priceDeviation > deviationThreshold ? true : false),
    alertResponse.data = {
      last_price: close,
      average: mean.toFixed(4),
      sdev: priceDeviation.toFixed(4),
      change: change.toFixed(4),
    };
  }

  return alertResponse;
}

// Start the server
(async () => {
  try {
    log('Starting up server.', 'i');
    validtradingPairs = (await axios('https://api.gemini.com/v1/symbols')).data;
    http.createServer(requestListener).listen(SERVER_PORT);
    log(`Server successfully running on port ${SERVER_PORT}`, 'i');
  } catch (error) {
    log(`Could not start server: ${error.message}`, 'e');
    exit(1);
  }
})();
