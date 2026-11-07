/**
 * Client half of the local Web UI kit: a settings gear beside the sidebar
 * account launcher.
 *
 * The shipped account row opens a menu; the gear is a direct shortcut into the
 * settings dialog. It is mounted as a sibling of the row's anchor and marks the
 * row with `data-dsh-wuc-row`, so the stylesheet below can lay the pair out
 * on one line when the sidebar is wide and stack the gear above the avatar in
 * the 56px rail.
 *
 * How the settings dialog is opened: the row is the shipped launcher, and the
 * settings shell hands that component an `openSettings` prop. React keeps the
 * fiber for every host element under `__reactFiber$…`, so walking up from the
 * row's own node reaches the component fiber that carries the callback. This
 * uses no private module import and degrades quietly: when the prop is not
 * found the gear is removed instead of becoming a dead button.
 *
 * React re-renders replace foreign children, so a MutationObserver re-mounts
 * the gear after any reconciliation that drops it.
 *
 * @module dsh-web-ui-custom
 */
window.__ModuleLoader__.load({
  id: '@liuzw/dsh-web-ui-custom',
  factory() {
    /** Marks the account row our gear belongs to. */
    const ROW_ATTR = 'data-dsh-wuc-row'
    /** Marks the gear button itself. */
    const GEAR_ATTR = 'data-dsh-wuc-gear'

    const LABEL = (typeof navigator !== 'undefined' && /^zh/i.test(navigator.language ?? '')) ? '设置' : 'Settings'

    /** 16px outline gear, drawn with `currentColor` so it follows the row. */
    const GEAR_SVG = [
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '<circle cx="12" cy="12" r="3.2"/>',
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      '</svg>',
    ].join('')

    const CSS = [
      /* One line: anchor takes the space, gear keeps its box. */
      `[${ROW_ATTR}]{display:flex;align-items:center;gap:4px}`,
      `[${ROW_ATTR}]>:first-child{flex:1;min-width:0}`,
      `[${GEAR_ATTR}]{flex:none;width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer}`,
      `[${GEAR_ATTR}]:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}`,
      `[${GEAR_ATTR}]:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4f6ef7);outline-offset:2px}`,
      /* Rail: stack the gear above the avatar, keeping the icon column centred.
         The sidebar marks its collapsed root with `_collapsed`, and the trigger
         row itself carries `_railRow`; either is enough. */
      `[class*="_collapsed"] [${ROW_ATTR}],[class*="_railRow"] [${ROW_ATTR}]{flex-direction:column;gap:8px}`,
      `[class*="_collapsed"] [${GEAR_ATTR}],[class*="_railRow"] [${GEAR_ATTR}]{order:-1}`,
    ].join('')

    /**
     * The shipped account launcher row.
     *
     * The shell renders each slot as `<div data-slot="…" style="display:contents">`
     * around the registrant's element, and `settings.launcher` sits inside the
     * settings trigger row. The launcher registered by the account plugin is the
     * element after those wrappers — that is the row the gear belongs beside,
     * and the only node whose fiber chain carries `openSettings`.
     * @returns the row element, or `undefined` while the sidebar is not mounted.
     */
    function findRow() {
      const slot = document.querySelector('[data-slot="settings.launcher"]')
        ?? document.querySelector('[class*="_settingsArea"] [class*="_triggerRow"]')
      if (slot === null || slot === undefined) return undefined
      let row = slot.firstElementChild
      /* Skip any further `data-slot` wrappers (presentation-only boxes). */
      while (row instanceof HTMLElement && row.hasAttribute('data-slot')) row = row.firstElementChild
      return row instanceof HTMLElement ? row : undefined
    }

    /**
     * Walk up the React fiber chain looking for the launcher's `openSettings`.
     * @param node - a host element inside the launcher's subtree.
     * @returns the callback the settings shell handed the launcher, if any.
     */
    function resolveOpenSettings(node) {
      const key = Object.keys(node).find((name) => name.startsWith('__reactFiber$'))
      if (key === undefined) return undefined
      let fiber = node[key]
      for (let depth = 0; fiber && depth < 64; depth += 1) {
        const props = fiber.memoizedProps
        if (props && typeof props.openSettings === 'function') return props.openSettings
        fiber = fiber.return
      }
      return undefined
    }

    /** One-time console notes, so a silent no-op is visible in DevTools. */
    let announced = false
    let warnedMissingOpen = false

    /**
     * Mount the gear into the account row when both the row and its settings
     * callback are present.
     * @param row - the launcher row.
     */
    function mount(row) {
      if (row.querySelector(`:scope > [${GEAR_ATTR}]`) !== null) return
      if (typeof resolveOpenSettings(row) !== 'function') {
        if (!warnedMissingOpen) {
          warnedMissingOpen = true
          console.warn('[dsh-web-ui-custom] launcher row found, but its openSettings prop is missing')
        }
        return
      }

      row.setAttribute(ROW_ATTR, '')
      const gear = document.createElement('button')
      gear.type = 'button'
      gear.dataset.dshWucGear = ''
      gear.setAttribute('aria-label', LABEL)
      gear.title = LABEL
      gear.innerHTML = GEAR_SVG
      gear.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const open = resolveOpenSettings(row)
        if (typeof open === 'function') open()
      })
      row.append(gear)
      if (!announced) {
        announced = true
        console.info('[dsh-web-ui-custom] settings gear mounted')
      }
    }

    return {
      /**
       * Install the stylesheet, the gear, and the observer that keeps it there.
       * @param ctx - browser plugin context, for effect ownership.
       */
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.plugin = '@liuzw/dsh-web-ui-custom'
          style.textContent = CSS
          document.head.append(style)

          let scheduled = false
          const sync = () => {
            scheduled = false
            const row = findRow()
            if (row !== undefined) mount(row)
          }
          const schedule = () => {
            if (scheduled) return
            scheduled = true
            requestAnimationFrame(sync)
          }

          sync()
          const observer = new MutationObserver(schedule)
          observer.observe(document.body, { childList: true, subtree: true })
          return () => {
            observer.disconnect()
            style.remove()
            for (const gear of document.querySelectorAll(`[${GEAR_ATTR}]`)) gear.remove()
            for (const row of document.querySelectorAll(`[${ROW_ATTR}]`)) row.removeAttribute(ROW_ATTR)
          }
        }, '@liuzw/dsh-web-ui-custom: sidebar settings gear')
      },
    }
  },
})
