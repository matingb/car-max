"use client";

import React, { useMemo } from "react";
import { COLOR } from "@/theme/theme";
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    type ChartConfig,
} from "@/app/components/shadcn/ui/chart";
import { Cell, Pie, PieChart } from "recharts";
import { formatArs, formatNumberAr } from "@/lib/format";
import GraficoTooltip from "./GraficoTooltip";

type Props = {
    id?: string;
    total?: number | null;
    cobrados?: number | null;
    parciales?: number | null;
    pendientes?: number | null;
    montoCobradoTotal?: number | null;
    montoCobradoParcial?: number | null;
    montoPendienteParcial?: number | null;
    montoPendiente?: number | null;
    className?: string;
};

const tooltipRows = [
    {
        key: "cantidad",
        label: "Arreglos",
        formatter: (value: unknown) =>
            formatNumberAr(Number(value ?? 0), { maxDecimals: 0, minDecimals: 0 }),
    },
    {
        key: "montoCobrado",
        label: "Cobrado",
        formatter: (value: unknown) => formatArs(Number(value ?? 0)),
    },
    {
        key: "montoPendiente",
        label: "Pendiente",
        formatter: (value: unknown) => formatArs(Number(value ?? 0)),
    },
];

export default function EstadoCobroArreglos({
    id = "estado-cobro-arreglos",
    total,
    cobrados,
    parciales,
    pendientes,
    montoCobradoTotal,
    montoCobradoParcial,
    montoPendienteParcial,
    montoPendiente,
    className,
}: Props) {
    const { chartData, totalLabel } = useMemo(() => {
        const cobradosValue = Number(cobrados ?? 0);
        const parcialesValue = Number(parciales ?? 0);
        const pendientesValue = Number(pendientes ?? 0);
        const totalValue = Number(total ?? cobradosValue + parcialesValue + pendientesValue);
        const montoCobradoTotalValue = Number(montoCobradoTotal ?? 0);
        const montoCobradoParcialValue = Number(montoCobradoParcial ?? 0);
        const montoPendienteParcialValue = Number(montoPendienteParcial ?? 0);
        const montoPendienteValue = Number(montoPendiente ?? 0);

        const safeTotal = Number.isFinite(totalValue) ? totalValue : 0;
        const safeCobrados = Number.isFinite(cobradosValue) ? cobradosValue : 0;
        const safeParciales = Number.isFinite(parcialesValue) ? parcialesValue : 0;
        const safePendientes = Number.isFinite(pendientesValue)
            ? pendientesValue
            : 0;
        const safeMontoCobradoTotal = Number.isFinite(montoCobradoTotalValue)
            ? montoCobradoTotalValue
            : 0;
        const safeMontoCobradoParcial = Number.isFinite(montoCobradoParcialValue)
            ? montoCobradoParcialValue
            : 0;
        const safeMontoPendienteParcial = Number.isFinite(montoPendienteParcialValue)
            ? montoPendienteParcialValue
            : 0;
        const safeMontoPendiente = Number.isFinite(montoPendienteValue)
            ? montoPendienteValue
            : 0;

        return {
            chartData: [
                {
                    key: "cobrados",
                    name: "Cobrados totalmente",
                    cantidad: safeCobrados,
                    montoCobrado: safeMontoCobradoTotal,
                },
                {
                    key: "parciales",
                    name: "Cobrados parcialmente",
                    cantidad: safeParciales,
                    montoCobrado: safeMontoCobradoParcial,
                    montoPendiente: safeMontoPendienteParcial,
                },
                {
                    key: "pendientes",
                    name: "Sin cobrar",
                    cantidad: safePendientes,
                    montoPendiente: safeMontoPendiente,
                },
            ],
            totalLabel: safeTotal,
        };
    }, [
        total,
        cobrados,
        parciales,
        pendientes,
        montoCobradoTotal,
        montoCobradoParcial,
        montoPendienteParcial,
        montoPendiente,
    ]);

    const chartConfig: ChartConfig = useMemo(
        () => ({
            cobrados: {
                label: "Cobrados totalmente",
                color: COLOR.GRAPHICS.PRIMARY,
            },
            parciales: {
                label: "Cobrados parcialmente",
                color: COLOR.GRAPHICS.QUINARY,
            },
            pendientes: {
                label: "Sin cobrar",
                color: COLOR.GRAPHICS.NONARY,
            },
        }),
        []
    );

    return (
        <div style={{ width: "100%" }}>
            <ChartContainer
                id={id}
                config={chartConfig}
                className={className ?? "w-full "}
            >
                <PieChart>
                    <ChartTooltip
                        cursor={false}
                        content={
                            <GraficoTooltip titleKey="name" extraRows={tooltipRows} />
                        }
                    />

                    <Pie
                        data={chartData}
                        dataKey="cantidad"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="68%"
                        outerRadius="88%"
                        isAnimationActive={true}
                        animationDuration={1000}
                        animationEasing="ease-out"
                        stroke="transparent"
                        label
                        labelLine={false}
                    >
                        {chartData.map((entry) => (
                            <Cell
                                key={entry.key}
                                fill={`var(--color-${entry.key})`}
                            />
                        ))}
                    </Pie>

                    <text
                        x="50%"
                        y="45%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ fill: COLOR.TEXT.PRIMARY }}
                    >
                        <tspan
                            x="50%"
                            dy="-0.2em"
                            style={{ fontSize: 28, fontWeight: 700 }}
                        >
                            {totalLabel.toLocaleString()}
                        </tspan>
                        <tspan
                            x="50%"
                            dy="10%"
                            style={{
                                fontSize: 12,
                                fill: COLOR.TEXT.SECONDARY,
                            }}
                        >
                            Total
                        </tspan>
                    </text>
                <ChartLegend
                    content={<ChartLegendContent nameKey="key" />}
                />
                </PieChart>
            </ChartContainer>

        </div>
    );
}
