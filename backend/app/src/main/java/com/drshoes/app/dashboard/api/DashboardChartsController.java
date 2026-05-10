package com.drshoes.app.dashboard.api;

import com.drshoes.app.dashboard.dto.DashboardChartsDto;
import com.drshoes.app.dashboard.dto.DashboardChartsDto.MixByTypeRowDto;
import com.drshoes.app.dashboard.dto.DashboardChartsDto.OrdersPerWeekRowDto;
import com.drshoes.app.order.domain.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.IsoFields;
import java.util.*;

/**
 * Dashboard chart aggregations: 8-week stacked bar + mix donut.
 *
 * Structured logging: op={} outcome=ok|error
 */
@RestController
@RequestMapping("/api/admin/dashboard")
public class DashboardChartsController {

    private static final Logger log = LoggerFactory.getLogger(DashboardChartsController.class);
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

    private final OrderRepository orderRepo;

    public DashboardChartsController(OrderRepository orderRepo) {
        this.orderRepo = orderRepo;
    }

    @GetMapping("/charts")
    public DashboardChartsDto charts() {
        // Window: Monday of (current week - 7) in Warsaw time, so last 8 ISO weeks including current.
        ZonedDateTime nowWarsaw = ZonedDateTime.now(WARSAW);
        ZonedDateTime windowStart = nowWarsaw.toLocalDate()
            .with(DayOfWeek.MONDAY)
            .minusWeeks(7)
            .atStartOfDay(WARSAW);
        Instant windowStartInstant = windowStart.toInstant();

        // Build ISO-week labels for the 8-slot window (zero-fill gaps).
        List<String> weekLabels = buildWeekLabels(windowStart, 8);

        List<Object[]> rawWeeks = orderRepo.countPerIsoWeek(windowStartInstant);
        Map<String, long[]> weekMap = new LinkedHashMap<>();
        for (Object[] row : rawWeeks) {
            String week = (String) row[0];
            long repairs = ((Number) row[1]).longValue();
            long custom  = ((Number) row[2]).longValue();
            weekMap.put(week, new long[]{repairs, custom});
        }

        List<OrdersPerWeekRowDto> ordersPerWeek = new ArrayList<>();
        for (String label : weekLabels) {
            long[] counts = weekMap.getOrDefault(label, new long[]{0L, 0L});
            ordersPerWeek.add(new OrdersPerWeekRowDto(label, counts[0], counts[1]));
        }

        // Mix donut — guard against division by zero
        List<Object[]> rawMix = orderRepo.countByItemKind();
        long total = rawMix.stream().mapToLong(r -> ((Number) r[1]).longValue()).sum();
        List<MixByTypeRowDto> mixByType = new ArrayList<>();
        for (Object[] row : rawMix) {
            String kind = (String) row[0];
            long count  = ((Number) row[1]).longValue();
            double pct  = (total == 0) ? 0.0 : Math.round((count * 1000.0 / total)) / 10.0;
            mixByType.add(new MixByTypeRowDto(kind, count, pct));
        }

        log.info("op=dashboardCharts weeksReturned={} mixBuckets={} outcome=ok",
            ordersPerWeek.size(), mixByType.size());
        return new DashboardChartsDto(ordersPerWeek, mixByType);
    }

    private static List<String> buildWeekLabels(ZonedDateTime firstMonday, int count) {
        List<String> labels = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            ZonedDateTime week = firstMonday.plusWeeks(i);
            int isoYear = week.get(IsoFields.WEEK_BASED_YEAR);
            int isoWeek = week.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
            labels.add(String.format("%04d-W%02d", isoYear, isoWeek));
        }
        return labels;
    }
}
