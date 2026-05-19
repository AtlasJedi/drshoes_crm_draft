package com.drshoes.app.dashboard.dto;

import java.util.List;
import java.util.Map;

public record DashboardChartsDto(
    List<OrdersPerWeekRowDto> ordersPerWeek,
    List<MixByTypeRowDto> mixByType
) {
    /**
     * One stacked-bar slot per period.
     * byKind: all 5 OrderItemKind names as keys, zero-filled; values = order count.
     * JSON: { "weekIso": "2026-W21", "byKind": { "CZYSZCZENIE": 0, "RENOWACJA": 1, ... } }
     */
    public record OrdersPerWeekRowDto(String weekIso, Map<String, Long> byKind) {}
    public record MixByTypeRowDto(String kind, long count, double percent) {}
}
