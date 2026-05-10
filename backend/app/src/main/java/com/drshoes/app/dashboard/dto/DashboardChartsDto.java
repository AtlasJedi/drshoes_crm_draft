package com.drshoes.app.dashboard.dto;

import java.util.List;

public record DashboardChartsDto(
    List<OrdersPerWeekRowDto> ordersPerWeek,
    List<MixByTypeRowDto> mixByType
) {
    public record OrdersPerWeekRowDto(String weekIso, long repairs, long custom) {}
    public record MixByTypeRowDto(String kind, long count, double percent) {}
}
