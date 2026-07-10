"use client";

import { useId, useState } from "react";
import type { CSSProperties } from "react";

type ChartItem = {
  label: string;
  created?: number;
  completed?: number;
  overdue?: number;
};

type ChartMetric = keyof Omit<ChartItem, "label">;

type ChartPoint = {
  x: number;
  y: number;
};

type ActivePoint = {
  item: ChartItem;
  x: number;
  y: number;
  align: "left" | "center" | "right";
};

const PLOT_TOP = 4;
const PLOT_BOTTOM = 96;

export function ReportLineChart({ data }: { data: ChartItem[] }) {
  const [active, setActive] = useState<ActivePoint | null>(null);
  const clipId = `report-chart-${useId().replace(/:/g, "")}`;
  const scale = buildScale(data);
  const created = buildChartCoordinates(data, "created", scale.max);
  const completed = buildChartCoordinates(data, "completed", scale.max);
  const overdue = buildChartCoordinates(data, "overdue", scale.max);
  const chartCount = Math.max(1, data.length);

  function showPeriod(item: ChartItem, index: number) {
    const points = [created[index], completed[index], overdue[index]].filter(Boolean);
    const x = points[0]?.x ?? 50;
    const y = Math.max(28, Math.min(...points.map((point) => point.y)));
    setActive({
      item,
      x,
      y,
      align: x < 12 ? "left" : x > 88 ? "right" : "center",
    });
  }

  if (!data.length) {
    return <p className="report-chart-empty">За выбранный период нет данных для графика.</p>;
  }

  return (
    <figure className="report-chart" onMouseLeave={() => setActive(null)}>
      <div className="report-chart-body">
        <div className="report-chart-y-axis" aria-hidden="true">
          {scale.ticks.map((tick) => (
            <span key={tick.value} style={{ "--tick-y": `${tick.y}%` } as CSSProperties}>
              {tick.value}
            </span>
          ))}
        </div>

        <div className="report-chart-plot" style={{ "--chart-count": chartCount } as CSSProperties}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y={PLOT_TOP} width="100" height={PLOT_BOTTOM - PLOT_TOP} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              {scale.ticks.map((tick) => (
                <line className="report-chart-grid" key={tick.value} x1="0" x2="100" y1={tick.y} y2={tick.y} vectorEffect="non-scaling-stroke" />
              ))}
              <path className="report-line-created" d={pointsToMonotonePath(created)} fill="none" vectorEffect="non-scaling-stroke" />
              <path className="report-line-completed" d={pointsToMonotonePath(completed)} fill="none" vectorEffect="non-scaling-stroke" />
              <path className="report-line-overdue" d={pointsToMonotonePath(overdue)} fill="none" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>

          {[
            { points: created, className: "report-marker-created" },
            { points: completed, className: "report-marker-completed" },
            { points: overdue, className: "report-marker-overdue" },
          ].flatMap(({ points, className }) =>
            points.map((point, index) => (
              <span
                aria-hidden="true"
                className={`report-chart-marker ${className}`}
                key={`${className}-${data[index].label}`}
                style={{ "--point-x": `${point.x}%`, "--point-y": `${point.y}%` } as CSSProperties}
              />
            )),
          )}

          {data.map((item, index) => (
            <button
              aria-label={`${item.label}: создано ${item.created ?? 0}, закрыто ${item.completed ?? 0}, просрочено ${item.overdue ?? 0}`}
              className="report-chart-period-target"
              key={item.label}
              style={{ "--point-x": `${created[index].x}%` } as CSSProperties}
              type="button"
              onBlur={() => setActive(null)}
              onFocus={() => showPeriod(item, index)}
              onMouseEnter={() => showPeriod(item, index)}
            />
          ))}

          {active ? (
            <div
              className={`report-chart-tooltip report-chart-tooltip-${active.align}`}
              style={{ "--tooltip-x": `${active.x}%`, "--tooltip-y": `${active.y}%` } as CSSProperties}
            >
              <strong>{active.item.label}</strong>
              <span>
                <i className="tooltip-dot-created" />
                Создано: {active.item.created ?? 0}
              </span>
              <span>
                <i className="tooltip-dot-completed" />
                Закрыто: {active.item.completed ?? 0}
              </span>
              <span>
                <i className="tooltip-dot-overdue" />
                Просрочено: {active.item.overdue ?? 0}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="report-chart-months" style={{ "--chart-count": chartCount } as CSSProperties} aria-hidden="true">
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
      <figcaption className="visually-hidden">График созданных, закрытых и просроченных задач по выбранному периоду.</figcaption>
    </figure>
  );
}

function buildScale(data: ChartItem[]) {
  const highestValue = Math.max(1, ...data.flatMap((item) => [item.created ?? 0, item.completed ?? 0, item.overdue ?? 0]));
  const step = Math.max(1, Math.ceil(highestValue / 4));
  const max = step * 4;
  const ticks = Array.from({ length: 5 }, (_, index) => {
    const value = max - step * index;
    return { value, y: scaleY(value, max) };
  });
  return { max, ticks };
}

function buildChartCoordinates(data: ChartItem[], metric: ChartMetric, max: number) {
  return data.map((item, index) => ({
    x: round(((index + 0.5) / data.length) * 100),
    y: scaleY(item[metric] ?? 0, max),
  }));
}

function scaleY(value: number, max: number) {
  return round(PLOT_BOTTOM - (value / max) * (PLOT_BOTTOM - PLOT_TOP));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function pointsToMonotonePath(points: ChartPoint[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const widths = points.slice(1).map((point, index) => point.x - points[index].x);
  const slopes = points.slice(1).map((point, index) => (point.y - points[index].y) / widths[index]);
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes[slopes.length - 1];

    const previous = slopes[index - 1];
    const next = slopes[index];
    if (previous === 0 || next === 0 || previous * next < 0) return 0;

    const previousWidth = widths[index - 1];
    const nextWidth = widths[index];
    const firstWeight = 2 * nextWidth + previousWidth;
    const secondWeight = nextWidth + 2 * previousWidth;
    return (firstWeight + secondWeight) / (firstWeight / previous + secondWeight / next);
  });

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const width = widths[index];
    const segmentMin = Math.min(previous.y, point.y);
    const segmentMax = Math.max(previous.y, point.y);
    const controlStartY = clamp(previous.y + (tangents[index] * width) / 3, segmentMin, segmentMax);
    const controlEndY = clamp(point.y - (tangents[index + 1] * width) / 3, segmentMin, segmentMax);

    return `${path} C ${round(previous.x + width / 3)} ${round(controlStartY)}, ${round(point.x - width / 3)} ${round(controlEndY)}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
