module.exports = {
    i18n: {
        defaultLocale: 'fr',
        locales: ['fr', 'en'],
        localeDetection: false,
        defaultNS: 'common', // 设置默认命名空间为 common
    },
    reloadOnPrerender: process.env.NODE_ENV === 'development',
};