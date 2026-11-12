import React, { useState } from "react";
import { Box, CssBaseline, Stack } from "@mui/material";
import { SudoModal } from "./SudoModal";
import { AdminHeader } from "./AdminHeader";
import { AdminNavigationRail } from "./AdminNavigationRail";
import { AdminBottomNav } from "./AdminBottomNav";
import type { BreadcrumbItem } from "./AdminHeader";

export const DRAWER_WIDTH = 250;
export const WARM_ARCHIVAL_LIGHT = "#FAFAFA";
export const WARM_ARCHIVAL_DARK = "#1F1916";

export interface AdminLayoutProps {
    children: React.ReactNode;
    title?: string;
    breadcrumbs?: BreadcrumbItem[];
    serverEndpoint?: string;
    onLogout?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
    children,
    title,
    breadcrumbs,
    serverEndpoint,
    onLogout,
}) => {
    const [sudoModalOpen, setSudoModalOpen] = useState(false);

    const handleOpenSudoModal = () => {
        setSudoModalOpen(true);
    };

    const handleCloseSudoModal = () => {
        setSudoModalOpen(false);
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                overflow: "hidden",
                bgcolor: "background.default",
            }}
        >
            <CssBaseline enableColorScheme />

            {/* Top Navbar matching Ente Web NavbarBase */}
            <AdminHeader
                title={title}
                breadcrumbs={breadcrumbs}
                serverEndpoint={serverEndpoint}
                onLogout={onLogout}
                onOpenSudoModal={handleOpenSudoModal}
            />

            {/* Workspace Row: 72px Vertical Navigation Rail + Page Content */}
            <Stack
                direction="row"
                sx={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    overflow: "hidden",
                }}
            >
                {/* 72px Vertical Navigation Rail (hidden on mobile, visible on sm+) */}
                <Box
                    sx={{
                        display: { xs: "none", sm: "block" },
                        height: "100%",
                    }}
                >
                    <AdminNavigationRail
                        onOpenSudoModal={handleOpenSudoModal}
                        onLogout={onLogout}
                    />
                </Box>

                {/* Primary Page Content Container */}
                <Box
                    component="main"
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        height: "100%",
                        overflowY: "auto",
                        p: { xs: 2, sm: 3, md: 4 },
                        pb: { xs: "72px", sm: 4 }, // Extra padding on mobile for docked bottom nav
                    }}
                >
                    <Box sx={{ maxWidth: 1400, mx: "auto" }}>
                        {children}
                    </Box>
                </Box>
            </Stack>

            {/* Docked Mobile Bottom Navigation Bar (< sm) */}
            <Box sx={{ display: { xs: "block", sm: "none" } }}>
                <AdminBottomNav />
            </Box>

            {/* Sudo Token Authentication & Renewal Modal */}
            <SudoModal
                open={sudoModalOpen}
                onClose={handleCloseSudoModal}
                onSuccess={handleCloseSudoModal}
            />
        </Box>
    );
};
