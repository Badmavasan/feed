'use client';

import { useRouter } from 'next/router';
import {Button, Menu, MenuButton, MenuItem, MenuList, Portal} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { useTranslation } from 'next-i18next';

const LanguageSwitcher = () => {
    const router = useRouter();
    const { locale, pathname, query, asPath } = router;
    const { i18n } = useTranslation('common');

    const changeLanguage = async (newLocale: string) => {
        if (newLocale === locale) return;

        await i18n.changeLanguage(newLocale); // ✅ 客户端切换语言
        router.replace({ pathname, query }, asPath, { locale: newLocale }); // ✅ 替换 URL，不刷新
    };


    return (
        <Menu>
            <MenuButton as={Button} rightIcon={<ChevronDownIcon />} size="sm">
                {(locale ?? 'fr').toUpperCase()}
            </MenuButton>

            <Portal>
            <MenuList minW="unset">
                <MenuItem onClick={() => changeLanguage('fr')}>FR</MenuItem>
                <MenuItem onClick={() => changeLanguage('en')}>EN</MenuItem>
            </MenuList>
            </Portal>
        </Menu>
    );
};

export default LanguageSwitcher;
