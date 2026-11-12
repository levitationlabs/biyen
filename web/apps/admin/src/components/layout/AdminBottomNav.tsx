import React from "react";
import { useRouter } from "next/router";
import { Box, Stack, Typography, ButtonBase } from "@mui/material";
import {
    DashboardSquare01Icon,
    UserMultiple02Icon,
    Shield01Icon,
    Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface AdminBottomNavItem {
    label: string;
    href: string;
    icon: typeof DashboardSquare01Icon;
}

const BOTTOM_NAV_ITEMS: AdminBottomNavItem[] = [
    { label: "Dashboard", href: "/", icon: DashboardSquare01Icon },
    { label: "Pengguna", href: "/users", icon: UserMultiple02Icon },
    { label: "Abuse", href: "/abuse", icon: Shield01Icon },
    { label: "Sistem", href: "/system", icon: Settings01Icon },
];

export const AdminBottomNav: React.FC = () => {
    const router = useRouter();
    const currentPath = router.pathname;

    const isItemActive = (href: string): boolean => {
        if (href === "/") {
            return currentPath === "/";
        }
        return currentPath.startsWith(href);
    };

    return (
        <Box
            component="nav"
            aria-label="Admin Mobile Navigation"
            sx={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1200,
                height: 60,
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
                {BOTTOM_NAV_ITEMS.map((item) => {
                    const active = isItemActive(item.href);
                    return (
                        <ButtonBase
                            key={item.href}
                            onClick={() => router.push(item.href)}
                            aria-label={item.label}
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                minWidth: 64,
                                py: 0.5,
                                px: 1,
                                borderRadius: "8px",
                                color: active ? "accent.main" : "text.muted",
                                transition: "color 0.15s ease",
                            }}
                        >
                            <HugeiconsIcon icon={item.icon} size={20} strokeWidth={1.8} />
                            <Typography
                                sx={{
                                    fontSize: "0.6875rem",
                                    fontWeight: active ? 600 : 500,
                                    fontFamily: '"Inter Variable", Inter, sans-serif',
                                    mt: "2px",
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
