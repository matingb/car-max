"use client";

import React from "react";
import GraficoBalance from "@/app/components/graficos/GraficoBalance";
import DashboardSectionCard from "@/app/components/dashboard/DashboardSectionCard";
import type { Granularity } from "@/lib/dashboard/aggregation";

type Props = {
    ingresosBalanceData: Array<{ label: string; mano_de_obra: number; repuestos: number; ventas: number }>;
    gastosBalanceData: Array<{ label: string; repuestos: number; sueldos: number; eventuales: number }>;
    granularity: Granularity;
    headerAction?: React.ReactNode;
};

export default function PanelBalance({ ingresosBalanceData, gastosBalanceData, granularity, headerAction }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DashboardSectionCard title="Balance Histórico" headerAction={headerAction}>
                <GraficoBalance
                    id="balance-principal"
                    ingresosPorPeriodo={ingresosBalanceData}
                    gastosPorPeriodo={gastosBalanceData}
                    granularity={granularity}
                />
            </DashboardSectionCard>
        </div>
    );
}
