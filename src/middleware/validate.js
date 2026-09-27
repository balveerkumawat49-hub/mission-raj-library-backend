"use strict";

const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

/**
 * Runs an array of express-validator chains, then rejects with a 422 and
 * a field-by-field detail list if any of them failed. Usage:
 *   router.post("/", validate(createLearnerValidators), controller.create)
 */
function validate(validators) {
  return async (req, _res, next) => {
    await Promise.all(validators.map((validator) => validator.run(req)));

    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const details = result.array().map((e) => ({ field: e.path, message: e.msg }));
    next(ApiError.unprocessable("Validation failed.", "VALIDATION_ERROR", details));
  };
}

module.exports = validate;
