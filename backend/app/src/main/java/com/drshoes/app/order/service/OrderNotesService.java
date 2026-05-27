package com.drshoes.app.order.service;

import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.storage.domain.StorageLocationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Service
@Slf4j
@RequiredArgsConstructor
public class OrderNotesService {

    private final OrderRepository orders;
    private final StorageLocationRepository locations;

    public record Result(String oldLocation, String newLocation, String note) {}

    @Transactional
    public Result addNote(UUID orderId, String rawNote, String rawLocation) {
        String note = trimOrNull(rawNote);
        String newLoc = trimOrNull(rawLocation);

        if (note == null && newLoc == null) {
            throw new NoteValidationException("at_least_one_required",
                "either note or location must be provided");
        }

        Order o = orders.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));

        String oldLoc = o.getLocation();
        boolean locationActuallyChanged = newLoc != null && !newLoc.equals(oldLoc);

        if (newLoc != null && !locationActuallyChanged && note == null) {
            throw new NoteValidationException("no_op_change",
                "location equals current and no note provided");
        }
        if (newLoc != null && locationActuallyChanged
                && !locations.existsByNameAndActiveTrue(newLoc)) {
            throw new UnknownLocationException(newLoc);
        }

        if (locationActuallyChanged) {
            o.setLocation(newLoc);
            orders.save(o);
        }

        log.info("op=order.addNote orderId={} hasNote={} locationChanged={} from={} to={} outcome=ok",
            orderId, note != null, locationActuallyChanged, oldLoc, newLoc);

        return new Result(
            locationActuallyChanged ? oldLoc : null,
            locationActuallyChanged ? newLoc : null,
            note
        );
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    public static class NoteValidationException extends RuntimeException {
        public final String code;
        public NoteValidationException(String code, String msg) { super(msg); this.code = code; }
    }

    public static class UnknownLocationException extends RuntimeException {
        public UnknownLocationException(String name) {
            super("storage_location not active or unknown: " + name);
        }
    }

    public static class OrderNotFoundException extends RuntimeException {
        public OrderNotFoundException(UUID id) { super("order not found: " + id); }
    }
}
