module.exports = {
    i18n: {
        defaultLocale: 'fr',
        locales: ['fr', 'en'],
        localeDetection: false,
    },
    // next-i18next option (kept out of the native Next `i18n` block to avoid
    // the "Unrecognized key(s) ... defaultNS" warning)
    defaultNS: 'common', // 设置默认命名空间为 common
    reloadOnPrerender: process.env.NODE_ENV === 'development',
};