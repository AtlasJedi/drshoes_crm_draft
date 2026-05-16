package com.drshoes.lib.email.postmark;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.storage.NoOpBlobStorage;
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
 * WireMock integration test for PostmarkEmailGateway.
 *
 * No Spring context — gateway is wired manually against WireMock's dynamic port.
 * Uses SimpleClientHttpRequestFactory (HTTP/1.1) to ensure compatibility with
 * WireMock's Jetty server which does not negotiate HTTP/2 in standalone mode.
 * Six cases: 200 success, 200 inline error, 422, 500, retry-then-success,
 * double network fault.
 */
class PostmarkEmailGatewayIntegrationTest {

    @RegisterExtension
    static WireMockExtension wm = WireMockExtension.newInstance()
            .options(WireMockConfiguration.wireMockConfig().dynamicPort())
            .build();

    private PostmarkEmailGateway gateway;

    @BeforeEach
    void setUp() {
        PostmarkProperties props = new PostmarkProperties();
        props.setServerToken("test-token");
        props.setFrom("noreply@drshoes.pl");
        props.setMessageStream("outbound");
        props.setApiBaseUrl(wm.getRuntimeInfo().getHttpBaseUrl());
        props.setTimeoutSeconds(5);

        // Use SimpleClientHttpRequestFactory (HTTP/1.1) so WireMock can handle requests;
        // the JDK default HttpClient prefers HTTP/2 which WireMock standalone does not support.
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(5_000);

        RestClient restClient = RestClient.builder()
                .baseUrl(wm.getRuntimeInfo().getHttpBaseUrl())
                .requestFactory(factory)
                .build();

        var blobStorage = new NoOpBlobStorage();
        gateway = new PostmarkEmailGateway(restClient, props, blobStorage);
    }

    // ── Test 1: 200 success ────────────────────────────────────────────────
    @Test
    void send_200Success_returnsAccepted() {
        wm.stubFor(post(urlEqualTo("/email"))
                .willReturn(aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("""
                                {"ErrorCode":0,"Message":"OK",
                                 "MessageID":"msg-001","SubmittedAt":"2026-05-09T10:00:00Z",
                                 "To":"jan@example.com"}
                                """)));

        OutboundMessage msg = OutboundMessage.of(
                Channel.EMAIL, "jan@example.com", "Test", "Hello.", List.of(), "idem-test-1");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(receipt.providerMessageId()).isEqualTo("msg-001");
        wm.verify(1, postRequestedFor(urlEqualTo("/email"))
                .withHeader("X-Postmark-Server-Token", equalTo("test-token")));
    }

    // ── Test 2: 200 + inline error ─────────────────────────────────────────
    @Test
    void send_200InlineError_returnsFailedWithPostmarkCode() {
        wm.stubFor(post(urlEqualTo("/email"))
                .willReturn(aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("""
                                {"ErrorCode":10,"Message":"Invalid email address."}
                                """)));

        OutboundMessage msg = OutboundMessage.of(
                Channel.EMAIL, "bad@example.com", "Test", "Hello.", List.of(), "idem-test-2");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("POSTMARK-10");
        assertThat(receipt.errorMessage()).isEqualTo("Invalid email address.");
    }

    // ── Test 3: 422 Unprocessable — no retry attempted ────────────────────
    @Test
    void send_422UnprocessableEntity_returnsFailedNoRetry() {
        wm.stubFor(post(urlEqualTo("/email"))
                .willReturn(aResponse()
                        .withStatus(422)
                        .withBody("{}")));

        OutboundMessage msg = OutboundMessage.of(
                Channel.EMAIL, "jan@example.com", "Test", "Hello.", List.of(), "idem-test-3");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("HTTP-422");
        // exactly one call — no retry on 4xx
        wm.verify(1, postRequestedFor(urlEqualTo("/email")));
    }

    // ── Test 4: 500 Server Error — no retry attempted ─────────────────────
    @Test
    void send_500ServerError_returnsFailedNoRetry() {
        wm.stubFor(post(urlEqualTo("/email"))
                .willReturn(aResponse()
                        .withStatus(500)
                        .withBody("Internal Server Error")));

        OutboundMessage msg = OutboundMessage.of(
                Channel.EMAIL, "jan@example.com", "Test", "Hello.", List.of(), "idem-test-4");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("HTTP-500");
        // exactly one call — no retry on 5xx
        wm.verify(1, postRequestedFor(urlEqualTo("/email")));
    }

    // ── Test 5: CONNECTION_RESET_BY_PEER — retry succeeds ─────────────────
    @Test
    void send_networkFaultThenSuccess_retriesAndReturnsAccepted() {
        wm.stubFor(post(urlEqualTo("/email"))
                .inScenario("retry")
                .whenScenarioStateIs(STARTED)
                .willReturn(aResponse()
                        .withFault(com.github.tomakehurst.wiremock.http.Fault.CONNECTION_RESET_BY_PEER))
                .willSetStateTo("attempt-2"));

        wm.stubFor(post(urlEqualTo("/email"))
                .inScenario("retry")
                .whenScenarioStateIs("attempt-2")
                .willReturn(aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("""
                                {"ErrorCode":0,"Message":"OK","MessageID":"msg-retry-ok",
                                 "SubmittedAt":"2026-05-09T10:00:01Z","To":"jan@example.com"}
                                """)));

        OutboundMessage msg = OutboundMessage.of(
                Channel.EMAIL, "jan@example.com", "Retry Test", "Hello.", List.of(), "idem-test-5");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(receipt.providerMessageId()).isEqualTo("msg-retry-ok");
        wm.verify(2, postRequestedFor(urlEqualTo("/email")));
    }

    // ── Test 6: both attempts fail with reset ──────────────────────────────
    @Test
    void send_bothAttemptsNetworkFault_returnsFailedNetwork() {
        wm.stubFor(post(urlEqualTo("/email"))
                .willReturn(aResponse()
                        .withFault(com.github.tomakehurst.wiremock.http.Fault.CONNECTION_RESET_BY_PEER)));

        OutboundMessage msg = OutboundMessage.of(
                Channel.EMAIL, "jan@example.com", "Retry Test", "Hello.", List.of(), "idem-test-6");

        DeliveryReceipt receipt = gateway.send(msg);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("NETWORK");
        wm.verify(2, postRequestedFor(urlEqualTo("/email")));
    }
}
