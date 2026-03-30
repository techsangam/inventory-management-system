require("dotenv").config();
const mongoose=require("mongoose");
const { connectDatabase }=require("../src/config/db");
const User=require("../src/models/User");
const Category=require("../src/models/Category");
const Supplier=require("../src/models/Supplier");
const Location=require("../src/models/Location");
const Product=require("../src/models/Product");
const PurchaseOrder=require("../src/models/PurchaseOrder");
const GoodsReceipt=require("../src/models/GoodsReceipt");
const Issue=require("../src/models/Issue");
const StockTransaction=require("../src/models/StockTransaction");
const Notification=require("../src/models/Notification");
const AuditLog=require("../src/models/AuditLog");
const Setting=require("../src/models/Setting");
const { createMovement, transferStock }=require("../src/services/stock.service");
const { generateNumber }=require("../src/utils/generateNumber");

async function seed(){
  await connectDatabase();
  await Promise.all([
    GoodsReceipt.deleteMany({}),
    PurchaseOrder.deleteMany({}),
    Issue.deleteMany({}),
    StockTransaction.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
    Product.deleteMany({}),
    Supplier.deleteMany({}),
    Category.deleteMany({}),
    Location.deleteMany({}),
    User.deleteMany({}),
    Setting.deleteMany({})
  ]);

  const settings=await Setting.create({
    companyName:"Northstar Inventory Hub",
    currency:"USD",
    taxRate:7.5,
    lowStockThreshold:10,
    expiryAlertDays:45,
    units:["pcs","box","strip","bottle","carton"],
    cloudSyncEnabled:true
  });

  const [admin,manager,staff]=await User.create([
    { name:"Admin User", email:"admin@inventory.local", password:"Password123!", role:"Admin" },
    { name:"Manager User", email:"manager@inventory.local", password:"Password123!", role:"Manager" },
    { name:"Staff User", email:"staff@inventory.local", password:"Password123!", role:"Staff" }
  ]);

  const [medicine,consumable,grocery]=await Category.create([
    { name:"Medicine", description:"Pharmacy stock", unit:"box", reorderThreshold:12 },
    { name:"Consumables", description:"Operational materials", unit:"pcs", reorderThreshold:20 },
    { name:"Grocery", description:"Retail items", unit:"pcs", reorderThreshold:15 }
  ]);

  const [warehouse,store,pharmacy]=await Location.create([
    { name:"Central Warehouse", type:"warehouse", address:"Industrial Zone" },
    { name:"Main Store", type:"store", address:"Front Retail Block" },
    { name:"ER Pharmacy", type:"department", address:"Hospital Wing A" }
  ]);

  const [medisupply,globalFoods]=await Supplier.create([
    { name:"MediSupply Labs", contactPerson:"Asha Fernando", phone:"+94 777 200 300", email:"orders@medisupply.test", paymentTerms:"Net 30" },
    { name:"Global Foods Wholesale", contactPerson:"Ruwan Perera", phone:"+94 777 444 100", email:"sales@globalfoods.test", paymentTerms:"Net 15" }
  ]);

  const products=await Product.create([
    { name:"Amoxicillin 500mg", sku:"MED-1001", barcode:"8901001001", category:medicine._id, supplier:medisupply._id, purchasePrice:4.2, sellingPrice:6.5, quantity:0, reorderLevel:12, overstockLevel:120, unit:"box", batchNo:"AMX-2401", expiryDate:new Date(new Date().setDate(new Date().getDate()+120)) },
    { name:"Paracetamol 10 Tabs", sku:"MED-1002", barcode:"8901001002", category:medicine._id, supplier:medisupply._id, purchasePrice:1.6, sellingPrice:2.9, quantity:0, reorderLevel:20, overstockLevel:250, unit:"strip", batchNo:"PAR-2410", expiryDate:new Date(new Date().setDate(new Date().getDate()+80)) },
    { name:"Surgical Gloves", sku:"CON-2001", barcode:"8902002001", category:consumable._id, supplier:medisupply._id, purchasePrice:0.5, sellingPrice:0.95, quantity:0, reorderLevel:50, overstockLevel:1000, unit:"pcs" },
    { name:"Mineral Water 1L", sku:"GRO-3001", barcode:"8903003001", category:grocery._id, supplier:globalFoods._id, purchasePrice:0.4, sellingPrice:0.9, quantity:0, reorderLevel:30, overstockLevel:600, unit:"bottle" }
  ]);

  await createMovement({ productId:products[0]._id, locationId:warehouse._id, quantity:60, type:"in", reason:"Seed stock", referenceType:"Seed", userId:admin._id, batchNo:"AMX-2401", expiryDate:products[0].expiryDate });
  await createMovement({ productId:products[1]._id, locationId:warehouse._id, quantity:90, type:"in", reason:"Seed stock", referenceType:"Seed", userId:admin._id, batchNo:"PAR-2410", expiryDate:products[1].expiryDate });
  await createMovement({ productId:products[2]._id, locationId:warehouse._id, quantity:240, type:"in", reason:"Seed stock", referenceType:"Seed", userId:admin._id });
  await createMovement({ productId:products[3]._id, locationId:warehouse._id, quantity:180, type:"in", reason:"Seed stock", referenceType:"Seed", userId:admin._id });
  await transferStock({ productId:products[0]._id, sourceLocationId:warehouse._id, targetLocationId:pharmacy._id, quantity:20, reason:"Seed transfer", referenceType:"Seed", userId:admin._id });
  await transferStock({ productId:products[3]._id, sourceLocationId:warehouse._id, targetLocationId:store._id, quantity:50, reason:"Seed transfer", referenceType:"Seed", userId:admin._id });

  const po=await PurchaseOrder.create({
    poNumber:generateNumber("PO"),
    supplier:medisupply._id,
    expectedDate:new Date(),
    status:"completed",
    items:[
      { product:products[0]._id, itemName:products[0].name, sku:products[0].sku, orderedQty:30, receivedQty:30, costPrice:products[0].purchasePrice, location:warehouse._id, batchNo:"AMX-2401", expiryDate:products[0].expiryDate },
      { product:products[2]._id, itemName:products[2].name, sku:products[2].sku, orderedQty:100, receivedQty:100, costPrice:products[2].purchasePrice, location:warehouse._id }
    ],
    subtotal:176,
    tax:13.2,
    total:189.2,
    approvedBy:manager._id,
    createdBy:staff._id
  });

  await GoodsReceipt.create({
    grnNumber:generateNumber("GRN"),
    purchaseOrder:po._id,
    supplier:medisupply._id,
    items:[
      { product:products[0]._id, receivedQty:30, costPrice:products[0].purchasePrice, batchNo:"AMX-2401", expiryDate:products[0].expiryDate, location:warehouse._id },
      { product:products[2]._id, receivedQty:100, costPrice:products[2].purchasePrice, location:warehouse._id }
    ],
    receivedBy:manager._id
  });

  const sale=await Issue.create({
    issueNumber:generateNumber("SAL"),
    type:"sale",
    destination:"Front counter",
    sourceLocation:store._id,
    status:"completed",
    items:[{ product:products[3]._id, quantity:12, sellingPrice:0.9, costPrice:0.4, batchNo:"" }],
    subtotal:10.8,
    tax:0,
    total:10.8,
    approvedBy:manager._id,
    createdBy:staff._id
  });
  await createMovement({ productId:products[3]._id, locationId:store._id, quantity:12, type:"out", reason:"Seed sale", referenceType:"Issue", referenceId:sale._id, userId:manager._id });

  const deptIssue=await Issue.create({
    issueNumber:generateNumber("ISS"),
    type:"issue",
    destination:"Emergency Ward",
    sourceLocation:pharmacy._id,
    status:"completed",
    items:[{ product:products[0]._id, quantity:6, sellingPrice:0, costPrice:products[0].purchasePrice, batchNo:"AMX-2401" }],
    subtotal:0,
    tax:0,
    total:0,
    approvedBy:manager._id,
    createdBy:staff._id
  });
  await createMovement({ productId:products[0]._id, locationId:pharmacy._id, quantity:6, type:"out", reason:"Seed department issue", referenceType:"Issue", referenceId:deptIssue._id, userId:manager._id, batchNo:"AMX-2401" });

  console.log("Seed complete");
  console.log(`Company: ${settings.companyName}`);
  console.log("Admin: admin@inventory.local / Password123!");
  console.log("Manager: manager@inventory.local / Password123!");
  console.log("Staff: staff@inventory.local / Password123!");
}

seed().then(()=>mongoose.disconnect()).catch(async(error)=>{console.error(error);await mongoose.disconnect();process.exit(1);});
