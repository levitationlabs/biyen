import "@fontsource-variable/inter";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { photosTheme } from "ente-base/components/utils/theme";
import { CustomHead } from "ente-base/components/Head";
import type { AppProps } from "next/app";
import React from "react";

const AdminApp: React.FC<AppProps> = ({ Component, pageProps }) => {
    return (
        <ThemeProvider theme={photosTheme}>
            <CustomHead title="Biyen Admin" />
            <CssBaseline enableColorScheme />
            <Component {...pageProps} />
        </ThemeProvider>
    );
};

export default AdminApp;
