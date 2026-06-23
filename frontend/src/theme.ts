// src/theme.ts
import {
    extendTheme,
    type ThemeConfig,
    type StyleFunctionProps,
} from "@chakra-ui/react";

const config: ThemeConfig = {
    initialColorMode: "light",
    useSystemColorMode: false,
};

const theme = extendTheme({
    config,

    styles: {
        global: (props: StyleFunctionProps) => ({
            body: {
                bg: props.colorMode === "dark" ? "gray.900" : "white",
                color: props.colorMode === "dark" ? "gray.100" : "gray.800",
                lineHeight: "base",
            },
        }),
    },

    components: {
        Button: {
            variants: {
                solid: (props: StyleFunctionProps) => {
                    if (props.colorMode !== "dark") return {}; // ✅ 保持浅色默认
                    return {
                        bg: "blue.300",
                        color: "gray.900",
                        _hover: { bg: "blue.400" },
                    };
                },
            },
        },

        IconButton: {
            defaultProps: {
                variant: "ghost",
            },
            variants: {
                ghost: (props: StyleFunctionProps) => {
                    if (props.colorMode !== "dark") return {};
                    return {
                        bg: "blue.500",
                        color: "white",
                        _hover: { bg: "blue.600" },
                    };
                },
            },
        },

        Select: {
            variants: {
                outline: (props: StyleFunctionProps) => {
                    if (props.colorMode !== "dark") return {};
                    return {
                        field: {
                            bg: "gray.800",
                            borderColor: "gray.600",
                            color: "gray.100",
                            _hover: { borderColor: "gray.500" },
                            _placeholder: { color: "gray.400" },
                        },
                    };
                },
            },
        },

        Input: {
            variants: {
                outline: (props: StyleFunctionProps) => {
                    if (props.colorMode !== "dark") return {};
                    return {
                        field: {
                            bg: "gray.800",
                            borderColor: "gray.600",
                            color: "gray.100",
                            _hover: { borderColor: "gray.500" },
                            _placeholder: { color: "gray.400" },
                        },
                    };
                },
            },
        },

        Table: {
            baseStyle: (props: StyleFunctionProps) => {
                if (props.colorMode !== "dark") return {};
                return {
                    th: {
                        bg: "gray.800",
                        color: "gray.200",
                    },
                    td: {
                        color: "gray.100",
                    },
                };
            },
        },

        Modal: {
            baseStyle: (props: StyleFunctionProps) => ({
                dialog: {
                    bg: props.colorMode === "dark" ? "gray.800" : "white",
                },
            }),
        },
    },
});

export default theme;
