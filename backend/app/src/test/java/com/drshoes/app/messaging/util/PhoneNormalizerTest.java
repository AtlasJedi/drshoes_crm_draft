package com.drshoes.app.messaging.util;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class PhoneNormalizerTest {

    @Test
    void plusSpaceFormat() {
        assertThat(PhoneNormalizer.normalize("+48 506 220 119")).isEqualTo("+48506220119");
    }

    @Test
    void plusNoSpace() {
        assertThat(PhoneNormalizer.normalize("+48506220119")).isEqualTo("+48506220119");
    }

    @Test
    void countryCodeBare() {
        assertThat(PhoneNormalizer.normalize("48506220119")).isEqualTo("+48506220119");
    }

    @Test
    void doubleZeroPrefix() {
        assertThat(PhoneNormalizer.normalize("00 48 506 220 119")).isEqualTo("+48506220119");
    }

    @Test
    void nineDigitsPolish() {
        assertThat(PhoneNormalizer.normalize("506 220 119")).isEqualTo("+48506220119");
    }

    @Test
    void parensAndDashes() {
        assertThat(PhoneNormalizer.normalize("(506) 220-119")).isEqualTo("+48506220119");
    }

    @Test
    void emptyString() {
        assertThat(PhoneNormalizer.normalize("")).isNull();
    }

    @Test
    void nullInput() {
        assertThat(PhoneNormalizer.normalize(null)).isNull();
    }
}
