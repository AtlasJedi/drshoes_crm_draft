package com.drshoes.app.messaging.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Size;
public record PostmarkInboundPayload(
    @JsonProperty("MessageID")         @Size(max = 120) String messageId,
    @JsonProperty("From")              String from,
    @JsonProperty("FromName")          String fromName,
    @JsonProperty("To")                String to,
    @JsonProperty("Subject")           String subject,
    @JsonProperty("TextBody")          String textBody,
    @JsonProperty("StrippedTextReply") String strippedTextReply,
    @JsonProperty("Date")              String date
) {}
