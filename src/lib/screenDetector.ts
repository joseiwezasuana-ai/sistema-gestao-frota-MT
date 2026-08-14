// Dynamic Screen Size Detection & Mobile Viewport Lock for JIS ANGOLA / SUPER Táxi
// Ensures responsive adaptation across all mobile phone screen resolutions (iPhone SE, Galaxy, Pixel, Xiaomi, etc.)

export interface ScreenDimensions {
  width: number;
  height: number;
  visualWidth: number;
  visualHeight: number;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  orientation: 'portrait' | 'landscape';
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmallScreen: boolean; // < 375px
  touchCapable: boolean;
  screenType: 'compact' | 'standard' | 'large' | 'tablet' | 'desktop';
}

export function getScreenDimensions(): ScreenDimensions {
  if (typeof window === 'undefined') {
    return {
      width: 390,
      height: 844,
      visualWidth: 390,
      visualHeight: 844,
      screenWidth: 390,
      screenHeight: 844,
      pixelRatio: 1,
      orientation: 'portrait',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isSmallScreen: false,
      touchCapable: true,
      screenType: 'standard'
    };
  }

  const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
  const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  const visualWidth = window.visualViewport?.width ?? width;
  const visualHeight = window.visualViewport?.height ?? height;
  const screenWidth = window.screen?.width || width;
  const screenHeight = window.screen?.height || height;
  const pixelRatio = window.devicePixelRatio || 1;
  const orientation: 'portrait' | 'landscape' = width > height ? 'landscape' : 'portrait';
  const touchCapable = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  const isMobile = width < 768 || (touchCapable && width < 1024);
  const isTablet = width >= 768 && width < 1024 && !touchCapable;
  const isDesktop = width >= 1024;
  const isSmallScreen = width < 375;

  let screenType: 'compact' | 'standard' | 'large' | 'tablet' | 'desktop' = 'standard';
  if (width < 375) screenType = 'compact';
  else if (width < 450) screenType = 'standard';
  else if (width < 768) screenType = 'large';
  else if (width < 1024) screenType = 'tablet';
  else screenType = 'desktop';

  return {
    width,
    height,
    visualWidth,
    visualHeight,
    screenWidth,
    screenHeight,
    pixelRatio,
    orientation,
    isMobile,
    isTablet,
    isDesktop,
    isSmallScreen,
    touchCapable,
    screenType
  };
}

/**
 * Updates CSS custom properties on documentElement to lock mobile interfaces
 * and provide exact viewport metrics to all CSS and responsive layout rules.
 */
export function applyScreenMetricsToDom(dims: ScreenDimensions = getScreenDimensions()): void {
  if (typeof document === 'undefined') return;

  const doc = document.documentElement;
  const vh = dims.visualHeight * 0.01;
  const vw = dims.visualWidth * 0.01;

  doc.style.setProperty('--app-height', `${dims.visualHeight}px`);
  doc.style.setProperty('--app-width', `${dims.visualWidth}px`);
  doc.style.setProperty('--vh', `${vh}px`);
  doc.style.setProperty('--vw', `${vw}px`);
  doc.style.setProperty('--real-inner-height', `${dims.height}px`);
  doc.style.setProperty('--real-inner-width', `${dims.width}px`);
  doc.style.setProperty('--device-pixel-ratio', `${dims.pixelRatio}`);

  doc.setAttribute('data-screen-width', String(Math.round(dims.width)));
  doc.setAttribute('data-screen-height', String(Math.round(dims.height)));
  doc.setAttribute('data-screen-type', dims.screenType);
  doc.setAttribute('data-is-mobile', String(dims.isMobile));
  doc.setAttribute('data-orientation', dims.orientation);
}

/**
 * Initializes listeners for window resize, orientationchange, and visualViewport changes.
 */
export function initScreenSizeWatcher(onChange?: (dims: ScreenDimensions) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let ticking = false;

  const handleUpdate = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const dims = getScreenDimensions();
        applyScreenMetricsToDom(dims);
        if (onChange) {
          onChange(dims);
        }
        ticking = false;
      });
      ticking = true;
    }
  };

  // Initial execution
  applyScreenMetricsToDom();

  window.addEventListener('resize', handleUpdate, { passive: true });
  window.addEventListener('orientationchange', handleUpdate, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleUpdate, { passive: true });
    window.visualViewport.addEventListener('scroll', handleUpdate, { passive: true });
  }

  // Periodic safety check for mobile virtual keyboards or browser address bar collapses
  const intervalId = window.setInterval(handleUpdate, 2000);

  return () => {
    window.removeEventListener('resize', handleUpdate);
    window.removeEventListener('orientationchange', handleUpdate);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', handleUpdate);
      window.visualViewport.removeEventListener('scroll', handleUpdate);
    }
    window.clearInterval(intervalId);
  };
}
