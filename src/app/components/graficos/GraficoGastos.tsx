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
    data?: Array<{ label: string; repuestos: number; sueldos: number; eventuales: number }>;
    granularity?: Granularity;
};

function formatCurrency(value: number) {
    return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

const LABELS: Record<string, string> = {
    repuestos: "Repuestos",
    sueldos: "Sueldos",
    eventuales: "Gastos eventuales",
};

export default function GraficoGastos({ id = "grafico-gastos", data, granularity }: Props) {
    const isMonthly = granularity === "month";

    const { chartData, monthlyPoint, config } = useMemo(() => {
        const chartData = (data ?? []).map((d) => ({
            label: d.label,
            repuestos: d.repuestos,
            sueldos: d.sueldos,
            eventuales: d.eventuales,
        }));

        const totals = chartData.reduce(
            (acc, d) => ({
                repuestos: acc.repuestos + d.repuestos,
                sueldos: acc.sueldos + d.sueldos,
                eventuales: acc.eventuales + d.eventuales,
            }),
            { repuestos: 0, sueldos: 0, eventuales: 0 }
        );

        const config: ChartConfig = {
            repuestos: { label: "Repuestos", color: COLOR.GRAPHICS_DANGER.PRIMARY },
            sueldos: { label: "Sueldos", color: COLOR.GRAPHICS_DANGER.TERTIARY },
            eventuales: { label: "Gastos eventuales", color: COLOR.GRAPHICS_DANGER.SECONDARY },
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
                    <Bar dataKey="repuestos" fill="var(--color-repuestos)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="sueldos" fill="var(--color-sueldos)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="eventuales" fill="var(--color-eventuales)" radius={[3, 3, 0, 0]} />
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
                <Bar dataKey="repuestos" fill="var(--color-repuestos)" stackId="a" />
                <Bar dataKey="sueldos" fill="var(--color-sueldos)" stackId="a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="eventuales" fill="var(--color-eventuales)" stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
        </ChartContainer>
    );
}
