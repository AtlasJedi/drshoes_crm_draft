package com.drshoes.app.order.api;

import com.drshoes.app.order.OrderNotFoundException;
import com.drshoes.app.order.OrderService;
import com.drshoes.app.order.OrderVersionConflictException;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.dto.BulkStatusRequestDto;
import com.drshoes.app.order.dto.BulkStatusResponseDto;
import com.drshoes.app.order.dto.BulkStatusResponseDto.FailedItem;
import com.drshoes.app.order.dto.BulkStatusResponseDto.SucceededItem;
import com.drshoes.app.order.dto.ChangeStatusRequest;
import com.drshoes.app.order.dto.ChangeStatusResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@RestController
@RequestMapping("/api/admin/orders")
@Slf4j
@RequiredArgsConstructor
public class BulkStatusController {
    private static final int MAX_IDS = 100;

    private final OrderService orderService;
    private final OrderRepository orderRepo;

    @PostMapping("/bulk/status")
    public BulkStatusResponseDto bulkStatus(@Valid @RequestBody BulkStatusRequestDto req,
                                            Authentication auth) {
        if (req.orderIds().size() > MAX_IDS) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                "Bulk status accepts at most " + MAX_IDS + " order IDs per request");
        }

        List<SucceededItem> succeeded = new ArrayList<>();
        List<FailedItem> failed = new ArrayList<>();

        for (UUID orderId : req.orderIds()) {
            Optional<Order> maybeOrder =
                orderRepo.findById(orderId).filter(o -> o.getDeletedAt() == null);

            if (maybeOrder.isEmpty()) {
                failed.add(new FailedItem(orderId, null, null, "NOT_FOUND"));
                log.info("op=bulkStatusChange orderId={} error=NOT_FOUND outcome=skipped", orderId);
                continue;
            }

            Order order = maybeOrder.get();
            OrderStatus fromStatus = order.getStatus();

            try {
                ChangeStatusRequest singleReq = new ChangeStatusRequest(
                    req.newStatus(),
                    order.getVersion(),
                    req.sendTriggers(),
                    null
                );
                ChangeStatusResponse resp = orderService.changeStatus(orderId, singleReq);
                succeeded.add(new SucceededItem(orderId, resp.order().code(), fromStatus, req.newStatus()));
            } catch (OrderVersionConflictException e) {
                failed.add(new FailedItem(orderId, order.getCode(), fromStatus, "VERSION_CONFLICT"));
                log.info("op=bulkStatusChange orderId={} error=VERSION_CONFLICT outcome=skipped", orderId);
            } catch (IllegalStateException e) {
                failed.add(new FailedItem(orderId, order.getCode(), fromStatus, "ILLEGAL_TRANSITION"));
                log.info("op=bulkStatusChange orderId={} error=ILLEGAL_TRANSITION outcome=skipped", orderId);
            } catch (Exception e) {
                failed.add(new FailedItem(orderId, order.getCode(), fromStatus, "UNKNOWN"));
                log.warn("op=bulkStatusChange orderId={} error={} outcome=unknown-failure",
                    orderId, e.getMessage());
            }
        }

        log.info("op=bulkStatusChange actor={} count={} succeeded={} failed={} outcome=ok",
            auth != null ? auth.getName() : "anonymous",
            req.orderIds().size(), succeeded.size(), failed.size());

        return new BulkStatusResponseDto(succeeded, failed);
    }
}
