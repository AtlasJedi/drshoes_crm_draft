package com.drshoes.app.dashboard.dto;

import java.util.List;
import java.util.Map;

public record DashboardChartsDto(
    List<OrdersPerWeekRowDto> ordersPerWeek,
    List<MixByTypeRowDto> mixByType
) {
    public record OrdersPerWeekRowDto(String weekIso, Map<String, Long> byKind) {}
    public record MixByTypeRowDto(String kind, long count, double percent) {}
}
