'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isReturnFromChild, readAdminPlace, writeAdminPlace } from '@/lib/admin-place';

/**
 * Keeps the admin's scroll position per page. Next resets the window to the top
 * on every navigation, and that reset also fires a scroll event, so the last
 * real position is snapshotted before she leaves and reapplied after she returns.
 */
export default function AdminPlaceMemory() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const previousPath = useRef(pathname);
  const lastUserY = useRef(0);
  const ignoreScroll = useRef(false);

  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    return () => {
      history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    pathnameRef.current = pathname;
    lastUserY.current = window.scrollY;

    const remember = (y: number) => {
      lastUserY.current = y;
      writeAdminPlace(pathname, y);
    };

    const onScroll = () => {
      if (ignoreScroll.current) return;
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
      ignoreScroll.current = true;
      remember(window.scrollY);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, true);
      if (!ignoreScroll.current) writeAdminPlace(pathname, lastUserY.current);
      ignoreScroll.current = false;
    };
  }, [pathname]);

  useEffect(() => {
    const from = previousPath.current;
    previousPath.current = pathname;
    if (from === pathname) return;
    if (!isReturnFromChild(from, pathname)) return;

    const target = readAdminPlace(pathname);
    if (target <= 0) return;

    let stopped = false;
    const stop = () => {
      stopped = true;
    };
    const started = performance.now();

    const apply = () => {
      if (stopped) return;
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const next = Math.min(target, max);
      if (Math.abs(window.scrollY - next) > 2) {
        ignoreScroll.current = true;
        window.scrollTo(0, next);
        ignoreScroll.current = false;
        lastUserY.current = next;
      }
    };

    let frame = 0;
    const tick = () => {
      apply();
      if (stopped || performance.now() - started > 700) return;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const observer = new ResizeObserver(() => apply());
    observer.observe(document.documentElement);
    const giveUp = window.setTimeout(stop, 8000);

    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    window.addEventListener('keydown', stop);

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.clearTimeout(giveUp);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
      window.removeEventListener('keydown', stop);
    };
  }, [pathname]);

  return null;
}
