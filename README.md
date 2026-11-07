# @liuzw/dsh-web-ui-custom

给 **DeepSeek Harness Web** 的两项界面定制，做成插件——升级 DSH 不会再被覆盖：

1. **PWA 应用图标**：深色圆角底 + 白色鲸鱼，替换上游白底灰鲸那一套；
2. **侧栏设置齿轮**：账户行右侧（收起时在头像上方）加一个齿轮，单击直接打开设置面板。

> 之前的做法是直接改 DSH 安装目录里的前端 `dist` 和客户端 bundle，每次升级都会被还原。这个包用 DSH 的插件接口重做了一遍，安装、卸载、升级互不影响。

## 安装

**从 npm（推荐）**——在 DSH 的插件市场里搜 `@liuzw/dsh-web-ui-custom` 安装，或手动：

```bash
cd ~/.dsh/profiles/web
pnpm add @liuzw/dsh-web-ui-custom
```

然后把包名加进 `package.json` 的 `dsh.profile.bundles`：

```json
"bundles": ["...", "@liuzw/dsh-web-ui-custom"]
```

重启 `dsh web` 生效。

**源码方式**（本仓库 clone 后）：

```bash
./install.sh     # 写入 file: 依赖 + bundle，并 pnpm install --offline
./uninstall.sh   # 撤销
```

两条脚本都要求先停掉 `dsh web/serve`，失败会自动回滚 profile 配置。

## 实现

| 部分 | 做法 |
| --- | --- |
| 图标（宿主 `index.js`） | `webServer.register` 以 **exact route** 接住 `/icon-192.png`、`/icon-512.png`、`/icon-maskable-512.png`、`/apple-touch-icon.png`，返回包内 `assets/` 的 PNG。上游 `manifest.webmanifest` 与 `index.html` 引用的正是这些路径，因此前端 `dist` 一个字节都不用改。 |
| 齿轮（浏览器 `client.js`） | 在侧栏账户行追加一个按钮；点击时沿 React fiber 向上找到启动器组件的 `openSettings` 属性并调用。React 重渲染会移除外来子节点，用 MutationObserver 补回。 |

## 行为与边界

- 图标路由带 `cache-control: no-cache`，DSH 静态资源本身也是 `no-cache`，刷新即可看到新图标；已安装的 PWA 若仍显示旧图标，是系统缓存，卸载重装 PWA 即可。
- 齿轮依赖 `_settingsArea` / `_triggerRow` 两个 CSS Module 后缀和启动器组件上的 `openSettings`。DSH 改这两处时齿轮会静默不显示（图标不受影响），届时只需调整 `client.js` 里的 `findRow`。
- 宿主以 exact match 匹配图标路径，DSH 若改文件名，需要同步更新 `index.js` 的 `ICONS` 表。

## 许可

MIT
