# Yash Marketing Master App - Antigravity Project Guide

## Overview
- **Project Name**: Yash Marketing Master App (OS)
- **Repository**: [yashmbarlota007/Yash-Marketing-Master-App](https://github.com/yashmbarlota007/Yash-Marketing-Master-App)
- **Default Branch**: `main`
- **Zero-Storage Online Workflow**: 100% cloud-managed via GitHub REST API & Google Apps Script GitHub Assistant
- **Live Deployment**: [yash-marketing-master-app.vercel.app](https://yash-marketing-master-app.vercel.app)

## Google Apps Script (GAS) Connection
- **Linked Script ID**: `1fpkyk0LQ8nPmDoqd-xCsSiGD91wbHToBXQzbUf2YRTlDDZKUYvIMmT0l`
- **Sync Method**: Online synchronization using Google Apps Script GitHub Assistant browser extension
- **Configuration**: `.clasp.json` and `appsscript.json` tracked in root

## Code Structure
- `index.html`: Unified single-file web application containing login authentication, management tabs, and GAS API integrations.
- `.clasp.json`: GAS project binding configuration.
- `appsscript.json`: Google Apps Script manifest file.

## Guidelines for Antigravity AI
1. Preserve embedded styling and responsive layout for mobile and desktop screens.
2. Keep data structures aligned with Yash Marketing backend schemas.
3. Maintain 0 KB local disk storage; all operations executed online in the cloud.