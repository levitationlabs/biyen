import type { CSSObject, Theme } from "@mui/material/styles";

const inter =
    '"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const sidebarHeadingFont = '"Outfit Variable", Outfit, sans-serif';

// Keep the settings palette local, including drawers and portalled menus.
export const sidebarStyles = (theme: Theme): CSSObject => {
    return {
        "--mui-palette-background-default": "#FBF8F2",
        "--mui-palette-background-paper": "#FFFFFF",
        "--mui-palette-background-paper2": "#F5ECE0",
        "--mui-palette-text-muted": "#666666",
        "--mui-palette-text-secondary": "#666666",
        "--mui-palette-text-faint": "#969696",
        "--mui-palette-fill-faint": "#F5ECE0",
        "--mui-palette-fill-fainter": "#FBF8F2",
        "--mui-palette-fill-muted": "#D2D2D2",
        "--mui-palette-fill-faintHover": "#F5ECE0",
        "--mui-palette-stroke-muted": "#E0E0E0",
        "--mui-palette-stroke-faint": "#EBEBEB",
        "--mui-palette-divider": "#EBEBEB",
        "--mui-palette-secondary-main": "#F5ECE0",
        "--mui-palette-secondary-dark": "#EBE0D2",
        "--mui-palette-primary-main": "#C8502E",
        "--mui-palette-primary-mainChannel": "200 80 46",
        "--mui-palette-primary-dark": "#A53C1F",
        "--mui-palette-primary-contrastText": "#FFFFFF",
        "--mui-palette-accent-main": "#C8502E",
        "--mui-palette-accent-mainChannel": "200 80 46",
        "--mui-palette-accent-dark": "#A53C1F",
        "--mui-palette-critical-main": "#F63A3A",
        "--mui-palette-critical-mainChannel": "246 58 58",
        "--mui-palette-critical-dark": "#DD3434",
        "--mui-palette-error-main": "#F63A3A",
        "--mui-palette-FilledInput-bg": "var(--mui-palette-background-default)",
        "--mui-palette-FilledInput-hoverBg":
            "var(--mui-palette-background-default)",
        "--mui-palette-backdrop-muted": "rgba(0, 0, 0, 0.4)",
        ...theme.applyStyles("dark", {
            "--mui-palette-background-default": "#1A1513",
            "--mui-palette-background-paper": "#261F1C",
            "--mui-palette-background-paper2": "#332A26",
            "--mui-palette-text-muted": "#999999",
            "--mui-palette-text-secondary": "#999999",
            "--mui-palette-fill-faint": "#261F1C",
            "--mui-palette-fill-fainter": "#1A1513",
            "--mui-palette-fill-muted": "#292929",
            "--mui-palette-fill-faintHover": "#261F1C",
            "--mui-palette-stroke-muted": "#4D3E38",
            "--mui-palette-stroke-faint": "#3A2F2A",
            "--mui-palette-divider": "#3A2F2A",
            "--mui-palette-secondary-main": "#261F1C",
            "--mui-palette-secondary-dark": "#1A1513",
        }),
        fontFamily: inter,
        "& .MuiTypography-h3:not([data-sidebar-subscription] *)": {
            fontSize: "18px",
            lineHeight: "24px",
        },
        "& .MuiTypography-small.MuiTypography-noWrap": { lineHeight: "16px" },
        "& .MuiTypography-h3 + .MuiTypography-small": {
            fontSize: "13px",
            lineHeight: "18px",
        },
        "& .MuiButton-root": { fontSize: "14px", fontWeight: 600 },
        "& .MuiButton-root:has(> .MuiStack-root):hover": {
            backgroundColor: "var(--mui-palette-background-default)",
        },
        "& .MuiInputBase-root": { fontSize: "14px" },
        "& .MuiInputBase-input::placeholder": { color: "#969696", opacity: 1 },
        "& .MuiIconButton-root:hover": {
            backgroundColor:
                "color-mix(in srgb, var(--mui-palette-text-base) 8%, var(--mui-palette-background-paper))",
        },
        "& .MuiSwitch-root": {
            "--mui-palette-primary-main":
                theme.colorSchemes.light?.palette.primary.main,
            "--mui-palette-fill-muted":
                theme.colorSchemes.light?.palette.fill.muted,
            "--mui-palette-stroke-muted":
                theme.colorSchemes.light?.palette.stroke.muted,
            "--mui-palette-stroke-faint":
                theme.colorSchemes.light?.palette.stroke.faint,
            ...theme.applyStyles("dark", {
                "--mui-palette-primary-main":
                    theme.colorSchemes.dark?.palette.primary.main,
                "--mui-palette-fill-muted":
                    theme.colorSchemes.dark?.palette.fill.muted,
                "--mui-palette-stroke-muted":
                    theme.colorSchemes.dark?.palette.stroke.muted,
                "--mui-palette-stroke-faint":
                    theme.colorSchemes.dark?.palette.stroke.faint,
            }),
        },
        "& .ente-chevron-right:not([data-sidebar-subscription] *)": {
            color: "#969696",
        },
    };
};

export const sidebarTheme = (theme: Theme): Theme => {
    const colors = sidebarStyles(theme);

    return {
        ...theme,
        typography: {
            ...theme.typography,
            fontFamily: inter,
            fontWeightRegular: 400,
            fontWeightMedium: 500,
            h2: {
                ...theme.typography.h2,
                fontFamily: sidebarHeadingFont,
                fontSize: "24px",
                lineHeight: "32px",
                fontWeight: 600,
            },
            h3: { ...theme.typography.h3, fontFamily: inter },
            h5: {
                ...theme.typography.h5,
                fontSize: "18px",
                lineHeight: "24px",
            },
            body: {
                ...theme.typography.body,
                fontFamily: inter,
                fontSize: "14px",
                fontWeight: 400,
            },
            small: {
                ...theme.typography.small,
                fontSize: "12px",
                lineHeight: "16px",
                fontWeight: 400,
            },
            mini: {
                ...theme.typography.mini,
                lineHeight: "16px",
                fontWeight: 400,
            },
        },
        components: {
            ...theme.components,
            MuiDialog: {
                ...theme.components?.MuiDialog,
                styleOverrides: {
                    ...theme.components?.MuiDialog?.styleOverrides,
                    root: [
                        theme.components?.MuiDialog?.styleOverrides?.root,
                        colors,
                    ],
                },
            },
            MuiDrawer: {
                ...theme.components?.MuiDrawer,
                styleOverrides: {
                    ...theme.components?.MuiDrawer?.styleOverrides,
                    root: [
                        theme.components?.MuiDrawer?.styleOverrides?.root,
                        colors,
                    ],
                },
            },
            MuiPopover: {
                ...theme.components?.MuiPopover,
                styleOverrides: {
                    ...theme.components?.MuiPopover?.styleOverrides,
                    root: [
                        theme.components?.MuiPopover?.styleOverrides?.root,
                        colors,
                    ],
                },
            },
        },
    };
};
