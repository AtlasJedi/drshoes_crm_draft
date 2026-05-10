package com.drshoes.app.dashboard.dto;

public record DashboardKpiDto(
    long inProgressCount,
    long readyForPickupCount,
    long todayIntakeCount,
    long monthRevenueCents,
    String monthRevenueFormatted
) {}
