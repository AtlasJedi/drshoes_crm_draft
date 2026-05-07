package com.drshoes.lib.messaging;

public interface MessageGateway {
    Channel channel();
    DeliveryReceipt send(OutboundMessage message);
}
