package com.drshoes.app.audit.api;

import com.drshoes.app.audit.AuditTimelineService;
import com.drshoes.app.audit.dto.TimelineEvent;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

/**
 * REST controller for the order timeline endpoint.
 *
 * Endpoint:
 *   GET /api/admin/orders/{orderId}/timeline
 *     → 200 + List&lt;TimelineEvent&gt; (empty list for unknown orderId — no 404)
 *     → 401 for anonymous (enforced by admin SecurityConfig filter chain)
 *
 * RBAC: relies on the existing admin SecurityConfig filter chain which requires
 * isAuthenticated() for all /api/admin/** paths. Both OWNER and EMPLOYEE roles
 * are permitted. No additional @PreAuthorize annotation is needed here because
 * the filter chain already gates the entire /api/admin/** namespace.
 *
 * Placed at com.drshoes.app.audit.api so the AuditLogAspect pointcut
 * (execution(public * com.drshoes.app..api..*Controller.*(..))) fires for any
 * future write operations added to this controller.
 *
 * Structured logging: op=getTimeline actor={} orderId={} outcome=ok
 */
@RestController
@RequestMapping("/api/admin/orders/{orderId}/timeline")
@Slf4j
@RequiredArgsConstructor
public class AuditTimelineController {

    private final AuditTimelineService svc;

    @GetMapping
    public List<TimelineEvent> getTimeline(@PathVariable UUID orderId,
                                           Authentication auth) {
        log.info("op=getTimeline actor={} orderId={}", actor(auth), orderId);
        List<TimelineEvent> events = svc.timelineForOrder(orderId);
        log.info("op=getTimeline actor={} orderId={} eventCount={} outcome=ok",
            actor(auth), orderId, events.size());
        return events;
    }

    private static String actor(Authentication auth) {
        return (auth != null) ? auth.getName() : "anonymous";
    }
}
