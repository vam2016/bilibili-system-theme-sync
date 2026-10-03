// Bilibili System Theme Sync — controller, MIT, 2026.
// DarkReader is a private bundled instance, supplied by the build wrapper.
const VERSION = '1.0.0';
const MODE_KEY = 'bili-system-theme.mode';
const VALID_MODES = new Set(['auto', 'dark', 'light', 'off']);
const media = window.matchMedia('(prefers-color-scheme: dark)');
const readMode = () => {
    const saved = GM_getValue(MODE_KEY, 'auto');
    return VALID_MODES.has(saved) ? saved : 'auto';
};
let mode = readMode();
let enabled = false;
let pending = false;
let cookieWritten = false;
let startupStyle = null;
let lastError = '';
const labels = {auto: '跟随系统', dark: '始终深色', light: '始终浅色', off: '暂停脚本'};
const wantsDark = () => mode === 'dark' || (mode === 'auto' && media.matches);

// Restrict privileged requests to public CSS on Bilibili's own asset hosts.
// Images are not analysed. These requests neither send cookies nor modify data.
function publicCSSURL(input) {
    const url = new URL(input, location.href);
    const allowed = ['bilibili.com', 'hdslb.com', 'biliimg.com'].some(
        host => url.hostname === host || url.hostname.endsWith(`.${host}`)
    );
    if (url.protocol !== 'https:' || !allowed || !/\.css$/i.test(url.pathname)) {
        throw new Error(`拒绝读取非 B 站公共样式资源：${url.origin}${url.pathname}`);
    }
    return url.href;
}
DarkReader.setFetchMethod(input => {
    const url = new URL(input, location.href);
    if (url.protocol === 'data:' || url.protocol === 'blob:') {
        return window.fetch(url.href);
    }
    return new Promise((resolve, reject) => {
        let href;
        try { href = publicCSSURL(url.href); } catch (error) { reject(error); return; }
        GM_xmlhttpRequest({
            method: 'GET', url: href, anonymous: true, timeout: 15000,
            responseType: 'text',
            onload(response) {
                try {
                    publicCSSURL(response.finalUrl || href);
                    if (response.status < 200 || response.status >= 300) {
                        throw new Error(`样式加载失败：HTTP ${response.status}`);
                    }
                    resolve(new Response(response.responseText, {
                        status: response.status,
                        headers: {'Content-Type': 'text/css; charset=utf-8'}
                    }));
                } catch (error) { reject(error); }
            },
            onerror: () => reject(new Error('B 站样式网络请求失败')),
            ontimeout: () => reject(new Error('B 站样式请求超时')),
            onabort: () => reject(new Error('B 站样式请求已取消'))
        });
    });
});

const theme = {
    brightness: 100, contrast: 100, sepia: 0, grayscale: 0,
    darkSchemeBackgroundColor: '#18191c',
    darkSchemeTextColor: '#e3e5e7',
    styleSystemControls: true
};
const fixes = {
    invert: ['.opus-formula-node', '.search-bar .search-icon'],
    ignoreImageAnalysis: ['*'],
    ignoreInlineStyle: [
        'video', 'canvas', 'img',
        '.bili-danmaku-x-dm', '.bili-danmaku-x-dm *',
        '.bilibili-player-video-danmaku', '.bilibili-player-video-danmaku *',
        '.danmaku-item', '.danmaku-item *'
    ],
    // Let the site continue to see its own CSSStyleSheet objects.
    disableStyleSheetsProxy: true,
    css: `
        body { background-color: var(--darkreader-neutral-background) !important; }
        :root {
            --bg1: var(--darkreader-neutral-background) !important;
            --text1: var(--darkreader-neutral-text) !important;
        }
        .login-scan-box, .qrcode, .qrcode-box { background: white !important; }
        video, canvas, img:not(.opus-formula-node) { filter: none !important; }
        .bili-danmaku-x-dm, .bilibili-player-video-danmaku, .danmaku-item {
            filter: none !important;
        }
        #app > .bg, .bili-dyn-home--member > .bg {
            background-image: none !important;
            background-color: var(--darkreader-neutral-background) !important;
        }
    ` + (location.hostname === 'live.bilibili.com' ? `
        .room-bg {
            background-image: none !important;
            background-color: var(--darkreader-neutral-background) !important;
        }
    ` : '')
};

function useLightBase() {
    // Always transform the native LIGHT base; otherwise native-dark pages get
    // processed twice and can become brighter or lose contrast.
    const root = document.documentElement;
    if (root.classList.contains('bili_dark')) {
        root.classList.remove('bili_dark');
        cookieWritten = false;
    }
    if (!cookieWritten) {
        try {
            document.cookie = 'theme_style=light; Path=/; Domain=.bilibili.com; Max-Age=31536000; SameSite=Lax; Secure';
            cookieWritten = true;
        } catch (error) {
            lastError = `原生主题偏好无法写入：${error.message}`;
        }
    }
}
function apply() {
    if (!document.documentElement) return;
    if (mode !== 'off') useLightBase();
    const dark = wantsDark();
    try {
        if (dark && !enabled) {
            DarkReader.enable(theme, fixes);
            enabled = true;
        } else if (!dark && enabled) {
            DarkReader.disable();
            enabled = false;
        }
        if (mode === 'off') document.documentElement.removeAttribute('data-bili-system-theme');
        else document.documentElement.setAttribute('data-bili-system-theme', dark ? 'dark' : 'light');
    } catch (error) {
        lastError = error.message;
        console.warn('[B站系统主题]', error);
    } finally {
        if (startupStyle) { startupStyle.remove(); startupStyle = null; }
    }
}
function scheduleApply() {
    if (pending) return;
    pending = true;
    queueMicrotask(() => { pending = false; apply(); });
}

// Only watch the root class. Dark Reader watches content, styles, open shadow
// roots and new components itself. No document-wide rescans or polling loop.
function start() {
    const root = document.documentElement;
    if (wantsDark()) {
        startupStyle = GM_addStyle('html, body { background-color: #18191c !important; }');
        startupStyle.classList.add('darkreader');
    }
    apply();
    new MutationObserver(() => {
        if (mode !== 'off' && root.classList.contains('bili_dark')) scheduleApply();
    }).observe(root, {attributes: true, attributeFilter: ['class']});
}
if (document.documentElement) start();
else {
    const observer = new MutationObserver(() => {
        if (document.documentElement) { observer.disconnect(); start(); }
    });
    observer.observe(document, {childList: true});
}

media.addEventListener('change', scheduleApply);
window.addEventListener('pageshow', scheduleApply);
window.addEventListener('focus', scheduleApply);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleApply();
});
GM_addValueChangeListener(MODE_KEY, () => { mode = readMode(); scheduleApply(); });

if (window.top === window.self) {
    for (const nextMode of VALID_MODES) {
        GM_registerMenuCommand(`B站主题 · ${labels[nextMode]}`, () => {
            mode = nextMode;
            GM_setValue(MODE_KEY, nextMode);
            apply();
        });
    }
    GM_registerMenuCommand('B站主题 · 查看状态／排查问题', () => {
        const root = document.documentElement;
        window.alert([
            `B站系统主题同步 v${VERSION}`,
            `页面：${location.hostname}${location.pathname}`,
            `设置：${labels[mode]}`,
            `Chrome 感知的系统外观：${media.matches ? '深色' : '浅色'}`,
            `当前目标：${mode === 'off' ? '暂停' : wantsDark() ? '深色' : '浅色'}`,
            `引擎标记：${root.getAttribute('data-darkreader-mode') || '无'}`,
            `样式数量（主文档）：${document.querySelectorAll('style.darkreader').length}`,
            lastError ? `最近错误：${lastError}` : '',
            '',
            '若系统感知不正确：关闭开发者工具的 prefers-color-scheme 模拟。',
            '若主题冲突：停用旧主题脚本，并在 Dark Reader 扩展中排除 B 站。',
            '暂停会撤掉本脚本的深色样式，原生偏好仍为浅色。'
        ].filter(Boolean).join('\n'));
    });
}
