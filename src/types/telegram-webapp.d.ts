declare global {
    interface Window {
        Telegram?: {
            WebApp: {
                sendData: (data: string) => void;
                close: () => void;
            }
        }
    }
}

export {}; 