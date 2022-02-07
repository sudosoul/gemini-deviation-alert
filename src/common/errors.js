// todo - specific error types.. ServerError, ClientError, etc
class CustomError extends Error {
  constructor(message, extras = {}) {
    super(message);
    for (const extra in extras) { 
      this[extra] = extras[extra];
    }
  }
}

exports.CustomError = CustomError;