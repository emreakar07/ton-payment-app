interface TelegramWebAppInitData {
    query_id?: string;
    user?: {
        id: number;
        first_name: string;
        last_name?: string;
        username?: string;
        language_code?: string;
    };
    auth_date: number;
    hash: string;
}

interface TelegramWebAppMainButton {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive: boolean) => void;
    hideProgress: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    setText: (text: string) => void;
}

interface TelegramWebApp {
    ready: () => void;
    close: () => void;
    expand: () => void;
    sendData: (data: string) => void;
    backgroundColor: string;
    textColor: string;
    MainButton: TelegramWebAppMainButton;
    initData: string;
    initDataUnsafe: TelegramWebAppInitData;
    colorScheme: 'light' | 'dark';
    themeParams: {
        bg_color: string;
        text_color: string;
        hint_color: string;
        link_color: string;
        button_color: string;
        button_text_color: string;
    };
    isExpanded: boolean;
    viewportHeight: number;
    viewportStableHeight: number;
}

declare global {
    interface Window {
        Telegram?: {
            WebApp: TelegramWebApp;
        };
    }
}

export {}; 