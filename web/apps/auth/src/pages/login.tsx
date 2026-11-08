import { AuthShell } from "@/components/AuthShell";
import { WebMaintenanceView } from "@/components/WebMaintenanceView";
import React from "react";

const LoginPage: React.FC = () => (
    <AuthShell>
        <WebMaintenanceView />
    </AuthShell>
);

export default LoginPage;
