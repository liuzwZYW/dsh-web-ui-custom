/**
 * Host half of the local Web UI kit.
 *
 * The shipped Web frontend serves its PWA icons from its own `dist/`, so an
 * upgrade replaces any replaced image files. This row claims the four icon
 * paths as exact routes instead and answers with the brand set kept inside
 * this package, which leaves the frontend untouched and survives upgrades.
 *
 * The manifest itself is not claimed here: it keeps pointing at
 * `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and the built
 * `index.html` still links `./apple-touch-icon.png`. Exact routes win over the
 * static file of the same path, so both keep resolving to these bytes.
 *
 * @module dsh-web-ui-custom
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/** Stable Cordis plugin name. */
export const name = 'web-ui-custom'

/** The web server is required before any icon route can be claimed. */
export const inject = ['webServer']

/** Icon files served from this package, keyed by the path the frontend links. */
const ICONS = {
  '/icon-192.png': 'icon-192.png',
  '/icon-512.png': 'icon-512.png',
  '/icon-maskable-512.png': 'icon-maskable-512.png',
  '/apple-touch-icon.png': 'apple-touch-icon.png',
}

const ASSET_DIR = join(dirname(fileURLToPath(import.meta.url)), 'assets')

/**
 * Read one bundled icon once.
 * @param file - file name inside `assets/`.
 * @returns the file bytes, or `undefined` when the package is incomplete.
 */
function readIcon(file) {
  try {
    return readFileSync(join(ASSET_DIR, file))
  } catch {
    return undefined
  }
}

/**
 * Serve the brand icons over the shipped asset paths.
 * @param ctx - plugin context carrying the webServer service.
 */
export function apply(ctx) {
  ctx.effect(() => {
    const disposers = []
    for (const [route, file] of Object.entries(ICONS)) {
      const body = readIcon(file)
      if (body === undefined) {
        ctx.logger?.warn?.(`web-ui-custom: missing asset ${file}, keeping the shipped icon for ${route}`)
        continue
      }
      disposers.push(ctx.webServer.register({
        kind: 'exact',
        path: route,
        handler: (request, response) => {
          if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { allow: 'GET, HEAD' })
            response.end()
            return
          }
          response.writeHead(200, {
            'content-type': 'image/png',
            'content-length': body.byteLength,
            /* Revalidate so a replaced icon reaches an installed app. */
            'cache-control': 'no-cache',
          })
          if (request.method === 'HEAD') response.end()
          else response.end(body)
        },
      }))
    }
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'web-ui-custom: icon routes')
}
