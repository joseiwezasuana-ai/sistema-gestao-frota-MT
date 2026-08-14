import { useState, useEffect } from 'react';
import { getScreenDimensions, initScreenSizeWatcher, type ScreenDimensions } from './screenDetector';

export function useScreenSize(): ScreenDimensions {
  const [dimensions, setDimensions] = useState<ScreenDimensions>(getScreenDimensions);

  useEffect(() => {
    const cleanup = initScreenSizeWatcher((dims) => {
      setDimensions(dims);
    });
    return cleanup;
  }, []);

  return dimensions;
}

export default useScreenSize;
