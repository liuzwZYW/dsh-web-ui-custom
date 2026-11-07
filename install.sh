#!/usr/bin/env bash
# 安装本机 DSH Web 品牌插件（PWA 图标 + 侧栏设置齿轮）
#
# 做的事：
#   1) 在 profile 的 package.json 里加依赖 file:<本目录>，并把它加进 dsh.profile.bundles；
#   2) 在 profile 里跑一次 pnpm install（file: 本地依赖，--offline，不需要网络），刷新 lockfile；
#   3) 校验 node_modules 里能解析到本包。
#
# 必须在 dsh web/serve 停止后执行：pnpm 会重排 node_modules，运行中的进程不应被这样改动。
# 幂等：重复执行不会重复添加；改完会打印包列表。
#
# 用法：  ./install.sh           # 正常安装
#        ./install.sh --force   # 忽略“dsn 正在运行”的检查（不推荐）
#        ./install.sh --check   # 只检查当前是否已安装
#
# 环境变量：DSH_PROFILE_DIR 覆盖 profile 目录（默认 /root/.dsh/profiles/web）

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="${DSH_PROFILE_DIR:-/root/.dsh/profiles/web}"
PKG="$PROFILE/package.json"
SNAP="$PLUGIN_DIR/.snapshot-profile"
NAME='@liuzw/dsh-web-ui-custom'
SPEC="file:$PLUGIN_DIR"

say() { printf '%s\n' "$*"; }
die() { printf '错误: %s\n' "$*" >&2; exit 1; }

[ -f "$PKG" ] || die "找不到 $PKG"
[ -f "$PLUGIN_DIR/index.js" ] || die "找不到插件入口 $PLUGIN_DIR/index.js"

check() {
  node -e '
    const fs=require("fs"), path=require("path");
    const [pkgPath, name] = process.argv.slice(1);
    const pkg=JSON.parse(fs.readFileSync(pkgPath,"utf8"));
    const dep=(pkg.dependencies||{})[name];
    const inBundles=(pkg.dsh?.profile?.bundles||[]).includes(name);
    const linked=fs.existsSync(path.join(path.dirname(pkgPath),"node_modules",name,"package.json"));
    console.log(`依赖: ${dep??"(无)"}`);
    console.log(`bundle 列表: ${inBundles?"有":"无"}`);
    console.log(`node_modules 链接: ${linked?"有":"无"}`);
    process.exit(dep&&inBundles&&linked?0:1);
  ' "$PKG" "$NAME"
}

if [ "${1:-}" = "--check" ]; then
  say "== $NAME 安装状态"
  check && say "已安装。" || say "未安装或不完整。"
  exit 0
fi

if pgrep -f 'dsh/lib/bin\.js (web|serve)' >/dev/null 2>&1 && [ "${1:-}" != "--force" ]; then
  say "检测到 dsh web/serve 正在运行。"
  say "pnpm install 会重排 node_modules，请先停掉它再执行；确认无碍可加 --force。"
  exit 1
fi

# ---- 快照（仅首次） ----
if [ ! -d "$SNAP" ]; then
  mkdir -p "$SNAP"
  cp -p "$PKG" "$SNAP/package.json"
  [ -f "$PROFILE/pnpm-lock.yaml" ] && cp -p "$PROFILE/pnpm-lock.yaml" "$SNAP/pnpm-lock.yaml"
  say "已创建快照: $SNAP"
fi

restore() {
  say "正在回滚 profile 配置…"
  cat "$SNAP/package.json" > "$PKG"
  [ -f "$SNAP/pnpm-lock.yaml" ] && cat "$SNAP/pnpm-lock.yaml" > "$PROFILE/pnpm-lock.yaml"
  say "已回滚。"
}

# ---- 写入依赖与 bundle ----
node - "$PKG" "$NAME" "$SPEC" <<'NODE' || { restore; die "修改 package.json 失败"; }
const fs = require('fs')
const [pkgPath, name, spec] = process.argv.slice(2)
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
pkg.dependencies = pkg.dependencies ?? {}
pkg.dependencies[name] = spec
pkg.dsh = pkg.dsh ?? {}
pkg.dsh.profile = pkg.dsh.profile ?? {}
const bundles = pkg.dsh.profile.bundles = pkg.dsh.profile.bundles ?? []
if (!bundles.includes(name)) bundles.push(name)
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
console.log('已写入 package.json: ' + name + ' -> ' + spec)
NODE

# ---- 安装（file: 本地依赖，离线） ----
say "运行 pnpm install --offline …"
if ! ( cd "$PROFILE" && pnpm install --offline --ignore-scripts --reporter=append-only 2>&1 | tail -20 ); then
  restore
  die "pnpm install 失败，配置已回滚（node_modules 可能已部分重排，必要时重跑 dsh 安装）"
fi

# ---- 校验 ----
if ! check; then
  restore
  die "安装后校验失败，配置已回滚"
fi

say ""
say "安装完成。启动 dsh 后生效："
say "  - PWA 图标：/icon-192.png、/icon-512.png、/icon-maskable-512.png、/apple-touch-icon.png"
say "  - 侧栏：账户行旁/上方出现设置齿轮"
say "回滚：./uninstall.sh"
