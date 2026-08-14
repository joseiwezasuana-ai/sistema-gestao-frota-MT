import React from 'react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
  pullThreshold?: number;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ children }) => {
  return <>{children}</>;
};
