package com.drshoes.app.webhooks;

import com.drshoes.app.messaging.dto.SmsApiInboundPayload;
import com.drshoes.app.messaging.service.InboundMessageService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
@RestController
@RequestMapping("/api/webhooks/smsapi/inbound")
@Slf4j
public class SmsApiInboundController {

    private final InboundMessageService inboundService;
    private final Set<String>           allowlist;

    public SmsApiInboundController(
            InboundMessageService inboundService,
            @Value("${messaging.sms.smsapi.allowlist:198.18.0.1,198.18.0.2,198.18.0.3,198.18.0.4,198.18.0.5}")
            String allowlistCsv) {
        this.inboundService = inboundService;
        this.allowlist      = Set.of(allowlistCsv.split(","));
    }

    public record InboundResponse(UUID messageId, UUID threadId, boolean duplicate) {}

    @PostMapping(consumes = "application/x-www-form-urlencoded")
    public ResponseEntity<InboundResponse> receive(
            @RequestParam("sms_id")                           String smsId,
            @RequestParam("sms_from")                         String smsFrom,
            @RequestParam(value = "sms_to", required = false) String smsTo,
            @RequestParam("sms_text")                         String smsText,
            @RequestParam("sms_date")                         long   smsDate,
            HttpServletRequest req) {

        String ip = req.getHeader("Cf-Connecting-Ip");
        if (ip == null || !allowlist.contains(ip)) {
            log.warn("op=inbound.sms.received outcome=ip-rejected ip={}", ip);
            return ResponseEntity.status(403).build();
        }

        log.info("op=inbound.sms.received smsId={}", smsId);
        var payload = new SmsApiInboundPayload(smsId, smsFrom, smsTo, smsText, smsDate);
        try {
            var result = inboundService.recordSmsInbound(payload);
            log.info("op=inbound.sms.handled outcome=ok threadId={} duplicate={}",
                    result.threadId(), result.duplicate());
            return ResponseEntity.ok(
                new InboundResponse(result.messageId(), result.threadId(), result.duplicate()));
        } catch (DataAccessException ex) {
            log.info("op=inbound.sms.handled outcome=duplicate reason=race_constraint smsId={}", smsId);
            return ResponseEntity.ok(new InboundResponse(null, null, true));
        }
    }
}
