import "@fontsource-variable/inter";
import "@fontsource-variable/outfit";
import { CssBaseline } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { photosTheme } from "ente-base/components/utils/theme";
import { CustomHead } from "ente-base/components/Head";
import type { AppProps } from "next/app";
import React from "react";

const OUTFIT_FONT_FAMILY = '"Outfit Variable", Outfit, sans-serif';
const INTER_FONT_FAMILY = '"Inter Variable", Inter, sans-serif';

export const adminTheme = createTheme(photosTheme, {
    typography: {
        fontFamily: INTER_FONT_FAMILY,
        h1: { fontFamily: OUTFIT_FONT_FAMILY, fontWeight: 600 },
        h2: { fontFamily: OUTFIT_FONT_FAMILY, fontWeight: 600 },
        h3: { fontFamily: OUTFIT_FONT_FAMILY, fontWeight: 600 },
        h4: { fontFamily: OUTFIT_FONT_FAMILY, fontWeight: 600 },
        h5: { fontFamily: OUTFIT_FONT_FAMILY, fontWeight: 600 },
        h6: { fontFamily: OUTFIT_FONT_FAMILY, fontWeight: 600 },
    },
    components: {
        MuiTypography: {
            styleOverrides: {
                h1: { fontFamily: OUTFIT_FONT_FAMILY },
                h2: { fontFamily: OUTFIT_FONT_FAMILY },
                h3: { fontFamily: OUTFIT_FONT_FAMILY },
                h4: { fontFamily: OUTFIT_FONT_FAMILY },
                h5: { fontFamily: OUTFIT_FONT_FAMILY },
                h6: { fontFamily: OUTFIT_FONT_FAMILY },
            },
        },
    },
});

const AdminApp: React.FC<AppProps> = ({ Component, pageProps }) => {
    return (
        <ThemeProvider theme={adminTheme}>
            <CustomHead title="Biyen Admin" />
            <CssBaseline enableColorScheme />
            <Component {...pageProps} />
        </ThemeProvider>
    );
};

export default AdminApp;
