#!/usr/bin/env bash
# 卸载本机 DSH Web 品牌插件。
#
# 做的事：从 profile 的 package.json 去掉依赖与 bundle 条目，删掉 node_modules 里的链接，
# 再跑一次 pnpm install --offline 让 lockfile 跟上。幂等，可重复执行。
#
# 用法：./uninstall.sh [--force]      # 同样建议先停掉 dsh web/serve

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="${DSH_PROFILE_DIR:-/root/.dsh/profiles/web}"
PKG="$PROFILE/package.json"
NAME='@liuzw/dsh-web-ui-custom'

say() { printf '%s\n' "$*"; }
die() { printf '错误: %s\n' "$*" >&2; exit 1; }

[ -f "$PKG" ] || die "找不到 $PKG"

if pgrep -f 'dsh/lib/bin\.js (web|serve)' >/dev/null 2>&1 && [ "${1:-}" != "--force" ]; then
  say "检测到 dsh web/serve 正在运行，请先停掉它（或加 --force）。"
  exit 1
fi

node - "$PKG" "$NAME" <<'NODE'
const fs = require('fs')
const [pkgPath, name] = process.argv.slice(2)
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
let changed = false
if (pkg.dependencies && name in pkg.dependencies) { delete pkg.dependencies[name]; changed = true }
const bundles = pkg.dsh?.profile?.bundles
if (Array.isArray(bundles)) {
  const next = bundles.filter((entry) => entry !== name)
  if (next.length !== bundles.length) { pkg.dsh.profile.bundles = next; changed = true }
}
if (changed) {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  console.log('已从 package.json 移除 ' + name)
} else {
  console.log('package.json 里没有 ' + name + '，无需修改')
}
NODE

rm -rf "$PROFILE/node_modules/@liuzw/dsh-web-ui-custom"
say "已删除 node_modules/@liuzw/dsh-web-ui-custom"

say "运行 pnpm install --offline 刷新 lockfile …"
( cd "$PROFILE" && pnpm install --offline --ignore-scripts --reporter=append-only 2>&1 | tail -10 ) || say "pnpm install 未成功；lockfile 可能仍带有该依赖，下次 dsh 安装会修正。"

say "卸载完成，重启 dsh 生效。"
