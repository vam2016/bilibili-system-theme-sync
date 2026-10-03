const {chromium} = require('playwright');
const fs = require('node:fs');
fs.mkdirSync('work', {recursive: true});
const assert = require('node:assert/strict');
const script = fs.readFileSync('bilibili-system-theme.user.js','utf8');
const mockGM = () => {
  const storage = new Map();
  const listeners = [];
  window.__themeMenus = new Map();
  window.GM_addStyle = css => {
    const style = document.createElement('style'); style.textContent = css;
    (document.head || document.documentElement).append(style); return style;
  };
  window.GM_getValue = (key, fallback) => storage.has(key) ? storage.get(key) : fallback;
  window.GM_setValue = (key, value) => {
    const old = storage.get(key); storage.set(key,value);
    listeners.forEach(cb=>cb(key,old,value,false));
  };
  window.GM_addValueChangeListener = (key,cb) => listeners.push(cb);
  window.GM_registerMenuCommand = (label,cb) => window.__themeMenus.set(label,cb);
  window.GM_xmlhttpRequest = options => {
    window.__cssFetch(options.url).then(r=>options.onload(r),options.onerror);
  };
};
async function main() {
  const browser = await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE || undefined,headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light'});
  await context.exposeBinding('__cssFetch', async (_,url) => {
    const response = await context.request.get(url,{timeout:15000});
    return {status:response.status(),responseText:await response.text(),finalUrl:response.url()};
  });
  await context.addInitScript(mockGM);
  await context.addInitScript({content:script});
  const checks = [];
  function passed(name, data) { checks.push({name,...data}); console.log('PASS '+name+' '+JSON.stringify(data||{})); }
  const page = await context.newPage();
  const fixtureHTML = `<!DOCTYPE html><html class="bili_dark"><head><style>
    :root {--bg1:white; --text1:#18191c}
    body {background:white;color:#18191c}
    .card {background:#f1f2f3;color:#18191c;border:1px solid #ccc}
    .late {background:white;color:black}
    .qrcode {background:#fff} video {background:black} .danmaku-item {color:white}
  </style></head><body><div class="card">分类和直播卡片</div><div class="qrcode">QR</div>
  <video></video><canvas></canvas><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E">
  <span class="danmaku-item" style="color:rgb(255, 0, 0)">弹幕</span><div id="shadow-host"></div>
  <script>document.querySelector('#shadow-host').attachShadow({mode:'open'}).innerHTML='<style>p{background:white;color:black}</style><p>评论</p>';</script>
  </body></html>`;
  await context.route('https://www.bilibili.com/theme-fixture',r=>r.fulfill({contentType:'text/html',body:fixtureHTML}));
  await page.goto('https://www.bilibili.com/theme-fixture');
  await page.waitForTimeout(300);
  const before = await page.locator('.card').evaluate(n=>getComputedStyle(n).backgroundColor);
  assert.equal(before,'rgb(241, 242, 243)');
  assert.equal(await page.locator('html').getAttribute('data-bili-system-theme'),'light');
  passed('initial light restores native light base');
  await page.emulateMedia({colorScheme:'dark'});
  await page.waitForTimeout(600);
  const dark = await page.locator('.card').evaluate(n=>getComputedStyle(n).backgroundColor);
  assert.notEqual(dark,before);
  assert.equal(await page.locator('html').getAttribute('data-bili-system-theme'),'dark');
  assert.equal(await page.locator('html').evaluate(n=>n.classList.contains('bili_dark')),false);
  passed('live media change without refresh',{before,dark});
  for(const selector of ['video','canvas','img','.danmaku-item']) {
    assert.equal(await page.locator(selector).evaluate(n=>getComputedStyle(n).filter),'none');
  }
  assert.equal(await page.locator('.danmaku-item').evaluate(n=>getComputedStyle(n).color),'rgb(255, 0, 0)');
  assert.equal(await page.locator('.qrcode').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');
  passed('media / coloured danmaku / QR preservation');
  const shadowDark=await page.evaluate(()=>getComputedStyle(document.querySelector('#shadow-host').shadowRoot.querySelector('p')).backgroundColor);
  assert.notEqual(shadowDark,'rgb(255, 255, 255)');
  await page.evaluate(()=> {
    const card=document.createElement('div'); card.className='late'; card.textContent='异步列表';document.body.append(card);
    const host=document.createElement('bili-comments');document.body.append(host);
    host.attachShadow({mode:'open'}).innerHTML='<style>p{background:white;color:black}</style><p>延迟加载评论</p>';
    history.pushState({},'', '/theme-fixture?page=2');
  });
  await page.waitForTimeout(600);
  assert.notEqual(await page.locator('.late').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');
  assert.notEqual(await page.evaluate(()=>getComputedStyle(document.querySelector('bili-comments').shadowRoot.querySelector('p')).backgroundColor),'rgb(255, 255, 255)');
  passed('asynchronous lists / late shadow comments / SPA navigation');
  await page.evaluate(()=>{
    document.cookie='theme_style=dark; Path=/; Domain=.bilibili.com; Secure';
    document.documentElement.classList.add('bili_dark');
  });
  await page.waitForTimeout(100);
  assert.equal(await page.locator('html').evaluate(n=>n.classList.contains('bili_dark')),false);
  assert.equal(await page.evaluate(()=>document.cookie.includes('theme_style=light')),true);
  passed('native theme class reapplication is corrected');
  await page.evaluate(()=>window.__themeMenus.get('B站主题 · 始终浅色')());
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.card').evaluate(n=>getComputedStyle(n).backgroundColor),before);
  assert.equal(await page.locator('style.darkreader').count(),0);
  assert.equal(await page.evaluate(()=>document.querySelector('#shadow-host').shadowRoot.querySelectorAll('style.darkreader').length),0);
  passed('forced light removes engine styles including shadow roots');
  await page.emulateMedia({colorScheme:'light'});
  await page.evaluate(()=>window.__themeMenus.get('B站主题 · 始终深色')());
  await page.waitForTimeout(250);
  assert.equal(await page.locator('html').getAttribute('data-bili-system-theme'),'dark');
  await page.evaluate(()=>window.__themeMenus.get('B站主题 · 暂停脚本')());
  await page.waitForTimeout(250);
  assert.equal(await page.locator('html').getAttribute('data-bili-system-theme'),null);
  assert.equal(await page.locator('style.darkreader').count(),0);
  await page.emulateMedia({colorScheme:'dark'});
  await page.waitForTimeout(200);
  assert.equal(await page.locator('style.darkreader').count(),0);
  passed('forced dark / pause persists through system changes');
  await page.evaluate(()=>window.__themeMenus.get('B站主题 · 跟随系统')());
  await page.waitForTimeout(300);
  assert.equal(await page.locator('html').getAttribute('data-bili-system-theme'),'dark');
  for(let i=0;i<3;i++) {
    await page.emulateMedia({colorScheme:'light'});await page.waitForTimeout(100);
    assert.equal(await page.locator('style.darkreader').count(),0);
    await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(150);
    assert.equal(await page.locator('meta[name="darkreader"]').count(),1);
  }
  passed('repeated toggles do not duplicate engine');
  await page.close();
  if (process.argv.includes('--fixture-only')) {
    fs.writeFileSync('work/fixture-results.json',JSON.stringify(checks,null,2));
    await browser.close();return;
  }

  const real=[];
  const home=await context.newPage();
  await home.goto('https://www.bilibili.com/',{waitUntil:'domcontentloaded',timeout:45000});
  await home.waitForTimeout(3000);
  const links=await home.evaluate(()=>({
    category:[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='动画')?.href,
    video:document.querySelector('a[href*="/video/BV"]')?.href
  }));
  console.log('DISCOVERED '+JSON.stringify(links));
  await home.close();
  const targets=[['home','https://www.bilibili.com/'], ['live','https://live.bilibili.com/'], ['category',links.category], ['search','https://search.bilibili.com/all?keyword=bilibili'], ['video',links.video], ['space','https://space.bilibili.com/2'], ['dynamic','https://t.bilibili.com/']];
  for (const [name,url] of targets) {
    if(!url) {real.push({name,error:'Missing URL'});continue;}
    const p=await context.newPage();
    const errors=[];
    p.on('pageerror',e=>errors.push(e.message.slice(0,200)));
    try {
      const res=await p.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
      await p.waitForTimeout(4500);
      await p.emulateMedia({colorScheme:'dark'});
      await p.waitForTimeout(4000);
      const state=await p.evaluate(()=>({title:document.title,bodyBG:getComputedStyle(document.body).backgroundColor,bodyColor:getComputedStyle(document.body).color,htmlTheme:document.documentElement.getAttribute('data-bili-system-theme'),engine:document.documentElement.getAttribute('data-darkreader-mode'),styles:document.querySelectorAll('style.darkreader').length,text:document.body.innerText.slice(-200),links:[...document.querySelectorAll('a[href]')].filter(a=>/^https:\/\/live.bilibili.com\/\d+/.test(a.href)).slice(0,2).map(a=>a.href)}));
      await p.screenshot({path:`work/${name}-dark.png`});
      assert.equal(state.htmlTheme,'dark');
      assert.equal(state.engine,'dynamic');
      assert(state.styles>0);
      await p.emulateMedia({colorScheme:'light'});
      await p.waitForTimeout(500);
      assert.equal(await p.locator('style.darkreader').count(),0);
      real.push({name,url,status:res.status(),...state,errors});
      passed('actual '+name+' dark → light',{status:res.status(),bodyBG:state.bodyBG,styles:state.styles});
      if(name==='live' && state.links[0]) targets.push(['live-room',state.links[0]]);
    } catch(error) {real.push({name,url,error:String(error),errors});console.log('FAIL '+name+' '+String(error));}
    await p.close();
  }
  fs.writeFileSync('work/test-results.json',JSON.stringify({checks,real},null,2));
  await browser.close();
  assert.equal(real.filter(r=>r.error).length,0,'Real page checks failed');
}
module.exports = {mockGM};
if (require.main === module) main().catch(e=>{console.error(e);process.exit(1);});
