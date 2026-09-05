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
    ingresosPorPeriodo?: Array<{ label: string; mano_de_obra: number; repuestos: number; ventas: number }>;
    gastosPorPeriodo?: Array<{ label: string; repuestos: number; sueldos: number; eventuales: number }>;
    granularity?: Granularity;
};

function formatCurrency(value: number) {
    return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export default function GraficoBalance({ id = "grafico-balance", ingresosPorPeriodo, gastosPorPeriodo, granularity }: Props) {
    const isMonthly = granularity === "month";

    const { chartData, monthlyPoint, config } = useMemo(() => {
        const ingresosMap = new Map(
            (ingresosPorPeriodo ?? []).map((d) => [
                d.label,
                d.mano_de_obra + d.repuestos + d.ventas,
            ])
        );

        const chartData = (gastosPorPeriodo ?? []).map((d) => {
            const ingresos = ingresosMap.get(d.label) ?? 0;
            const gastos = d.repuestos + d.sueldos + d.eventuales;
            return { label: d.label, ingresos, gastos };
        });

        const totalIngresos = (ingresosPorPeriodo ?? []).reduce(
            (s, d) => s + d.mano_de_obra + d.repuestos + d.ventas, 0
        );
        const totalGastos = (gastosPorPeriodo ?? []).reduce(
            (s, d) => s + d.repuestos + d.sueldos + d.eventuales, 0
        );

        const config: ChartConfig = {
            ingresos: { label: "Facturación", color: COLOR.SEMANTIC.SUCCESS },
            gastos: { label: "Gastos", color: COLOR.SEMANTIC.DANGER },
        };

        return { chartData, monthlyPoint: [{ label: "", ingresos: totalIngresos, gastos: totalGastos }], config };
    }, [ingresosPorPeriodo, gastosPorPeriodo]);

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
                    <ChartTooltip cursor={false} content={<GraficoTooltip formatter={formatCurrency} />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[3, 3, 0, 0]} />
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
                <ChartTooltip cursor={false} content={<GraficoTooltip formatter={formatCurrency} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[3, 3, 0, 0]} />
            </BarChart>
        </ChartContainer>
    );
}
