import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

// The admin shell remains mounted between routes, so the browser otherwise
// carries a previous page's scroll offset into the next page.
export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
};
