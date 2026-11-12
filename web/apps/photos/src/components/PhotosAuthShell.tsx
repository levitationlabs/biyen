import { AuthPageShell } from "ente-accounts/components/auth/AuthPageShell";
import type { AuthPresentationConfig } from "ente-accounts/components/auth/styles";
import { isDesktop } from "ente-base/app";
import { t } from "i18next";
import type React from "react";

interface PhotosAuthShellProps extends React.PropsWithChildren {
    contentWidth?: 400 | 420;
}

const photosAuthTheme: AuthPresentationConfig = {
    primary: "#C8502E",
    primaryHover: "#A53C1F",
    primaryActive: "#8B3016",
    focus: "#C8502E",
    focusDark: "#DE643F",
    link: "#C8502E",
    linkDark: "#DE643F",
    termsLink: "#C8502E",
    termsLinkDark: "#DE643F",
    passwordMessage: "#1A1513",
    passwordMessageDark: "#fff",
    textDisabledDark: "#4d4d4d",
    wideGamutPrimary: "color(display-p3 0.7843 0.3137 0.1804)",
    mobileBrandHeight: 196,
    illustrationHeights: { desktop: 219, tablet: 172, mobile: 127, wide: 249 },
};

export function PhotosAuthShell({
    children,
    contentWidth,
}: PhotosAuthShellProps): React.JSX.Element {
    return (
        <AuthPageShell
            brand={{
                headline: t("photos_auth_headline"),
                subtitle: t("photos_auth_subtitle"),
                bullets: [
                    t("intro_slide_1"),
                    t("photos_auth_no_ads_no_spying"),
                    t("auth_independently_audited"),
                ],
            }}
            presentationConfig={photosAuthTheme}
            contentWidth={contentWidth}
            viewportHeight={
                isDesktop
                    ? "calc(100svh - env(titlebar-area-height, 30px))"
                    : undefined
            }
        >
            {children}
        </AuthPageShell>
    );
}
