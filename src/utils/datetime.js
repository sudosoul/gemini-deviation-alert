
const isoTimestamp = () => {
  const currentDate = new Date();
  const isoTimestamp = currentDate.toISOString();
  
  return isoTimestamp;
}
  
exports.isoTimestamp = isoTimestamp;
