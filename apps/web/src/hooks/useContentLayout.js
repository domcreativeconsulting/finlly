import { useIsMobile } from './useMediaQuery.js';

export function useContentLayout() {
  const isMobile = useIsMobile();
  return {
    isMobile,
    contentStyle: isMobile
      ? { marginLeft: 0, paddingBottom: '80px' }
      : { marginLeft: '108px' },
  };
}
