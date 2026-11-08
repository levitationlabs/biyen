import { AuthShell } from "@/components/AuthShell";
import { WebMaintenanceView } from "@/components/WebMaintenanceView";
import React from "react";

const SignUpPage: React.FC = () => (
    <AuthShell>
        <WebMaintenanceView />
    </AuthShell>
);

export default SignUpPage;
