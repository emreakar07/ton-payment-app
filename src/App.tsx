import React, { useEffect } from 'react';
import './App.scss'
import {THEME, TonConnectUIProvider} from "@tonconnect/ui-react";
import { PaymentForm } from './components/PaymentForm/PaymentForm';
import './polyfills';

// Worker'ı import et
async function enableMocking() {
  if (process.env.NODE_ENV !== 'development') return;
  
  const { worker } = await import('./server/worker')
  return worker.start({
    onUnhandledRequest: 'bypass'
  })
}

// Worker'ı başlat
enableMocking();

function App() {
  // Telegram Mini App başlatma
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      // Mini App'i başlat
      tg.ready();
      // Tam ekran yap
      tg.expand();
      // Kapatma onayını aktifleştir
      tg.enableClosingConfirmation();
    }
  }, []);

  return (
      <TonConnectUIProvider
          manifestUrl="https://ton-payment-app.vercel.app/tonconnect-manifest.json"
          uiPreferences={{ theme: THEME.DARK }}
          walletsListConfiguration={{
            includeWallets: [
              {
                appName: "telegram-wallet",
                name: "Wallet",
                imageUrl: "https://wallet.tg/images/logo-288.png",
                aboutUrl: "https://wallet.tg/",
                universalLink: "https://t.me/wallet",
                bridgeUrl: "https://bridge.wallet.tg/bridge",
                jsBridgeKey: "telegram-wallet",
                platforms: ["ios", "android"]
              }
            ]
          }}
          actionsConfiguration={{
              twaReturnUrl: 'https://t.me/electronicpinbot',
              returnStrategy: 'back',
              modals: ['before', 'success', 'error']
          }}
      >
        <div className="app">
            <div className="main-content">
                <PaymentForm />
            </div>
        </div>
      </TonConnectUIProvider>
  )
}

export default App
