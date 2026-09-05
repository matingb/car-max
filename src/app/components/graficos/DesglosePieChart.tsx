"use client";

import React, { useEffect, useMemo, useState } from "react";
import { COLOR } from "@/theme/theme";
import {
    ChartContainer,
    ChartTooltip,
    type ChartConfig,
} from "@/app/components/shadcn/ui/chart";
import { Cell, Pie, PieChart } from "recharts";
import { formatNumberAr } from "@/lib/format";
import GraficoTooltip from "./GraficoTooltip";
import { ChevronDown } from "lucide-react";
import { getStyles } from "./DesglosePieChart.styles";
import DesglosePieChartList from "./DesglosePieChartList";

export type DesgloseItem = {
    label: string;
    cantidad: number;
    monto: number;
    fill?: string;
};

export type DesglosePieChartSubItem = DesgloseItem & {
    key: string;
    porcentaje: number;
    fill: string;
};

export type DesglosePieChartDataItem = DesglosePieChartSubItem & {
    subItems?: DesglosePieChartSubItem[];
};

type Props = {
    id?: string;
    items?: DesgloseItem[];
    montoLabel?: string;
    variant?: "default" | "danger";
    maxItems?: number;
};

const DEFAULT_COLORS = [
    COLOR.GRAPHICS.PRIMARY,
    COLOR.GRAPHICS.SECONDARY,
    COLOR.GRAPHICS.TERTIARY,
    COLOR.GRAPHICS.QUATERNARY,
    COLOR.GRAPHICS.QUINARY,
    COLOR.GRAPHICS.SENARY,
    COLOR.GRAPHICS.SEPTENARY,
    COLOR.GRAPHICS.OCTONARY,
    COLOR.GRAPHICS.NONARY,
    COLOR.GRAPHICS.DENARY,
];

const DANGER_COLORS = [
    COLOR.GRAPHICS_DANGER.PRIMARY,
    COLOR.GRAPHICS_DANGER.SECONDARY,
    COLOR.GRAPHICS_DANGER.TERTIARY,
    COLOR.GRAPHICS_DANGER.QUATERNARY,
    COLOR.GRAPHICS_DANGER.QUINARY,
    COLOR.GRAPHICS_DANGER.SENARY,
    COLOR.GRAPHICS_DANGER.SEPTENARY,
    COLOR.GRAPHICS_DANGER.OCTONARY,
    COLOR.GRAPHICS_DANGER.NONARY,
    COLOR.GRAPHICS_DANGER.DENARY,
];

function getDistributedColor(idx: number, totalItems: number, palette: string[]) {
    if (totalItems <= 1) return palette[0];

    if (totalItems <= 5) {
        return palette[idx * 2];
    }
    const mappedIdx = Math.round((idx / (totalItems - 1)) * (palette.length - 1));
    return palette[mappedIdx];
}
export default function DesglosePieChart({ id = "desglose-pie", items, montoLabel = "Monto", variant = "default", maxItems = 5 }: Props) {
    const [showListOnMobile, setShowListOnMobile] = useState(false);
    const [expandedOtros, setExpandedOtros] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const styles = useMemo(() => getStyles(isMobile), [isMobile]);
    const effectivelyExpanded = expandedOtros || isMobile;

    const extraRows = useMemo(
        () => [
            {
                key: "cantidad",
                label: "Cantidad",
                formatter: (v: unknown) => formatNumberAr(Number(v ?? 0), { maxDecimals: 0, minDecimals: 0 }),
            },
            {
                key: "monto",
                label: montoLabel,
                formatter: (v: unknown) => `$${formatNumberAr(Number(v ?? 0), { maxDecimals: 0, minDecimals: 0 })}`,
            },
            {
                key: "porcentaje",
                label: "Porcentaje",
                formatter: (v: unknown) => `${formatNumberAr(Number(v ?? 0), { maxDecimals: 1, minDecimals: 0 })}%`,
            },
        ],
        [montoLabel]
    );

    const series = useMemo(() => {
        const safeItems = (items ?? []).filter((i) => i && typeof i.label === "string");
        const colors = variant === "danger" ? DANGER_COLORS : DEFAULT_COLORS;

        const processedItems = [...safeItems].sort((a, b) => b.monto - a.monto);
        const total = processedItems.reduce((acc, item) => acc + Number(item?.monto ?? 0), 0);

        const itemsWithColor: DesglosePieChartSubItem[] = processedItems.map((item, idx) => ({
            ...item,
            key: `linea_${idx}`,
            porcentaje: total > 0 ? (item.monto / total) * 100 : 0,
            fill: getDistributedColor(idx, processedItems.length, colors)
        }));

        let pieDataItems: DesglosePieChartDataItem[] = [...itemsWithColor];

        if (pieDataItems.length > maxItems + 1) {
            const top = pieDataItems.slice(0, maxItems);
            const rest = pieDataItems.slice(maxItems);

            const restMonto = rest.reduce((acc, i) => acc + i.monto, 0);
            const restCantidad = rest.reduce((acc, i) => acc + i.cantidad, 0);

            pieDataItems = [
                ...top,
                {
                    key: "otros",
                    label: "Otros",
                    monto: restMonto,
                    cantidad: restCantidad,
                    porcentaje: total > 0 ? (restMonto / total) * 100 : 0,
                    subItems: rest,
                    fill: "#94a3b8", // Static gray for the "Otros" group slice
                },
            ];
        }

        const keys = pieDataItems.map((_, idx) => `linea_${idx}`);

        const data: DesglosePieChartDataItem[] = keys.map((key, idx) => {
            const item = pieDataItems[idx];
            return {
                key,
                label: item.label ?? key,
                cantidad: Number(item.cantidad ?? 0),
                monto: item.monto,
                porcentaje: item.porcentaje,
                fill: item.fill,
                subItems: item.subItems,
            };
        });

        const config: ChartConfig = {};
        keys.forEach((key, idx) => {
            config[key] = {
                label: pieDataItems[idx]?.label ?? key,
                color: pieDataItems[idx]?.fill ?? colors[0],
            };
        });

        return { config, data, total };
    }, [items, variant, maxItems]);

    const maxMonto = useMemo(() => {
        return Math.max(0, ...series.data.map(d => d.monto));
    }, [series.data]);

    if (!series.data.length) {
        return (
            <div style={styles.emptyState}>
                Sin datos
            </div>
        );
    }

    const hasOtros = series.data.some(item => item.subItems && item.subItems.length > 0);
    const topItems = series.data.filter(item => !item.subItems || item.subItems.length === 0);
    const otrosItem = series.data.find(item => item.subItems && item.subItems.length > 0);

    const pieChartData = effectivelyExpanded && otrosItem && otrosItem.subItems
        ? [
            ...topItems,
            ...otrosItem.subItems
        ]
        : series.data;

    return (
        <div style={styles.container}>
            <div style={styles.row}>
                <div style={styles.chartWrapper}>
                    <ChartContainer id={id} config={series.config} style={styles.chartContainer}>
                        <PieChart>
                            <ChartTooltip cursor={false} content={<GraficoTooltip titleKey="label" extraRows={extraRows} />} />
                            <Pie
                                data={pieChartData}
                                dataKey="monto"
                                nameKey="label"
                                cx="50%"
                                cy="50%"
                                isAnimationActive={true}
                                animationDuration={600}
                                innerRadius={40}
                                outerRadius={90}
                                paddingAngle={2}
                                stroke="none"
                            >
                                {pieChartData.map((entry) => (
                                    <Cell key={entry.key} fill={entry.fill} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                </div>

                <DesglosePieChartList
                    topItems={topItems}
                    otrosItem={otrosItem}
                    maxMonto={maxMonto}
                    isMobile={isMobile}
                    showListOnMobile={showListOnMobile}
                    setShowListOnMobile={setShowListOnMobile}
                    effectivelyExpanded={effectivelyExpanded}
                />
            </div>

            {hasOtros && (
                <div style={styles.otrosToggleContainer}>
                    <div style={styles.otrosToggleSpacer} />
                    <div style={styles.otrosToggleInner}>
                        <button
                            onClick={() => setExpandedOtros(!expandedOtros)}
                            style={styles.otrosToggleButton}
                        >
                            <ChevronDown
                                style={{
                                    ...styles.expandIcon,
                                    transform: expandedOtros ? "rotate(180deg)" : "rotate(0deg)",
                                }}
                            />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
