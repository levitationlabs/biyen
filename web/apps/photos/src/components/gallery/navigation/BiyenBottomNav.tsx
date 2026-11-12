// Biyen Photos — Docked Bottom Navigation Bar (Mobile Viewport)
// Copyright 2026 Levitation — AGPL-3.0-or-later

import {
    Album02Icon,
    Image01Icon,
    Search01Icon,
    Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import type { GalleryNavigationState } from "./navigation-state";
import { usePhotosNavigation } from "./PhotosNavigationContext";

interface BiyenBottomNavProps {
    navigation: GalleryNavigationState;
    isHome: boolean;
    onOpenSearch: () => void;
    onOpenSettings: () => void;
}

interface BottomNavItem {
    id: "photos" | "albums" | "search" | "settings";
    label: string;
    icon: typeof Image01Icon;
    selected: boolean;
    onClick: () => void;
}

export const BiyenBottomNav: React.FC<BiyenBottomNavProps> = ({
    navigation,
    isHome,
    onOpenSearch,
    onOpenSettings,
}) => {
    const { t } = useTranslation();
    const { goHome, openSection } = usePhotosNavigation();

    const currentSection = navigation.destination.section;
    const isSearchActive = navigation.overlay?.section === "search";

    const items: BottomNavItem[] = [
        {
            id: "photos",
            label: t("photos"),
            icon: Image01Icon,
            selected: isHome && !isSearchActive,
            onClick: goHome,
        },
        {
            id: "albums",
            label: t("albums"),
            icon: Album02Icon,
            selected: currentSection === "albums" && !isHome && !isSearchActive,
            onClick: () => openSection("albums"),
        },
        {
            id: "search",
            label: t("search"),
            icon: Search01Icon,
            selected: isSearchActive,
            onClick: onOpenSearch,
        },
        {
            id: "settings",
            label: t("settings"),
            icon: Settings01Icon,
            selected: false,
            onClick: onOpenSettings,
        },
    ];

    return (
        <Box
            component="nav"
            aria-label="Mobile Navigation"
            sx={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1200,
                height: 64,
                bgcolor: "background.paper",
                backdropFilter: "blur(20px)",
                borderTop: "1px solid",
                borderColor: "divider",
                pb: "env(safe-area-inset-bottom, 0px)",
            }}
        >
            <Stack
                direction="row"
                sx={{
                    height: "100%",
                    alignItems: "center",
                    justifyContent: "space-around",
                    px: 1,
                }}
            >
                {items.map((item) => {
                    const activeColor = "accent.main";
                    const inactiveColor = "text.muted";

                    return (
                        <ButtonBase
                            key={item.id}
                            onClick={item.onClick}
                            aria-label={item.label}
                            aria-current={item.selected ? "page" : undefined}
                            sx={{
                                flex: 1,
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 0.5,
                                color: item.selected ? activeColor : inactiveColor,
                                transition: "color 0.15s ease",
                                borderRadius: "8px",
                                "&:focus-visible": {
                                    outline: "2px solid",
                                    outlineColor: "accent.main",
                                    outlineOffset: -2,
                                },
                            }}
                        >
                            <HugeiconsIcon
                                icon={item.icon}
                                size={22}
                                strokeWidth={item.selected ? 2.2 : 1.8}
                            />
                            <Typography
                                variant="tiny"
                                sx={{
                                    fontWeight: item.selected ? 700 : 500,
                                    fontSize: "0.6875rem",
                                    lineHeight: 1,
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {item.label}
                            </Typography>
                        </ButtonBase>
                    );
                })}
            </Stack>
        </Box>
    );
};
