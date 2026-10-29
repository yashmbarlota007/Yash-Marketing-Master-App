# Yash Marketing - Stock Inward System (OS)

## 📌 Overview
The **Stock Inward App** is part of the Yash Marketing Enterprise Suite. It enables store managers, accountants, and staff to log received consignments, verify quantities against invoices, auto-detect shortages/excess, upload mandatory documentation photos (Invoice, Box, Pavti, Product), and view historical inwards.

---

## 🔗 Single Sign-On (SSO) Connection
- **Integrated with Yash Marketing Master App**:
  When accessed through the Master App portal, user authentication (`empId` and `role`) is passed automatically via query parameters:
  `.../exec?empId=YM01&role=Store+Manager`
- **Auto-Login Handshake**:
  The system matches `empId` against the Staff Master database and skips the login PIN screen, directly opening the Inward entry screen with the checker's name populated.
- **Stand-Alone Login**:
  Can still be opened independently with Employee ID and PIN authentication.

---

## 📂 Project Structure
- [`Code.gs`](file:///C:/Users/Acer/.copilot/repos/Yash-Marketing-Master-App/inward/Code.gs):
  - `doGet(e)`: Master App SSO template parameter parsing & iframe enablement (`ALLOWALL`).
  - `getDropdownData()`: Fetches brands, categories, models from Catalogue, staff credentials, and transport list.
  - `processFormFast(jsonString)`: Fast batch logging of inward records and direct Drive upload of compressed photos.
  - `getInwardHistory()`: Fetches recent inward invoices with expandable item rows and photo vault links.
- [`Index.html`](file:///C:/Users/Acer/.copilot/repos/Yash-Marketing-Master-App/inward/Index.html):
  - Responsive single-page interface (Entry Tab & History Tab).
  - Client-side image compressor (700px max width JPEG) for fast mobile uploads.
  - Multi-model dynamic entries, discrepancy calculations (`Short`, `Extra`, `OK`), and real-time filtering.

---

## 🚀 Deployment Instructions (Google Apps Script)
1. Open your Stock Inward Google Apps Script project at [script.google.com](https://script.google.com).
2. Copy [`inward/Code.gs`](file:///C:/Users/Acer/.copilot/repos/Yash-Marketing-Master-App/inward/Code.gs) into `Code.gs`.
3. Copy [`inward/Index.html`](file:///C:/Users/Acer/.copilot/repos/Yash-Marketing-Master-App/inward/Index.html) into `Index.html`.
4. Click **Deploy** > **Manage Deployments** > Click the **Pencil icon** (Edit) on the active Web App deployment.
5. Select **New Version** and click **Deploy**.
6. Ensure the Web App URL matches the entry in [`Yash-Marketing-Master-App/index.html`](file:///C:/Users/Acer/.copilot/repos/Yash-Marketing-Master-App/index.html):
   `https://script.google.com/macros/s/AKfycbySm0k-h9WsgrvK94p032tMc-H2sQ5paK6IprxajLndIu3JILTG1CxrjkK664I3Ur2Edg/exec`
