"use client";

import React from "react";

import GraficoGastos from "@/app/components/graficos/GraficoGastos";
import DesglosePieChart from "@/app/components/graficos/DesglosePieChart";
import DashboardSectionCard from "@/app/components/dashboard/DashboardSectionCard";
import { BREAKPOINTS, TYPOGRAPHY } from "@/theme/theme";
import type { DashboardStats } from "@/app/providers/DashboardProvider";
import type { Granularity } from "@/lib/dashboard/aggregation";
import { css } from "@emotion/react";

type Props = {
    gastosData: Array<{ label: string; repuestos: number; sueldos: number; eventuales: number }>;
    granularity: Granularity;
    stats: DashboardStats | null;
    headerAction?: React.ReactNode;
};

export default function PanelGastos({ gastosData, granularity, stats, headerAction }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DashboardSectionCard title="Evolución de Gastos" headerAction={headerAction}>
                <GraficoGastos id="gastos-principal" data={gastosData} granularity={granularity} />
            </DashboardSectionCard>

            <DashboardSectionCard>
                <div css={styles.mainPanel}>
                    <div css={styles.halfPanel}>
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Costo por categoría</h4>
                        <div style={styles.chartWrapper}>
                            <DesglosePieChart id="gastos-categoria" items={stats?.costoPorTipo} montoLabel="Costo" variant="danger" />
                        </div>
                    </div>
                    <div css={styles.halfPanel}>
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Costo por empleado</h4>
                        <div style={styles.chartWrapper}>
                            <DesglosePieChart id="gastos-empleado" items={stats?.costoPorEmpleado} montoLabel="Costo" variant="danger" />
                        </div>
                    </div>
                </div>
            </DashboardSectionCard>
        </div>
    );
}

const styles = {
    mainPanel: css({
        display: "flex",
        flexDirection: "row",
        gap: 16,
        marginTop: 8,
        [`@media (max-width: ${BREAKPOINTS.xl}px)`]: {
            flexDirection: "column",
        },
    }),
    halfPanel: css({
        width: "50%",
        display: "flex",
        flexDirection: "column" as const,
        [`@media (max-width: ${BREAKPOINTS.xl}px)`]: {
            width: "100%",
        },
    }),
    chartWrapper: {
        flex: 1,
        display: "flex",
        flexDirection: "column" as const,
        justifyContent: "center",
    },
} as const;
