import * as React from "react";
import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import type { AppProps } from "next/app";
import { appWithTranslation, i18n } from "next-i18next";
import { useRouter } from "next/router";
import { SWRConfig } from 'swr';
import { fetcher } from '@/utils/fetcher';
import theme from "@/theme";

import { AuthProvider } from "@/contexts/AuthContext";
import { ProjectProvider } from '@/contexts/ProjectContext';

import type { ReactElement, ReactNode } from 'react';
import type { NextPage } from 'next';

// 新增：支持页面级 Layout
export type NextPageWithLayout = NextPage & {
    getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
    Component: NextPageWithLayout;
};

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
    const router = useRouter();
    const [isLocaleReady, setIsLocaleReady] = React.useState(false);

    React.useEffect(() => {
        const locale = router.locale ?? "fr";
        const syncLanguage = async () => {
            if (i18n && i18n.language !== locale) {
                await i18n.changeLanguage(locale);
                await i18n.reloadResources();
            }
            setIsLocaleReady(true);
        };
        syncLanguage();
    }, [router.locale]);

    if (!isLocaleReady) return null;

    // 支持页面自定义 Layout，默认返回原页面
    const getLayout = Component.getLayout ?? ((page) => page);

    return (
        <>
            <ColorModeScript initialColorMode={theme.config.initialColorMode} />
            <ChakraProvider theme={theme}>
                <SWRConfig value={{ fetcher }}>
                    <AuthProvider>
                        <ProjectProvider>
                            {getLayout(<Component {...pageProps} />)}
                        </ProjectProvider>
                    </AuthProvider>
                </SWRConfig>
            </ChakraProvider>
        </>
    );
}

export default appWithTranslation(MyApp);
