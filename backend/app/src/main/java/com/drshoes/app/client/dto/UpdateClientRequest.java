package com.drshoes.app.client.dto;

import jakarta.validation.constraints.Size;

/**
 * Partial-update request for a Client.
 *
 * preferredChannel: when non-null, must be one of EMAIL|SMS|WHATSAPP.
 *   Validated in ClientService.update (not via Jakarta constraint) so the
 *   error message is domain-meaningful.
 * rodoConsent: tri-state Boolean — true=grant, false=revoke, null=no change.
 */
public record UpdateClientRequest(
    @Size(max = 80) String firstName,
    @Size(max = 80) String lastName,
    @Size(max = 40) String phone,
    @Size(max = 120) String email,
    String preferredChannel,
    Boolean rodoConsent,
    @Size(max = 2000) String notes
) {}
