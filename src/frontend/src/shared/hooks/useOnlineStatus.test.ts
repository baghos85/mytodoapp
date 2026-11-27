import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { reportNetworkFailure, reportNetworkSuccess } from '../lib/connectivity';
import { useOnlineStatus } from './useOnlineStatus';

function goOffline() {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  window.dispatchEvent(new Event('offline'));
}

function goOnline() {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  window.dispatchEvent(new Event('online'));
}

describe('useOnlineStatus', () => {
  it('useOnlineStatus_BrowserOnline_ReturnsTrue', () => {
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);
  });

  it('useOnlineStatus_OfflineThenOnlineEvents_FollowsTheBrowser', () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(goOffline);
    expect(result.current).toBe(false);

    act(goOnline);
    expect(result.current).toBe(true);
  });

  it('useOnlineStatus_RequestFailedWithNetworkError_ReturnsFalseUntilNextResponse', () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(reportNetworkFailure);
    expect(result.current).toBe(false);

    act(reportNetworkSuccess);
    expect(result.current).toBe(true);
  });

  it('useOnlineStatus_StartsWhileBrowserOffline_ReturnsFalse', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(false);
  });
});
