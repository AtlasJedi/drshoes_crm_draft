package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.OutboundMessage;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import com.github.tomakehurst.wiremock.junit5.WireMockExtension;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.util.List;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static com.github.tomakehurst.wiremock.stubbing.Scenario.STARTED;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * WireMock integration test for SmsApiSmsGateway.
 *
 * Uses WireMock JUnit5 extension; no Spring context needed.
 * Gateway wired manually with RestClient pointing at WireMock's dynamic port.
 * SimpleClientHttpRequestFactory forces HTTP/1.1 — WireMock standalone (Jetty)
 * does not support HTTP/2 (same pattern as PostmarkEmailGatewayIT).
 *
 * Carry-forward #2: file named *IntegrationTest.java (not *IT.java) so Surefire picks it up.
 */
class SmsApiSmsGatewayIntegrationTest {

    @RegisterExtension
    static WireMockExtension wm = WireMockExtension.newInstance()
            .options(WireMockConfiguration.wireMockConfig().dynamicPort())
            .build();

    private SmsApiSmsGateway gateway;

    @BeforeEach
    void setUp() {
        SmsApiProperties props = new SmsApiProperties();
        props.setToken("test-smsapi-token");
        props.setFrom("DrShoes");
        props.setApiBaseUrl(wm.getRuntimeInfo().getHttpBaseUrl());
        props.setTimeoutSeconds(5);

        // Force HTTP/1.1: WireMock standalone (Jetty 11) does not support HTTP/2.
        // Same fix as PostmarkEmailGatewayIT (4-4 dispatch log, decision #6).
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(5_000);

        RestClient restClient = RestClient.builder()
                .requestFactory(factory)
                .baseUrl(wm.getRuntimeInfo().getHttpBaseUrl())
                .build();

        gateway = new SmsApiSmsGateway(restClient, props);
    }

    // ── Test 1: 200 success ────────────────────────────────────────────────

    @Test
    void send_200Success_returnsAccepted() {
        wm.stubFor(post(urlEqualTo("/sms.do"))
                .willReturn(aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("""
                                {"list":[{"id":"sms-001","status":"QUEUE",
                                          "number":"+48600100200","date_sent":1715250000,
                                          "submitted_number":"+48600100200",
                                          "points":0.160,"encoding":"utf-8",
                                          "idx":"idem-sms-test-1"}],
                                 "count":1}
                                """)));

        OutboundMessage msg = new OutboundMessage(
                Channel.SMS, "+48600100200", null,
                "Twoje buty są gotowe.", List.of(), "idem-sms-test-1");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(receipt.providerMessageId()).isEqualTo("sms-001");
        // Carry-forward #3: check_idx=1 must appear alongside idx when idempotencyKey is present
        wm.verify(1, postRequestedFor(urlEqualTo("/sms.do"))
                .withHeader("Authorization", equalTo("Bearer test-smsapi-token"))
                .withHeader("Content-Type", containing("application/json"))
                .withRequestBody(containing("\"check_idx\":1"))
                .withRequestBody(containing("\"idx\":\"idem-sms-test-1\"")));
    }

    // ── Test 2: 200 inline error envelope ─────────────────────────────────

    @Test
    void send_200ErrorEnvelope_returnsFailedWithSmsApiCode() {
        wm.stubFor(post(urlEqualTo("/sms.do"))
                .willReturn(aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("""
                                {"error":13,"message":"Wrong phone number"}
                                """)));

        OutboundMessage msg = new OutboundMessage(
                Channel.SMS, "bad-phone1", null,
                "Test.", List.of(), "idem-sms-test-2");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("SMSAPI-13");
        assertThat(receipt.errorMessage()).isEqualTo("Wrong phone number");
    }

    // ── Test 3: 400 Bad Request → no retry, FAILED with HTTP-400 ──────────

    @Test
    void send_400BadRequest_returnsFailedNoRetry() {
        wm.stubFor(post(urlEqualTo("/sms.do"))
                .willReturn(aResponse()
                        .withStatus(400)
                        .withHeader("Content-Type", "text/plain")
                        .withBody("Bad Request")));

        OutboundMessage msg = new OutboundMessage(
                Channel.SMS, "+48600100300", null,
                "Test 400.", List.of(), "idem-sms-test-3");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("HTTP-400");
        // No retry: exactly 1 request made
        wm.verify(1, postRequestedFor(urlEqualTo("/sms.do")));
    }

    // ── Test 4: network fault then success → retries ───────────────────────

    @Test
    void send_networkFaultThenSuccess_retriesAndReturnsAccepted() {
        wm.stubFor(post(urlEqualTo("/sms.do"))
                .inScenario("sms-retry")
                .whenScenarioStateIs(STARTED)
                .willReturn(aResponse()
                        .withFault(com.github.tomakehurst.wiremock.http.Fault.CONNECTION_RESET_BY_PEER))
                .willSetStateTo("attempt-2"));

        wm.stubFor(post(urlEqualTo("/sms.do"))
                .inScenario("sms-retry")
                .whenScenarioStateIs("attempt-2")
                .willReturn(aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("""
                                {"list":[{"id":"sms-retry-ok","status":"QUEUE",
                                          "number":"+48600100200","date_sent":1715250001,
                                          "submitted_number":"+48600100200",
                                          "points":0.160,"encoding":"utf-8",
                                          "idx":"idem-sms-test-4"}],
                                 "count":1}
                                """)));

        OutboundMessage msg = new OutboundMessage(
                Channel.SMS, "+48600100200", null,
                "Retry test.", List.of(), "idem-sms-test-4");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(receipt.providerMessageId()).isEqualTo("sms-retry-ok");
        wm.verify(2, postRequestedFor(urlEqualTo("/sms.do")));
    }
}
