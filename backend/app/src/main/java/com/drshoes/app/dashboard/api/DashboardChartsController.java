package com.drshoes.app.dashboard.api;

import com.drshoes.app.dashboard.dto.DashboardChartsDto;
import com.drshoes.app.dashboard.dto.DashboardChartsDto.MixByTypeRowDto;
import com.drshoes.app.dashboard.dto.DashboardChartsDto.OrdersPerWeekRowDto;
import com.drshoes.app.order.domain.OrderItemKind;
import com.drshoes.app.order.domain.OrderRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.IsoFields;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@RestController
@RequestMapping("/api/admin/dashboard")
@Slf4j
@RequiredArgsConstructor
public class DashboardChartsController {
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

    private final OrderRepository orderRepo;

    @GetMapping("/charts")
    public DashboardChartsDto charts(
            @RequestParam(name = "period", defaultValue = "WEEK") String period) {
        ZonedDateTime nowWarsaw = ZonedDateTime.now(WARSAW);

        List<OrdersPerWeekRowDto> ordersPerWeek;
        switch (period) {
            case "MONTH" -> {
                ZonedDateTime monthWindowStart = nowWarsaw.toLocalDate()
                        .withDayOfMonth(1)
                        .minusMonths(5)
                        .atStartOfDay(WARSAW);
                List<String> monthLabels = buildMonthLabels(monthWindowStart, 6);
                List<Object[]> rawMonths = orderRepo.countPerIsoMonth(monthWindowStart.toInstant());
                Map<String, Map<String, Long>> monthMap = buildPeriodMap(rawMonths);
                ordersPerWeek = fillPeriods(monthLabels, monthMap);
            }
            case "QUARTER" -> {
                LocalDate firstDayOfCurQ = nowWarsaw.toLocalDate()
                        .with(IsoFields.DAY_OF_QUARTER, 1);
                ZonedDateTime quarterWindowStart = firstDayOfCurQ
                        .minusMonths(9)
                        .atStartOfDay(WARSAW);
                List<String> quarterLabels = buildQuarterLabels(quarterWindowStart, 4);
                List<Object[]> rawQuarters = orderRepo.countPerIsoQuarter(quarterWindowStart.toInstant());
                Map<String, Map<String, Long>> quarterMap = buildPeriodMap(rawQuarters);
                ordersPerWeek = fillPeriods(quarterLabels, quarterMap);
            }
            default -> {
                ZonedDateTime weekWindowStart = nowWarsaw.toLocalDate()
                        .with(DayOfWeek.MONDAY)
                        .minusWeeks(7)
                        .atStartOfDay(WARSAW);
                List<String> weekLabels = buildWeekLabels(weekWindowStart, 8);
                List<Object[]> rawWeeks = orderRepo.countPerIsoWeek(weekWindowStart.toInstant());
                Map<String, Map<String, Long>> weekMap = buildPeriodMap(rawWeeks);
                ordersPerWeek = fillPeriods(weekLabels, weekMap);
            }
        }
        List<Object[]> rawMix = orderRepo.countByItemKind();
        Map<String, Long> kindCounts = zeroFilledKindMap();
        for (Object[] row : rawMix) {
            String kind = (String) row[0];
            long count  = ((Number) row[1]).longValue();
            if (kindCounts.containsKey(kind)) kindCounts.put(kind, count);
        }
        long total = kindCounts.values().stream().mapToLong(Long::longValue).sum();
        List<MixByTypeRowDto> mixByType = new ArrayList<>();
        for (Map.Entry<String, Long> entry : kindCounts.entrySet()) {
            String kind = entry.getKey();
            long count  = entry.getValue();
            double pct  = (total == 0) ? 0.0 : Math.round((count * 1000.0 / total)) / 10.0;
            mixByType.add(new MixByTypeRowDto(kind, count, pct));
        }

        log.info("op=dashboardCharts period={} periodsReturned={} mixBuckets={} outcome=ok",
            period, ordersPerWeek.size(), mixByType.size());
        return new DashboardChartsDto(ordersPerWeek, mixByType);
    }
    private static Map<String, Map<String, Long>> buildPeriodMap(List<Object[]> rows) {
        Map<String, Map<String, Long>> map = new LinkedHashMap<>();
        for (Object[] row : rows) {
            String label = (String) row[0];
            String kind  = (String) row[1];
            long count   = ((Number) row[2]).longValue();
            map.computeIfAbsent(label, k -> zeroFilledKindMap()).put(kind, count);
        }
        return map;
    }
    private static Map<String, Long> zeroFilledKindMap() {
        Map<String, Long> m = new LinkedHashMap<>();
        for (OrderItemKind k : OrderItemKind.values()) m.put(k.name(), 0L);
        return m;
    }

    private static List<OrdersPerWeekRowDto> fillPeriods(List<String> labels,
                                                          Map<String, Map<String, Long>> map) {
        List<OrdersPerWeekRowDto> result = new ArrayList<>();
        for (String label : labels) {
            Map<String, Long> byKind = map.getOrDefault(label, zeroFilledKindMap());
            result.add(new OrdersPerWeekRowDto(label, byKind));
        }
        return result;
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

    private static List<String> buildMonthLabels(ZonedDateTime firstOfMonth, int count) {
        List<String> labels = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            ZonedDateTime m = firstOfMonth.plusMonths(i);
            labels.add(String.format("%04d-%02d", m.getYear(), m.getMonthValue()));
        }
        return labels;
    }

    private static List<String> buildQuarterLabels(ZonedDateTime firstDayOfFirstQ, int count) {
        List<String> labels = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            ZonedDateTime q = firstDayOfFirstQ.plusMonths(i * 3L);
            int quarter = (q.getMonthValue() - 1) / 3 + 1;
            labels.add(String.format("%04d-Q%d", q.getYear(), quarter));
        }
        return labels;
    }
}
