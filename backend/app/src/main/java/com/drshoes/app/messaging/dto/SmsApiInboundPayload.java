package com.drshoes.app.messaging.dto;

/**
 * Form-encoded MO (mobile-originated) payload from SMSAPI inbound callback.
 *
 * Field names match the SMSAPI MO webhook specification (application/x-www-form-urlencoded):
 *   sms_id   — unique ID for the inbound SMS (used as provider_message_id / dedup key)
 *   sms_from — sender phone number (may include country prefix, spaces, or leading zeros)
 *   sms_to   — virtual number that received the SMS (optional — absent on some routes)
 *   sms_text — message body
 *   sms_date — Unix epoch seconds, when SMSAPI received the message
 *
 * Verify field names against SMSAPI MO webhook documentation at implementation time.
 * If SMSAPI uses different names (e.g. "MsgId" or "from" without prefix), update
 * both this record and the @RequestParam bindings in SmsApiInboundController.
 */
public record SmsApiInboundPayload(
    String smsId,
    String smsFrom,
    String smsTo,
    String smsText,
    long   smsDate
) {}
