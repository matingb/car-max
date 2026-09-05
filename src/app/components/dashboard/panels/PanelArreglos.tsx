
"use client";

import React from "react";

import GraficoArreglos from "@/app/components/graficos/GraficoArreglos";
import VolumenDeTrabajo from "@/app/components/graficos/VolumenDeTrabajo";
import EstadoCobroArreglos from "@/app/components/graficos/EstadoCobroArreglos";
import DashboardSectionCard from "@/app/components/dashboard/DashboardSectionCard";
import { TYPOGRAPHY } from "@/theme/theme";
import type { DashboardStats } from "@/app/providers/DashboardProvider";
import type { Granularity } from "@/lib/dashboard/aggregation";

type Props = {
    arreglosData: Array<{ label: string; cantidad: number }>;
    granularity: Granularity;
    stats: DashboardStats | null;
    headerAction?: React.ReactNode;
};

export default function PanelArreglos({ arreglosData, granularity, stats, headerAction }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DashboardSectionCard title="Arreglos realizados" headerAction={headerAction}>
                <GraficoArreglos id="arreglos-principal" data={arreglosData} granularity={granularity} />
            </DashboardSectionCard>

            <DashboardSectionCard>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
                    <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column" }}>
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Volumen de trabajo por categoría</h4>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                            <VolumenDeTrabajo id="arreglos-volumen" items={stats?.facturacionPorTipo ?? []} />
                        </div>
                    </div>
                    <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column" }}>
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Estado de pago</h4>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                            <EstadoCobroArreglos
                                id="arreglos-estado-pago"
                                total={stats?.totals?.arreglos ?? null}
                                cobrados={stats?.arreglos?.cobrados ?? null}
                                parciales={stats?.arreglos?.parciales ?? null}
                                pendientes={stats?.arreglos?.pendientes ?? null}
                                montoCobradoTotal={stats?.arreglos?.montoCobradoTotal ?? null}
                                montoCobradoParcial={stats?.arreglos?.montoCobradoParcial ?? null}
                                montoPendienteParcial={stats?.arreglos?.montoPendienteParcial ?? null}
                                montoPendiente={stats?.arreglos?.montoPendiente ?? null}
                            />
                        </div>
                    </div>
                </div>
            </DashboardSectionCard>
        </div>
    );
}
