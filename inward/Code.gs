// =====================================================================
// YASH MARKETING - ENTERPRISE STOCK INWARD OS (Code.gs)
// Includes Multi-Product Inward, High-Speed Photo Vault & Master App SSO
// =====================================================================

var DRIVE_FOLDER_ID = "1uj9sY9b74_Tzm-x_Uu6I4NqGCP2harxJ"; // Yash Marketing Shared Drive Folder

/**
 * Web App Entry Point with Master App Single Sign-On (SSO) Support
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  
  if (e && e.parameter && e.parameter.empId) {
    template.empId = e.parameter.empId;
    template.role = e.parameter.role || '';
  } else {
    template.empId = '';
    template.role = '';
  }
  
  return template.evaluate()
    .setTitle('Yash Marketing - Stock Inward')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper to safely find a sheet by name case-insensitively
 */
function getSheetSafely(ss, targetNames) {
  if (!Array.isArray(targetNames)) targetNames = [targetNames];
  var sheets = ss.getSheets();
  for (var k = 0; k < targetNames.length; k++) {
    var search = targetNames[k].trim().toLowerCase();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().trim().toLowerCase() === search) {
        return sheets[i];
      }
    }
  }
  return null;
}

/**
 * 1. GET DROPDOWN DATA (Catalogue, Staff Master, Transporters)
 */
function getDropdownData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = {
    products: [],
    staffs: [],
    transporters: [
      "VRL Logistics",
      "TCI Express",
      "DTDC",
      "Delhivery",
      "Safechem Logistics",
      "Direct / Self Delivery",
      "Local Courier"
    ]
  };

  try {
    // 1. Fetch Staff Master
    var staffSheet = getSheetSafely(ss, ["Staff Master", "Staff", "Employees", "Users"]);
    if (staffSheet) {
      var staffData = staffSheet.getDataRange().getValues();
      for (var s = 1; s < staffData.length; s++) {
        var row = staffData[s];
        var id = row[0] ? String(row[0]).trim().toLowerCase() : "";
        var pin = row[1] ? String(row[1]).trim() : "";
        var name = row[2] ? String(row[2]).trim() : id;
        if (id) {
          result.staffs.push({ id: id, p: pin, n: name });
        }
      }
    }

    // 2. Fetch Products / Catalogue
    var prodSheet = getSheetSafely(ss, ["Product Master", "Products", "Catalogue", "Stock Master", "Item Master"]);
    if (prodSheet) {
      var prodData = prodSheet.getDataRange().getValues();
      for (var p = 1; p < prodData.length; p++) {
        var pRow = prodData[p];
        var brand = pRow[0] ? String(pRow[0]).trim() : "";
        var cat = pRow[1] ? String(pRow[1]).trim() : "";
        var model = pRow[2] ? String(pRow[2]).trim() : "";
        if (brand && model) {
          result.products.push({ b: brand, c: cat, m: model });
        }
      }
    }

    // 3. Fetch Transporters if dedicated sheet exists
    var transSheet = getSheetSafely(ss, ["Transporters", "Transporter Master", "Transport"]);
    if (transSheet) {
      var transData = transSheet.getDataRange().getValues();
      var customTrans = [];
      for (var t = 1; t < transData.length; t++) {
        var tName = transData[t][0] ? String(transData[t][0]).trim() : "";
        if (tName) customTrans.push(tName);
      }
      if (customTrans.length > 0) result.transporters = customTrans;
    }

  } catch (err) {
    Logger.log("Error in getDropdownData: " + err.message);
  }

  return result;
}

/**
 * Helper to upload Base64 photos directly to Google Drive
 */
function uploadToDrive(base64Payload, folder, prefix) {
  if (!base64Payload || !base64Payload.data) return "-";
  try {
    var decoded = Utilities.base64Decode(base64Payload.data);
    var blob = Utilities.newBlob(decoded, base64Payload.mimeType || "image/jpeg", prefix + "_" + new Date().getTime() + ".jpg");
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    Logger.log("Upload error: " + e.message);
    return "-";
  }
}

/**
 * 2. PROCESS INWARD FORM (High-Speed Batch Save)
 */
function processFormFast(jsonString) {
  try {
    var payload = JSON.parse(jsonString);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Target Stock Inward sheet
    var inwardSheet = getSheetSafely(ss, ["Stock Inward", "Stock_Inward", "Inward", "Inward Records"]);
    if (!inwardSheet) {
      inwardSheet = ss.insertSheet("Stock Inward");
      // Add standard headers
      inwardSheet.appendRow([
        "Timestamp", "Inward Date", "Inward Time", "Invoice No", "Invoice Date", 
        "Staff / Checker", "Transporter", "LR Number", "Total Cartons", 
        "Common Brand", "Category", "Model Name", "Pieces Per Carton", 
        "Actual Qty", "Shortage Qty", "DOA Qty", "Missing Model", "Missing Qty", 
        "Invoice Photos", "Box Photos", "Pavti Photos", "Product Photo"
      ]);
      inwardSheet.getRange(1, 1, 1, 22).setFontWeight("bold").setBackground("#3f51b5").setFontColor("#ffffff");
    }

    // Resolve Drive Folder
    var folder;
    try {
      folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    } catch (e) {
      var rootFolders = DriveApp.getFoldersByName("Yash Marketing Stock Inward Photos");
      folder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder("Yash Marketing Stock Inward Photos");
    }

    // Upload Inward Group Photos
    var invoicePhotoUrls = [];
    if (payload.invoicePhotosB64 && payload.invoicePhotosB64.length) {
      for (var i = 0; i < payload.invoicePhotosB64.length; i++) {
        var url = uploadToDrive(payload.invoicePhotosB64[i], folder, "INV_" + payload.invoiceNo);
        if (url !== "-") invoicePhotoUrls.push(url);
      }
    }

    var boxPhotoUrls = [];
    if (payload.boxPhotosB64 && payload.boxPhotosB64.length) {
      for (var b = 0; b < payload.boxPhotosB64.length; b++) {
        var bUrl = uploadToDrive(payload.boxPhotosB64[b], folder, "BOX_" + payload.invoiceNo);
        if (bUrl !== "-") boxPhotoUrls.push(bUrl);
      }
    }

    var pavtiPhotoUrls = [];
    if (payload.pavtiPhotosB64 && payload.pavtiPhotosB64.length) {
      for (var p = 0; p < payload.pavtiPhotosB64.length; p++) {
        var pUrl = uploadToDrive(payload.pavtiPhotosB64[p], folder, "PAVTI_" + payload.invoiceNo);
        if (pUrl !== "-") pavtiPhotoUrls.push(pUrl);
      }
    }

    var invPhotosStr = invoicePhotoUrls.length ? invoicePhotoUrls.join(" \n ") : "-";
    var boxPhotosStr = boxPhotoUrls.length ? boxPhotoUrls.join(" \n ") : "-";
    var pavtiPhotosStr = pavtiPhotoUrls.length ? pavtiPhotoUrls.join(" \n ") : "-";

    var nowTimestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    var rowsToAppend = [];

    // Process each item
    for (var k = 0; k < payload.items.length; k++) {
      var it = payload.items[k];
      var prodPhotoUrl = "-";
      if (it.productPhotoB64) {
        prodPhotoUrl = uploadToDrive(it.productPhotoB64, folder, "PROD_" + payload.invoiceNo + "_" + it.modelName);
      }

      rowsToAppend.push([
        nowTimestamp,
        payload.inwardDate,
        payload.inwardTime,
        payload.invoiceNo,
        payload.invoiceDate,
        payload.staffName,
        payload.transporter,
        payload.lrNumber,
        payload.masterCartons,
        payload.commonBrand,
        it.category,
        it.modelName,
        Number(it.piecesPerCarton) || 0,
        Number(it.actualQty) || 0,
        it.shortageQty || "0",
        Number(it.doaQty) || 0,
        payload.missingModel || "-",
        payload.missingQty || "0",
        invPhotosStr,
        boxPhotosStr,
        pavtiPhotosStr,
        prodPhotoUrl
      ]);
    }

    if (rowsToAppend.length > 0) {
      var lastRow = inwardSheet.getLastRow();
      inwardSheet.getRange(lastRow + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    }

    return "✅ Stock Inward entry saved successfully! Invoice: " + payload.invoiceNo + " (" + payload.items.length + " items logged)";

  } catch (error) {
    Logger.log("processFormFast Error: " + error.message);
    return "❌ Error saving Stock Inward: " + error.message;
  }
}

/**
 * 3. GET INWARD HISTORY (Cards & Details for View Invoice tab)
 */
function getInwardHistory() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getSheetSafely(ss, ["Stock Inward", "Stock_Inward", "Inward", "Inward Records"]);
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    // Group rows by Invoice Number
    var invoicesMap = {};
    var invoiceOrder = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var invNo = String(row[3]).trim();
      if (!invNo) continue;

      if (!invoicesMap[invNo]) {
        invoicesMap[invNo] = {
          invoice: invNo,
          inwardDate: row[1] ? Utilities.formatDate(new Date(row[1]), Session.getScriptTimeZone(), "yyyy-MM-dd") : "-",
          commonBrand: row[9] || "-",
          transporter: row[6] || "-",
          staff: row[5] || "-",
          missingProd: row[16] || "-",
          missingQty: row[17] || "0",
          invoicePhotos: row[18] || "-",
          boxPhotos: row[19] || "-",
          pavtiPhotos: row[20] || "-",
          items: []
        };
        invoiceOrder.push(invNo);
      }

      invoicesMap[invNo].items.push({
        model: row[11] || "-",
        qty: row[13] || 0,
        prodPhoto: row[21] || "-"
      });
    }

    // Return the latest invoices first (descending)
    var result = [];
    for (var j = invoiceOrder.length - 1; j >= 0; j--) {
      result.push(invoicesMap[invoiceOrder[j]]);
      if (result.length >= 100) break; // Limit to recent 100 invoices for high speed
    }

    return result;

  } catch (e) {
    Logger.log("getInwardHistory Error: " + e.message);
    return [];
  }
}
