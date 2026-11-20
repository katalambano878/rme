'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  controlKey,
  isRememberedInputType,
  isReturnFromChild,
  readAdminPlace,
  readSavedControls,
  writeAdminPlace,
  writeSavedControls,
  type SavedControl,
} from '@/lib/admin-place';

/** How long a restore keeps waiting for a slow list to load before giving up. */
const RESTORE_TIMEOUT_MS = 15_000;
/** After this, scroll even if a remembered filter never reappeared. */
const CONTROLS_GRACE_MS = 1_500;
/** Back/Forward's popstate arrives just after the page switch; wait this long for it. */
const HISTORY_EVENT_WAIT_MS = 60;

type Control = HTMLInputElement | HTMLSelectElement;

/** Search boxes and filter dropdowns on the page itself (not the menu or a pop-up). */
function pageControls(): { key: string; el: Control }[] {
  const main = document.querySelector('main');
  if (!main) return [];
  const seen = new Map<string, number>();
  const out: { key: string; el: Control }[] = [];
  for (const el of main.querySelectorAll<Control>('input, select')) {
    if (el.closest('[role="dialog"]')) continue;
    const tag = el instanceof HTMLSelectElement ? 'select' : 'input';
    const type = tag === 'input' ? (el as HTMLInputElement).type || 'text' : '';
    if (tag === 'input' && !isRememberedInputType(type)) continue;
    const label =
      el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('name') || el.id || '';
    const base = `${tag}:${type}:${label}`;
    const index = seen.get(base) ?? 0;
    seen.set(base, index + 1);
    out.push({ key: controlKey({ tag, type, label, index }), el });
  }
  return out;
}

/** Fields the admin changed from their starting value. */
function snapshotControls(): SavedControl[] {
  return pageControls()
    .filter(({ el }) => (el instanceof HTMLSelectElement ? el.selectedIndex > 0 : el.value !== ''))
    .map(({ key, el }) => ({ key, value: el.value }));
}

/** Set a React-controlled field the way typing would, so the page re-filters. */
function setControlValue(el: Control, value: string): boolean {
  if (el.value === value) return true;
  if (el instanceof HTMLSelectElement && ![...el.options].some((o) => o.value === value)) return false;
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  return true;
}

/**
 * Keeps the admin's place on every admin page. When she opens something (an
 * order, a product, a customer) and comes back, with the page's Back link or
 * the browser's Back button, the page returns to where she was scrolled, with
 * the same search and filters, so the same rows are on screen.
 *
 * Next resets the window to the top on every navigation, and that reset also
 * fires a scroll event, so positions are tracked from real scrolling and
 * reapplied after she returns.
 */
export default function AdminPlaceMemory() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const lastUserY = useRef(0);
  const ignoreScroll = useRef(false);
  /** True while a restore is running; its own scrolling must not be saved. */
  const restoring = useRef(false);
  /** Set by the browser's Back/Forward, which should always restore. */
  const historyNav = useRef(false);

  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    const onPop = () => {
      historyNav.current = true;
    };
    // Only marks the navigation; the restore effect waits for this (see HISTORY_EVENT_WAIT_MS).
    window.addEventListener('popstate', onPop, { capture: true });
    return () => {
      history.scrollRestoration = previous;
      window.removeEventListener('popstate', onPop, { capture: true });
    };
  }, []);

  useEffect(() => {
    lastUserY.current = window.scrollY;

    const remember = (y: number) => {
      lastUserY.current = y;
      writeAdminPlace(pathname, y);
    };

    const onScroll = () => {
      if (ignoreScroll.current || restoring.current) return;
      const y = window.scrollY;
      // The router jumps to 0 the moment a link is clicked, before this page unmounts.
      if (y === 0 && lastUserY.current > 80) return;
      remember(y);
    };

    const onClick = (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!link || link.getAttribute('target') === '_blank') return;
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('/') || href.startsWith('//')) return;
      const next = href.split('?')[0]?.split('#')[0] ?? '';
      if (!next || next === pathname) return;
      historyNav.current = false;
      ignoreScroll.current = true;
      remember(window.scrollY);
    };

    // Typing in a search box or picking a filter: remember it for this page.
    let pending = 0;
    const onEdit = (event: Event) => {
      if (restoring.current) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      if (!target.closest('main') || target.closest('[role="dialog"]')) return;
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => writeSavedControls(pathname, snapshotControls()));
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onEdit, true);
    document.addEventListener('change', onEdit, true);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('input', onEdit, true);
      document.removeEventListener('change', onEdit, true);
      cancelAnimationFrame(pending);
      if (!ignoreScroll.current && !restoring.current) writeAdminPlace(pathname, lastUserY.current);
      ignoreScroll.current = false;
    };
  }, [pathname]);

  useEffect(() => {
    const from = previousPath.current;
    previousPath.current = pathname;
    if (from === pathname) return;

    // Read what was remembered now, before the router's jump to the top can
    // be mistaken for her scrolling. Saving pauses until the decision below.
    const target = readAdminPlace(pathname);
    const controls = readSavedControls(pathname);
    restoring.current = true;

    let finished = false;
    let timer = 0;
    let observer: ResizeObserver | null = null;

    const stopListeners = () => {
      window.removeEventListener('wheel', finish);
      window.removeEventListener('touchmove', finish);
      window.removeEventListener('keydown', finish);
    };

    /** `save` is false when leaving the page: by then the window may already show the next page. */
    const end = (save: boolean) => {
      if (finished) return;
      finished = true;
      restoring.current = false;
      window.clearTimeout(decide);
      window.clearInterval(timer);
      observer?.disconnect();
      stopListeners();
      if (!save) return;
      // Save wherever the restore ended so the next return starts from here.
      lastUserY.current = window.scrollY;
      writeAdminPlace(pathname, window.scrollY);
    };
    const finish = () => end(true);

    const start = () => {
      const pendingControls = new Map(controls.map((c) => [c.key, c.value]));
      const started = performance.now();
      let settledAt = 0;

      const step = () => {
        if (finished) return;
        const elapsed = performance.now() - started;

        if (pendingControls.size > 0) {
          for (const { key, el } of pageControls()) {
            const value = pendingControls.get(key);
            if (value !== undefined && setControlValue(el, value)) pendingControls.delete(key);
          }
        }
        // Scroll once the filters are back (or have had their chance), so the
        // remembered position refers to the same rows.
        if (pendingControls.size === 0 || elapsed > CONTROLS_GRACE_MS) {
          const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          const next = Math.min(target, max);
          if (Math.abs(window.scrollY - next) > 2) {
            window.scrollTo(0, next);
            settledAt = 0;
          } else if (next >= target - 2) {
            // Reached; hold briefly in case late content shifts the page.
            settledAt ||= performance.now();
            if (performance.now() - settledAt > 600) return finish();
          }
        }
        if (elapsed > RESTORE_TIMEOUT_MS) finish();
      };

      timer = window.setInterval(step, 100);
      observer = new ResizeObserver(step);
      observer.observe(document.documentElement);
      window.addEventListener('wheel', finish, { passive: true });
      window.addEventListener('touchmove', finish, { passive: true });
      window.addEventListener('keydown', finish);
      requestAnimationFrame(step);
    };

    // The browser reports Back/Forward (popstate) a moment *after* the router
    // has already switched pages, so decide once it has had the chance.
    const decide = window.setTimeout(() => {
      const viaHistory = historyNav.current;
      historyNav.current = false;
      // Back/Forward always returns her to her place; a link only does when it
      // leads back out of a detail (an order's "Back" arrow, "All products"…).
      // Opening a page fresh from the menu starts it clean.
      if (!viaHistory && !isReturnFromChild(from, pathname)) {
        writeSavedControls(pathname, []);
        finished = true;
        restoring.current = false;
        return;
      }
      if (target <= 0 && controls.length === 0) {
        finished = true;
        restoring.current = false;
        return;
      }
      start();
    }, HISTORY_EVENT_WAIT_MS);

    return () => end(false);
  }, [pathname]);

  return null;
}
