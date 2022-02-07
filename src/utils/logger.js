const { isoTimestamp } = require('./datetime');

const log = (message, level) => {
  const logLevel = level == 'd' ? 'DEBUG' : (level == 'e') ? 'ERROR' : (level == 'w') ? 'WARN' : 'INFO'
  let currentDate = new Date();
  currentDate = currentDate.toISOString();
  console.log(`${isoTimestamp()} - ${logLevel} - ${message}.`);
}

exports.log = log;
