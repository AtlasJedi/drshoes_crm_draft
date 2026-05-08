package com.drshoes.app.order.dto;

public record ChangeStatusResponse(
    OrderDto order,
    TriggerSuggestion triggerSuggestion
) {}
