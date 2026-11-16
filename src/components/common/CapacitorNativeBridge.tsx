import React, { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useApp } from '../../context/AppContext';

export const CapacitorNativeBridge: React.FC = () => {
  const { canGoBack, goBack } = useApp();
  const canGoBackRef = useRef(canGoBack);
  const goBackRef = useRef(goBack);

  canGoBackRef.current = canGoBack;
  goBackRef.current = goBack;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (Capacitor.getPlatform() === 'android') {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#0f172a' }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    }

    const listenerPromise = CapApp.addListener('backButton', ({ canGoBack: webCanGoBack }) => {
      if (canGoBackRef.current) {
        goBackRef.current();
      } else if (webCanGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    });

    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, []);

  return null;
};
