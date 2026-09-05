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
import { formatNumberAr } from "@/lib/format";
import GraficoTooltip from "./GraficoTooltip";

type Props = {
    id?: string;
    items?: Array<{
        label: string;
        cantidad: number;
        monto: number;
    }>;
};

const TIPOS_EXTRA_ROWS = [
    {
        key: "cantidad",
        label: "Cantidad",
        formatter: (v: unknown) =>
            formatNumberAr(Number(v ?? 0), { maxDecimals: 0, minDecimals: 0 }),
    },
    {
        key: "monto",
        label: "Ingresos",
        formatter: (v: unknown) =>
            `$${formatNumberAr(Number(v ?? 0), { maxDecimals: 2, minDecimals: 2 })}`,
    },
];

export default function VolumenDeTrabajo({
    id = "volumen-trabajo",
    items,
}: Props) {
    const tipoSeries = useMemo(() => {
        const safeItems = (items ?? []).filter(
            (i) => i && typeof i.label === "string"
        );
        const safeTipos = safeItems.map((i) => i.label);

        const keys = safeTipos.map((_, idx) => `label_${idx}`);

        const data = keys.map((key, idx) => {
            const item = safeItems[idx];
            return {
                key,
                label: item?.label ?? key,
                cantidad: Number(item?.cantidad ?? 0),
                monto: Number(item?.monto ?? 0),
            };
        });

        const colors = [
            COLOR.GRAPHICS.PRIMARY,
            COLOR.GRAPHICS.SECONDARY,
            COLOR.GRAPHICS.TERTIARY,
            COLOR.GRAPHICS.QUATERNARY,
            COLOR.GRAPHICS.QUINARY,
        ];

        const config: ChartConfig = Object.fromEntries(
            keys.map((key, idx) => [
                key,
                {
                    label: safeTipos[idx] ?? key,
                    color: colors[idx % colors.length],
                },
            ])
        );

        return {
            config,
            data,
        };
    }, [items]);

    return (
        <ChartContainer
            id={id}
            config={tipoSeries.config}
            style={{ width: "100%" }}
        >
            <PieChart>
                <ChartTooltip
                    cursor={false}
                    content={
                        <GraficoTooltip titleKey="label" extraRows={TIPOS_EXTRA_ROWS} />
                    }
                />
                <Pie
                    data={tipoSeries.data}
                    dataKey="cantidad"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    isAnimationActive={true}
                    animationDuration={1000}
                    outerRadius="80%"
                    labelLine={false}
                    label
                >
                    {tipoSeries.data.map((entry) => (
                        <Cell
                            key={entry.key}
                            fill={`var(--color-${entry.key})`}
                        />
                    ))}
                </Pie>

                <ChartLegend content={<ChartLegendContent nameKey="key" />} />
            </PieChart>
        </ChartContainer>
    );
}
