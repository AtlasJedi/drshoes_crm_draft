package com.drshoes.app.dashboard.api;

import com.drshoes.app.dashboard.dto.DashboardKpiDto;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.text.NumberFormat;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Locale;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

/**
 * Read-only dashboard aggregation endpoints.
 *
 * Structured logging: op={} actor={} outcome=ok
 */
@RestController
@RequestMapping("/api/admin/dashboard")
@Slf4j
@RequiredArgsConstructor
public class DashboardController {
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    private static final Locale PL = Locale.forLanguageTag("pl-PL");

    private final OrderRepository orderRepo;

    @GetMapping("/kpis")
    public DashboardKpiDto kpis() {
        ZonedDateTime now = ZonedDateTime.now(WARSAW);
        Instant todayStart    = now.toLocalDate().atStartOfDay(WARSAW).toInstant();
        Instant tomorrowStart = now.toLocalDate().plusDays(1).atStartOfDay(WARSAW).toInstant();
        Instant monthStart    = now.toLocalDate().withDayOfMonth(1).atStartOfDay(WARSAW).toInstant();
        Instant monthEnd      = now.toLocalDate().plusMonths(1).withDayOfMonth(1).atStartOfDay(WARSAW).toInstant();

        long inProgress     = orderRepo.countByStatusNotDeleted(OrderStatus.W_REALIZACJI);
        long readyForPickup = orderRepo.countByStatusNotDeleted(OrderStatus.GOTOWE_DO_ODBIORU);
        long todayIntake    = orderRepo.countReceivedBetween(todayStart, tomorrowStart);
        long monthRevenue   = orderRepo.sumRevenueBetween(monthStart, monthEnd);
        String formatted    = formatPln(monthRevenue);

        long inProgressMoney    = orderRepo.sumTotalPriceByStatusIn(
            Set.of(OrderStatus.W_REALIZACJI, OrderStatus.PRZYJETE));
        long pickedUpMoneyMonth = orderRepo.sumTotalPricePickedUpBetween(monthStart, monthEnd);
        String inProgressFormatted    = formatPln(inProgressMoney);
        String pickedUpMonthFormatted = formatPln(pickedUpMoneyMonth);

        log.info("op=dashboardKpis inProgress={} readyForPickup={} todayIntake={} monthRevenue={}" +
                 " inProgressMoney={} pickedUpMonth={} outcome=ok",
            inProgress, readyForPickup, todayIntake, monthRevenue,
            inProgressMoney, pickedUpMoneyMonth);

        return new DashboardKpiDto(
            inProgress, readyForPickup, todayIntake, monthRevenue, formatted,
            inProgressMoney, inProgressFormatted, pickedUpMoneyMonth, pickedUpMonthFormatted);
    }

    /**
     * Converts cents to PLN and formats with pl-PL locale.
     * Non-breaking spaces (U+00A0) produced by the locale are replaced with
     * regular spaces so the JSON value is predictable and human-readable.
     * Example: 1824000 cents → "18 240,00 zł"
     */
    private static String formatPln(long cents) {
        NumberFormat nf = NumberFormat.getCurrencyInstance(PL);
        double pln = cents / 100.0;
        return nf.format(pln).replace(' ', ' ');
    }
}
