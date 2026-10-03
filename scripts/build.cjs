const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
let vendor = fs.readFileSync(path.join(base,'vendor/darkreader.js'),'utf8').replace(/\r\n/g,'\n');
// 4.9.120 leaves shadow-root invert styles behind on disable; remove them too.
const cleanup = 'shadowRootsWithOverrides.forEach((root) => {\n            removeNode(root.querySelector(".darkreader--inline"));';
if (!vendor.includes(cleanup)) throw new Error('Vendor shadow cleanup patch no longer matches');
vendor = vendor.replace(cleanup, 'shadowRootsWithOverrides.forEach((root) => {\n            removeNode(root.querySelector(".darkreader--invert"));\n            removeNode(root.querySelector(".darkreader--inline"));');
const license = fs.readFileSync(path.join(base,'vendor/LICENSE'),'utf8');
const controller = fs.readFileSync(path.join(base,'src/controller.js'),'utf8');
const header = `// ==UserScript==
// @name         B站系统主题同步（全站增强版）
// @namespace    local.bilibili-system-theme-sync
// @version      1.0.0
// @description  跟随 macOS 系统深浅色，动态适配 B 站首页、视频、分类、搜索、动态、空间与直播；内置 Dark Reader。
// @match        https://bilibili.com/*
// @match        https://*.bilibili.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      bilibili.com
// @connect      hdslb.com
// @connect      biliimg.com
// @license      MIT
// ==/UserScript==
`;
const result = `${header}\n/*\nBundled dependency: Dark Reader 4.9.120\nhttps://github.com/darkreader/darkreader\nhttps://www.npmjs.com/package/darkreader/v/4.9.120\nLocal patch: remove shadow-root invert styles when disabling the engine.\n\n${license}\n*/\n\n(() => {\n'use strict';\n// Keep the UMD export private, avoiding the page's AMD loaders and globals.\nconst engine = {};\n(function (exports, module, define) {\n${vendor}\n})(engine, {}, undefined);\nconst DarkReader = engine;\n\n${controller}\n})();\n`;
fs.writeFileSync(path.join(base,'bilibili-system-theme.user.js'),result);

console.log(`Built ${Buffer.byteLength(result)} bytes`);
