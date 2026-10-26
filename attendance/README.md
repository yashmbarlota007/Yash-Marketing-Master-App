# Attendance OS - Short Break & 50m Geofencing System

## 1. Short Break Feature Overview
Office staff agar shift hours ke dauran kisi kaam se bahar jata hai toh unka break time total working hours me se deduct hota hai:
1. **Short Break (Punch Out - Jate Time)**: Jab staff office se bahar nikalta hai. Isse break timer start hota hai aur working hours pause ho jate hain.
2. **Short Break (Punch In - Aate Time)**: Jab staff office me wapas aata hai. Working hours wapas resume ho jate hain.

## 2. 50-Meter Geofence Verification Rule
- Dono punches (`Short Break (Out)` aur `Short Break (In)`) sirf **Office ke 50 meters ke radius** ke andar se hi allow honge (`19.088889, 74.733667`).
- Agar koi office se 50m door jakar punch karne ki koshish karega toh system turant block karega:
  `"Access Denied: Short Break punch office ke 50m radius ke andar se hi ho sakta hai"`.

## 3. Working Hours Deduction Formula
$$\text{Net Working Hours} = (\text{Shift End} - \text{Shift Start}) - \sum (\text{Short Break Duration})$$
- Daily Attendance Ledger me exact break time (e.g. `Break: 45m`) aur net working hours show honge.

## 4. Google Apps Script Setup
1. Apna Google Apps Script kholein: `script.google.com` (Attendance Project).
2. `Index.html` file me `attendance/Index.html` ka code paste karein.
3. `Code.gs` file me `attendance/Code.gs` ka code paste karein.
4. Top right me **Deploy** > **Manage Deployments** > **Edit** > **New Version** select karke Deploy karein.