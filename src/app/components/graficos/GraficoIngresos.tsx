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
import GraficoTooltip from "./GraficoTooltip";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type Granularity } from "@/lib/dashboard/aggregation";

type Props = {
    id?: string;
    data?: Array<{ label: string; mano_de_obra: number; repuestos: number; ventas: number }>;
    granularity?: Granularity;
};

function formatCurrency(value: number) {
    return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

const LABELS: Record<string, string> = {
    mano_de_obra: "Mano de obra",
    repuestos: "Repuestos",
    ventas: "Ventas",
};

export default function GraficoIngresos({ id = "grafico-ingresos", data, granularity }: Props) {
    const isMonthly = granularity === "month";

    const { chartData, monthlyPoint, config } = useMemo(() => {
        const chartData = (data ?? []).map((d) => ({
            label: d.label,
            mano_de_obra: d.mano_de_obra,
            repuestos: d.repuestos,
            ventas: d.ventas,
        }));

        const totals = chartData.reduce(
            (acc, d) => ({
                mano_de_obra: acc.mano_de_obra + d.mano_de_obra,
                repuestos: acc.repuestos + d.repuestos,
                ventas: acc.ventas + d.ventas,
            }),
            { mano_de_obra: 0, repuestos: 0, ventas: 0 }
        );

        const config: ChartConfig = {
            mano_de_obra: { label: "Mano de obra", color: COLOR.GRAPHICS.PRIMARY },
            repuestos: { label: "Repuestos", color: COLOR.GRAPHICS.TERTIARY },
            ventas: { label: "Ventas", color: COLOR.GRAPHICS.QUINARY },
        };

        return { chartData, monthlyPoint: [{ label: "", ...totals }], config };
    }, [data]);

    if (isMonthly) {
        return (
            <ChartContainer id={id} config={config} className="w-full h-[220px]">
                <BarChart data={monthlyPoint} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" hide />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        width={64}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip cursor={false} content={<GraficoTooltip labelMap={LABELS} formatter={formatCurrency} />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="mano_de_obra" fill="var(--color-mano_de_obra)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="repuestos" fill="var(--color-repuestos)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="ventas" fill="var(--color-ventas)" radius={[3, 3, 0, 0]} />
                </BarChart>
            </ChartContainer>
        );
    }

    return (
        <ChartContainer id={id} config={config} className="w-full h-[220px]">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                />
                <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={64}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <ChartTooltip cursor={false} content={<GraficoTooltip labelMap={LABELS} formatter={formatCurrency} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="mano_de_obra" fill="var(--color-mano_de_obra)" stackId="a" />
                <Bar dataKey="repuestos" fill="var(--color-repuestos)" stackId="a" />
                <Bar dataKey="ventas" fill="var(--color-ventas)" stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
        </ChartContainer>
    );
}
