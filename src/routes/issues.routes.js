const express = require("express");
const Product = require("../models/Product");
const Issue = require("../models/Issue");
const { authorize, requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");
const { generateNumber } = require("../utils/generateNumber");
const { createAuditLog } = require("../services/audit.service");
const { createMovement, transferStock } = require("../services/stock.service");
const { emitAppEvent } = require("../services/eventBus");

const router = express.Router();

function calculateIssueTotals(items, taxRate = 0) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.sellingPrice || 0),
    0
  );
  const tax = Number(((subtotal * Number(taxRate || 0)) / 100).toFixed(2));
  return { subtotal, tax, total: subtotal + tax };
}

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const issues = await Issue.find()
      .populate("sourceLocation", "name")
      .populate("targetLocation", "name")
      .populate("createdBy", "name role")
      .populate("approvedBy", "name")
      .sort({ createdAt: -1 });
    res.json(issues);
  })
);

router.post(
  "/",
  authorize("Admin", "Manager", "Staff"),
  asyncHandler(async (req, res) => {
    const items = [];
    for (const item of req.body.items || []) {
      const product = await Product.findById(item.product);
      items.push({
        product: item.product,
        quantity: Number(item.quantity || 0),
        sellingPrice:
          req.body.type === "sale"
            ? Number(item.sellingPrice || product?.sellingPrice || 0)
            : 0,
        costPrice: Number(item.costPrice || product?.purchasePrice || 0),
        batchNo: item.batchNo || product?.batchNo || ""
      });
    }

    const totals = calculateIssueTotals(items, req.body.taxRate || 0);
    const issue = await Issue.create({
      issueNumber: generateNumber(req.body.type === "sale" ? "SAL" : "ISS"),
      type: req.body.type || "issue",
      destination: req.body.destination || "",
      sourceLocation: req.body.sourceLocation,
      targetLocation: req.body.targetLocation,
      status: req.user.role === "Staff" ? "pending_approval" : req.body.status || "draft",
      items,
      ...totals,
      notes: req.body.notes || "",
      createdBy: req.user._id
    });

    await createAuditLog({
      req,
      action: "CREATE_ISSUE",
      entityType: "Issue",
      entityId: issue._id,
      metadata: { type: issue.type }
    });
    emitAppEvent("issue.created", { issueId: issue._id });
    res.status(201).json(issue);
  })
);

router.patch(
  "/:id/approve",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }
    issue.status = "approved";
    issue.approvedBy = req.user._id;
    await issue.save();

    await createAuditLog({
      req,
      action: "APPROVE_ISSUE",
      entityType: "Issue",
      entityId: issue._id
    });
    res.json(issue);
  })
);

router.patch(
  "/:id/complete",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    for (const item of issue.items) {
      if (issue.type === "transfer") {
        await transferStock({
          productId: item.product,
          sourceLocationId: issue.sourceLocation,
          targetLocationId: issue.targetLocation,
          quantity: item.quantity,
          reason: issue.notes || "Warehouse transfer",
          referenceType: "Issue",
          referenceId: issue._id,
          userId: req.user._id
        });
      } else {
        await createMovement({
          productId: item.product,
          locationId: issue.sourceLocation,
          quantity: item.quantity,
          type: "out",
          reason: issue.type === "sale" ? "Sales dispatch" : "Department issue",
          referenceType: "Issue",
          referenceId: issue._id,
          batchNo: item.batchNo,
          userId: req.user._id
        });
      }
    }

    issue.status = "completed";
    await issue.save();

    await createAuditLog({
      req,
      action: "COMPLETE_ISSUE",
      entityType: "Issue",
      entityId: issue._id
    });

    emitAppEvent("issue.completed", { issueId: issue._id });
    res.json(issue);
  })
);

module.exports = router;
