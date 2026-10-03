# B站系统主题同步（全站增强版）

适用于 Chrome + Tampermonkey 的油猴脚本，默认跟随 macOS 深浅色外观实时切换，无需刷新。内置 Dark Reader 4.9.120 动态配色引擎。

## 安装

[点击这里安装脚本](https://raw.githubusercontent.com/vam2016/bilibili-system-theme-sync/main/bilibili-system-theme.user.js)（需先安装 Tampermonkey）。

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 停用原来的 B 站主题脚本；如使用 Dark Reader 扩展，请在扩展中排除 B 站。
3. 打开 [完整脚本](bilibili-system-theme.user.js)，点击 Raw 进入油猴安装页；若没有弹出安装页，将完整内容复制到油猴「添加新脚本」中，删除默认内容，粘贴并保存。
4. 刷新已打开的 B 站页面，然后切换 macOS「系统设置 → 外观」测试联动。

更多安装、Chrome 脚本权限及故障排查见 [安装与使用说明](docs/安装与使用说明.md)。

## 功能

- 匹配 B 站主站及各子域，包括视频、分类、搜索、动态、个人空间和直播。
- 动态处理新增内容和开放式 Shadow DOM 评论组件。
- 保留普通图片、视频、Canvas 与彩色弹幕的内联颜色。
- 深色时移除直播间装饰皮肤背景，浅色时恢复。
- 油猴菜单支持跟随系统、始终深色、始终浅色、暂停和状态查看。
- 固定依赖直接打包，无外部 `@require`。

为避免双重配色，脚本将 B 站原生 `theme_style` 偏好设为浅色，深色效果由本脚本生成。暂停或卸载后，原生偏好仍为浅色。

## 开发

修改 `src/controller.js`，然后执行：

```sh
npm run build
npm run check
```

构建仅依赖 Node.js，不需要先安装开发依赖。请同时提交源码与生成的 `bilibili-system-theme.user.js`。

运行浏览器验证：

```sh
npm install
npx playwright install chromium
npm test
```

`npm test` 使用本地测试页面；`npm run test:live` 会访问 B 站的实际页面，可能受到网络或验证码影响。可通过 `CHROME_EXECUTABLE` 指定本机 Chrome 路径。测试模拟油猴 GM 接口，不能替代安装到真实油猴后的确认。

## 验证与已知限制

v1.0.0 已在独立 Chrome 中检查首页、动画分类、搜索、视频、个人空间、动态首页、直播首页和直播间的深浅色切换。另验证动态内容、开放式 Shadow DOM、隔离运行环境、媒体颜色保护及样式清理。

直播推荐浮层可能仍有浅色区域，后续复核遇到验证码，尚未完成确认。不同登录状态、第三方框架、封闭式 Shadow DOM、活动皮肤和未来的网站改版可能需要进一步适配。

## 许可

本项目使用 [MIT 许可](LICENSE)。内置 Dark Reader 的版权、许可与构建补丁说明见 [第三方声明](THIRD_PARTY_NOTICES.md)。
