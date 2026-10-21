/**
 * Detects the system preference and applies the dark style.
 * Reacts to theme changes and DOM updates through observers and events, without polling.
 */

(() => {
  // Helper to determine if we should run in the current frame/page context
  const shouldRun = () => {
    const isTopFrame = window === window.top;
    const host = window.location.hostname;

    if (isTopFrame) {
      // Top-level frame: only run if it is Gmail
      return host.includes('mail.google.');
    } else {
      // Subframe: only run if the parent/ancestor is Gmail
      try {
        if (window.top && window.top.location && window.top.location.hostname.includes('mail.google.')) {
          return true;
        }
      } catch (e) {
        // Ignore cross-origin error
      }

      if (window.location.ancestorOrigins) {
        for (let i = 0; i < window.location.ancestorOrigins.length; i++) {
          if (window.location.ancestorOrigins[i].includes('mail.google.')) {
            return true;
          }
        }
      }

      if (document.referrer && document.referrer.includes('mail.google.')) {
        return true;
      }

      return false;
    }
  };

  if (!shouldRun()) {
    return;
  }

  // Cache the media query to avoid repeated lookups.
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  /**
   * Exact inverse of the dark filter chain
   * (invert(1) hue-rotate(180deg) brightness(1.2) contrast(0.85) saturate(1.1)).
   * The inverse operations must be applied with reciprocal values in REVERSE
   * order — re-applying them in the same order as the dark filter does not undo
   * it, which washed out icon and image colors. hue-rotate(180deg) is exactly
   * self-inverse (its color matrix squared is the identity), so a plain CSS
   * chain restores original colors exactly for everything inside the displayable
   * range of the dark filter (only extremely saturated reds/yellows retain a
   * small residual, a hard limit of the filter-inversion approach).
   * saturate(1 / 1.1); contrast(1 / 0.85); brightness(1 / 1.2)
   */
  const RESTORE_FILTER =
    'saturate(0.909091) contrast(1.176471) brightness(0.833333) hue-rotate(180deg) invert(1)';

  /**
   * Gmail's UI glyphs (checkboxes, toolbar icons, chevrons) are monochrome PNG sprites
   * served from gstatic icon paths. They are drawn for a light background, so
   * counter-inverting them keeps them dark on a dark surface. The list checkbox sprite
   * averages rgb(68, 71, 70), which leaves 1.49:1 against the dark background, and only
   * 1.13:1 while .oZ-jc dims the resting checkbox to opacity 0.32. Letting the page-wide
   * invert handle them instead gives 7.12:1.
   *
   * A light asset would be the obvious alternative, but the nv100/nv200/nv300/nv600/white
   * variants of those sprite URLs all 404.
   *
   * The path alone is not enough to tell them apart, because colored artwork lives there
   * too. Google encodes the tone in the file name, so the match is restricted to the
   * single-dark-color tokens: 27 sprites on a loaded inbox carry nv700, a handful carry
   * black, grey600, gm_grey or p900, and label_important_fill_googyellow500 is colored and
   * has to keep its counter-inversion. Unknown tokens fall through to previous behavior,
   * as do avatars and inline photos from googleusercontent.com.
   */
  const MONOCHROME_UI_ICON_URL =
    /gstatic\.com\/(?:ui\/v1\/icons|images\/icons)\/[^"')]*_(?:nv\d{3}|p900|black|grey\d{3}|gm_grey)_/;

  /**
   * The input tools sprite sheet carries no color token in its name, so the rule above
   * cannot classify it, but it is measurably greyscale: of 11667 opaque pixels in
   * ita_sprite8.png not one has a channel spread above 30, and the mean is rgb(89, 89, 89).
   * It backs the keyboard glyphs in the input language menu, ten elements on a loaded page.
   */
  const GREYSCALE_SPRITE_URL = /gstatic\.com\/inputtools\/images\//;

  /**
   * CSS that restores original colors on media and a handful of specific Gmail UI
   * elements after the page-wide dark filter has inverted everything.
   *
   * The selectors like .qj, .at, .ahR and .T-KT are Gmail's own minified (and
   * therefore unstable) class names for things such as attachment chips and preview
   * tiles. If a future Gmail update renames them, those elements simply fall back to
   * the inverted look — nothing breaks.
   *
   * This block is identical in the top frame and in subframes, so it lives here and
   * is reused everywhere instead of being copied into each style tag.
   */
  const COUNTER_INVERT_CSS = `
    /* Counter-invert media and background images so they keep their true colors.
       Matches <img>/<video>/<canvas>/<svg>, elements with an inline background image,
       and anything we tag with .auto-dark-counter-invert at runtime.
       The url() match also requires "background" in the style to avoid matching
       cursor: url(...), which Gmail sets on <body> during drag & drop (matching it
       would flip the whole page back to light).
       Everything carrying .auto-dark-keep-inverted drops out again. Elements reach this rule
       through four different paths (inline style, the svg tag, Gmail's own class names, and
       the runtime tag), so the exemption sits on the whole block rather than on each path.
       See MONOCHROME_UI_ICON_URL and isMonochromeDarkIcon for what earns it. */
    :is(img, video, canvas,
        [style*="background-image"], [style*="background"][style*="url("],
        svg, .qj, .at, .ahR,
        .auto-dark-counter-invert):not(.auto-dark-keep-inverted) {
      filter: ${RESTORE_FILTER} !important;
    }
    /* Attachment chips / preview tiles that Gmail also dims via opacity — restore that too. */
    :is(.T-KT.T-KT-CE, .pH.yX, .WA.xY, .pH.a9q):not(.auto-dark-keep-inverted) {
      filter: ${RESTORE_FILTER} !important;
      opacity: 1 !important;
    }
  `;

  /**
   * The full stylesheet for the top Gmail frame. It applies the page-wide dark
   * filter, then layers COUNTER_INVERT_CSS and a few Gmail-specific tweaks on top.
   * Subframes use COUNTER_INVERT_CSS alone, since the top frame already inverts them.
   */
  const TOP_FRAME_CSS = `
    :root {
      /* Light on purpose, not dark. The page-wide invert below is the only source of
         darkness. Declaring dark makes Gmail's Material components render themselves dark,
         and the filter then inverts that a second time. Disabled buttons come out as light
         blocks on a dark page and their label drops to 1.29:1, against 1.98:1 with light.
         Scrollbars and native form controls behave the same way. */
      color-scheme: light !important;
    }
    html {
      /* Softer dark: high brightness lifts blacks to grays, lower contrast reduces the "void" feel. */
      filter: invert(1) hue-rotate(180deg) brightness(1.2) contrast(0.85) saturate(1.1) !important;
      background-color: #f1f3f4 !important;
    }
    * {
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
      text-rendering: optimizeLegibility !important;
    }
    .gb_Td, .gb_Vd, .gb_Wd, .S7, .aeN, .z0, .G-atb, .brC-brI, .T-I-KE {
      box-shadow: none !important;
    }
    ${COUNTER_INVERT_CSS}
    form#aso_search_form_anchor {
      background-color: #e8eaed !important;
      border: 1px solid transparent !important;
    }
    .ae4, .qh, .G-atb, .Ym, .brC-brI, .aeQ, .G-tF {
      border-color: #dadce0 !important;
    }
    .n6, .bhZ.n3, .J-Ke.n0 {
      background-color: #e8f0fe !important;
    }
    /* Neutralize the filter on toolbar/attachment controls in their default state.
       Their active state (.T-KT-CE etc.) is handled by COUNTER_INVERT_CSS above. */
    .T-KT, .pH, .a9q {
      filter: none !important;
      opacity: 1 !important;
    }
    .gb_tc, .bjK, .ajy, .ajv, .ajz {
      filter: none !important;
    }
  `;

  const isTopFrame = window === window.top;

  // Whether an ANCESTOR Gmail frame currently has dark mode active. Counter-inversion
  // in a subframe must key off this, not the subframe's own prefers-color-scheme:
  // Google serves some embedded widgets (e.g. the app launcher at ogs.google.com)
  // with a forced light color-scheme, so a cross-origin subframe reports light even
  // while the top frame is dark and is visually inverting the whole page (this iframe
  // included). The top frame detects dark correctly and relays it down via postMessage.
  let ancestorDark = false;

  // The dark theme is active in this frame if this frame itself is dark (top frame,
  // or a subframe that honestly reports dark) or an ancestor told us it is dark.
  const isDarkActive = () => (isTopFrame ? darkModeQuery.matches : darkModeQuery.matches || ancestorDark);

  // Only accept dark-state messages from our own origin, other Google frames, or
  // opaque (about:blank / sandboxed) frames. The payload is just a theme boolean.
  const isTrustedOrigin = (origin) => {
    if (!origin || origin === 'null') return true;
    try {
      return new URL(origin).hostname.includes('google.');
    } catch (e) {
      return false;
    }
  };

  // Relay the effective dark state to every child frame (works cross-origin).
  const broadcastDarkToChildren = (dark) => {
    document.querySelectorAll('iframe').forEach(frame => {
      try {
        if (frame.contentWindow) {
          frame.contentWindow.postMessage({ __autoDarkGmail: true, dark }, '*');
        }
      } catch (e) {
        // Ignore frames we cannot post to
      }
    });
  };

  /**
   * Most of Gmail's chrome (help, settings, navigation, toolbar) is inline SVG filled with
   * one dark tone, rgb(68, 71, 70), the same color as the PNG sprites. Counter-inverting it
   * leaves those icons dark on a dark surface, so they get tagged here and excluded from
   * the svg rule in COUNTER_INVERT_CSS.
   *
   * Multi-color and gradient artwork fails this test and keeps its counter-inversion. That
   * covers the account avatar, the Gemini mark and product logos. The check is strict on
   * purpose: one opaque color across every fill and stroke, dark enough that inverting it
   * lands on a light tone. Anything ambiguous falls back to the previous behavior.
   *
   * An embedded <image> only disqualifies an icon when it actually has a source. The app
   * launcher ships an empty 24x24 <image> placeholder next to its single dark path, and
   * treating that as raster artwork left the grid dark.
   */
  const RGB_PARTS = /[\d.]+/g;

  const parsePaint = (value) => {
    if (!value || value === 'none' || value.includes('url(')) return null;
    const parts = value.match(RGB_PARTS);
    if (!parts) return null;
    const alpha = parts[3] !== undefined ? Number(parts[3]) : 1;
    if (alpha < 0.05) return null;
    return parts.slice(0, 3).map(Number);
  };

  const relativeLuminance = ([r, g, b]) => {
    const [rs, gs, bs] = [r, g, b].map(channel => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const isMonochromeDarkIcon = (svg, view) => {
    if (svg.querySelector('linearGradient, radialGradient, pattern')) return false;
    for (const img of svg.querySelectorAll('image')) {
      if ((img.getAttribute('href') || img.getAttribute('xlink:href') || '').trim()) return false;
    }
    const nodes = [svg, ...svg.querySelectorAll('path, circle, rect, polygon, ellipse, line, polyline, g')];
    const colors = [];
    for (const node of nodes) {
      const style = view.getComputedStyle(node);
      for (const paint of [style.fill, style.stroke]) {
        if (paint && paint.includes('url(')) return false;
        const color = parsePaint(paint);
        if (color) colors.push(color);
      }
    }
    if (!colors.length) return false;
    if (new Set(colors.map(c => c.join(','))).size > 1) return false;
    return relativeLuminance(colors[0]) < 0.5;
  };

  /**
   * A 1x1 transparent spacer GIF is not artwork. Gmail sets one as the background image of
   * the search input, and counter-inverting on that basis turned the typed query dark on a
   * dark field while the autocomplete suffix, which lives in a separate element, stayed
   * light. Form fields are exempt for the same reason: their text matters, and a background
   * image on them is decoration at most.
   *
   * Gmail also builds icon buttons as an <img> pointing at cleardot.gif with the real glyph
   * in background-image. All 35 such images on a loaded inbox are 1x1, so an img that small
   * carries no artwork of its own and the background decides. The pagination chevrons are
   * the visible case: the img rule matched them directly and the tagging never reached them,
   * because it only walks div, span, a, li and button.
   */
  const PLACEHOLDER_BG_URL = /data:image\/gif;base64,R0lGODlhAQABA/;
  const TEXT_ENTRY_TAG = /^(?:input|textarea|select)$/;

  const carriesNoImageOfItsOwn = (el) => el.naturalWidth <= 1 && el.naturalHeight <= 1;

  const keepsItsOwnColors = (el, bg) => {
    const tag = el.tagName.toLowerCase();
    if (TEXT_ENTRY_TAG.test(tag)) return true;
    if (PLACEHOLDER_BG_URL.test(bg)) return true;
    if (GREYSCALE_SPRITE_URL.test(bg)) return true;
    if (!MONOCHROME_UI_ICON_URL.test(bg)) return false;
    return tag !== 'img' || carriesNoImageOfItsOwn(el);
  };

  /**
   * Classification engine.
   *
   * The original version re-walked every div/span/a/li/button/img on a 500 ms interval and
   * called getComputedStyle on each untagged one, twice per tick, with a class write after
   * every read. On a loaded inbox that is ~6,900 style reads per pass and a 60-150 ms long
   * task twice a second, growing with the DOM the longer the tab stays open.
   *
   * Now each element is classified once, when it appears or when its own class/style
   * changes, in batches that read everything first and write the classes afterwards. A slow
   * idle-time sweep (every SWEEP_INTERVAL_MS) re-checks untagged elements to catch what no
   * mutation reports: stylesheets that arrive late, or an ancestor class change giving a
   * descendant a background image. Tagging rules are the same as before; tags stay sticky.
   */
  const COUNTER_CLASS = 'auto-dark-counter-invert';
  const KEEP_CLASS = 'auto-dark-keep-inverted';
  const SCAN_SELECTOR = 'div, span, a, li, button, img, [style*="background"]';
  const FLUSH_BUDGET_MS = 8;
  const SWEEP_INTERVAL_MS = 5000;
  const SMALL_SUBTREE = 300;
  const OBSERVE_OPTIONS = { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] };

  const pending = new Set();
  const pendingSvgs = new Set();
  let flushScheduled = false;

  const isTagged = (el) => el.classList.contains(COUNTER_CLASS) || el.classList.contains(KEEP_CLASS);

  const queueElement = (el) => {
    if (el.matches(SCAN_SELECTOR) && !isTagged(el)) pending.add(el);
    if (el.localName === 'svg' && !el.dataset.autoDarkIconChecked) pendingSvgs.add(el);
  };

  const queueTree = (root) => {
    queueElement(root);
    if (!root.firstElementChild) return;
    for (const el of root.querySelectorAll(SCAN_SELECTOR)) {
      if (!isTagged(el)) pending.add(el);
    }
    for (const svg of root.querySelectorAll('svg')) {
      if (!svg.dataset.autoDarkIconChecked) pendingSvgs.add(svg);
    }
  };

  const scheduleFlush = () => {
    if (flushScheduled || (!pending.size && !pendingSvgs.size)) return;
    flushScheduled = true;
    // rAF runs before the next paint, so new elements are tagged in the frame they first
    // show up in. Hidden tabs get no rAF; a timer keeps the queue from piling up there.
    if (document.hidden) setTimeout(flush, 250);
    else requestAnimationFrame(flush);
  };

  // Decides the class for one element without touching the DOM (same rules as before).
  const classify = (el) => {
    if (!el.isConnected || isTagged(el)) return null;
    // An img that has not finished loading reports 0x0, which would look like a spacer.
    // Its load/error event queues it again.
    if (el.localName === 'img' && !el.complete) return null;
    const view = el.ownerDocument.defaultView || window;
    const bg = el.style.backgroundImage || view.getComputedStyle(el).backgroundImage;
    if (!bg || bg === 'none' || !bg.includes('url(')) return null;
    return keepsItsOwnColors(el, bg) ? KEEP_CLASS : COUNTER_CLASS;
  };

  const flush = () => {
    flushScheduled = false;
    if (!isDarkActive()) {
      pending.clear();
      pendingSvgs.clear();
      return;
    }
    const start = performance.now();
    const writes = [];
    // Reads only, until the budget runs out; what is left goes to the next frame.
    for (const el of pending) {
      pending.delete(el);
      try {
        const cls = classify(el);
        if (cls) writes.push(el, cls);
      } catch (e) {
        // Ignore stylesheet security or cross-origin access errors
      }
      if (performance.now() - start > FLUSH_BUDGET_MS) break;
    }
    const svgWrites = [];
    for (const svg of pendingSvgs) {
      pendingSvgs.delete(svg);
      if (!svg.isConnected || svg.dataset.autoDarkIconChecked) continue;
      try {
        svgWrites.push(svg, isMonochromeDarkIcon(svg, svg.ownerDocument.defaultView || window));
      } catch (e) {
        // Ignore cross-origin or detached node errors
      }
      if (performance.now() - start > FLUSH_BUDGET_MS) break;
    }
    // Writes, all together, so the style reads above never force a recalculation per element.
    for (let i = 0; i < writes.length; i += 2) writes[i].classList.add(writes[i + 1]);
    for (let i = 0; i < svgWrites.length; i += 2) {
      svgWrites[i].dataset.autoDarkIconChecked = '1';
      if (svgWrites[i + 1]) svgWrites[i].classList.add(KEEP_CLASS);
    }
    scheduleFlush();
  };

  /**
   * Same-origin subframes (Gmail writes some about:blank iframes itself, where Chrome does
   * not always inject the content script) get the counter-inversion styles and their own
   * observer, keyed by document because document.open() replaces it.
   */
  const observedDocs = new WeakSet();

  const ensureSubframeStyle = (doc) => {
    if (doc.getElementById('auto-dark-gmail-styles-subframe')) return;
    const styleTag = doc.createElement('style');
    styleTag.id = 'auto-dark-gmail-styles-subframe';
    styleTag.textContent = COUNTER_INVERT_CSS;
    (doc.head || doc.documentElement).appendChild(styleTag);
  };

  const handleSubframe = (iframe) => {
    try {
      const doc = iframe.contentDocument;
      if (!doc || !doc.documentElement) return;
      ensureSubframeStyle(doc);
      if (observedDocs.has(doc)) return;
      observedDocs.add(doc);
      new MutationObserver((records) => {
        if (!isDarkActive()) return;
        ensureSubframeStyle(doc);
        onMutations(records);
      }).observe(doc.documentElement, OBSERVE_OPTIONS);
      queueTree(doc.documentElement);
      scheduleFlush();
    } catch (e) {
      // Ignore cross-origin access errors (handled by direct matches injection)
    }
  };

  const injectStylesIntoSubframes = () => {
    document.querySelectorAll('iframe').forEach(handleSubframe);
  };

  const onMutations = (records) => {
    for (const r of records) {
      if (r.type === 'childList') {
        for (const node of r.addedNodes) {
          if (node.nodeType !== 1) continue;
          queueTree(node);
          if (isTopFrame && node.localName === 'iframe') handleSubframe(node);
          if (node.localName === 'style' || node.localName === 'link') scheduleSweep(200);
        }
        continue;
      }
      const el = r.target;
      if (isTagged(el)) continue;
      if (r.attributeName === 'style') {
        queueElement(el);
      } else if (el.getElementsByTagName('*').length <= SMALL_SUBTREE) {
        queueTree(el);
      } else {
        queueElement(el);
      }
    }
    scheduleFlush();
  };

  const observer = new MutationObserver((records) => {
    // Gmail is a SPA and may remove injected styles; put ours back if it went away.
    if (!document.getElementById('auto-dark-gmail-styles')) applyTheme();
    if (isDarkActive()) onMutations(records);
  });
  let observing = false;

  /**
   * Idle-time safety net: re-checks every untagged element in small slices, so it never
   * becomes a long task. Also re-attaches to same-origin subframes and re-sends the dark
   * state to child frames (cheap; children ignore a state they already have).
   */
  let sweepTimer = 0;
  let sweepList = null;
  let sweepIndex = 0;
  const idle = window.requestIdleCallback || ((cb) => setTimeout(() => cb({ timeRemaining: () => 8 }), 50));

  const scheduleSweep = (delay = SWEEP_INTERVAL_MS) => {
    clearTimeout(sweepTimer);
    sweepTimer = setTimeout(() => {
      if (!isDarkActive()) return;
      sweepList = document.querySelectorAll(SCAN_SELECTOR);
      sweepIndex = 0;
      if (isTopFrame) injectStylesIntoSubframes();
      broadcastDarkToChildren(true);
      idle(sweepSlice);
    }, delay);
  };

  const sweepSlice = (deadline) => {
    if (!sweepList || !isDarkActive()) return;
    const writes = [];
    while (sweepIndex < sweepList.length && deadline.timeRemaining() > 2) {
      const el = sweepList[sweepIndex++];
      try {
        const cls = classify(el);
        if (cls) writes.push(el, cls);
      } catch (e) {
        // Ignore stylesheet security or cross-origin access errors
      }
    }
    for (let i = 0; i < writes.length; i += 2) writes[i].classList.add(writes[i + 1]);
    if (sweepIndex < sweepList.length) {
      idle(sweepSlice);
      return;
    }
    sweepList = null;
    document.querySelectorAll('svg').forEach(svg => {
      if (!svg.dataset.autoDarkIconChecked) pendingSvgs.add(svg);
    });
    scheduleFlush();
    scheduleSweep();
  };

  const applyTheme = () => {
    const styleTag = document.getElementById('auto-dark-gmail-styles');

    // Dark mode off: tear down our style tag (if any) and stop.
    if (!isDarkActive()) {
      if (styleTag) styleTag.remove();
      return;
    }

    // Dark mode on: make sure our style tag exists. The top frame gets the full
    // stylesheet; subframes get COUNTER_INVERT_CSS only, since the top frame is
    // already inverting the whole iframe for them.
    if (!styleTag) {
      const newStyleTag = document.createElement('style');
      newStyleTag.id = 'auto-dark-gmail-styles';
      newStyleTag.textContent = isTopFrame ? TOP_FRAME_CSS : COUNTER_INVERT_CSS;
      (document.head || document.documentElement).appendChild(newStyleTag);
    }
  };

  // Reacts to the effective dark state turning on or off (system setting or ancestor frame).
  let lastDark = null;
  const onThemeChange = () => {
    const dark = isDarkActive();
    applyTheme();
    if (dark === lastDark) return;
    lastDark = dark;
    if (dark) {
      if (!observing) {
        observer.observe(document.documentElement, OBSERVE_OPTIONS);
        observing = true;
      }
      queueTree(document.documentElement);
      scheduleFlush();
      if (isTopFrame) injectStylesIntoSubframes();
      scheduleSweep();
    } else {
      observer.disconnect();
      observing = false;
      clearTimeout(sweepTimer);
      sweepList = null;
      pending.clear();
      pendingSvgs.clear();
    }
    broadcastDarkToChildren(dark);
  };

  // Learn the dark state from an ancestor frame (see ancestorDark). Only a change does any
  // work; it is then relayed onward to our own child frames (for deeply nested widgets).
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || !isTrustedOrigin(event.origin)) return;
    if (data.__autoDarkGmailHello === true && event.source) {
      // A child frame just started and asks for the current state.
      try {
        event.source.postMessage({ __autoDarkGmail: true, dark: isDarkActive() }, '*');
      } catch (e) {
        // Ignore frames we cannot post to
      }
      return;
    }
    if (data.__autoDarkGmail !== true) return;
    ancestorDark = !!data.dark;
    onThemeChange();
  });

  // Images that were still loading when first seen, iframes that (re)load and late
  // stylesheets: load/error do not bubble, but a capturing listener still sees them.
  const onResourceEvent = (event) => {
    if (!isDarkActive()) return;
    const el = event.target;
    if (!el || el.nodeType !== 1) return;
    if (el.localName === 'img') {
      queueElement(el);
      scheduleFlush();
    } else if (el.localName === 'iframe') {
      if (isTopFrame) handleSubframe(el);
      try {
        el.contentWindow.postMessage({ __autoDarkGmail: true, dark: true }, '*');
      } catch (e) {
        // Ignore frames we cannot post to
      }
    } else if (el.localName === 'link') {
      scheduleSweep(200);
    }
  };
  document.addEventListener('load', onResourceEvent, true);
  document.addEventListener('error', onResourceEvent, true);

  // Listen for changes in the system preference (Light/Dark).
  darkModeQuery.addEventListener('change', onThemeChange);

  // Initial execution (may run before <head> exists at document_start). The observer also
  // sees everything the parser inserts from here on.
  onThemeChange();
  if (!isTopFrame) {
    try {
      window.parent.postMessage({ __autoDarkGmailHello: true }, '*');
    } catch (e) {
      // Ignore frames we cannot post to
    }
  }

  // Re-apply once the DOM is ready so the style is properly placed in <head>.
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    if (isDarkActive()) {
      if (isTopFrame) injectStylesIntoSubframes();
      broadcastDarkToChildren(true);
    }
  });
})();
