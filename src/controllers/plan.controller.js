"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/ApiResponse");
const Plan = require("../models/Plan");
const Learner = require("../models/Learner");
const { recordAudit } = require("../services/auditLog.service");

const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const plans = await Plan.find(filter).sort({ createdAt: -1 });
  sendSuccess(res, { data: plans });
});

const create = asyncHandler(async (req, res) => {
  const { name, durationValue, durationUnit, price, status, description, benefits } = req.body;

  const plan = await Plan.create({
    name,
    durationValue,
    durationUnit,
    price,
    status,
    description,
    benefits
  });

  await recordAudit({ req, action: "plan.create", targetType: "plan", targetId: plan.id });

  sendSuccess(res, { statusCode: 201, message: "Membership plan created successfully.", data: plan });
});

const update = asyncHandler(async (req, res) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) throw ApiError.notFound("Membership plan not found.");

  const fields = ["name", "durationValue", "durationUnit", "price", "status", "description", "benefits"];
  fields.forEach((field) => {
    if (req.body[field] !== undefined) plan[field] = req.body[field];
  });

  await plan.save();

  // Keep the denormalized plan-name snapshot on learners in sync.
  if (req.body.name) {
    await Learner.updateMany({ "membership.planId": plan._id }, { $set: { "membership.planName": plan.name } });
  }

  await recordAudit({ req, action: "plan.update", targetType: "plan", targetId: plan.id, metadata: { fields: Object.keys(req.body) } });

  sendSuccess(res, { message: "Membership plan updated successfully.", data: plan });
});

module.exports = { list, create, update };
